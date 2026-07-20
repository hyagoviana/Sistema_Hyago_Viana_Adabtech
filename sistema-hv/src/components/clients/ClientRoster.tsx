import { Link } from "@tanstack/react-router";
import { ChevronRight, Phone, Plus, Search, Settings2, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { ClientCardMenu } from "@/components/clients/ClientCardMenu";
import { ClientFieldsManagerDialog } from "@/components/clients/ClientFieldsManagerDialog";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { Badge, Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useClientsByLifecycle, type LifecycleTab } from "@/hooks/useClients";
import { can } from "@/lib/rbac";
import type { Database } from "@/lib/supabase/types";

type Client = Database["public"]["Tables"]["system_clients"]["Row"];

// S1-05 / #15 — abas por ciclo de vida. Reduzidas a Leads e Clientes (sem
// "Todos"/"Perdidos"); default = Leads. "Leads" = todo cadastro que ainda não é
// cliente; "Clientes" = quem já virou cliente.
export type LifecycleView = LifecycleTab;

const ALL_LIFECYCLE_TABS: Array<{ key: LifecycleView; label: string }> = [
  { key: "lead", label: "Leads" },
  { key: "cliente", label: "Clientes" },
];

function pickCity(address: Client["address"]): string | null {
  if (!address || typeof address !== "object" || Array.isArray(address)) return null;
  const a = address as Record<string, unknown>;
  const city = typeof a.city === "string" ? a.city : null;
  const state = typeof a.state === "string" ? a.state : null;
  return city ? (state ? `${city}/${state}` : city) : null;
}

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

// ----------------------------------------------------------------------------
// Filtros avançados de busca — restringe a quais campos o termo é comparado.
// Sem nenhum campo marcado, vale a busca ampla do servidor (todos os campos).
// ----------------------------------------------------------------------------
type SearchField = {
  key: string;
  label: string;
  digitsOnly?: boolean;
  extract: (c: Client) => string;
};

function addrStr(address: Client["address"], key: string): string {
  if (!address || typeof address !== "object" || Array.isArray(address)) return "";
  const a = address as Record<string, unknown>;
  return typeof a[key] === "string" ? (a[key] as string) : "";
}

function jsonStr(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

const SEARCH_FIELDS: SearchField[] = [
  { key: "nome", label: "Nome", extract: (c) => c.full_name ?? "" },
  { key: "cpf", label: "CPF/CNPJ", digitsOnly: true, extract: (c) => c.cpf_cnpj ?? "" },
  { key: "municipio", label: "Município", extract: (c) => addrStr(c.address, "city") },
  { key: "uf", label: "UF", extract: (c) => addrStr(c.address, "state") },
  { key: "email", label: "E-mail", extract: (c) => c.email ?? "" },
  { key: "telefone", label: "Telefone", digitsOnly: true, extract: (c) => c.phone ?? "" },
  { key: "profissional", label: "Profissional", extract: (c) => jsonStr(c.professional_data) },
  { key: "adicionais", label: "Campos adicionais", extract: (c) => jsonStr(c.custom_fields) },
];

// Normaliza para busca: remove acentos (NFD + strip diacríticos) e baixa a caixa,
// para "São"/"Sao"/"sao" e "José"/"jose" casarem. Sem isso, a lupa parecia "não
// funcionar" ao buscar nomes/municípios acentuados.
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matchField(c: Client, term: string, f: SearchField): boolean {
  const val = f.extract(c);
  if (f.digitsOnly) {
    const td = term.replace(/\D/g, "");
    if (!td) return false;
    return val.replace(/\D/g, "").includes(td);
  }
  return norm(val).includes(norm(term));
}

// ----------------------------------------------------------------------------
// ClientRoster — lista de cadastros compartilhada (S9-07). Duas configurações:
//   - roster completo (Inteligência › Leads): as 4 sub-abas Todos/Leads/Clientes/
//     Perdidos, via useClientsByLifecycle.
//   - só clientes (Operação › Clientes): tab fixa em `cliente`, sub-abas ocultas,
//     consumindo system_clients_clientes (useClientsByLifecycle('cliente')).
// ----------------------------------------------------------------------------
export function ClientRoster({
  eyebrow,
  title,
  breadcrumb,
  showLifecycleTabs = true,
  fixedLifecycle,
  entityNoun = "cadastro",
  entityNounPlural = "cadastros",
  canEdit = true,
}: {
  eyebrow: string;
  title: string;
  breadcrumb: Array<{ label: string; to?: string }>;
  /** Mostra as 4 sub-abas (roster). Se false, usa `fixedLifecycle`. */
  showLifecycleTabs?: boolean;
  /** Quando showLifecycleTabs=false, fixa a fonte (ex.: 'cliente'). */
  fixedLifecycle?: LifecycleTab;
  entityNoun?: string;
  entityNounPlural?: string;
  /** 2026-07-19 — pode criar/editar/excluir cadastro? (permissão do módulo da aba). */
  canEdit?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos os tipos");
  const [searchFields, setSearchFields] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [lifecycleTab, setLifecycleTab] = useState<LifecycleView>(
    showLifecycleTabs ? "lead" : (fixedLifecycle ?? "cliente"),
  );

  const { role } = useAuth();
  const canManageFields = can(role, "config.manage");

  // Aba efetiva de lifecycle. Com sub-abas ocultas, sempre a fixa.
  const effectiveTab: LifecycleView = showLifecycleTabs
    ? lifecycleTab
    : (fixedLifecycle ?? "cliente");

  // #15 — sempre por lifecycle (Leads = não-clientes; Clientes = clientes).
  const { data, isLoading, isError, error } = useClientsByLifecycle(effectiveTab as LifecycleTab);
  const usingLifecycle = true;

  const tipos = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((c) => {
      if (c.tipo) set.add(c.tipo);
    });
    return ["Todos os tipos", ...Array.from(set).sort()];
  }, [data]);

  const toggleSearchField = (key: string) =>
    setSearchFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const filtered = useMemo(() => {
    if (!data) return [];
    let res = data;
    if (tipoFilter !== "Todos os tipos") res = res.filter((c) => c.tipo === tipoFilter);
    const term = search.trim();
    if (term) {
      // Sem chip marcado → busca ampla sobre todos os campos padrão.
      // Com chip(s) marcado(s) → restringe aos campos escolhidos.
      const fields =
        searchFields.length > 0
          ? SEARCH_FIELDS.filter((f) => searchFields.includes(f.key))
          : SEARCH_FIELDS;
      res = res.filter((c) => fields.some((f) => matchField(c, term, f)));
    }
    return res;
  }, [data, tipoFilter, search, searchFields]);

  const total = data?.length ?? 0;

  return (
    <div className="page-container">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={
          isLoading ? "Carregando…" : `${total} ${total === 1 ? entityNoun : entityNounPlural}`
        }
        aside={
          <div className="flex gap-2">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={-1}>
                    <Btn variant="outline" disabled>
                      Importar Excel
                    </Btn>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Em breve</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {canManageFields && (
              <Btn variant="outline" onClick={() => setFieldsOpen(true)}>
                <Settings2 size={14} />
                Info/Cadastro
              </Btn>
            )}
            {canEdit && (
              <Btn variant="gold" onClick={() => setCreateOpen(true)}>
                <Plus size={14} />
                Novo cadastro
              </Btn>
            )}
          </div>
        }
      />

      {/* S1-05 / S9-07 — abas por ciclo de vida (só no roster completo) */}
      {showLifecycleTabs && (
        <div className="flex items-center gap-1 mb-4 border-b border-[var(--border)]">
          {ALL_LIFECYCLE_TABS.map((t) => {
            const active = lifecycleTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setLifecycleTab(t.key)}
                className="px-4 py-2 text-[13px] font-medium -mb-px border-b-2 transition-colors"
                style={
                  active
                    ? { color: "var(--gold-700)", borderColor: "var(--gold)" }
                    : { color: "var(--ink-700)", borderColor: "transparent" }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de busca + filtros integrados, num painel único elevado */}
      <div className="card-editorial !p-2 mb-6 flex items-center gap-2">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium transition-colors shrink-0"
          style={
            showFilters || tipoFilter !== "Todos os tipos"
              ? {
                  background: "var(--gold-pale)",
                  color: "var(--gold-700)",
                  border: "1px solid rgba(152,120,20,0.28)",
                }
              : {
                  background: "transparent",
                  color: "var(--ink-700)",
                  border: "1px solid var(--border)",
                }
          }
        >
          <SlidersHorizontal size={14} />
          Filtros Avançados
        </button>

        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, município, e-mail…"
            className="w-full pl-9 pr-4 py-2 bg-transparent text-[13px] outline-none"
          />
        </div>
      </div>

      {showFilters && (
        <div className="card-editorial !p-4 mb-6 space-y-4">
          {/* Campos de busca: restringe o termo a um ou mais campos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-[var(--ink-500)]">
                Buscar em
              </span>
              {searchFields.length > 0 && (
                <button
                  onClick={() => setSearchFields([])}
                  className="text-[12px] text-[var(--gold-700)] hover:text-[var(--gold)] font-medium"
                >
                  Todos os campos
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {SEARCH_FIELDS.map((f) => {
                const active = searchFields.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleSearchField(f.key)}
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
                    style={
                      active
                        ? {
                            background: "var(--gold-pale)",
                            color: "var(--gold-700)",
                            border: "1px solid rgba(152,120,20,0.4)",
                          }
                        : {
                            background: "transparent",
                            color: "var(--ink-700)",
                            border: "1px solid var(--border)",
                          }
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {searchFields.length === 0
                ? "Sem seleção, a busca cobre todos os campos (nome, CPF, município, e-mail, profissional e adicionais)."
                : `A busca será restrita a: ${SEARCH_FIELDS.filter((f) =>
                    searchFields.includes(f.key),
                  )
                    .map((f) => f.label)
                    .join(", ")}.`}
            </p>
          </div>

          {/* Filtro por tipo */}
          <div className="flex items-center gap-3 border-t pt-3">
            <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-[var(--ink-500)]">
              Tipo
            </span>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="px-4 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
            >
              {tipos.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {tipoFilter !== "Todos os tipos" && (
              <button
                onClick={() => setTipoFilter("Todos os tipos")}
                className="text-[12px] text-[var(--gold-700)] hover:text-[var(--gold)] font-medium"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar {entityNounPlural}:{" "}
            {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-editorial !p-10 text-center text-muted-foreground">
          {search || tipoFilter !== "Todos os tipos"
            ? `Nenhum ${entityNoun} encontrado com esses filtros.`
            : `Nenhum ${entityNoun} ainda. Clique em "Novo cadastro" pra começar.`}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="relative">
              <Link
                to="/clientes/$id"
                params={{ id: c.id }}
                // ITEM 6 (2026-07-07) — no roster de Cadastro (sub-abas Leads/
                // Clientes), leva a origem para o breadcrumb voltar a Cadastro.
                search={showLifecycleTabs ? { from: "cadastro" } : undefined}
                className="card-editorial !p-5 flex items-center gap-4 group"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-semibold text-[var(--navy)] shrink-0"
                  style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
                >
                  {c.full_name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-[var(--navy)] group-hover:text-[var(--gold-700)] transition-colors truncate pr-8">
                    {c.full_name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {c.tipo && <Badge tone="navy">{c.tipo}</Badge>}
                    <span className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1.5">
                      <Phone size={10} /> {maskPhone(c.phone)}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-1.5">
                    {pickCity(c.address) ?? "—"}
                    {usingLifecycle &&
                      typeof (c as { dias_parado?: number }).dias_parado === "number" && (
                        <>
                          {" · "}
                          <span className="text-[var(--navy)] font-medium">
                            {(c as { casos_no_lifecycle?: number }).casos_no_lifecycle ?? 0} caso(s)
                            · parado há {(c as { dias_parado?: number }).dias_parado} dia(s)
                          </span>
                        </>
                      )}
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="text-[var(--gold)] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                />
              </Link>
              {canEdit && (
                <div className="absolute top-3 right-3">
                  <ClientCardMenu
                    clientId={c.id}
                    clientName={c.full_name}
                    onEdit={() => setEditClient(c)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManageFields && (
        <ClientFieldsManagerDialog open={fieldsOpen} onOpenChange={setFieldsOpen} />
      )}
      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
      <ClientFormDialog
        open={!!editClient}
        onOpenChange={(o) => !o && setEditClient(null)}
        mode="edit"
        client={editClient}
      />
    </div>
  );
}
