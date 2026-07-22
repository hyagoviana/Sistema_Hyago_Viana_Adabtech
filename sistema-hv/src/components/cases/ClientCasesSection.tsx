import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { CaseFormDialog, type CreatedCaseLite } from "./CaseFormDialog";
import { GenerateCaseDocumentFlow } from "./GenerateCaseDocumentFlow";
import { Badge } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { useClient } from "@/hooks/useClients";
import { usePodeEditarAlgum } from "@/hooks/usePermissions";
import {
  augmentWithHonorarios,
  augmentWithMunicipio,
  augmentWithPerfil,
  buildAutoFillFromClient,
} from "@/lib/cases/document-autofill";
import { useCaseHonorarios } from "@/hooks/useTermo";
import { useMunicipios, usePerfis } from "@/hooks/useReferencias";
import { useServiceTypes } from "@/hooks/usePipeline";
import { useTemas } from "@/hooks/useTemas";
import {
  getCaseTemaKey,
  getCaseTemaLabel,
  SEM_TEMA_KEY,
  type CaseTemaLabelMaps,
} from "@/lib/cases/case-tema";
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

/**
 * R1-04 — agrupa os casos (já carregados) por TEMA (nível 1), via o adaptador
 * `getCaseTemaKey`. Client-side, sem query nova. Preserva a ordem original dos
 * casos dentro de cada tema (mais recente primeiro). "Sem tema" (SEM_TEMA_KEY),
 * quando existir, vai SEMPRE ao final para que casos legados nunca sumam.
 */
function groupCasesByTema<T extends { tema_id?: string | null; case_type?: string | null }>(
  cases: readonly T[],
): { key: string; items: T[] }[] {
  const order: string[] = [];
  const byKey = new Map<string, T[]>();
  for (const c of cases) {
    const key = getCaseTemaKey(c);
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = [];
      byKey.set(key, bucket);
      order.push(key);
    }
    bucket.push(c);
  }
  // "Sem tema" por último; demais preservam a ordem de primeira aparição.
  order.sort((a, b) => {
    if (a === SEM_TEMA_KEY) return 1;
    if (b === SEM_TEMA_KEY) return -1;
    return 0;
  });
  return order.map((key) => ({ key, items: byKey.get(key)! }));
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
  // 2026-07-19 — cadastro já é CLIENTE? Define a situação inicial do caso sem
  // seletor no popup (CLIENTE → Operacional; LEAD → Comercial).
  clienteEhCliente?: boolean;
};

