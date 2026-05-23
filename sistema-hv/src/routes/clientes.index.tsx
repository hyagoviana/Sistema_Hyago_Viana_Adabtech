import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Phone, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ClientCardMenu } from "@/components/clients/ClientCardMenu";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { Badge, Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientsList } from "@/hooks/useClients";
import type { Database } from "@/lib/supabase/types";

type Client = Database["public"]["Tables"]["system_clients"]["Row"];

export const Route = createFileRoute("/clientes/")({
  component: ClientesList,
});

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

function ClientesList() {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos os tipos");
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const { data, isLoading, isError, error } = useClientsList(search);

  const tipos = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((c) => {
      if (c.tipo) set.add(c.tipo);
    });
    return ["Todos os tipos", ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (tipoFilter === "Todos os tipos") return data;
    return data.filter((c) => c.tipo === tipoFilter);
  }, [data, tipoFilter]);

  const total = data?.length ?? 0;

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Clientes" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Clientes"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${total} cadastrado${total === 1 ? "" : "s"} · todos ativos no MVP`
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
            <Btn variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Novo cliente
            </Btn>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px]"
        >
          {tipos.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar clientes: {error instanceof Error ? error.message : "desconhecido"}
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
            ? "Nenhum cliente encontrado com esses filtros."
            : 'Nenhum cliente cadastrado ainda. Clique em "Novo cliente" pra começar.'}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="relative">
              <Link
                to="/clientes/$id"
                params={{ id: c.id }}
                className="card-editorial !p-5 flex items-center gap-4 group"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-display text-[18px] font-semibold text-[var(--navy)] shrink-0"
                  style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
                >
                  {c.full_name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[16px] font-semibold text-[var(--navy)] group-hover:text-[var(--gold-700)] transition-colors truncate pr-8">
                    {c.full_name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {c.tipo && <Badge tone="navy">{c.tipo}</Badge>}
                    <span className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1.5">
                      <Phone size={10} /> {maskPhone(c.phone)}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-1.5">
                    {pickCity(c.address) ?? "—"} ·{" "}
                    <span className="text-[var(--navy)] font-medium">— casos</span>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="text-[var(--gold)] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                />
              </Link>
              <div className="absolute top-3 right-3">
                <ClientCardMenu
                  clientId={c.id}
                  clientName={c.full_name}
                  onEdit={() => setEditClient(c)}
                />
              </div>
            </div>
          ))}
        </div>
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
