import {
  Download,
  Edit3,
  ExternalLink,
  FileSignature,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCaseDocuments,
  useDeleteCaseDocument,
  useDownloadCaseDocument,
  useFinalizeCaseDocument,
  useGenerateCaseDocument,
  useReopenCaseDocument,
  useSendCaseDocumentToZapsign,
} from "@/hooks/useCaseDocuments";
import { useDocumentTemplates, useSyncDocumentTemplates, useTemplatePlaceholders } from "@/hooks/useDocumentTemplates";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";

type TemplateField = {
  key: string;
  label: string;
  source: "auto" | "manual" | "blank";
  required?: boolean;
  auto_field?: string;
};

/** Map auto_field values to client/case data for pre-filling */
type AutoFillData = {
  clientName?: string;
  clientCpf?: string;
  municipio?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  crm_numero?: string;
  crm_uf?: string;
  oab_numero?: string;
  oab_uf?: string;
  especialidade?: string;
  vinculo_institucional?: string;
  caseCode?: string;
  responsavel?: string;
};

function editUrl(googleDocId: string): string {
  // rm=embedded mantém toolbar completa (cores, fontes, formatação) dentro do iframe
  return `https://docs.google.com/document/d/${googleDocId}/edit?rm=embedded`;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  EM_EDICAO: { label: "Em edição", cls: "bg-amber-100 text-amber-800" },
  FINALIZADO: { label: "Finalizado", cls: "bg-[var(--navy)] text-white" },
  ENVIADO_ZAPSIGN: { label: "Aguardando assinatura", cls: "bg-[var(--gold-700)] text-white" },
  ASSINADO: { label: "Assinado", cls: "bg-green-600 text-white" },
  CANCELADO: { label: "Cancelado", cls: "bg-muted text-muted-foreground line-through" },
};

