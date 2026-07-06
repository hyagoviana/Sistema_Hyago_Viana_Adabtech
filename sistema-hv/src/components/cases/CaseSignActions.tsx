import { Check, ExternalLink, FileSignature, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGenerateContrato, useGenerateProcuracao } from "@/hooks/useCases";
import {
  useCaseDocuments,
  useFinalizeCaseDocument,
  useSendCaseDocumentToZapsign,
} from "@/hooks/useCaseDocuments";
import { useDocumentTemplates, useTemplatePlaceholders } from "@/hooks/useDocumentTemplates";
import {
  type AutoFillData,
  type TemplateField,
  resolveAutoValue,
} from "@/lib/cases/document-autofill";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";

type Kind = "procuracao" | "contrato";

// S9-12 — Documento COMBINADO (decisão do owner 2026-07-06): cada modelo
// "Contrato e procuração - [serviço]" traz procuração + contrato numa assinatura
// só. É 1 documento por caso. Fluxo: cadastro (LEAD) → envia o combinado → entra
// no Comercial (aguardando assinatura, ainda LEAD) → assinou → CLIENTE.
//
// NÃO existe procuração pura nem contrato puro separados. Por isso a UI expõe um
// ÚNICO botão ("Enviar contrato e procuração") que envia o combinado como
// doc_kind='contrato' (o gatilho operacional S9-04/S9-05 vira CLIENTE ao assinar).
//
// O botão "Enviar procuração" (procuração pura) fica ESCONDIDO atrás deste flag —
// o backend (registrarProcuracaoAssinada / generateProcuracaoFromTemplate) segue
// INTACTO caso o owner queira reativar procuração pura no futuro.
const SEPARATE_PROCURACAO = false;

// S9-09/S9-12 — ação de assinatura no detalhe do caso. Reusa a máquina de
// geração/finalização/envio já existente (aba Documentos): escolher modelo →
// revisar campos → gerar (idempotente) → finalizar (PDF na pasta) → enviar ao
// ZapSign. O envio carimba `aguardando_assinatura_at` (entra no Comercial); o
// efeito de lifecycle (→ CLIENTE) vem do webhook (S9-05), nunca do envio.
export function CaseSignActions({
  caseId,
  clientId,
  caseType,
  clientName,
  clientCpf,
  municipio,
  autoFillExtra,
}: {
  caseId: string;
  clientId: string;
  caseType: string;
  clientName?: string;
  clientCpf?: string;
  municipio?: string;
  autoFillExtra?: Omit<AutoFillData, "clientName" | "clientCpf" | "municipio">;
  /**
   * S9-12 — mantido por compat (callers passam), mas NÃO é mais usado: o modelo
   * combinado substituiu a procuração pura, então não há mais aviso de "procuração
   * ainda não assinada". Aceito e ignorado.
   */
  procuracaoAssinada?: boolean;
}) {
  const [openKind, setOpenKind] = useState<Kind | null>(null);

  return (
    <>
      {/* S9-12 — botão principal: envia o documento COMBINADO (contrato +
          procuração numa assinatura só). Ao enviar, o caso entra no Comercial
          (aguardando assinatura); ao assinar, vira CLIENTE. */}
      <Button variant="outline" size="sm" onClick={() => setOpenKind("contrato")}>
        <Send size={14} className="mr-1.5" /> Enviar contrato e procuração
      </Button>
      {/* Procuração PURA — desativada (não há doc de procuração separado). O flag
          reexibe caso o owner reative procuração pura. */}
      {SEPARATE_PROCURACAO && (
        <Button variant="outline" size="sm" onClick={() => setOpenKind("procuracao")}>
          <FileSignature size={14} className="mr-1.5" /> Enviar procuração
        </Button>
      )}

      <SendFlowDialog
        kind={openKind}
        onClose={() => setOpenKind(null)}
        caseId={caseId}
        clientId={clientId}
        caseType={caseType}
        autoFill={{ clientName, clientCpf, municipio, ...autoFillExtra }}
        defaultSignerName={clientName}
        defaultSignerEmail={autoFillExtra?.email}
      />
    </>
  );
}

type Step = "pick" | "send";

