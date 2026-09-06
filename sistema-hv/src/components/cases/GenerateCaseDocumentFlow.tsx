import { useNavigate } from "@tanstack/react-router";
import { Check, ExternalLink, FileSignature, FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CaseFilterFillDialog } from "@/components/cases/CaseFilterFillDialog";
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
  useFinalizeCaseDocument,
  useGenerateCaseDocument,
  useGenerateDocumentAsNewCase,
  useSendCaseDocumentToZapsign,
} from "@/hooks/useCaseDocuments";
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
  useProcuracaoFolderIds,
  useTypeFolders,
} from "@/hooks/useServiceTypeFolders";
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
  temaId,
  clientId,
  canonicalFields,
  autoFill,
  initialMode,
  initialFolderId,
  casoCriaNovoCaso = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  // ITEM 4 (2026-07-07) — mantido por compat com callers; o caminho "Documento de
  // caso" agora seleciona por PASTA (source_folder_id), não mais por case_type.
  caseType?: string;
  // R2-04 — frente do caso (quando houver): filtra as pastas por frente + comuns.
  frenteSlug?: string | null;
  // R2-09 — tema do caso: usado para abrir o pop-up de FILTROS pós-Word.
  temaId?: string | null;
  // R2-09 — cliente do caso: habilita o seletor de caso no pop-up de filtros.
  clientId?: string | null;
  // R2-09 — canonical_fields BRUTO do caso (chaveado por slug do def), para
  // pré-carregar os filtros já preenchidos no pop-up. NÃO usar autoFill.canonical
  // aqui (aquele mapa é re-rotulado em PT e não casa com def.key).
  canonicalFields?: Record<string, unknown> | null;
  autoFill: AutoFillData;
  // ITEM 2 — quando o chamador já sabe o modo (ex.: ficha do cliente já escolheu
  // "Documento do caso" e o caso), pula a pergunta Procuração vs Caso.
  initialMode?: GenMode;
  // Pasta de caso pré-selecionada (drive_folder_id) — pula a etapa de seleção de
  // pasta e vai direto para a seleção de template dentro dela.
  initialFolderId?: string | null;
  // R2-10 — quando true, gerar "Documento de caso" cria um CASO NOVO (não anexa
  // ao caso atual). Procuração/contrato NUNCA cria caso. Ligado na ficha e na aba
  // Documentos; DESLIGADO no "Novo caso" (o caso já foi criado ali).
  casoCriaNovoCaso?: boolean;
}) {
  const navigate = useNavigate();
  const generate = useGenerateCaseDocument(caseId);
  const genAsNewCase = useGenerateDocumentAsNewCase();
  const finalize = useFinalizeCaseDocument(caseId);
  const sendZap = useSendCaseDocumentToZapsign(caseId);
  // R2-10 — quando um "Documento de caso" cria um caso novo, guardamos o id p/ o
  // pop-up de filtros e a navegação ao fechar o editor. null = mesmo caso.
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const activeCaseId = createdCaseId ?? caseId;

  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  // Envio ao ZapSign a partir do editor (2026-07-19) — o botão finaliza o
  // documento (se preciso) e dispara a assinatura. Vale p/ lead ou cliente.
  const [finalized, setFinalized] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signUrl, setSignUrl] = useState<string | null>(null);
  // R2-09 — pop-up de FILTROS do tema, abre após concluir/finalizar o Word.
  const [showFilters, setShowFilters] = useState(false);

  // Dispara o pop-up de filtros do tema uma vez, após finalizar o documento.
  // Se o tema não tiver filtros customizados, o pop-up se fecha sozinho.
  function abrirFiltrosPosWord() {
    if (temaId) setShowFilters(true);
  }

  function closeEditor() {
    setEditorUrl(null);
    setEditorDocId(null);
    setFinalized(false);
    setSignUrl(null);
    // R2-10 — se um caso novo foi criado, navega para ele ao fechar o editor.
    if (createdCaseId) {
      const target = createdCaseId;
      setCreatedCaseId(null);
      navigate({ to: "/casos/$id", params: { id: target } });
    }
  }

  async function enviarAoZapsign() {
    if (!editorDocId) return;
    const nome = signerName.trim();
    if (!nome) {
      toast.error("Informe o nome de quem vai assinar");
      return;
    }
    try {
      // ZapSign exige o documento FINALIZADO (PDF). Finaliza uma vez, se ainda não.
      if (!finalized) {
        await finalize.mutateAsync(editorDocId);
        setFinalized(true);
        abrirFiltrosPosWord();
      }
      const res = await sendZap.mutateAsync({
        docId: editorDocId,
        signers: [
          {
            name: nome,
            email: signerEmail.trim() || undefined,
            authMode: "assinaturaTela-tokenEmail",
            sendAutomaticEmail: true,
          },
        ],
      });
      setSignUrl(res.signUrl ?? null);
      toast.success("Enviado ao ZapSign · e-mail de assinatura disparado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar ao ZapSign");
    }
  }
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
        pending={generate.isPending || genAsNewCase.isPending}
        autoFill={autoFill}
        caseType={caseType}
        frenteSlug={frenteSlug}
        initialMode={initialMode}
        initialFolderId={initialFolderId}
        onGenerate={async (templateId, title, values, docKind, folderId, folderName) => {
          try {
            // R2-10 — "Documento de caso" (contrato) com casoCriaNovoCaso: cria
            // um CASO NOVO e gera o doc nele. Procuração NUNCA cria caso.
            if (docKind === "contrato" && casoCriaNovoCaso) {
              const res = await genAsNewCase.mutateAsync({
                sourceCaseId: caseId,
                templateId,
                title,
                values,
                casoPastaNome: folderName ?? null,
                casoPastaDriveId: folderId ?? null,
              });
              // R2-11 req.5 — o RPC pode ter gerado NO PRÓPRIO caso (1º doc de caso,
              // fica junto da procuração) ou criado um caso NOVO. Só navega/marca se
              // for um caso diferente.
              const isNovoCaso = res.caseId !== caseId;
              setCreatedCaseId(isNovoCaso ? res.caseId : null);
              onOpenChange(false);
              toast.success(
                isNovoCaso
                  ? "Novo caso criado · documento gerado, abrindo editor"
                  : "Documento gerado · abrindo editor",
              );
              setEditorDocId(res.doc.id);
              setEditorUrl(editUrl(res.doc.google_doc_id!));
              setFinalized(false);
              setSignUrl(null);
              setSignerName(autoFill.clientName ?? "");
              setSignerEmail(autoFill.email ?? "");
              return;
            }
            const res = await generate.mutateAsync({ caseId, templateId, title, values, docKind });
            setCreatedCaseId(null);
            onOpenChange(false);
            toast.success("Documento gerado · abrindo editor");
            setEditorDocId(res.doc.id);
            setEditorUrl(editUrl(res.doc.google_doc_id!));
            // Pré-preenche o signatário com os dados do cliente do caso.
            setFinalized(false);
            setSignUrl(null);
            setSignerName(autoFill.clientName ?? "");
            setSignerEmail(autoFill.email ?? "");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao gerar");
          }
        }}
      />

      <Dialog open={!!editorUrl} onOpenChange={(v) => !v && closeEditor()}>
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

          {/* Envio ao ZapSign (2026-07-19) — signatário + botão logo abaixo do
              editor. Vale para lead ou cliente. */}
          <div className="mt-1 rounded-md border border-[var(--border)] p-3 space-y-2">
            <Label className="text-[12px] font-semibold text-[var(--navy)]">
              Enviar para assinatura (ZapSign)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="Nome de quem vai assinar"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
              <Input
                placeholder="E-mail (opcional)"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
              />
            </div>
            {signUrl && (
              <a
                href={signUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--gold-700)] hover:underline text-xs inline-flex items-center gap-1"
              >
                <ExternalLink size={12} /> Link de assinatura
              </a>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Fechar
            </Button>
            <Button
              variant="outline"
              disabled={finalize.isPending || finalized}
              onClick={async () => {
                if (!editorDocId) return;
                try {
                  await finalize.mutateAsync(editorDocId);
                  setFinalized(true);
                  toast.success("Documento finalizado (PDF na pasta do caso)");
                  abrirFiltrosPosWord();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha");
                }
              }}
            >
              {finalize.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
              {finalized ? "Finalizado" : "Concluí a edição (Finalizar)"}
            </Button>
            <Button
              disabled={finalize.isPending || sendZap.isPending || !signerName.trim()}
              onClick={enviarAoZapsign}
            >
              {sendZap.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
              Enviar ao ZapSign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* R2-09 — pop-up de FILTROS do tema, após concluir o Word. Preenchimento
          opcional; grava em canonical_fields. Fecha sozinho se o tema não tem
          filtros customizados. */}
      <CaseFilterFillDialog
        open={showFilters}
        onOpenChange={setShowFilters}
        caseId={activeCaseId}
        clientId={clientId}
        temaId={temaId}
        frenteSlug={frenteSlug}
        // Caso novo → começa em branco; mesmo caso → pré-carrega os atuais.
        initialValues={createdCaseId ? null : canonicalFields}
      />
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
  initialFolderId,
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

  // "Documento de caso", passo 1: escolher a pasta DA CATEGORIA do caso.
  if (mode === "caso" && !folderId) {
    const folders = casoFolders ?? [];
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
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Este tema ainda não tem nenhum tipo de caso. Crie um nas Configurações do tema, na aba
              de pastas.
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