export function ClientCasesSection({ clientId, clienteEhCliente }: Props) {
  const { data, isLoading, isError, error } = useCasesList({ client_id: clientId });
  const { data: fullClient } = useClient(clientId);
  const { data: municipios } = useMunicipios();
  const { data: perfis } = usePerfis();
  const podeEditar = usePodeEditarAlgum(["comercial", "operacional"]);
  const [createOpen, setCreateOpen] = useState(false);
  // Caso recém-criado cujos documentos (pasta de casos/procurações do tema) o
  // usuário vai escolher/gerar logo após criar — reusa o fluxo do caso.
  const [genFor, setGenFor] = useState<CreatedCaseLite | null>(null);
  // Honorários do caso recém-criado (para pré-preencher documentos financeiros).
  const { data: honorarios } = useCaseHonorarios(genFor?.id ?? "");
  const cases = useMemo(() => data ?? [], [data]);

  // R1-04 — nomes dos grupos (nível 1 = TEMA). Carregados UMA vez, sem query por
  // caso: temas de R2 (tema_id → name) e service_types legados (slug → name).
  // Ambos os hooks têm cache de 5min e são compartilhados com o resto do app.
  const { data: temas } = useTemas();
  const { data: serviceTypes } = useServiceTypes();
  const temaLabelMaps: CaseTemaLabelMaps = useMemo(
    () => ({
      temaNameById: Object.fromEntries((temas ?? []).map((t) => [t.id, t.name])),
      serviceTypeNameBySlug: Object.fromEntries((serviceTypes ?? []).map((s) => [s.slug, s.name])),
    }),
    [temas, serviceTypes],
  );

  // R1-04 — nível 1: agrupa os casos JÁ carregados por TEMA (via adaptador),
  // client-side. "Sem tema" fica ao final; casos legados nunca somem.
  const temaGroups = useMemo(() => groupCasesByTema(cases), [cases]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[24px] font-semibold text-[var(--navy)]">
          Casos do cliente
        </h2>
        {podeEditar && (
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1.5" /> Novo caso
          </Button>
        )}
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
        // R1-04 — nível 1: um bloco por TEMA (header + rótulo amigável +
        // contagem). Dentro de cada tema, R1-03 particiona por lifecycle.
        <div className="space-y-8">
          {temaGroups.map(({ key, items }) => (
            <TemaSection
              key={key}
              label={getCaseTemaLabel(items[0], temaLabelMaps)}
              count={items.length}
              items={items}
            />
          ))}
        </div>
      )}

      <CaseFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        presetClientId={clientId}
        clienteEhCliente={clienteEhCliente}
        onCreated={(created) => setGenFor(created)}
      />

      {/* 2026-07-19 — logo após criar o caso, abre o MESMO fluxo do caso para
          escolher a PASTA e o DOCUMENTO (caso ou procuração) do tema, preencher as
          variáveis, abrir o Word editável e enviar ao ZapSign. Reusa 100% do fluxo
          já existente na ficha do caso (pastas filtradas pelo tipo do tema). */}
      {genFor && (
        <GenerateCaseDocumentFlow
          open={!!genFor}
          onOpenChange={(v) => !v && setGenFor(null)}
          caseId={genFor.id}
          caseType={genFor.case_type}
          frenteSlug={genFor.frente_slug}
          temaId={genFor.tema_id}
          clientId={clientId}
          initialFolderId={genFor.casoFolderId}
          autoFill={(() => {
            let af = buildAutoFillFromClient(fullClient ?? {}, genFor);
            const municipioRow = (municipios ?? []).find(
              (m) => m.nome.trim().toLowerCase() === (genFor.municipio ?? "").trim().toLowerCase(),
            );
            af = augmentWithMunicipio(af, municipioRow);
            const perfilNum = Object.entries(af.canonical ?? {}).find(
              ([k]) => /perfil/i.test(k) && !/informa/i.test(k),
            )?.[1];
            const perfilRow = perfilNum
              ? (perfis ?? []).find(
                  (p) => p.nome.trim().toLowerCase() === perfilNum.trim().toLowerCase(),
                )
              : undefined;
            af = augmentWithPerfil(af, perfilRow);
            af = augmentWithHonorarios(af, honorarios);
            return af;
          })()}
        />
      )}
    </>
  );
}

// R1-03 — item da lista já carregada (mesma forma retornada por useCasesList).
// Derivado do hook para não duplicar/importar o tipo do serviço.
type CaseListItem = NonNullable<ReturnType<typeof useCasesList>["data"]>[number];

// R1-04 — nível 1: um bloco por TEMA. Header com o rótulo amigável do tema
// (via adaptador) + contagem total do tema; abaixo, a partição por lifecycle de
// R1-03 (Efetivados / Aguardando / Perdidos). O tema NUNCA some (mesmo com só
// casos perdidos), mas as subseções vazias somem (CaseGroup retorna null).
function TemaSection({
  label,
  count,
  items,
}: {
  label: string;
  count: number;
  items: CaseListItem[];
}) {
  const { clientes, leads, perdidos } = partitionCasesByLifecycle(items);
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3 pb-1 border-b border-[var(--border)]">
        <span className="text-[12px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-[11px] text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-5">
        <CaseGroup title="Casos efetivados" items={clientes} />
        <CaseGroup title="Aguardando assinatura" items={leads} />
        <CaseGroup title="Perdidos" items={perdidos} />
      </div>
    </section>
  );
}

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
          <div className="text-[15px] text-[var(--navy)] font-semibold group-hover:text-[var(--gold-700)] transition-colors">
            {(c as { caso_pasta_nome?: string | null }).caso_pasta_nome ??
              CASE_TYPE_LABELS[c.case_type as CaseType] ??
              c.case_type}
          </div>
          <span className="text-[11px] text-muted-foreground tracking-wide mt-0.5">
            {c.case_code}
          </span>
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
