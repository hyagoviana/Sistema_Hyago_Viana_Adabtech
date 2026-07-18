import { Check, ExternalLink, FileSignature, FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useFinalizeCaseDocument, useGenerateCaseDocument } from "@/hooks/useCaseDocuments";
import {
  useSyncProcuracaoTemplates,
  useTemplatePlaceholders,
  useTemplatesByFolder,
  useTemplatesByFolders,
} from "@/hooks/useDocumentTemplates";
import { useServiceTypes } from "@/hooks/usePipeline";
import { useTypeFolders } from "@/hooks/useServiceTypeFolders";
import {
  type AutoFillData,
  type TemplateField,
  resolveAutoValue,
} from "@/lib/cases/document-autofill";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";

function editUrl(googleDocId: string): string {
  return `https://docs.google.com/document/d/${googleDocId}/edit?rm=embedded`;
}

// ITEM 2 (2026-07-06) — fluxo de geração de documento reutilizável, controlado por
// `open`/`onOpenChange`. É o MESMO popup do "Gerar documento" (ITEM 1): pergunta
// Procuração vs Documento do caso → escolhe modelo → preenche → gera → abre o Word
// editável. Usado no TOPO da ficha do caso (botão "Enviar contrato e procuração"),
// substituindo o CaseSignActions no topo. O envio ao ZapSign continua disponível
// na aba Documentos.
type GenMode = "procuracao" | "caso";

