import { Check, FileSignature, FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  useSyncProcuracaoTemplates,
  useTemplatePlaceholders,
  useTemplatesByFolder,
  useTemplatesByFolders,
} from "@/hooks/useDocumentTemplates";
import { useServiceTypes } from "@/hooks/usePipeline";
import {
  CATEGORIAS_MODELO,
  type CategoriaModelo,
  pastaDaCategoria,
  useCreateTypeFolder,
  useProcuracaoFolderIds,
  useTypeFolders,
  useUploadTypeTemplate,
} from "@/hooks/useServiceTypeFolders";
import {
  type AutoFillData,
  type TemplateField,
  resolveAutoValue,
} from "@/lib/cases/document-autofill";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";

// Diálogo de escolha de modelo — TELA ÚNICA para os dois pontos de entrada:
// o botão do topo da ficha do caso (`GenerateCaseDocumentFlow`) e o "Gerar
// documento" da aba Documentos (`CaseDocumentsTab`).
//
// Os dois tinham uma cópia quase idêntica deste diálogo — ~460 linhas duplicadas.
// Toda alteração precisava ser feita duas vezes, e as cópias já haviam divergido:
// só a da ficha avisava sobre placeholder órfão, só a da aba oferecia criar a
// pasta no empty-state. Unificar traz o melhor dos dois para os dois lados; o
// que era específico da aba virou a prop opcional `permiteCriarPasta`.
//
// S2-04 — o fluxo tem TRÊS telas (Thiago, resposta B2): tipo de caso →
// categoria (judicial / contrato e procuração / administrativo) → modelo. A
// tela de categoria só aparece para tipo que já tem a estrutura MODELOS no
// Drive; tipo antigo vai direto do tipo ao modelo.
export type GenMode = "procuracao" | "caso";

