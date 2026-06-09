import { ExternalLink, FileSignature, FileText, Loader2, Plus, Send, Trash2 } from "lucide-react";
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
  useFinalizeCaseDocument,
  useGenerateCaseDocument,
  useSendCaseDocumentToZapsign,
} from "@/hooks/useCaseDocuments";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";

type TemplateField = {
  key: string;
  label: string;
  source: "auto" | "manual" | "blank";
  required?: boolean;
};

function editUrl(googleDocId: string): string {
  return `https://docs.google.com/document/d/${googleDocId}/edit?rm=minimal`;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  EM_EDICAO: { label: "Em edição", cls: "bg-amber-100 text-amber-800" },
  FINALIZADO: { label: "Finalizado", cls: "bg-[var(--navy)] text-white" },
  ENVIADO_ZAPSIGN: { label: "Aguardando assinatura", cls: "bg-[var(--gold-700)] text-white" },
  ASSINADO: { label: "Assinado", cls: "bg-green-600 text-white" },
  CANCELADO: { label: "Cancelado", cls: "bg-muted text-muted-foreground line-through" },
};

export function CaseDocumentsTab({ caseId, caseType }: { caseId: string; caseType: string }) {
  const { data: docs, isLoading } = useCaseDocuments(caseId);
  const { data: templates } = useDocumentTemplates(caseType);
  const generate = useGenerateCaseDocument(caseId);
  const finalize = useFinalizeCaseDocument(caseId);
  const sendZap = useSendCaseDocumentToZapsign(caseId);
  const del = useDeleteCaseDocument(caseId);

  const [genOpen, setGenOpen] = useState(false);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [sendFor, setSendFor] = useState<{ id: string; title: string } | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[24px] font-semibold text-[var(--navy)]">Documentos</h2>
        <Button size="sm" onClick={() => setGenOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Gerar documento
        </Button>
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
                          Editar
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
                        {d.drive_url && (
                          <a href={d.drive_url} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm">
                              <ExternalLink size={13} className="mr-1" /> PDF
                            </Button>
                          </a>
                        )}
                        {d.goes_to_zapsign && (
                          <Button
                            size="sm"
                            onClick={() => setSendFor({ id: d.id, title: d.title })}
                          >
                            <Send size={13} className="mr-1" /> ZapSign
                          </Button>
                        )}
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
        templates={(templates ?? []) as Array<{ id: string; name: string; fields: unknown }>}
        pending={generate.isPending}
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
function GenerateDialog({
  open,
  onOpenChange,
  templates,
  pending,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: Array<{ id: string; name: string; fields: unknown }>;
  pending: boolean;
  onGenerate: (templateId: string, title: string, values: Record<string, string>) => void;
}) {
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});

  const selected = templates.find((t) => t.id === templateId);
  const fields = useMemo<TemplateField[]>(
    () => ((selected?.fields as TemplateField[]) ?? []).filter((f) => f.source !== "blank"),
    [selected],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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

          {fields.map((f) => {
            const isDoc = isCpfCnpjField(f.key, f.label);
            return (
              <div key={f.key}>
                <Label>
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
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
                      : f.source === "auto"
                        ? "(auto — ajuste se precisar)"
                        : ""
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
            disabled={!templateId || pending}
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
      <DialogContent className="max-w-5xl w-[92vw]">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
          <DialogDescription>
            Edite aqui dentro. Se o editor não carregar, use “Abrir em nova aba”. Ao terminar,
            clique em “Concluí a edição”.
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
              <ExternalLink size={13} /> Abrir em nova aba
            </a>
          )}
        </div>

        {url && (
          <iframe
            src={url}
            title="Editor de documento"
            className="w-full rounded-md border border-[var(--border)]"
            style={{ height: "60vh" }}
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