export function CaseDocumentsTab({ caseId, caseType, clientName, clientCpf, municipio, autoFillExtra }: { caseId: string; caseType: string; clientName?: string; clientCpf?: string; municipio?: string; autoFillExtra?: Omit<AutoFillData, 'clientName' | 'clientCpf' | 'municipio'> }) {
  const { data: docs, isLoading } = useCaseDocuments(caseId);
  const { data: templates } = useDocumentTemplates(caseType);
  const generate = useGenerateCaseDocument(caseId);
  const finalize = useFinalizeCaseDocument(caseId);
  const reopen = useReopenCaseDocument(caseId);
  const download = useDownloadCaseDocument();
  const sendZap = useSendCaseDocumentToZapsign(caseId);
  const del = useDeleteCaseDocument(caseId);
  const sync = useSyncDocumentTemplates();

  const [genOpen, setGenOpen] = useState(false);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [sendFor, setSendFor] = useState<{ id: string; title: string } | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[24px] font-semibold text-[var(--navy)]">Documentos</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={sync.isPending}
            onClick={async () => {
              try {
                const res = await sync.mutateAsync(undefined);
                toast.success(
                  `Sync: ${res.foldersScanned} pastas, ${res.filesFound} docs → ${res.created} novos, ${res.updated} atualizados, ${res.skipped} já existiam` +
                    (res.errors.length ? ` | ${res.errors.length} erros` : ""),
                );
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Falha ao sincronizar");
              }
            }}
          >
            <RefreshCw size={14} className={`mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
            Sincronizar modelos
          </Button>
          <Button size="sm" onClick={() => setGenOpen(true)}>
            <Plus size={14} className="mr-1.5" /> Gerar documento
          </Button>
        </div>
      </div>

      <div className="card-editorial !p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>
        ) : (docs ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic text-sm">
            Nenhum documento gerado neste caso ainda.
          </div>
        ) : (
          <ul>
            {(docs ?? []).map((d) => {
              const meta = STATUS_META[d.status] ?? STATUS_META.RASCUNHO;
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] last:border-0"
                >
                  <FileText size={16} className="text-[var(--gold-700)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--navy)] font-medium truncate">
                      {String(d.document_number ?? 0).padStart(2, "0")} · {d.title}
                    </div>
                    <div className="mt-0.5">
                      <Badge className={meta.cls}>{meta.label}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.status === "EM_EDICAO" && d.google_doc_id && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditorDocId(d.id);
                            setEditorUrl(editUrl(d.google_doc_id!));
                          }}
                        >
                          <Edit3 size={13} className="mr-1" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={download.isPending}
                          onClick={async () => {
                            try {
                              await download.mutateAsync({ id: d.id, format: "pdf" });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha ao baixar");
                            }
                          }}
                        >
                          <Download size={13} className="mr-1" /> PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={download.isPending}
                          onClick={async () => {
                            try {
                              await download.mutateAsync({ id: d.id, format: "docx" });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha ao baixar");
                            }
                          }}
                        >
                          <Download size={13} className="mr-1" /> DOCX
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await finalize.mutateAsync(d.id);
                              toast.success("Documento finalizado (PDF na pasta do caso)");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha");
                            }
                          }}
                          disabled={finalize.isPending}
                        >
                          Finalizar
                        </Button>
                      </>
                    )}
                    {d.status === "FINALIZADO" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={download.isPending}
                          onClick={async () => {
                            try {
                              await download.mutateAsync({ id: d.id, format: "pdf" });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha ao baixar PDF");
                            }
                          }}
                        >
                          <Download size={13} className="mr-1" /> PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={download.isPending}
                          onClick={async () => {
                            try {
                              await download.mutateAsync({ id: d.id, format: "docx" });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha ao baixar DOCX");
                            }
                          }}
                        >
                          <Download size={13} className="mr-1" /> DOCX
                        </Button>
                        {d.google_doc_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reopen.isPending}
                            onClick={async () => {
                              try {
                                await reopen.mutateAsync(d.id);
                                toast.success("Documento reaberto para edição");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Falha ao reabrir");
                              }
                            }}
                          >
                            <Edit3 size={13} className="mr-1" /> Editar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => setSendFor({ id: d.id, title: d.title })}
                        >
                          <Send size={13} className="mr-1" /> ZapSign
                        </Button>
                      </>
                    )}
                    {d.status === "ENVIADO_ZAPSIGN" && d.zapsign_sign_url && (
                      <a href={d.zapsign_sign_url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                          <FileSignature size={13} className="mr-1" /> Link de assinatura
                        </Button>
                      </a>
                    )}
                    {d.status === "ASSINADO" && d.drive_url && (
                      <a href={d.drive_url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink size={13} className="mr-1" /> Assinado
                        </Button>
                      </a>
                    )}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Excluir"
                      onClick={async () => {
                        try {
                          await del.mutateAsync(d.id);
                          toast.success("Documento removido");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Falha");
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <GenerateDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        templates={(templates ?? []) as Array<{ id: string; name: string; fields: unknown; google_doc_id?: string }>}
        pending={generate.isPending}
        autoFill={{ clientName, clientCpf, municipio, ...autoFillExtra }}
        onGenerate={async (templateId, title, values) => {
          try {
            const res = await generate.mutateAsync({ caseId, templateId, title, values });
            setGenOpen(false);
            toast.success("Documento gerado — abrindo editor");
            setEditorDocId(res.doc.id);
            setEditorUrl(editUrl(res.doc.google_doc_id!));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao gerar");
          }
        }}
      />

      <EditorDialog
        url={editorUrl}
        onClose={() => {
          setEditorUrl(null);
          setEditorDocId(null);
        }}
        onFinalize={async () => {
          if (!editorDocId) return;
          try {
            await finalize.mutateAsync(editorDocId);
            toast.success("Documento finalizado (PDF na pasta do caso)");
            setEditorUrl(null);
            setEditorDocId(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha");
          }
        }}
        finalizing={finalize.isPending}
      />

      <SendZapsignDialog
        target={sendFor}
        onClose={() => setSendFor(null)}
        pending={sendZap.isPending}
        onSend={async (signer) => {
          if (!sendFor) return;
          try {
            const res = await sendZap.mutateAsync({ docId: sendFor.id, signers: [signer] });
            setSendFor(null);
            toast.success(`Enviado ao ZapSign${res.signUrl ? " — link gerado" : ""}`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao enviar");
          }
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------- Gerar ----
function resolveAutoValue(field: TemplateField, data: AutoFillData): string | undefined {
  // Try auto_field first (set by sync), then fall back to key-based heuristics
  const autoField = field.auto_field?.toLowerCase();
  if (autoField) {
    if (autoField === "client_name") return data.clientName;
    if (autoField === "cpf") return data.clientCpf ? formatCpfCnpj(data.clientCpf) : undefined;
    if (autoField === "municipio") return data.municipio;
    if (autoField === "email") return data.email;
    if (autoField === "phone" || autoField === "telefone") return data.phone;
    if (autoField === "crm" || autoField === "crm_numero") return data.crm_numero;
    if (autoField === "crm_uf") return data.crm_uf;
    if (autoField === "oab" || autoField === "oab_numero") return data.oab_numero;
    if (autoField === "oab_uf") return data.oab_uf;
    if (autoField === "especialidade") return data.especialidade;
    if (autoField === "vinculo_institucional") return data.vinculo_institucional;
    if (autoField === "case_code" || autoField === "codigo_caso") return data.caseCode;
    if (autoField === "responsavel") return data.responsavel;
    if (autoField === "cidade" || autoField === "city") return data.city;
    if (autoField === "estado" || autoField === "uf" || autoField === "state") return data.state;
    // "dados_pessoais" = nome + CPF combinado
    if (autoField === "dados_pessoais") {
      const parts = [data.clientName, data.clientCpf ? `CPF: ${formatCpfCnpj(data.clientCpf)}` : ""].filter(Boolean);
      return parts.length ? parts.join(", ") : undefined;
    }
  }

  // Fallback: match by key content (for manually created templates)
  const key = field.key.toLowerCase();
  const label = (field.label ?? "").toLowerCase();
  const match = (patterns: RegExp) => patterns.test(key) || patterns.test(label);

  if (/\bdados pessoais\b/.test(key)) {
    const parts = [data.clientName, data.clientCpf ? `CPF: ${formatCpfCnpj(data.clientCpf)}` : ""].filter(Boolean);
    return parts.length ? parts.join(", ") : undefined;
  }
  // Nome do cliente / médico / profissional → sempre é o nome do cliente
  if (match(/\b(nome.*cliente|nome.*m[eé]dico|client.*name|nome.*profissional|nome_cliente|nome_do_cliente|nome_medico)\b/) || key === "nome" || key === "client_name") return data.clientName;
  if (match(/\b(cpf|cpf_cnpj|documento)\b/)) return data.clientCpf ? formatCpfCnpj(data.clientCpf) : undefined;
  if (match(/\bmunic[ií]pio\b/)) return data.municipio;
  if (match(/\be[-_]?mail\b/)) return data.email;
  if (match(/\b(telefone|phone|celular|fone)\b/)) return data.phone;
  if (match(/\b(crm_uf|uf.*crm)\b/)) return data.crm_uf;
  if (match(/\bcrm\b/) && !match(/\buf\b/)) return data.crm_numero;
  if (match(/\b(oab_uf|uf.*oab)\b/)) return data.oab_uf;
  if (match(/\boab\b/) && !match(/\buf\b/)) return data.oab_numero;
  if (match(/\bespecialidade\b/)) return data.especialidade;
  if (match(/\bv[ií]nculo\b/)) return data.vinculo_institucional;
  if (match(/\b(c[oó]digo.*caso|case.*code|numero.*caso)\b/)) return data.caseCode;
  if (match(/\brespons[aá]vel\b/)) return data.responsavel;
  if (match(/\b(cidade|city)\b/)) return data.city;
  if (key === "uf" || key === "estado" || key === "state") return data.state;
  return undefined;
}

function GenerateDialog({
  open,
  onOpenChange,
  templates,
  pending,
  onGenerate,
  autoFill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: Array<{ id: string; name: string; fields: unknown; google_doc_id?: string }>;
  pending: boolean;
  onGenerate: (templateId: string, title: string, values: Record<string, string>) => void;
  autoFill: AutoFillData;
}) {
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});

  const selected = templates.find((t) => t.id === templateId);

  // Busca placeholders ao vivo do Google Doc quando um template é selecionado
  const { data: livePlaceholders, isLoading: loadingFields } = useTemplatePlaceholders(
    selected?.google_doc_id ?? null,
  );

  const fields = useMemo<TemplateField[]>(() => {
    if (livePlaceholders?.length) return livePlaceholders as TemplateField[];
    // Fallback: usa campos salvos no banco
    return ((selected?.fields as TemplateField[]) ?? []).filter((f) => f.source !== "blank");
  }, [livePlaceholders, selected]);

  // Pre-fill auto fields when fields change
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar documento</DialogTitle>
          <DialogDescription>
            Escolha um modelo e preencha os campos. O documento abre para edição.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Modelo</Label>
            <Select
              value={templateId}
              onValueChange={(v) => {
                setTemplateId(v);
                setValues({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um modelo…" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum modelo cadastrado para este tipo.
                  </div>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {loadingFields && templateId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 size={14} className="animate-spin" /> Lendo campos do modelo…
            </div>
          )}

          {!loadingFields && templateId && fields.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Nenhum campo encontrado neste modelo. O documento sera gerado sem substituicoes — preencha manualmente na edicao.
            </div>
          )}

          {fields.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Campos com <span className="text-emerald-600 font-medium">(preenchido)</span> foram detectados automaticamente. Caso nao saiba os dados, preencha com o nome do campo.
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
                  {!hasValue && <span className="text-amber-600 text-xs">(preencha ou use o nome do campo)</span>}
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
                  placeholder={
                    isDoc
                      ? "000.000.000-00"
                      : f.key
                  }
                />
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!templateId || pending || loadingFields}
            onClick={() => {
              const faltando = fields.filter(
                (f) => f.required && !String(values[f.key] ?? "").trim(),
              );
              if (faltando.length) {
                toast.error(`Preencha: ${faltando.map((f) => f.label).join(", ")}`);
                return;
              }
              onGenerate(templateId, selected?.name ?? "Documento", values);
            }}
          >
            {pending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- Editor ----
function EditorDialog({
  url,
  onClose,
  onFinalize,
  finalizing,
}: {
  url: string | null;
  onClose: () => void;
  onFinalize: () => void;
  finalizing: boolean;
}) {
  return (
    <Dialog open={!!url} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
          <DialogDescription>
            Use a barra do Google Docs para mudar cores, fontes e formatação. Ao terminar,
            clique em "Concluí a edição".
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--gold-700)] hover:underline text-sm inline-flex items-center gap-1"
            >
              <ExternalLink size={13} /> Abrir em nova aba (tela cheia)
            </a>
          )}
        </div>

        {url && (
          <iframe
            src={url}
            title="Editor de documento"
            className="w-full rounded-md border border-[var(--border)]"
            style={{ height: "70vh" }}
            allow="clipboard-read; clipboard-write"
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onFinalize} disabled={finalizing}>
            {finalizing ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
            Concluí a edição (Finalizar)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------- ZapSign ----
function SendZapsignDialog({
  target,
  onClose,
  pending,
  onSend,
}: {
  target: { id: string; title: string } | null;
  onClose: () => void;
  pending: boolean;
  onSend: (signer: {
    name: string;
    email?: string;
    authMode?: string;
    sendAutomaticEmail?: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [autoEmail, setAutoEmail] = useState(true);

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar para ZapSign</DialogTitle>
          <DialogDescription>{target?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do signatário *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={autoEmail} onCheckedChange={(v) => setAutoEmail(!!v)} />
            ZapSign envia o link por e-mail automaticamente
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim() || pending}
            onClick={() =>
              onSend({
                name: name.trim(),
                email: email.trim() || undefined,
                authMode: "assinaturaTela-tokenEmail",
                sendAutomaticEmail: autoEmail,
              })
            }
          >
            {pending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
