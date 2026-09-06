import {
  BadgeCheck,
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
import { useNavigate } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CaseFilterFillDialog } from "@/components/cases/CaseFilterFillDialog";
import { DocumentPickerDialog } from "@/components/cases/DocumentPickerDialog";
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
  useCaseDocuments,
  useConfirmarAssinaturaManual,
  useDeleteCaseDocument,
  useDownloadCaseDocument,
  useFinalizeCaseDocument,
  useGenerateCaseDocument,
  useGenerateDocumentAsNewCase,
  useReopenCaseDocument,
  useSendCaseDocumentToZapsign,
  useUploadCaseDocument,
} from "@/hooks/useCaseDocuments";
import { useSyncCaseDocumentFolders, useSyncDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { type AutoFillData } from "@/lib/cases/document-autofill";

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
  frenteSlug,
  temaId,
  clientId,
  canonicalFields,
  clientName,
  clientCpf,
  municipio,
  autoFillExtra,
}: {
  caseId: string;
  caseType: string;
  // R2-04 — frente do caso (quando houver): filtra as pastas por frente + comuns.
  frenteSlug?: string | null;
  // R2-09 — tema/cliente/canonical: pop-up de filtros pós-Word também aqui.
  temaId?: string | null;
  clientId?: string | null;
  canonicalFields?: Record<string, unknown> | null;
  clientName?: string;
  clientCpf?: string;
  municipio?: string;
  autoFillExtra?: AutoFillData;
}) {
  const navigate = useNavigate();
  const { data: docs, isLoading } = useCaseDocuments(caseId);
  const generate = useGenerateCaseDocument(caseId);
  const genAsNewCase = useGenerateDocumentAsNewCase();
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
  // R2-09 — pop-up de filtros do tema, após concluir o Word (aqui também).
  const [showFilters, setShowFilters] = useState(false);
  // R2-10 — "Documento de caso" cria um CASO NOVO; guarda o id p/ filtros e
  // navegação ao fechar o editor. null = mesmo caso.
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const activeCaseId = createdCaseId ?? caseId;
  // Quando o finalizar abre o pop-up de filtros, a navegação para o caso novo
  // acontece ao FECHAR o pop-up (não no onClose do editor). Este ref evita a
  // navegação prematura do onClose disparado por fechar o editor no finalizar.
  const suppressCloseNavRef = useRef(false);

  function irParaCasoNovo() {
    if (!createdCaseId) return;
    const target = createdCaseId;
    setCreatedCaseId(null);
    navigate({ to: "/casos/$id", params: { id: target } });
  }

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
                // Mostra a mensagem ACIONÁVEL vinda da rota (pasta faltando, tipo
                // não suportado, falha do Drive) — não um "erro interno" genérico.
                // Duração maior porque a mensagem de 409/415 traz instrução ao usuário.
                toast.error(err instanceof Error ? err.message : "Falha ao anexar documento", {
                  duration: 8000,
                });
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(d.zapsign_sign_url!);
                                toast.success("Link de assinatura copiado");
                              } catch {
                                toast.error("Não foi possível copiar o link");
                              }
                            }}
                          >
                            <FileSignature size={13} className="mr-1" /> Copiar link de assinatura
                          </Button>
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

      <DocumentPickerDialog
        permiteCriarPasta
        open={genOpen}
        onOpenChange={setGenOpen}
        caseType={caseType}
        frenteSlug={frenteSlug}
        pending={generate.isPending || genAsNewCase.isPending}
        autoFill={{ clientName, clientCpf, municipio, ...autoFillExtra }}
        onGenerate={async (templateId, title, values, docKind, folderId, folderName) => {
          try {
            // R2-10 — "Documento de caso" cria um CASO NOVO; procuração fica no atual.
            if (docKind === "contrato") {
              const res = await genAsNewCase.mutateAsync({
                sourceCaseId: caseId,
                templateId,
                title,
                values,
                casoPastaNome: folderName ?? null,
                casoPastaDriveId: folderId ?? null,
              });
              // R2-11 req.5 — pode ter gerado no PRÓPRIO caso (1º doc de caso) ou
              // criado um caso NOVO. Só navega/marca se for caso diferente.
              const isNovoCaso = res.caseId !== caseId;
              setCreatedCaseId(isNovoCaso ? res.caseId : null);
              setGenOpen(false);
              toast.success(
                isNovoCaso
                  ? "Novo caso criado · documento gerado, abrindo editor"
                  : "Documento gerado · abrindo editor",
              );
              setEditorDocId(res.doc.id);
              setEditorUrl(editUrl(res.doc.google_doc_id!));
              return;
            }
            const res = await generate.mutateAsync({ caseId, templateId, title, values, docKind });
            setCreatedCaseId(null);
            setGenOpen(false);
            toast.success("Documento gerado · abrindo editor");
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
          // R2-10 — navega ao caso novo ao fechar o editor, EXCETO quando o
          // finalizar já abriu o pop-up de filtros (a navegação ocorre ao fechá-lo).
          if (suppressCloseNavRef.current) {
            suppressCloseNavRef.current = false;
            return;
          }
          irParaCasoNovo();
        }}
        onFinalize={async () => {
          if (!editorDocId) return;
          try {
            await finalize.mutateAsync(editorDocId);
            toast.success("Documento finalizado (PDF na pasta do caso)");
            // R2-09 — abre o pop-up de filtros do tema após concluir o Word.
            if (temaId) {
              suppressCloseNavRef.current = true;
              setShowFilters(true);
            }
            setEditorUrl(null);
            setEditorDocId(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha");
          }
        }}
        finalizing={finalize.isPending}
      />

      {/* R2-09/R2-10 — pop-up de FILTROS do tema, após concluir o Word (aba
          Documentos). Se um caso NOVO foi criado (Documento de caso), o pop-up é
          do novo caso (em branco) e ao fechar navega para ele. */}
      <CaseFilterFillDialog
        open={showFilters}
        onOpenChange={(v) => {
          setShowFilters(v);
          if (!v) irParaCasoNovo();
        }}
        caseId={activeCaseId}
        clientId={clientId}
        temaId={temaId}
        frenteSlug={frenteSlug}
        initialValues={createdCaseId ? null : canonicalFields}
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
            toast.success(`Enviado ao ZapSign${res.signUrl ? " · link gerado" : ""}`);
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
// O diálogo de escolha de modelo vive em `DocumentPickerDialog` — é o MESMO
// usado pelo botão do topo da ficha. Antes havia aqui uma cópia quase idêntica
// (~530 linhas), e as duas já tinham divergido: só esta oferecia criar a pasta
// no empty-state, só a outra avisava sobre placeholder órfão. Agora os dois
// lados têm as duas coisas.

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
  // Recarrega o iframe uma vez após abrir para cair direto em modo edição (a
  // permissão do Google Docs propaga com atraso e mostra o banner "Atualize a página").
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!url) return;
    const t = setTimeout(() => setNonce((n) => n + 1), 1800);
    return () => clearTimeout(t);
  }, [url]);
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
            key={nonce}
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
