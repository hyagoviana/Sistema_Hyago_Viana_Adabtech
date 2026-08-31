// Tela de TAREFAS — reescrita conforme o doc "31.08 — tarefas" (Thiago).
//
// Conceito que o documento fixa: "tratar as tarefas como o centro da rotina de
// trabalho […] cada colaborador deve estar visualmente vinculado a algo que
// deveria fazer, por isso a rotina orbita ao redor das tarefas que sejam de sua
// responsabilidade."
//
// O que mudou aqui, item por item do doc:
//   1. Saiu a coluna "Prazos" (a função prazo desvinculado de tarefa foi retirada
//      do produto) e saíram os KPIs de prazo.
//   2. Saiu a visualização unificada com CHECKLIST — checklist agora vive só na
//      página do caso (o hook pede incluirChecklist: false).
//   3. A lista foi dividida em DOIS menus: "Em atraso" e "Em prazo".
//   4. Paginação de 10 itens por vez, com navegação entre páginas.
//   5. Ordem cronológica canônica (prazo → prioridade → criação), calculada no
//      servidor por ordenarWorkItems().
//   6. A visão PADRÃO é só das tarefas do próprio usuário; ver as dos outros é
//      opção, não default.
//   7. Filtros novos: tema, tipo de tarefa e prioridade. (O filtro de "status"
//      saiu: a lista é de tarefas ABERTAS, e os demais status são conclusões.)

import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { TaskTypePicker } from "@/components/hv/TaskTypePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkItems } from "@/hooks/useDossie";
import { useTemas } from "@/hooks/useTemas";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/tarefas")({
  component: TarefasPage,
});

/** Itens por página — "listas com até 10 tarefas por visualização" (doc 31.08). */
const POR_PAGINA = 10;

/** Sentinela do seletor de colaborador: "todos" só existe para quem pode ver tudo. */
const TODOS = "__todos__";

const PRIO_TONE: Record<string, string> = {
  URGENTE: "var(--danger)",
  ALTA: "var(--warning)",
  MEDIA: "var(--ink-500)",
  BAIXA: "var(--ink-400)",
};
const PRIO_LABEL: Record<string, string> = {
  URGENTE: "Urgente",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};
const PRIORIDADES = ["URGENTE", "ALTA", "MEDIA", "BAIXA"] as const;

/**
 * Dias entre hoje e o prazo (YYYY-MM-DD), pelo CALENDÁRIO.
 * Negativo = atraso; 0 = vence hoje; positivo = ainda falta.
 * Comparar meia-noite dos dois lados evita "vence hoje" já aparecer como atraso.
 */