function SendFlowDialog({
  kind,
  onClose,
  caseId,
  clientId,
  caseType,
  autoFill,
  defaultSignerName,
  defaultSignerEmail,
}: {
  kind: Kind | null;
  onClose: () => void;
  caseId: string;
  clientId: string;
  caseType: string;
  autoFill: AutoFillData;
  defaultSignerName?: string;
  defaultSignerEmail?: string;
}) {
  const open = kind !== null;
  const isContrato = kind === "contrato";

  const { data: templates } = useDocumentTemplates(caseType);
  const { data: docs } = useCaseDocuments(caseId);
  const generateProcuracao = useGenerateProcuracao(caseId);
  const generateContrato = useGenerateContrato(caseId);
  const finalize = useFinalizeCaseDocument(caseId);
  const sendZap = useSendCaseDocumentToZapsign(caseId);

  const [step, setStep] = useState<Step>("pick");
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState<string | null>(null);

  // Signer (step "send").
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [autoEmail, setAutoEmail] = useState(true);

  // Reset ao abrir/trocar de tipo.
  useEffect(() => {
    if (open) {
      setStep("pick");
      setTemplateId("");
      setValues({});
      setDocId(null);
      setEditUrl(null);
      setSignerName(defaultSignerName ?? "");
      setSignerEmail(defaultSignerEmail ?? "");
      setAutoEmail(true);
    }
  }, [open, kind, defaultSignerName, defaultSignerEmail]);

  const selected = (templates ?? []).find((t) => t.id === templateId);
  const { data: livePlaceholders, isLoading: loadingFields } = useTemplatePlaceholders(
    (selected as { google_doc_id?: string })?.google_doc_id ?? null,
  );

  const fields = useMemo<TemplateField[]>(() => {
    if (livePlaceholders?.length) return livePlaceholders as TemplateField[];
    return (((selected as { fields?: unknown })?.fields as TemplateField[]) ?? []).filter(
      (f) => f.source !== "blank",
    );
  }, [livePlaceholders, selected]);

  const fieldsKey = fields.map((f) => f.key).join(",");
  useMemo(() => {
    if (!fields.length) return;
    const pre: Record<string, string> = {};
    for (const f of fields) {
      const val = resolveAutoValue(f, autoFill);
      if (val) pre[f.key] = val;
    }
    setValues(pre);
  }, [fieldsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function extractDoc(res: unknown): { id: string; status?: string; editUrl?: string } | null {
    if (!res || typeof res !== "object") return null;
    const r = res as { id?: string; doc?: { id: string; status?: string }; editUrl?: string };
    if (r.doc?.id) return { id: r.doc.id, status: r.doc.status, editUrl: r.editUrl };
    if (r.id) return { id: r.id };
    return null;
  }

  // Gera (idempotente) o doc do tipo escolhido, garante que esteja FINALIZADO e
  // avança para a etapa de envio ao ZapSign.
  async function handleGenerateAndFinalize() {
    if (!templateId) {
      toast.error("Escolha um modelo.");
      return;
    }
    const faltando = fields.filter((f) => f.required && !String(values[f.key] ?? "").trim());
    if (faltando.length) {
      toast.error(`Preencha: ${faltando.map((f) => f.label).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      // 1) Gera o doc idempotente por doc_kind. Documento COMBINADO (S9-12) via
      // generateContrato (doc_kind='contrato'): o modelo escolhido é o "Contrato e
      // procuração - [serviço]"; envia os `values` revisados. O envio ao ZapSign
      // carimba aguardando_assinatura_at (entra no Comercial); ao assinar, vira
      // CLIENTE (S9-05). Procuração pura (flag off) segue via generateProcuracao.
      let created;
      if (isContrato) {
        created = extractDoc(
          await generateContrato.mutateAsync({
            case_id: caseId,
            client_id: clientId,
            template_id: templateId,
            values,
          }),
        );
      } else {
        created = extractDoc(
          await generateProcuracao.mutateAsync({
            case_id: caseId,
            client_id: clientId,
            template_id: templateId,
            values,
          }),
        );
      }
      if (!created) throw new Error("Falha ao gerar o documento.");

      // 2) Descobre o status atual (o generate pode ter sido idempotente). Prioriza
      // o status retornado; senão, o da lista de documentos do caso.
      const fresh = (docs ?? []).find((d) => d.id === created.id);
      const status = created.status ?? fresh?.status;
      if (created.editUrl) setEditUrl(created.editUrl);

      // 3) Finaliza se ainda estiver em edição (pré-requisito do envio ao ZapSign).
      // FINALIZADO/ENVIADO/ASSINADO → pula. Status desconhecido (idempotente sem
      // entrada na lista) → tenta finalizar e tolera "já finalizado".
      const isReadyOrSent =
        status === "FINALIZADO" || status === "ENVIADO_ZAPSIGN" || status === "ASSINADO";
      if (!isReadyOrSent) {
        try {
          await finalize.mutateAsync(created.id);
        } catch (err) {
          // Se o status era desconhecido, o doc pode já estar finalizado — segue.
          if (status) throw err;
          void err;
        }
      }

      setDocId(created.id);
      setStep("send");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao preparar o documento.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!docId) return;
    if (!signerName.trim()) {
      toast.error("Informe o nome do signatário.");
      return;
    }
    setBusy(true);
    try {
      const res = await sendZap.mutateAsync({
        docId,
        signers: [
          {
            name: signerName.trim(),
            email: signerEmail.trim() || undefined,
            authMode: "assinaturaTela-tokenEmail",
            sendAutomaticEmail: autoEmail,
          },
        ],
      });
      toast.success(
        `${isContrato ? "Contrato e procuração" : "Procuração"} enviado ao ZapSign${
          (res as { signUrl?: string })?.signUrl ? " — link gerado" : ""
        }`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }

  const title = isContrato ? "Enviar contrato e procuração" : "Enviar procuração";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? isContrato
                ? "Escolha o modelo (Contrato e procuração - [serviço]). Ao enviar, o caso entra no Comercial; ao assinar, vira CLIENTE."
                : "Escolha o modelo de procuração. Ao enviar, o caso entra no comercial."
              : "Confirme o signatário e envie para assinatura."}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <div className="space-y-4">
            <div>
              <Label>
                {isContrato ? "Modelo (contrato e procuração)" : "Modelo de procuração"}
              </Label>
              {(templates ?? []).length === 0 ? (
                <div className="mt-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-muted-foreground">
                  Nenhum modelo sincronizado. Sincronize os modelos na aba Documentos.
                </div>
              ) : (
                <Command className="mt-1 rounded-md border border-[var(--border)]">
                  <CommandInput placeholder="Buscar pelo nome (ex.: covid, contrato)…" />
                  <CommandList className="max-h-56">
                    <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {(templates ?? []).map((t) => (
                        <CommandItem
                          key={t.id}
                          value={t.name}
                          onSelect={() => {
                            setTemplateId(t.id);
                            setValues({});
                          }}
                        >
                          <Check
                            className={
                              templateId === t.id
                                ? "mr-2 h-4 w-4 opacity-100"
                                : "mr-2 h-4 w-4 opacity-0"
                            }
                          />
                          {t.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
              {selected && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Selecionado:{" "}
                  <span className="font-medium text-[var(--navy)]">{selected.name}</span>
                </p>
              )}
            </div>

            {loadingFields && templateId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 size={14} className="animate-spin" /> Lendo campos do modelo…
              </div>
            )}

            {fields.map((f) => {
              const isDoc = isCpfCnpjField(f.key, f.label);
              const hasValue = !!String(values[f.key] ?? "").trim();
              const autoFilled = hasValue && f.source === "auto";
              return (
                <div key={f.key}>
                  <Label className="flex items-center gap-1.5">
                    <span>{f.label}</span>
                    {f.required && <span className="text-destructive">*</span>}
                    {autoFilled && <span className="text-emerald-600 text-xs">(preenchido)</span>}
                  </Label>
                  <Input
                    value={values[f.key] ?? ""}
                    inputMode={isDoc ? "numeric" : undefined}
                    maxLength={isDoc ? 18 : undefined}
                    onChange={(e) =>
                      setValues((s) => ({
                        ...s,
                        [f.key]: isDoc ? formatCpfCnpj(e.target.value) : e.target.value,
                      }))
                    }
                    placeholder={isDoc ? "000.000.000-00" : f.key}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {editUrl && (
              <a
                href={editUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--gold-700)] hover:underline text-sm inline-flex items-center gap-1"
              >
                <ExternalLink size={13} /> Revisar o documento gerado (abre no Google Docs)
              </a>
            )}
            <div>
              <Label>Nome do signatário *</Label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                type="email"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={autoEmail} onCheckedChange={(v) => setAutoEmail(!!v)} />
              ZapSign envia o link por e-mail automaticamente
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {step === "pick" ? (
            <Button
              disabled={!templateId || busy || loadingFields}
              onClick={handleGenerateAndFinalize}
            >
              {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
              Gerar e revisar
            </Button>
          ) : (
            <Button disabled={busy || !signerName.trim()} onClick={handleSend}>
              {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
              Enviar para assinatura
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