export function DocumentPickerDialog({
  open,
  onOpenChange,
  pending,
  onGenerate,
  autoFill,
  caseType,
  frenteSlug,
  initialMode,
  initialFolderId,
  permiteCriarPasta = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
  onGenerate: (
    templateId: string,
    title: string,
    values: Record<string, string>,
    docKind: "procuracao" | "contrato",
    // R2-10 — pasta escolhida (Documento de caso) p/ nomear o caso novo.
    folderId?: string | null,
    folderName?: string | null,
  ) => void;
  autoFill: AutoFillData;
  caseType?: string;
  frenteSlug?: string | null;
  initialMode?: GenMode;
  initialFolderId?: string | null;
  // Empty-state ativo: quando o tema não tem nenhum tipo, oferece criar a pasta e
  // já anexar um Word. Só a aba Documentos tinha isso; agora é opcional porque o
  // popup do topo da ficha é um atalho, não o lugar de configurar o tema.
  permiteCriarPasta?: boolean;
}) {
  const [mode, setMode] = useState<GenMode | null>(
    initialMode ?? (initialFolderId ? "caso" : null),
  );
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  // ITEM 4 — "Documento de caso": passo 1 = escolher 1 das 6 pastas; passo 2 =
  // só os docs daquela pasta (filtro por source_folder_id).
  // Quando initialFolderId é passado, pula a escolha de pasta.
  const [folderId, setFolderId] = useState<string | null>(initialFolderId ?? null);
  // S2-04 — o fluxo virou TRÊS telas (Thiago, resposta B2): "primeira tela vai
  // virar a de selecionar o tipo de caso. 2ª a de selecionar se quero um modelo
  // de procuração e contrato / documento judicial / documento administrativo.
  // 3ª tela selecionado o modelo conforme a categoria (em que pasta está)".
  //
  // A categoria só entra quando o TIPO escolhido já tem a estrutura MODELOS no
  // Drive; tipo antigo (sem estrutura) continua indo direto do tipo ao modelo.
  const [categoria, setCategoria] = useState<CategoriaModelo | null>(null);
  // Empty-state (`permiteCriarPasta`): criar a pasta do tipo e anexar o 1º Word.
  const criarPastaTipo = useCreateTypeFolder();
  const uploadTemplate = useUploadTypeTemplate();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [nomeNovaPasta, setNomeNovaPasta] = useState("");

  // (2026-07-10) — as pastas são POR CATEGORIA (system_service_type_folders).
  // Resolve o tipo do caso pelo slug e busca suas pastas de caso e de procuração.
  const { data: serviceTypes } = useServiceTypes();
  const serviceTypeId = (serviceTypes ?? []).find((t) => t.slug === caseType)?.id ?? null;
  // R2-09 — a camada FRENTE foi removida (casos nascem sem frente). Ignoramos o
  // filtro de frente aqui (`?? undefined` → todas as pastas do tema); senão pastas
  // marcadas com uma frente legada (ex.: COVID) somem para casos sem frente.
  const { data: casoFolders } = useTypeFolders(serviceTypeId, "caso", frenteSlug ?? undefined);
  // S2-04 — fonte única: categoria "CONTRATO E PROCURAÇÃO" de cada tipo +
  // vínculos `kind='procuracao'` legados.
  const { data: procFolderIdsData } = useProcuracaoFolderIds(serviceTypeId);
  const procFolderIds = procFolderIdsData ?? [];

  // Modelos por modo: procuração (só as pastas de procuração DA CATEGORIA) vs
  // pasta de caso escolhida (também da categoria). Antes a procuração usava
  // useDocumentTemplates('PROCURACAO', true) — listava procurações de TODAS as
  // categorias; e o "documento de caso" usava a lista GLOBAL de pastas.
  const { data: procTemplates } = useTemplatesByFolders(
    mode === "procuracao" ? procFolderIds : null,
  );
  // S2-04 — o TIPO escolhido e a pasta da categoria dentro dele.
  const tipoEscolhido = (casoFolders ?? []).find((f) => f.drive_folder_id === folderId);
  const tipoTemEstrutura = !!tipoEscolhido?.drive_modelos_folder_id;
  const pastaCategoria = categoria ? pastaDaCategoria(tipoEscolhido, categoria) : null;

  // Tipo COM estrutura nova → os modelos vêm da pasta da categoria. Tipo antigo →
  // da própria pasta do tipo, como sempre foi.
  const { data: folderTemplates } = useTemplatesByFolder(
    mode === "caso" ? (tipoTemEstrutura ? pastaCategoria : folderId) : null,
  );
  const syncProc = useSyncProcuracaoTemplates();

  useEffect(() => {
    if (open) {
      setMode(initialMode ?? (initialFolderId ? "caso" : null));
      setTemplateId("");
      setValues({});
      setFolderId(initialFolderId ?? null);
      setCategoria(null);
      setNomeNovaPasta("");
    }
  }, [open, initialMode, initialFolderId]);

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

  // A7 AC5(a) — placeholders ÓRFÃOS: variáveis do modelo que NÃO casam com nenhum
  // campo/autofill (resolveAutoValue devolve undefined). Sinaliza de forma NÃO
  // bloqueante ("sem campo correspondente · preencha manualmente"); não altera o
  // fluxo de geração. Um placeholder que resolve por autofill NÃO é órfão.
  const orphanKeys = useMemo(() => {
    const set = new Set<string>();
    for (const f of fields) {
      if (f.source === "blank") continue;
      if (resolveAutoValue(f, autoFill) == null) set.add(f.key);
    }
    return set;
  }, [fieldsKey, autoFill]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // "Documento de caso", passo 1: escolher o TIPO (pasta) do tema.
  if (mode === "caso" && !folderId) {
    const folders = casoFolders ?? [];
    const criandoPasta = criarPastaTipo.isPending || uploadTemplate.isPending;

    // Empty-state: cria a pasta do tipo e já sobe o primeiro modelo, para quem
    // caiu aqui num tema ainda não configurado não precisar sair da tela.
    const criarPastaEAnexar = async (file: File) => {
      if (!serviceTypeId) {
        toast.error("Tema do caso não encontrado");
        return;
      }
      const nome = nomeNovaPasta.trim();
      if (!nome) {
        toast.error("Dê um nome para a pasta");
        return;
      }
      try {
        const folder = await criarPastaTipo.mutateAsync({
          serviceTypeId,
          kind: "caso",
          name: nome,
          frenteSlug: frenteSlug ?? null,
        });
        await uploadTemplate.mutateAsync({
          serviceTypeId,
          kind: "caso",
          folderId: folder.drive_folder_id,
          file,
          // Empty-state: o primeiro modelo do tipo vai para ADMINISTRATIVO, que é
          // o que a maioria dos modelos do escritório é (requerimentos e
          // declarações). Quem quiser outra categoria usa a tela de configuração.
          categoria: "administrativo",
        });
        toast.success("Pasta criada e documento anexado");
        setNomeNovaPasta("");
        setFolderId(folder.drive_folder_id);
        setCategoria(null);
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
            <DialogTitle>Escolha o tipo de caso</DialogTitle>
            <DialogDescription>
              Só os tipos deste tema aparecem. Depois você escolhe a categoria do documento.
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
                    setCategoria(null);
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
                Este tema ainda não tem nenhum tipo de caso.
                {permiteCriarPasta
                  ? " Quer incluir um agora? Dê um nome à pasta e anexe um documento Word · ou saia se clicou aqui sem querer."
                  : " Crie um nas Configurações do tema, na aba de pastas."}
              </p>
              {permiteCriarPasta && (
                <>
                  <div>
                    <Label>Nome da nova pasta</Label>
                    <Input
                      value={nomeNovaPasta}
                      onChange={(e) => setNomeNovaPasta(e.target.value)}
                      placeholder="Ex.: Documentos gerais"
                      disabled={criandoPasta}
                    />
                  </div>
                  <input
                    ref={arquivoRef}
                    type="file"
                    accept=".doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) criarPastaEAnexar(file);
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={criandoPasta || !nomeNovaPasta.trim()}
                    onClick={() => arquivoRef.current?.click()}
                  >
                    {criandoPasta ? "Enviando…" : "Anexar documento e criar pasta"}
                  </Button>
                </>
              )}
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

  // S2-04, tela 2 — a categoria do documento dentro do TIPO. Só aparece para tipo
  // que já tem a estrutura MODELOS no Drive; tipo antigo pula direto para o
  // modelo, com o comportamento de sempre.
  if (mode === "caso" && folderId && tipoTemEstrutura && !categoria) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categoria do documento</DialogTitle>
            <DialogDescription>
              {tipoEscolhido?.name?.trim()} · escolha em que pasta de modelos procurar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {CATEGORIAS_MODELO.map((c) => {
              const pasta = pastaDaCategoria(tipoEscolhido, c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!pasta}
                  onClick={() => {
                    setCategoria(c.id);
                    setTemplateId("");
                    setValues({});
                  }}
                  className="flex items-center gap-2 rounded-md border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {c.id === "contrato" ? (
                    <FileSignature size={15} className="text-[var(--gold-700)] shrink-0" />
                  ) : (
                    <FileText size={15} className="text-[var(--gold-700)] shrink-0" />
                  )}
                  <span className="text-[13px] font-medium text-[var(--navy)]">{c.rotulo}</span>
                  {!pasta && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      pasta não criada
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderId(null)}>
              ← Voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isProc = mode === "procuracao";
  const folderLabel = (casoFolders ?? []).find((f) => f.drive_folder_id === folderId)?.name;
  const categoriaLabel = CATEGORIAS_MODELO.find((c) => c.id === categoria)?.rotulo;

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
              // Volta um passo só: da lista de modelos para a categoria (quando
              // o tipo tem a estrutura nova), da categoria para o tipo, e da
              // procuração para a primeira tela.
              if (isProc) {
                setMode(null);
              } else if (tipoTemEstrutura && categoria) {
                setCategoria(null);
              } else {
                setFolderId(null);
              }
              setTemplateId("");
              setValues({});
            }}
            className="text-xs text-[var(--gold-700)] hover:underline"
          >
            {isProc
              ? "← Trocar tipo de documento"
              : tipoTemEstrutura && categoria
                ? "← Trocar categoria"
                : "← Trocar tipo de caso"}
          </button>
          <div>
            <Label>
              {isProc
                ? "Modelo de procuração"
                : `${folderLabel?.trim() ?? "Tipo"}${categoriaLabel ? ` · ${categoriaLabel}` : ""}`}
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
            // A7 AC5(a) — órfão: variável sem campo/autofill correspondente.
            const isOrphan = orphanKeys.has(f.key);
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
                {isOrphan && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    sem campo correspondente · preencha manualmente
                  </p>
                )}
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
                isProc ? null : folderId,
                isProc ? null : (folderLabel ?? null),
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