function diasAteVencer(ymd: string): number {
  const [a, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const alvo = new Date(a, (m ?? 1) - 1, d ?? 1);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function TarefasPage() {
  const { profile } = useAuth();
  const meuId = profile?.id ?? null;

  // Doc 31.08: "a visualização padrão deve ser vinculada apenas as tarefas do
  // próprio usuário (não há problema poder ver as demais, por opção)".
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [inicializado, setInicializado] = useState(false);
  useEffect(() => {
    if (!inicializado && meuId) {
      setAssigneeId(meuId);
      setInicializado(true);
    }
  }, [meuId, inicializado]);

  const [aba, setAba] = useState<"atraso" | "prazo">("atraso");
  const [search, setSearch] = useState<string>("");
  const [temaId, setTemaId] = useState<string>("");
  const [taskTypeId, setTaskTypeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<string>("");
  const [pagina, setPagina] = useState(1);

  // Só tarefas ABERTAS chegam aqui (o serviço já recorta), então não há filtro de
  // status: os outros três status do vocabulário são conclusões, e filtrar por
  // eles devolveria lista vazia sempre.
  const workQ = useWorkItems({
    assigneeId: assigneeId || null,
    search: search || null,
    temaId: temaId || null,
    taskTypeId: taskTypeId || null,
    priority: priority || null,
  });
  const canSeeAll = workQ.data?.canSeeAll ?? false;
  const { data: users } = useUsers();
  const { data: temas } = useTemas();
  const loading = workQ.isLoading;

  // A lista já vem ordenada do servidor (prazo → prioridade → criação).
  const items = useMemo(() => workQ.data?.items ?? [], [workQ.data]);

  // Doc 31.08 — "dividir entre 2 menus: tarefas em atraso / tarefas em prazo".
  // Em atraso = tem prazo E o prazo já passou. Tudo o mais (inclusive vence hoje
  // e sem prazo) é "em prazo": ainda dá para cumprir.
  const { atrasadas, emPrazo } = useMemo(() => {
    const a: typeof items = [];
    const p: typeof items = [];
    for (const it of items) {
      if (it.due_date && diasAteVencer(it.due_date) < 0) a.push(it);
      else p.push(it);
    }
    return { atrasadas: a, emPrazo: p };
  }, [items]);

  const lista = aba === "atraso" ? atrasadas : emPrazo;
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  // Mudar de aba/filtro pode deixar a página atual fora do intervalo.
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = lista.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  // Qualquer mudança de recorte volta para a primeira página — senão a pessoa
  // filtra e cai numa página vazia sem entender por quê.
  useEffect(() => {
    setPagina(1);
  }, [aba, assigneeId, search, temaId, taskTypeId, priority]);

  const selCls =
    "h-9 rounded-md border border-[var(--border)] bg-white px-2.5 text-[13px] text-[var(--navy)] focus:outline-none focus:border-[var(--gold)]";

  const soMinhas = !!meuId && assigneeId === meuId;

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Tarefas" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Tarefas"
        subtitle={
          soMinhas
            ? "As tarefas sob a sua responsabilidade — em atraso primeiro."
            : "Tarefas atribuídas aos colaboradores — em atraso primeiro."
        }
      />

      {/* KPIs — o doc pediu a leitura por SITUAÇÃO da tarefa (em dia × vencida),
          não mais por "prazos" como entidade separada. Clicar troca a aba. */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Kpi
          label="Tarefas abertas"
          value={items.length}
          icon={CheckSquare}
          loading={loading}
          onClick={undefined}
        />
        <Kpi
          label="Em atraso"
          value={atrasadas.length}
          icon={AlertCircle}
          loading={loading}
          danger={atrasadas.length > 0}
          featured
          onClick={() => setAba("atraso")}
        />
        <Kpi
          label="Em prazo"
          value={emPrazo.length}
          icon={CheckSquare}
          loading={loading}
          onClick={() => setAba("prazo")}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, caso ou cliente…"
          className={`${selCls} min-w-[220px] flex-1`}
        />
        {canSeeAll && (
          <select
            value={assigneeId || TODOS}
            onChange={(e) => setAssigneeId(e.target.value === TODOS ? "" : e.target.value)}
            className={selCls}
          >
            {meuId && <option value={meuId}>Minhas tarefas</option>}
            <option value={TODOS}>Todos os colaboradores</option>
            {(users ?? [])
              .filter((u) => u.id !== meuId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
          </select>
        )}
        <select value={temaId} onChange={(e) => setTemaId(e.target.value)} className={selCls}>
          <option value="">Todos os temas</option>
          {((temas as Array<{ id: string; name: string }> | undefined) ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selCls}>
          <option value="">Todas as prioridades</option>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {PRIO_LABEL[p]}
            </option>
          ))}
        </select>
        {/* Classe → tipo (mesmo seletor usado ao criar tarefa e nos workflows). */}
        <div className="flex items-end gap-2">
          <TaskTypePicker
            value={taskTypeId}
            onChange={setTaskTypeId}
            emptyLabel="Todos os tipos"
            showLabels={false}
            estado="todos"
            classeWidth="w-[140px]"
            tipoWidth="w-[190px]"
          />
        </div>
      </div>

      {/* Dois menus (doc 31.08) */}
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--border)]">
        <Tab
          ativo={aba === "atraso"}
          onClick={() => setAba("atraso")}
          label="Tarefas em atraso"
          count={atrasadas.length}
          danger
        />
        <Tab
          ativo={aba === "prazo"}
          onClick={() => setAba("prazo")}
          label="Tarefas em prazo"
          count={emPrazo.length}
        />
      </div>

      <div className="card-editorial !p-0 overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : visiveis.length === 0 ? (
          <Empty>
            {aba === "atraso"
              ? "Nenhuma tarefa em atraso com os filtros atuais."
              : "Nenhuma tarefa em prazo com os filtros atuais."}
          </Empty>
        ) : (
          visiveis.map((it, i) => {
            const dias = it.due_date ? diasAteVencer(it.due_date) : null;
            const atrasada = dias !== null && dias < 0;
            const prazoTexto =
              dias === null
                ? "sem prazo"
                : atrasada
                  ? `${Math.abs(dias)}d atraso`
                  : dias === 0
                    ? "vence hoje"
                    : `${dias}d`;
            const prazoTone = atrasada
              ? "var(--danger)"
              : dias !== null && dias <= 3
                ? "var(--warning)"
                : "var(--ink-500)";
            const quem = it.assignee_name ? ` · ${it.assignee_name}` : "";
            const tipo = it.task_type_name ? ` · ${it.task_type_name}` : "";
            return (
              <Row
                key={`${it.type}:${it.id}`}
                caseId={it.case_id}
                primary={it.title}
                secondary={`${it.client_name} · ${it.case_code}${quem}${tipo}`}
                prazo={prazoTexto}
                prazoTone={prazoTone}
                prioridade={PRIO_LABEL[it.priority ?? "MEDIA"] ?? "·"}
                prioridadeTone={PRIO_TONE[it.priority ?? "MEDIA"] ?? "var(--ink-500)"}
                last={i === visiveis.length - 1}
              />
            );
          })
        )}
      </div>

      {lista.length > POR_PAGINA && (
        <Paginacao
          pagina={paginaAtual}
          total={totalPaginas}
          itens={lista.length}
          onChange={setPagina}
        />
      )}
    </div>
  );
}

