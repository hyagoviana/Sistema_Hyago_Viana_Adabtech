import {
  BadgeCheck,
  Check,
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
import { Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCaseDocuments,
  useConfirmarAssinaturaManual,
  useDeleteCaseDocument,
  useDownloadCaseDocument,
  useFinalizeCaseDocument,
  useGenerateCaseDocument,
  useReopenCaseDocument,
  useSendCaseDocumentToZapsign,
  useUploadCaseDocument,
} from "@/hooks/useCaseDocuments";
import {
  useSyncCaseDocumentFolders,
  useSyncDocumentTemplates,
  useSyncProcuracaoTemplates,
  useTemplatePlaceholders,
  useTemplatesByFolder,
  useTemplatesByFolders,
} from "@/hooks/useDocumentTemplates";
import { useServiceTypes } from "@/hooks/usePipeline";
import {
  useCreateTypeFolder,
  useTypeFolders,
  useUploadTypeTemplate,
} from "@/hooks/useServiceTypeFolders";
import {
  type AutoFillData,
  type TemplateField,
  resolveAutoValue,
} from "@/lib/cases/document-autofill";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";

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

export function CaseDocumentsTab({
  caseId,
  caseType,
  clientName,
  clientCpf,
  municipio,
  autoFillExtra,
}: {
  caseId: string;
  caseType: string;
  clientName?: string;
  clientCpf?: string;
  municipio?: string;
  autoFillExtra?: AutoFillData;
}) {
  const { data: docs, isLoading } = useCaseDocuments(caseId);
  const generate = useGenerateCaseDocument(caseId);
  const finalize = useFinalizeCaseDocument(caseId);
  const reopen = useReopenCaseDocument(caseId);
  const download = useDownloadCaseDocument();
  const sendZap = useSendCaseDocumentToZapsign(caseId);
  const del = useDeleteCaseDocument(caseId);
  const confirmarAssinatura = useConfirmarAssinaturaManual(caseId);
  const sync = useSyncDocumentTemplates();
  // ITEM 4 — sincroniza também as 6 pastas do "Documento de caso" (source_folder_id).
  const syncFolders = useSyncCaseDocumentFolders();
  const uploadDoc = useUploadCaseDocument(caseId);

  const uploadInputRef = useRef<HTMLInputElement>(null);
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
            disabled={sync.isPending || syncFolders.isPending}
            onClick={async () => {
              try {
                const res = await sync.mutateAsync(undefined);
                // ITEM 4 — também varre as 6 pastas do "Documento de caso" para
                // gravar source_folder_id em cada modelo.
                const resF = await syncFolders.mutateAsync();
                toast.success(
                  `Sync: ${res.foldersScanned + resF.foldersScanned} pastas, ${
                    res.filesFound + resF.filesFound
                  } docs → ${res.created + resF.created} novos, ${
                    res.updated + resF.updated
                  } atualizados, ${res.skipped + resF.skipped} já existiam` +
                    (res.errors.length + resF.errors.length
                      ? ` | ${res.errors.length + resF.errors.length} erros`
                      : ""),
                );
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Falha ao sincronizar");
              }
            }}
          >
            <RefreshCw
              size={14}
              className={`mr-1.5 ${sync.isPending || syncFolders.isPending ? "animate-spin" : ""}`}
            />
            Sincronizar modelos
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={uploadDoc.isPending}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploadDoc.isPending ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <Upload size={14} className="mr-1.5" />
            )}
            Anexar documento
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                await uploadDoc.mutateAsync(file);
                toast.success(`${file.name} anexado ao caso`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Falha ao anexar");
              }
            }}
          />
          <Button size="sm" onClick={() => setGenOpen(true)}>
            <Plus size={14} className="mr-1.5" /> Gerar documento
          </Button>
        </div>
      </div>

      <div className="card-editorial !p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>
        ) : (docs ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
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
                              toast.error(
                                err instanceof Error ? err.message : "Falha ao baixar PDF",
                              );
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
                              toast.error(
                                err instanceof Error ? err.message : "Falha ao baixar DOCX",
                              );
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
                                toast.error(
                                  err instanceof Error ? err.message : "Falha ao reabrir",
                                );
                              }
                            }}
                          >
                            <Edit3 size={13} className="mr-1" /> Editar
                          </Button>
                        )}
                        <Button size="sm" onClick={() => setSendFor({ id: d.id, title: d.title })}>
                          <Send size={13} className="mr-1" /> ZapSign
                        </Button>
                        <ConfirmSignatureButton
                          docKind={d.doc_kind}
                          pending={confirmarAssinatura.isPending}
                          onConfirm={async () => {
                            try {
                              await confirmarAssinatura.mutateAsync(d.id);
                              toast.success("Assinatura confirmada");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha");
                            }
                          }}
                        />
                      </>
                    )}
                    {d.status === "ENVIADO_ZAPSIGN" && (
                      <>
                        {d.zapsign_sign_url && (
                          <a href={d.zapsign_sign_url} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm">
                              <FileSignature size={13} className="mr-1" /> Link de assinatura
                            </Button>
                          </a>
                        )}
                        <ConfirmSignatureButton
                          docKind={d.doc_kind}
                          pending={confirmarAssinatura.isPending}
                          onConfirm={async () => {
                            try {
                              await confirmarAssinatura.mutateAsync(d.id);
                              toast.success("Assinatura confirmada");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha");
                            }
                          }}
                        />
                      </>
                    )}
                    {d.status === "ASSINADO" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={download.isPending}
                          onClick={async () => {
                            try {
                              await download.mutateAsync({ id: d.id, format: "pdf" });
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Falha ao baixar PDF",
                              );
                            }
                          }}
                        >
                          <Download size={13} className="mr-1" /> Baixar PDF
                        </Button>
                        {d.drive_url && (
                          <a href={d.drive_url} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm">
                              <ExternalLink size={13} className="mr-1" /> Assinado
                            </Button>
                          </a>
                        )}
                      </>
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
        caseType={caseType}
        pending={generate.isPending}
        autoFill={{ clientName, clientCpf, municipio, ...autoFillExtra }}
        onGenerate={async (templateId, title, values, docKind) => {
          try {
            const res = await generate.mutateAsync({ caseId, templateId, title, values, docKind });
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
        defaultName={clientName}
        defaultEmail={autoFillExtra?.email}
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

// ------------------------------------------------- Confirmar assinatura ----
// ITEM 5 — botão manual "Confirmar assinatura" (equivalente ao webhook ZapSign,
// adiado). Só aparece para documentos de assinatura (contrato/procuração).
function ConfirmSignatureButton({
  docKind,
  pending,
  onConfirm,
}: {
  docKind: string | null;
  pending: boolean;
  onConfirm: () => void;
}) {
  if (docKind !== "contrato" && docKind !== "procuracao") return null;
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onConfirm}>
      <BadgeCheck size={13} className="mr-1" /> Confirmar assinatura
    </Button>
  );
}

// ---------------------------------------------------------------- Gerar ----
type GenMode = "procuracao" | "caso";

// ITEM 1 (2026-07-06) — "Gerar documento" pergunta primeiro: PROCURAÇÃO ou
// DOCUMENTO DO CASO.
//   - Procuração      → modelos da pasta de procuração (case_type='PROCURACAO')
//     via useDocumentTemplates('PROCURACAO'); doc_kind='procuracao'.
//   - Documento do caso → modelos do TIPO do caso (pasta vinculada ao tipo) via
//     useDocumentTemplates(caseType); doc_kind='contrato'.
function GenerateDialog({
  open,
  onOpenChange,
  caseType,
  pending,
  onGenerate,
  autoFill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // (2026-07-09) — usado para resolver as pastas (caso/procuração) DA CATEGORIA
  // do caso; os seletores passam a listar só os modelos dessas pastas.
  caseType?: string;
  pending: boolean;
  onGenerate: (
    templateId: string,
    title: string,
    values: Record<string, string>,
    docKind: "procuracao" | "contrato",
  ) => void;
  autoFill: AutoFillData;
}) {
  const [mode, setMode] = useState<GenMode | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  // ITEM 4 — "Documento de caso": passo 1 = escolher 1 das 6 pastas; passo 2 =
  // só os docs daquela pasta (filtro por source_folder_id).
  const [folderId, setFolderId] = useState<string | null>(null);

  // (2026-07-09) — as pastas são POR CATEGORIA. Resolve o tipo do caso pelo slug e
  // busca suas pastas de caso e de procuração vinculadas.
  const { data: serviceTypes } = useServiceTypes();
  const serviceTypeId = (serviceTypes ?? []).find((t) => t.slug === caseType)?.id ?? null;
  const { data: casoFolders } = useTypeFolders(serviceTypeId, "caso");
  const { data: procFolders } = useTypeFolders(serviceTypeId, "procuracao");
  const procFolderIds = (procFolders ?? []).map((f) => f.drive_folder_id);

  // Modelos por modo: procuração (só as pastas de procuração DA CATEGORIA) vs
  // pasta de caso escolhida (também da categoria).
  const { data: procTemplates } = useTemplatesByFolders(
    mode === "procuracao" ? procFolderIds : null,
  );
  const { data: folderTemplates } = useTemplatesByFolder(mode === "caso" ? folderId : null);
  const syncProc = useSyncProcuracaoTemplates();

  // Empty-state do "Documento de caso" (categorias sem pasta): criar pasta + anexar.
  const createCasoFolder = useCreateTypeFolder();
  const uploadTemplate = useUploadTypeTemplate();
  const casoFileRef = useRef<HTMLInputElement>(null);
  const [newFolderName, setNewFolderName] = useState("");

  // Reset ao (re)abrir.
  useEffect(() => {
    if (open) {
      setMode(null);
      setTemplateId("");
      setValues({});
      setFolderId(null);
      setNewFolderName("");
    }
  }, [open]);

  const templates = ((mode === "procuracao" ? procTemplates : folderTemplates) ?? []) as Array<{
    id: string;
    name: string;
    fields: unknown;
    google_doc_id?: string;
  }>;

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

  // Etapa 1: escolher o tipo de documento (Procuração vs Documento do caso).
  if (mode === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar documento</DialogTitle>
            <DialogDescription>O que você quer gerar para este caso?</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMode("procuracao");
                setTemplateId("");
                setValues({});
              }}
              className="rounded-md border border-[var(--border)] p-4 text-left hover:border-[var(--gold)] transition-colors"
            >
              <div className="flex items-center gap-2 font-medium text-[var(--navy)]">
                <FileSignature size={16} className="text-[var(--gold-700)]" /> Procuração
              </div>
              <div className="text-[12px] text-muted-foreground mt-1">
                Modelos da pasta de procuração.
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("caso");
                setTemplateId("");
                setValues({});
              }}
              className="rounded-md border border-[var(--border)] p-4 text-left hover:border-[var(--gold)] transition-colors"
            >
              <div className="flex items-center gap-2 font-medium text-[var(--navy)]">
                <FileText size={16} className="text-[var(--gold-700)]" /> Documento do caso
              </div>
              <div className="text-[12px] text-muted-foreground mt-1">
                Só as pastas de documentos desta categoria.
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // "Documento de caso", passo 1: escolher a pasta DA CATEGORIA (ou criar a 1ª).
  if (mode === "caso" && !folderId) {
    const folders = casoFolders ?? [];
    const busy = createCasoFolder.isPending || uploadTemplate.isPending;

    const handleCreateAndAttach = async (file: File) => {
      if (!serviceTypeId) {
        toast.error("Categoria do caso não encontrada");
        return;
      }
      const nome = newFolderName.trim();
      if (!nome) {
        toast.error("Dê um nome para a pasta");
        return;
      }
      try {
        const folder = await createCasoFolder.mutateAsync({
          serviceTypeId,
          kind: "caso",
          name: nome,
        });
        await uploadTemplate.mutateAsync({
          serviceTypeId,
          kind: "caso",
          folderId: folder.drive_folder_id,
          file,
        });
        toast.success("Pasta criada e documento anexado");
        setNewFolderName("");
        setFolderId(folder.drive_folder_id);
        setTemplateId("");
        setValues({});
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao criar/anexar");
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Documento de caso — escolha a pasta</DialogTitle>
            <DialogDescription>
              Só as pastas desta categoria aparecem. Os documentos da pasta escolhida ficam
              disponíveis para gerar.
            </DialogDescription>
          </DialogHeader>

          {folders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFolderId(f.drive_folder_id);
                    setTemplateId("");
                    setValues({});
                  }}
                  className="flex items-center gap-2 rounded-md border border-[var(--border)] p-3 text-left hover:border-[var(--gold)] transition-colors"
                >
                  <FileText size={15} className="text-[var(--gold-700)] shrink-0" />
                  <span className="text-[13px] font-medium text-[var(--navy)]">{f.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-3">
              <p className="text-sm text-amber-800">
                Esta categoria ainda não tem nenhuma pasta de documentos de caso. Quer incluir uma
                agora? Dê um nome à pasta e anexe um documento Word — ou saia se clicou aqui sem
                querer.
              </p>
              <div>
                <Label>Nome da nova pasta</Label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex.: Documentos gerais"
                  disabled={busy}
                />
              </div>
              <input
                ref={casoFileRef}
                type="file"
                accept=".doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleCreateAndAttach(file);
                }}
              />
              <Button
                size="sm"
                disabled={busy || !newFolderName.trim()}
                onClick={() => casoFileRef.current?.click()}
              >
                {busy ? "Enviando…" : "Anexar documento e criar pasta"}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              ← Voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isProc = mode === "procuracao";
  const folderLabel = (casoFolders ?? []).find((f) => f.drive_folder_id === folderId)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar {isProc ? "procuração" : "documento do caso"}</DialogTitle>
          <DialogDescription>
            Escolha um modelo e preencha os campos. O documento abre para edição.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              if (isProc) {
                setMode(null);
              } else {
                setFolderId(null);
              }
              setTemplateId("");
              setValues({});
            }}
            className="text-xs text-[var(--gold-700)] hover:underline"
          >
            {isProc ? "← Trocar tipo de documento" : "← Trocar pasta"}
          </button>
          <div>
            <Label>
              {isProc ? "Modelo de procuração" : `Documento — ${folderLabel ?? "pasta"}`}
            </Label>
            {templates.length === 0 ? (
              <div className="mt-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-muted-foreground">
                {isProc ? (
                  <span className="flex items-center justify-between gap-2">
                    Nenhum modelo de procuração desta categoria. Sincronize as procurações do Drive
                    para importá-las.
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={syncProc.isPending}
                      onClick={async () => {
                        try {
                          const res = await syncProc.mutateAsync();
                          toast.success(
                            `Sync procurações: ${res.created} novos, ${res.updated} atualizados`,
                          );
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Falha ao sincronizar");
                        }
                      }}
                    >
                      <RefreshCw
                        size={13}
                        className={`mr-1 ${syncProc.isPending ? "animate-spin" : ""}`}
                      />
                      Sincronizar procurações
                    </Button>
                  </span>
                ) : (
                  'Nenhum documento nesta pasta. Use "Sincronizar modelos" para importar os documentos das pastas do Drive.'
                )}
              </div>
            ) : (
              <Command className="mt-1 rounded-md border border-[var(--border)]">
                <CommandInput placeholder="Buscar pelo nome…" />
                <CommandList className="max-h-56">
                  <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                  <CommandGroup>
                    {templates.map((t) => (
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
                Selecionado: <span className="font-medium text-[var(--navy)]">{selected.name}</span>
              </p>
            )}
          </div>

          {loadingFields && templateId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 size={14} className="animate-spin" /> Lendo campos do modelo…
            </div>
          )}

          {!loadingFields && templateId && fields.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Nenhum campo encontrado neste modelo. O documento sera gerado sem substituicoes —
              preencha manualmente na edicao.
            </div>
          )}

          {fields.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Campos com <span className="text-emerald-600 font-medium">(preenchido)</span> foram
              detectados automaticamente. Caso nao saiba os dados, preencha com o nome do campo.
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
                  {!hasValue && (
                    <span className="text-amber-600 text-xs">
                      (preencha ou use o nome do campo)
                    </span>
                  )}
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
              onGenerate(
                templateId,
                selected?.name ?? "Documento",
                values,
                isProc ? "procuracao" : "contrato",
              );
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
            Use a barra do Google Docs para mudar cores, fontes e formatação. Ao terminar, clique em
            "Concluí a edição".
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
  defaultName,
  defaultEmail,
  onClose,
  pending,
  onSend,
}: {
  target: { id: string; title: string } | null;
  defaultName?: string;
  defaultEmail?: string;
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

  // Ao abrir, pré-preenche com os dados do cliente do caso (editável).
  useEffect(() => {
    if (target) {
      setName(defaultName ?? "");
      setEmail(defaultEmail ?? "");
    }
  }, [target, defaultName, defaultEmail]);

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
