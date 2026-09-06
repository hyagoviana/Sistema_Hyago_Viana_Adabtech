import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CaseFilterFillDialog } from "@/components/cases/CaseFilterFillDialog";
import { DocumentPickerDialog, type GenMode } from "@/components/cases/DocumentPickerDialog";
import { Button } from "@/components/ui/button";
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
import { type AutoFillData } from "@/lib/cases/document-autofill";

function editUrl(googleDocId: string): string {
  return `https://docs.google.com/document/d/${googleDocId}/edit?rm=embedded`;
}

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
      <DocumentPickerDialog
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
