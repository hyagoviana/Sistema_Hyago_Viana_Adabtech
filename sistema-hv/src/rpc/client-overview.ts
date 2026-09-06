// S3-04 — a visão 360 do cliente.
//
// Gate de VALORES (AC7): quem não pode ver dinheiro recebe os casos e as etapas,
// mas com os números ZERADOS e `podeVerValores: false`. Zerar no SERVIDOR, e não
// esconder só na tela, é o que impede o valor de viajar no payload para quem não
// pode vê-lo — esconder no front deixaria o número acessível a quem abrisse as
// ferramentas do navegador.
//
// A seção não some para esse papel: ele continua vendo os casos e as etapas, que
// é informação operacional. Só o dinheiro é omitido.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  getClientOverview,
  type ClientOverview,
  type ResumoValores,
} from "@/lib/client-overview-service";
import {
  getRoleModuleDefaults,
  getUserModulePerms,
  getUserModuleValues,
} from "@/lib/rbac-perms-service";
import { permissaoEfetiva, podeVerValores, type Role } from "@/lib/rbac";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const ZERO: ResumoValores = {
  devido_centavos: 0,
  vencido_centavos: 0,
  pago_centavos: 0,
  vincendo_centavos: 0,
};

export const clientOverviewFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const me = await requireAuth();

      // O papel e os overrides do usuário — a mesma composição que
      // `requireModule` faz, mas aqui precisamos do RESULTADO (pode ou não ver
      // valores), não de um bloqueio.
      const sb = getSupabaseAdmin();
      const { data: perfil } = await sb
        .from("system_users")
        .select("role, status")
        .eq("id", me.id)
        .maybeSingle();
      const p = perfil as { role: string; status: string | null } | null;
      if (!p || p.status?.toUpperCase() !== "ACTIVE") {
        throw new AuthError("Usuário inativo ou sem perfil", 403);
      }

      const [overrides, valores, roleDefaults] = await Promise.all([
        getUserModulePerms(me.id),
        getUserModuleValues(me.id),
        getRoleModuleDefaults(p.role),
      ]);

      // Sem sequer ver o módulo operacional não há o que devolver.
      if (!permissaoEfetiva(p.role as Role, overrides, "operacional", "view", roleDefaults)) {
        throw new AuthError("Você não tem permissão para ver os casos deste cliente", 403);
      }

      const overview = await getClientOverview(data.clientId);
      const podeVer = podeVerValores(p.role as Role, overrides, valores, "financeiro");
      if (podeVer) return { ...overview, podeVerValores: true as const };

      const semValores: ClientOverview = {
        casos: overview.casos.map((c) => ({ ...c, receitas: ZERO, despesas: ZERO })),
        totalReceitas: ZERO,
        totalDespesas: ZERO,
      };
      return { ...semValores, podeVerValores: false as const };
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? err : new Error(String(err));
    }
  });