export function GenerateCaseDocumentFlow({
  open,
  onOpenChange,
  caseId,
  caseType,
  frenteSlug,
  autoFill,
  initialMode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  // ITEM 4 (2026-07-07) — mantido por compat com callers; o caminho "Documento de
  // caso" agora seleciona por PASTA (source_folder_id), não mais por case_type.
  caseType?: string;
  // R2-04 — frente do caso (quando houver): filtra as pastas por frente + comuns.
  frenteSlug?: string | null;
  autoFill: AutoFillData;
  // ITEM 2 — quando o chamador já sabe o modo (ex.: ficha do cliente já escolheu
  // "Documento do caso" e o caso), pula a pergunta Procuração vs Caso.
  initialMode?: GenMode;
}) {
  const generate = useGenerateCaseDocument(caseId);
  const finalize = useFinalizeCaseDocument(caseId);

  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  // A permissão de edição do Google Docs propaga com um pequeno atraso; ao abrir o
  // editor, recarregamos o iframe UMA vez para cair direto em modo edição (sem o
  // banner "Seu acesso foi alterado. Atualize a página").
  const [iframeNonce, setIframeNonce] = useState(0);
  useEffect(() => {
    if (!editorUrl) return;
    const t = setTimeout(() => setIframeNonce((n) => n + 1), 1800);
    return () => clearTimeout(t);
  }, [editorUrl]);

  return (
    <>
      <PickDialog
        open={open}
        onOpenChange={onOpenChange}
        pending={generate.isPending}
        autoFill={autoFill}
        caseType={caseType}
        frenteSlug={frenteSlug}
        initialMode={initialMode}
        onGenerate={async (templateId, title, values, docKind) => {
          try {
            const res = await generate.mutateAsync({ caseId, templateId, title, values, docKind });
            onOpenChange(false);
            toast.success("Documento gerado — abrindo editor");
            setEditorDocId(res.doc.id);
            setEditorUrl(editUrl(res.doc.google_doc_id!));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao gerar");
          }
        }}
      />

      <Dialog
        open={!!editorUrl}
        onOpenChange={(v) => !v && (setEditorUrl(null), setEditorDocId(null))}
      >
        <DialogContent className="max-w-6xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
            <DialogDescription>
              Use a barra do Google Docs para formatar. Ao terminar, clique em "Concluí a edição".
            </DialogDescription>
          </DialogHeader>

          {editorUrl && (
            <div className="mb-2">
              <a
                href={editorUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--gold-700)] hover:underline text-sm inline-flex items-center gap-1"
              >
                <ExternalLink size={13} /> Abrir em nova aba (tela cheia)
              </a>
            </div>
          )}

          {editorUrl && (
            <iframe
              key={iframeNonce}
              src={editorUrl}
              title="Editor de documento"
              className="w-full rounded-md border border-[var(--border)]"
              style={{ height: "70vh" }}
              allow="clipboard-read; clipboard-write"
            />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditorUrl(null);
                setEditorDocId(null);
              }}
            >
              Fechar
            </Button>
            <Button
              disabled={finalize.isPending}
              onClick={async () => {
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
            >
              {finalize.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
              Concluí a edição (Finalizar)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PickDialog({
  open,
  onOpenChange,
  pending,
  onGenerate,
  autoFill,
  caseType,
  frenteSlug,
  initialMode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
  onGenerate: (
    templateId: string,
    title: string,
    values: Record<string, string>,
    docKind: "procuracao" | "contrato",
  ) => void;
  autoFill: AutoFillData;
  caseType?: string;
  frenteSlug?: string | null;
  initialMode?: GenMode;
}) {
  const [mode, setMode] = useState<GenMode | null>(initialMode ?? null);
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  // ITEM 4 — "Documento de caso": passo 1 = escolher 1 das 6 pastas; passo 2 =
  // só os docs daquela pasta (filtro por source_folder_id).
  const [folderId, setFolderId] = useState<string | null>(null);

  // (2026-07-10) — as pastas são POR CATEGORIA (system_service_type_folders).
  // Resolve o tipo do caso pelo slug e busca suas pastas de caso e de procuração.
  const { data: serviceTypes } = useServiceTypes();
  const serviceTypeId = (serviceTypes ?? []).find((t) => t.slug === caseType)?.id ?? null;
  // R2-04 — pastas por frente do caso (frente + comuns). Sem frente → todas do tema.
  const { data: casoFolders } = useTypeFolders(serviceTypeId, "caso", frenteSlug);
  const { data: procFolders } = useTypeFolders(serviceTypeId, "procuracao", frenteSlug);
  const procFolderIds = (procFolders ?? []).map((f) => f.drive_folder_id);

  // Modelos por modo: procuração (só as pastas de procuração DA CATEGORIA) vs
  // pasta de caso escolhida (também da categoria). Antes a procuração usava
  // useDocumentTemplates('PROCURACAO', true) — listava procurações de TODAS as
  // categorias; e o "documento de caso" usava a lista GLOBAL de pastas.
  const { data: procTemplates } = useTemplatesByFolders(
    mode === "procuracao" ? procFolderIds : null,
  );
  const { data: folderTemplates } = useTemplatesByFolder(mode === "caso" ? folderId : null);
  const syncProc = useSyncProcuracaoTemplates();

  useEffect(() => {
    if (open) {
      setMode(initialMode ?? null);
      setTemplateId("");
      setValues({});
      setFolderId(null);
    }
  }, [open, initialMode]);

  const templates = ((mode === "procuracao" ? procTemplates : folderTemplates) ?? []) as Array<{
    id: string;
    name: string;
    fields: unknown;
    google_doc_id?: string;
  }>;

  const selected = templates.find((t) => t.id === templateId);

  const { data: livePlaceholders, isLoading: loadingFields } = useTemplatePlaceholders(
    selected?.google_doc_id ?? null,
  );

  const fields = useMemo<TemplateField[]>(() => {
    if (livePlaceholders?.length) return livePlaceholders as TemplateField[];
    return ((selected?.fields as TemplateField[]) ?? []).filter((f) => f.source !== "blank");
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

  if (mode === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar contrato e procuração</DialogTitle>
            <DialogDescription>O que você quer gerar para este caso?</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("procuracao")}
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
              onClick={() => setMode("caso")}
              className="rounded-md border border-[var(--border)] p-4 text-left hover:border-[var(--gold)] transition-colors"
            >
              <div className="flex items-center gap-2 font-medium text-[var(--navy)]">
                <FileText size={16} className="text-[var(--gold-700)]" /> Documento do caso
              </div>
              <div className="text-[12px] text-muted-foreground mt-1">
                Escolha a pasta da categoria e o documento dela.
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

  // "Documento de caso", passo 1: escolher a pasta DA CATEGORIA do caso.
  if (mode === "caso" && !folderId) {
    const folders = casoFolders ?? [];
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
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta categoria ainda não tem pasta de documentos de caso. Vincule/crie uma na aba
              Documentos (ou nas Configurações da categoria).
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
              // "caso": volta pra escolha das 6 pastas; "procuracao": pro tipo.
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
                    Nenhum modelo de procuração sincronizado.
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
                  'Nenhum documento nesta pasta. Use "Sincronizar modelos" na aba Documentos para importar os documentos das pastas da categoria.'
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
