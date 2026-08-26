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
import { DollarSign, FolderOpen, Gavel, Layers } from "lucide-react";

import { Breadcrumb } from "@/components/hv/primitives";
import { useMyModulePerms, useMyModuleValues } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { podeVerValores } from "@/lib/rbac";
import { useCase } from "@/hooks/useCases";
import { useTemas } from "@/hooks/useTemas";
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

  // N1 — o caminho ganha o TEMA no meio, clicável, levando de volta ao kanban de
  // onde a pessoa veio. Thiago: "eu queria clicar aqui e poder voltar para aquele
  // Kanban que eu tava, porque aqui eu caio na primeira página."
  //
  // O kanban do tema NÃO é rota própria: é /pipeline com os search params que os
  // cards já usam (cat = service_type_id, catName, temaId).
  const { data: temas } = useTemas();
  const temaDoCaso = (temas ?? []).find(
    (t) => t.id === (caso as { tema_id?: string | null } | undefined)?.tema_id,
  );
  const serviceTypeId = (caso as { service_type_id?: string | null } | undefined)?.service_type_id;
  const itemTema =
    serviceTypeId && temaDoCaso
      ? [
          {
            label: temaDoCaso.name,
            to: "/pipeline",
            search: { cat: serviceTypeId, catName: temaDoCaso.name, temaId: temaDoCaso.id },
          },
        ]
      : [];

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
  // M3 (2026-08-07) — Documentos virou aba de topo (ao lado de Judicial).
  const isDoc = !!matchRoute({ to: "/casos/$id/documentos", params: { id } });
  // M4 (2026-08-07) — Termo saiu da nav de topo: agora vive DENTRO do Financeiro
  // (é 100% financeiro). As rotas casos.$id.termo(.elaborar) continuam existindo,
  // mas são alcançadas pelo submenu Financeiro (e gate-adas por financeiro:view).
  // "Ficha" é a rota index — ativa quando não estamos em nenhum submenu.
  const isIndex = !isFin && !isJud && !isDoc;

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
      active
        ? "border-[var(--gold)] text-[var(--navy)]"
        : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
    }`;

  return (
    <div>
      <div className="page-container !pb-0">
        <Breadcrumb
          items={[{ label: "Casos", to: "/casos" }, ...itemTema, { label: caso?.case_code ?? "…" }]}
        />
        <nav className="mt-2 flex items-center gap-1 border-b border-[var(--border)]">
          <Link to="/casos/$id" params={{ id }} className={tabCls(isIndex)}>
            <Layers size={14} /> Ficha
          </Link>
          {podeVerFinanceiro && (
            <Link to="/casos/$id/financeiro" params={{ id }} className={tabCls(isFin)}>
              <DollarSign size={14} /> Financeiro
            </Link>
          )}
          <Link to="/casos/$id/documentos" params={{ id }} className={tabCls(isDoc)}>
            <FolderOpen size={14} /> Documentos
          </Link>
          {podeVerJudicial && (
            <Link to="/casos/$id/judicial" params={{ id }} className={tabCls(isJud)}>
              <Gavel size={14} /> Judicial
            </Link>
          )}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
