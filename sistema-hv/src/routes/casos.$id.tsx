// LAYOUT do caso (F1/G1 2026-08-05). Antes esta rota era a ficha CHEIA; agora é
// um LAYOUT fino: publica o título/breadcrumb do caso (nome do cliente) + uma
// NAV de submenus (Ficha / Financeiro / Judicial / Termo) + <Outlet/>. A ficha
// comum foi movida para casos.$id.index.tsx (padrão TanStack aninhado — ver
// reference_tanstack_nested_routes: layout com Outlet + index).
//
// Gates da NAV:
//   - Financeiro: só quem tem financeiro:view (podeVerValores).
//   - Judicial:   regra de sigilo (usePodeVerJudicial) — some p/ não-autorizados
//                 em caso sigiloso (G4). Casos normais → todos veem.

import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { DollarSign, FileText, Gavel, Layers } from "lucide-react";

import { Breadcrumb } from "@/components/hv/primitives";
import { useMyModulePerms, useMyModuleValues } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { podeVerValores } from "@/lib/rbac";
import { useCase } from "@/hooks/useCases";
import { useClient } from "@/hooks/useClients";
import { usePodeVerJudicial } from "@/hooks/usePodeVerJudicial";
import { resolveEntityLabel } from "@/lib/use-document-title";
import { usePublishRouteTitle } from "@/lib/route-title";

export const Route = createFileRoute("/casos/$id")({
  component: CasoLayout,
});

function CasoLayout() {
  const { id } = Route.useParams();
  const { data: caso, isLoading, isError } = useCase(id);
  const { data: cliente } = useClient(caso?.client_id ?? "");
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  const { data: values } = useMyModuleValues();
  const podeVerFinanceiro = podeVerValores(role, perms ?? {}, values ?? {}, "financeiro");
  const { podeVer: podeVerJudicial } = usePodeVerJudicial(id);

  const matchRoute = useMatchRoute();

  // fix breadcrumb Topbar — publica o NOME DO CLIENTE p/ o breadcrumb do Topbar.
  usePublishRouteTitle(
    resolveEntityLabel(cliente?.full_name, {
      loading: isLoading || (!!caso?.client_id && cliente === undefined),
      notFound: isError,
      notFoundLabel: "Caso não encontrado",
    }),
  );

  const isFin = !!matchRoute({ to: "/casos/$id/financeiro", params: { id } });
  const isJud = !!matchRoute({ to: "/casos/$id/judicial", params: { id } });
  const isTermo = !!matchRoute({ to: "/casos/$id/termo", params: { id }, fuzzy: true });
  // "Ficha" é a rota index — ativa quando não estamos em nenhum submenu.
  const isIndex = !isFin && !isJud && !isTermo;

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
      active
        ? "border-[var(--gold)] text-[var(--navy)]"
        : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
    }`;

  return (
    <div>
      <div className="page-container !pb-0">
        <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: caso?.case_code ?? "…" }]} />
        <nav className="mt-2 flex items-center gap-1 border-b border-[var(--border)]">
          <Link to="/casos/$id" params={{ id }} className={tabCls(isIndex)}>
            <Layers size={14} /> Ficha
          </Link>
          {podeVerFinanceiro && (
            <Link to="/casos/$id/financeiro" params={{ id }} className={tabCls(isFin)}>
              <DollarSign size={14} /> Financeiro
            </Link>
          )}
          {podeVerJudicial && (
            <Link to="/casos/$id/judicial" params={{ id }} className={tabCls(isJud)}>
              <Gavel size={14} /> Judicial
            </Link>
          )}
          <Link to="/casos/$id/termo" params={{ id }} className={tabCls(isTermo)}>
            <FileText size={14} /> Termo
          </Link>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
