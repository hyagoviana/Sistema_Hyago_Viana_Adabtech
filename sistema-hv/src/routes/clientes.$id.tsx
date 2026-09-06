import { createFileRoute, notFound } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ClientCasesSection } from "@/components/cases/ClientCasesSection";
import { ClientCpfFillDialog } from "@/components/clients/ClientCpfFillDialog";
import { ClientDataPanel } from "@/components/clients/ClientDataPanel";
import { ClientDocumentsSection } from "@/components/clients/ClientDocumentsSection";
import { Breadcrumb, Card, Eyebrow, OrnamentalDivider } from "@/components/hv/primitives";
import { NotesBlock } from "@/components/notes/NotesBlock";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { useClientPaymentStatus } from "@/hooks/useFinanceiro";
import { useClient, useDeleteClient, useResyncDrive, useTornarCliente } from "@/hooks/useClients";
import { useMyModulePerms, useMyModuleValues, usePodeEditarAlgum } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { podeVerValores } from "@/lib/rbac";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { usePublishRouteTitle } from "@/lib/route-title";

// ITEM 6 (2026-07-07) — quando o cadastro é aberto a partir de "Cadastro"
// (Inteligência › Cadastro / aba Leads), guardamos a origem em ?from=cadastro
// para o breadcrumb voltar a Cadastro (e não "jogar" o usuário na aba Clientes).
export const Route = createFileRoute("/clientes/$id")({
  validateSearch: (s: Record<string, unknown>): { from?: "cadastro" } => ({
    from: s.from === "cadastro" ? "cadastro" : undefined,
  }),
  component: ClienteDetalhe,
});

