import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { CaseFormDialog } from "./CaseFormDialog";
import { Badge } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import {
  CASE_TYPE_LABELS,
  MACRO_OP_LABELS,
  type CaseType,
  type MacroOp,
} from "@/lib/cases/constants";

// R1-03 — lifecycle do caso (LEAD | CLIENTE | PERDIDO), exposto por
// `system_cases_active` (tipado como string). Um caso nasce 'LEAD' (default da
// coluna); casos MUITO antigos podem vir sem o campo → tratados como LEAD.
type Lifecycle = "LEAD" | "CLIENTE" | "PERDIDO";

function caseLifecycle(c: unknown): Lifecycle {
  const lc = (c as { lifecycle?: string | null } | null)?.lifecycle;
  return lc === "CLIENTE" || lc === "PERDIDO" ? lc : "LEAD";
}

/**
 * R1-03 — particiona uma lista de casos (já carregada) por lifecycle do CASO.
 * Preserva a ordem original dentro de cada balde (mais recente primeiro).
 * Reutilizável: R1-04 vai compor este particionamento com o agrupamento por TEMA.
 */
export function partitionCasesByLifecycle<T>(cases: readonly T[]): {
  clientes: T[];
  leads: T[];
  perdidos: T[];
} {
  const clientes: T[] = [];
  const leads: T[] = [];
  const perdidos: T[] = [];
  for (const c of cases) {
    const lc = caseLifecycle(c);
    if (lc === "CLIENTE") clientes.push(c);
    else if (lc === "PERDIDO") perdidos.push(c);
    else leads.push(c);
  }
  return { clientes, leads, perdidos };
}

type Props = {
  clientId: string;
  // ITEM 1 (2026-07-07) — mantidos por compat com os callers (ficha do cliente
  // ainda passa nome/cpf/email/phone), mas não são mais usados aqui: a ação de
  // enviar contrato/procuração saiu desta lista (vai pra aba Documentos do caso).
  clientName?: string;
  clientCpf?: string;
  clientEmail?: string;
  clientPhone?: string;
};

export function ClientCasesSection({ clientId }: Props) {
  const { data, isLoading, isError, error } = useCasesList({ client_id: clientId });
  const [createOpen, setCreateOpen] = useState(false);
  const cases = useMemo(() => data ?? [], [data]);

  // R1-03 — separa os casos JÁ carregados em grupos por lifecycle (client-side,
  // sem query nova). A ordem original (mais recente primeiro) é preservada.
  const { clientes, leads, perdidos } = useMemo(() => partitionCasesByLifecycle(cases), [cases]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[24px] font-semibold text-[var(--navy)]">
          Casos do cliente
        </h2>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Novo caso
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>
            Erro ao listar casos: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="card-editorial !p-8 text-center text-muted-foreground text-sm">
          Esse cliente ainda não tem casos. Clique em "Novo caso" pra começar.
        </div>
      ) : (
        // R1-03 — grupos por lifecycle. Ordem: efetivados (CLIENTE) → aguardando
        // assinatura (LEAD) → perdidos (PERDIDO, ao final). Grupo vazio some.
        <div className="space-y-6">
          <CaseGroup title="Casos efetivados" items={clientes} />
          <CaseGroup title="Aguardando assinatura" items={leads} />
          <CaseGroup title="Perdidos" items={perdidos} />
        </div>
      )}

      <CaseFormDialog open={createOpen} onOpenChange={setCreateOpen} presetClientId={clientId} />
    </>
  );
}

// R1-03 — item da lista já carregada (mesma forma retornada por useCasesList).
// Derivado do hook para não duplicar/importar o tipo do serviço.
type CaseListItem = NonNullable<ReturnType<typeof useCasesList>["data"]>[number];

// R1-03 — uma SEÇÃO por lifecycle (cabeçalho + contagem). Grupo vazio some.
// Reutiliza o MESMO card/<li> de cada item (nada de reescrever o card nem
// mexer no Link to="/casos/$id").
function CaseGroup({ title, items }: { title: string; items: CaseListItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-[12px] text-muted-foreground">({items.length})</span>
      </div>
      <ul className="space-y-2">
        {items.map((c) => (
          <CaseCard key={c.id} c={c} />
        ))}
      </ul>
    </section>
  );
}

// R1-03 — card de UM caso. Extraído SEM alterar layout/markup nem a navegação
// (Link to="/casos/$id") em relação à versão anterior da lista única.
function CaseCard({ c }: { c: CaseListItem }) {
  return (
    <li className="card-editorial !p-4">
      <div className="flex items-center gap-4">
        <Link to="/casos/$id" params={{ id: c.id }} className="flex-1 min-w-0 group">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
          </span>
          <div className="text-[15px] text-[var(--navy)] font-semibold mt-0.5 group-hover:text-[var(--gold-700)] transition-colors">
            {c.case_code}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone="gold">
              {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
            </Badge>
            {c.proximo_passo && (
              <span className="text-[11.5px] text-muted-foreground line-clamp-1">
                {c.proximo_passo}
              </span>
            )}
          </div>
        </Link>
        {/* ITEM 1 (2026-07-07) — a ação "Enviar contrato e procuração" foi
            REMOVIDA da lista de casos da ficha do cliente. Criar/listar caso
            aqui NÃO gera documento; a geração/envio acontece DENTRO do caso
            (aba Documentos). Abra o caso para gerar contrato/procuração. */}
      </div>
    </li>
  );
}