function Tab({
  ativo,
  onClick,
  label,
  count,
  danger,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
  count: number;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative px-3.5 py-2 text-[13.5px] font-medium transition-colors"
      style={{ color: ativo ? "var(--navy)" : "var(--ink-500)" }}
    >
      {label}
      <span
        className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full"
        style={{
          background: danger && count > 0 ? "rgba(190,60,60,0.12)" : "var(--ink-100)",
          color: danger && count > 0 ? "var(--danger)" : "var(--ink-700)",
        }}
      >
        {count}
      </span>
      {ativo && (
        <span
          className="absolute left-0 right-0 -bottom-px h-[2px]"
          style={{ background: "var(--gold)" }}
        />
      )}
    </button>
  );
}

function Paginacao({
  pagina,
  total,
  itens,
  onChange,
}: {
  pagina: number;
  total: number;
  itens: number;
  onChange: (p: number) => void;
}) {
  // Janela de no máximo 7 números em volta da página atual — com 40 páginas,
  // listar todas viraria uma régua ilegível.
  const inicio = Math.max(1, Math.min(pagina - 3, total - 6));
  const fim = Math.min(total, inicio + 6);
  const numeros = [];
  for (let i = inicio; i <= fim; i++) numeros.push(i);

  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <span className="text-[12px] text-muted-foreground">
        {itens} tarefa{itens === 1 ? "" : "s"} · página {pagina} de {total}
      </span>
      <div className="flex items-center gap-1">
        <PagBtn disabled={pagina === 1} onClick={() => onChange(pagina - 1)}>
          <ChevronLeft size={14} />
        </PagBtn>
        {numeros.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="min-w-[30px] h-[30px] px-2 rounded-md text-[12.5px] tabular transition-colors"
            style={
              n === pagina
                ? { background: "var(--navy)", color: "white", fontWeight: 600 }
                : { color: "var(--ink-600)", border: "1px solid var(--border)" }
            }
          >
            {n}
          </button>
        ))}
        <PagBtn disabled={pagina === total} onClick={() => onChange(pagina + 1)}>
          <ChevronRight size={14} />
        </PagBtn>
      </div>
    </div>
  );
}

function PagBtn({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-[30px] h-[30px] rounded-md border border-[var(--border)] inline-flex items-center justify-center text-[var(--ink-600)] disabled:opacity-35 disabled:cursor-not-allowed hover:border-[var(--gold)] transition-colors"
    >
      {children}
    </button>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  loading,
  danger,
  featured,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  loading?: boolean;
  danger?: boolean;
  featured?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`card-editorial !p-5 ${onClick ? "cursor-pointer hover:border-[var(--gold)] transition-colors" : ""}`}
      style={featured ? { borderColor: "rgba(152,120,20,0.28)" } : undefined}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">
          {label}
        </span>
        <Icon size={15} style={{ color: featured ? "#987814" : "var(--ink-400)" }} />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-12 rounded" />
      ) : (
        <div
          className="kpi-number"
          style={{
            color: danger ? "var(--danger)" : featured ? "var(--gold-700)" : "#1e2044",
            fontSize: 30,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function Row({
  caseId,
  primary,
  secondary,
  prazo,
  prazoTone,
  prioridade,
  prioridadeTone,
  last,
}: {
  caseId: string;
  primary: string;
  secondary: string;
  prazo: string;
  prazoTone: string;
  prioridade: string;
  prioridadeTone: string;
  last: boolean;
}) {
  return (
    <Link
      to="/casos/$id"
      params={{ id: caseId }}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ink-50)]"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      <CheckSquare size={15} className="text-[var(--ink-400)] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">{primary}</div>
        <div className="text-[11.5px] text-muted-foreground truncate">{secondary}</div>
      </div>
      <div
        className="text-[12px] tabular font-semibold shrink-0 w-[86px] text-right"
        style={{ color: prazoTone }}
      >
        {prazo}
      </div>
      <div
        className="text-[12px] font-semibold shrink-0 w-[62px] text-right"
        style={{ color: prioridadeTone }}
      >
        {prioridade}
      </div>
      <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">{children}</div>;
}

function ListSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}