function maskCpfCnpj(d: string): string {
  const c = d.replace(/\D/g, "");
  if (c.length === 11) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  if (c.length === 14)
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  return d;
}

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: cliente, isLoading, isError, error } = useClient(id);
  const { data: casesData } = useCasesList({ client_id: id });
  const resyncMutation = useResyncDrive();
  const deleteMutation = useDeleteClient();
  const tornarClienteMutation = useTornarCliente();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // J2 — preencher CPF real (troca o marcador CL-XXXX dos importados Mais Médicos).
  const [cpfFillOpen, setCpfFillOpen] = useState(false);

  // R4-01 — gate de $ na ficha do cliente. Único booleano trocável.
  // Usa a infra efetiva de R3-01 (permissaoEfetiva): combina o PAPEL com
  // overrides por usuário×módulo. Com a tabela de overrides vazia isto é
  // IDÊNTICO ao papel (regressão zero) — apenas ganha overrides quando existirem.
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  const { data: values } = useMyModuleValues();
  const podeVerFinanceiro = podeVerValores(role, perms ?? {}, values ?? {}, "financeiro");
  // Editar/excluir/tornar cliente = escrita de cadastro (comercial OU operacional).
  const podeEditarCadastro = usePodeEditarAlgum(["comercial", "operacional"]);

  // S4-06 — título da aba por NOME (full_name), nunca UUID.
  const clienteLabel = resolveEntityLabel(cliente?.full_name, {
    loading: isLoading,
    notFound: isError,
    notFoundLabel: "Cliente não encontrado",
  });
  useDocumentTitle(clienteLabel);
  // fix breadcrumb Topbar (2026-07-03) — publica o nome para o Topbar.
  usePublishRouteTitle(clienteLabel);

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-6 w-64 mb-4" />
        <Skeleton className="h-24 w-full mb-8" />
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "erro desconhecido";
    if (msg.toLowerCase().includes("não encontrado")) throw notFound();
    return (
      <div className="page-container">
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar cliente: {msg}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!cliente) throw notFound();

  const cases = casesData ?? [];
  // 2026-07-19 — o cadastro é CLIENTE quando foi marcado manualmente
  // (marcado_cliente_at) OU já tem um caso efetivado (lifecycle CLIENTE). Define a
  // situação inicial dos novos casos sem seletor no popup ("Novo tema").
  const ehCliente =
    Boolean((cliente as { marcado_cliente_at?: string | null }).marcado_cliente_at) ||
    cases.some((c) => (c as { lifecycle?: string | null }).lifecycle === "CLIENTE");
  // J2 — CPF pendente: importados Mais Médicos (A8) vieram com o marcador CL-XXXX
  // em cpf_cnpj e `custom_fields.cpf_pendente=true`. Detecta por qualquer um dos
  // dois (o serviço limpa o flag ao gravar o CPF real).
  const cpfCustom = ((): Record<string, unknown> => {
    const cf = (cliente as { custom_fields?: unknown }).custom_fields;
    return cf && typeof cf === "object" && !Array.isArray(cf)
      ? (cf as Record<string, unknown>)
      : {};
  })();
  const cpfPendente =
    cpfCustom.cpf_pendente === true ||
    cpfCustom.cpf_pendente === "true" ||
    (cliente.cpf_cnpj ?? "").toUpperCase().startsWith("CL-");
  const totalCasos = cases.length;
  const receitaTotalCentavos = cases.reduce(
    (sum, c) => sum + (typeof c.valor_centavos === "number" ? c.valor_centavos : 0),
    0,
  );
  const formatBRL = (centavos: number) =>
    (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          from === "cadastro"
            ? { label: "Cadastro", to: "/inteligencia/leads" }
            : { label: "Clientes", to: "/clientes" },
          { label: cliente.full_name },
        ]}
      />

      <header className="flex items-end gap-6 mb-8">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center font-display text-[40px] font-bold text-[var(--navy)]"
          style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
        >
          {cliente.full_name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1">
          <Eyebrow>
            {cliente.tipo ? `${cliente.tipo} · ` : ""}CPF/CNPJ {maskCpfCnpj(cliente.cpf_cnpj)}
          </Eyebrow>
          <h1 className="font-display text-[40px] font-bold text-[var(--navy)] mt-2 h1-ornament">
            {cliente.full_name}
          </h1>
        </div>
        {/* Ações de escrita só para quem pode editar o cadastro (2026-07-19). */}
        {podeEditarCadastro && (
          <div className="flex gap-2 self-start mt-2">
            {/* Tornar cliente — só enquanto for LEAD (não marcado como cliente). */}
            {!(cliente as { marcado_cliente_at?: string | null }).marcado_cliente_at && (
              <Button
                size="sm"
                disabled={tornarClienteMutation.isPending}
                onClick={async () => {
                  try {
                    await tornarClienteMutation.mutateAsync(cliente.id);
                    toast.success("Cadastro agora é um cliente.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Falha ao tornar cliente");
                  }
                }}
              >
                Tornar esse lead um cliente
              </Button>
            )}
            {/* S3-01 — o cadastro virou PÁGINA; o botão navega em vez de abrir pop-up. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/clientes/editar/$id", params: { id: cliente.id } })}
            >
              <Pencil size={14} className="mr-1.5" /> Editar
            </Button>
            {/* S3-03 — a pasta do Drive virou BOTÃO. Thiago: "Vamos alterar do
                visual de um painel/menu que ocupa tanto espaço e manter como um
                botão (de fácil visualização, mas menor e mais proporcional do que
                o formato atual)". */}
            {cliente.drive_folder_url && (
              <Button asChild variant="outline" size="sm">
                <a href={cliente.drive_folder_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="mr-1.5" /> Abrir no Drive
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} className="mr-1.5" /> Excluir
            </Button>
          </div>
        )}
      </header>

      {cliente.drive_sync_failed && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao criar pasta no Google Drive</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-xs opacity-80 truncate">
              {cliente.drive_sync_error ?? "Erro desconhecido"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={resyncMutation.isPending}
              onClick={async () => {
                try {
                  await resyncMutation.mutateAsync(cliente.id);
                  toast.success("Pasta criada no Drive");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falhou de novo");
                }
              }}
            >
              <RefreshCw
                size={14}
                className={`mr-1.5 ${resyncMutation.isPending ? "animate-spin" : ""}`}
              />
              {resyncMutation.isPending ? "Tentando…" : "Tentar de novo"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* J2 — CPF pendente (importados Mais Médicos): destaca o marcador CL-XXXX e
          oferece preencher o CPF real. Só para quem pode editar o cadastro. */}
      {cpfPendente && (
        <Alert className="mb-6 border-[var(--gold)] bg-[var(--cream)]">
          <AlertTriangle className="h-4 w-4 text-[var(--gold-700)]" />
          <AlertTitle>CPF pendente</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-xs opacity-90">
              Este cadastro está com um marcador provisório ({cliente.cpf_cnpj}) no lugar do
              CPF/CNPJ. Preencha o número real para completar o cadastro.
            </span>
            {podeEditarCadastro && (
              <Button size="sm" variant="outline" onClick={() => setCpfFillOpen(true)}>
                <Pencil size={14} className="mr-1.5" /> Preencher CPF
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Total de casos" value={totalCasos} />
        <Stat label="Receita total" value={formatBRL(receitaTotalCentavos)} />
        <Stat label="LTV estimado" value={formatBRL(receitaTotalCentavos)} />
      </div>

      <OrnamentalDivider />

      {/* S3-03 (reunião 02/09) — painel único DADOS DO CLIENTE, no lugar dos cards
          "Contato" + "Pasta no Drive" (que virou botão no cabeçalho) e do
          "Dados profissionais" (absorvido). Só campos da entidade CLIENTE —
          campos de caso não entram, como o Thiago pediu. */}
      <ClientDataPanel cliente={cliente as unknown as Record<string, unknown>} />

      {/* S3-04 — a ordem da página é a que o Thiago desenhou (33-35):
          dados do cliente → casos + financeiro → notas → documentos.
          Documentos desceu para o fim: é consulta pontual, não a foto que se
          quer ao abrir a ficha. */}

      <ClientCasesSection
        clientId={cliente.id}
        clientName={cliente.full_name}
        clientCpf={cliente.cpf_cnpj ?? undefined}
        clientEmail={cliente.email ?? undefined}
        clientPhone={cliente.phone ?? undefined}
        clienteEhCliente={ehCliente}
      />

      {/* S3-04 AC3 — `ClientFinanceiroSection` SAIU: era uma ilha com o total do
          cliente, sem dizer de qual caso vinha cada valor, e é justamente o que o
          Thiago pediu para unificar. O total agora abre a seção de casos, e cada
          card traz o resumo do próprio caso.

          O SELO binário continua para quem não pode ver valores: é a única coisa
          que esse papel enxerga do financeiro, e some junto se não ficar aqui. */}
      {!podeVerFinanceiro && (
        <>
          <OrnamentalDivider />
          <ClientPaymentStatusSeal clientId={cliente.id} />
        </>
      )}

      <OrnamentalDivider />

      {/* S4-03 — bloco de notas do cliente (auth-only, soft-delete). */}
      <NotesBlock target="client" entityId={cliente.id} />

      <OrnamentalDivider />

      <h2 className="font-display text-[24px] font-semibold text-[var(--navy)] mb-3">
        Documentos do cliente
      </h2>
      <ClientDocumentsSection
        clientId={cliente.id}
        clientHasDriveFolder={!!cliente.drive_folder_id}
      />

      {/* S4-02 — a lista agregada de documentos de casos (ClientCaseDocumentsSection)
          foi REMOVIDA: documentos de caso vivem DENTRO do caso (CaseDocumentsTab),
          para não misturar docs de casos diferentes na ficha do cliente. Os docs
          pessoais do cliente (acima) permanecem. */}

      {/* J2 — preencher/trocar o CPF real (marcador CL-XXXX → CPF válido). */}
      <ClientCpfFillDialog
        open={cpfFillOpen}
        onOpenChange={setCpfFillOpen}
        clientId={cliente.id}
        currentCpf={cliente.cpf_cnpj}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {cliente.full_name} permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>PERMANENTE e não pode ser desfeita</strong>. O cliente e{" "}
              <strong>tudo que depende dele</strong> · casos, documentos, parcelas, notas e
              consentimentos · serão apagados do banco. A pasta no Google Drive não é apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteMutation.mutateAsync(cliente.id);
                  toast.success("Cliente excluído");
                  navigate({ to: "/clientes" });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erro ao excluir");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// R4-04 (AC-3) — SELO BINÁRIO para papéis SEM `financeiro:view`. Consome o
// endpoint leve `getClientPaymentStatusFn` (requireAuth), que devolve só
// `{ emDia }` — nenhum valor $ passa por aqui. Substitui o antigo "—".
function ClientPaymentStatusSeal({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientPaymentStatus(clientId);

  return (
    <div>
      <h2 className="text-[19px] font-semibold text-[var(--navy)] mb-4">Financeiro do cliente</h2>
      <div className="card-hero p-4 flex items-center justify-between gap-4">
        <span className="text-[13px] text-muted-foreground">Situação financeira</span>
        {isLoading ? (
          <Badge className="bg-muted text-muted-foreground text-[11px]">…</Badge>
        ) : data?.emDia ? (
          <Badge className="bg-green-100 text-green-800 text-[11px]">Em dia</Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 text-[11px]">Devendo</Badge>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <div className="kpi-number text-[36px] mt-3">{value}</div>
    </Card>
  );
}
