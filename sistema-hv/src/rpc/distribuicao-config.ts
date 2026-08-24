// RPC (server-only, Node) — Config do Motor de Distribuicao COM SEGREDOS
// protegidos (H11). A tela de Configuracao NAO deve ler/gravar os campos de
// segredo (password/token/api_key) direto pelo browser client: a leitura via
// service_role NUNCA devolve o valor do segredo (so um boolean "tem valor"), e a
// gravacao e write-only (campo em branco = "nao alterar") com gate de admin.
//
// Os campos nao-secretos (base_url/auth_type/username) continuam podendo ir e
// vir normalmente — nao sao segredo.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type ConfigUpdate = Database["public"]["Tables"]["system_distribution_config"]["Update"];

const ORG_ID = "00000000-0000-0000-0000-000000000001";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? new Error(err.message) : new Error(String(err));
  }
}

/** Valores expostos ao front: campos nao-secretos + FLAGS "tem valor" p/ segredos. */
export interface DistributionCredsView {
  projuris_base_url: string | null;
  projuris_auth_type: string | null;
  projuris_username: string | null;
  /** true se ha senha gravada (o valor NUNCA e devolvido). */
  has_password: boolean;
  /** true se ha token gravado (o valor NUNCA e devolvido). */
  has_token: boolean;
  /** true se ha api_key gravada (o valor NUNCA e devolvido). */
  has_api_key: boolean;
}

/**
 * Leitura da config de credenciais para a TELA. Roda pelo service_role e devolve
 * SO os campos nao-secretos + booleans "tem valor" p/ os segredos. O valor cru
 * do segredo nunca sai do servidor (anti-vazamento via devtools/network).
 * Gate: quem pode ver o modulo controladoria.
 */
export const getDistributionCredsFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<DistributionCredsView> => {
    await requireModule("controladoria", "view");
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("system_distribution_config")
      .select(
        "projuris_base_url, projuris_auth_type, projuris_username, projuris_password, projuris_token, projuris_api_key",
      )
      .eq("organization_id", ORG_ID)
      .maybeSingle();
    if (error) throw new AuthError("Falha ao ler configuracao", 500);

    const nonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    return {
      projuris_base_url: data?.projuris_base_url ?? null,
      projuris_auth_type: data?.projuris_auth_type ?? null,
      projuris_username: data?.projuris_username ?? null,
      has_password: nonEmpty(data?.projuris_password),
      has_token: nonEmpty(data?.projuris_token),
      has_api_key: nonEmpty(data?.projuris_api_key),
    };
  }),
);

// Gravacao write-only: os campos de segredo sao OPCIONAIS. Enviar `undefined`
// (campo em branco na UI) = "nao alterar"; enviar string vazia "" tambem = "nao
// alterar" (evita zerar sem querer). Para LIMPAR um segredo, o front envia `null`
// explicito.
const saveSchema = z.object({
  projuris_base_url: z.string().min(1),
  projuris_auth_type: z.enum(["basic", "bearer", "apikey", "oauth2_password"]),
  projuris_username: z.string().nullable().optional(),
  // Segredos: string = novo valor; null = limpar; undefined/"" = nao alterar.
  projuris_password: z.string().nullable().optional(),
  projuris_token: z.string().nullable().optional(),
  projuris_api_key: z.string().nullable().optional(),
});

/**
 * Gravacao da config de credenciais (write-only p/ segredos). Gate: admin/edicao
 * do modulo controladoria. Campos de segredo vazios/ausentes NAO sobrescrevem o
 * que ja esta gravado. A resposta NAO devolve nenhum segredo.
 */
export const saveDistributionCredsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<{ ok: true }> => {
      await requireModule("controladoria", "edit");
      const sb = getSupabaseAdmin();

      // Monta o UPDATE so com os campos que devem mudar. Segredo write-only:
      // - undefined / "" (string vazia) => nao inclui no update ("nao alterar")
      // - null                          => grava null (LIMPA o segredo)
      // - string nao-vazia              => grava o novo valor
      const patch: ConfigUpdate = {
        projuris_base_url: data.projuris_base_url,
        projuris_auth_type: data.projuris_auth_type,
        updated_at: new Date().toISOString(),
      };
      if (data.projuris_username !== undefined) patch.projuris_username = data.projuris_username;

      const applySecret = (key: "projuris_password" | "projuris_token" | "projuris_api_key") => {
        const v = data[key];
        if (v === undefined) return; // nao alterar
        if (v === null) {
          patch[key] = null; // limpar explicitamente
          return;
        }
        if (v.trim().length === 0) return; // branco = nao alterar
        patch[key] = v; // novo valor
      };
      applySecret("projuris_password");
      applySecret("projuris_token");
      applySecret("projuris_api_key");

      const { error } = await sb
        .from("system_distribution_config")
        .update(patch)
        .eq("organization_id", ORG_ID);
      // NUNCA ecoa a config crua nem o segredo no erro.
      if (error) throw new AuthError("Falha ao salvar credenciais", 500);
      return { ok: true };
    }),
  );

// ----------------------------------------------------------------------------
// Config GERAL do motor (mode/batch_hour) — escrita via SERVER (service_role),
// com gate requireModule("controladoria","edit"). Antes ia direto pelo browser
// client, e a RLS de config estava aberta (qualquer autenticado escrevia). Agora
// o único caminho de escrita é este server fn gateado.
// ----------------------------------------------------------------------------
const updateConfigSchema = z.object({
  mode: z.enum(["HIGH_PRODUCTION", "HIGH_CONTROL"]).optional(),
  batch_hour: z.number().int().min(0).max(23).optional(),
  // Doc 21.08: a média diária de produção deixou de ser inferida dos últimos 90
  // dias e passou a ser um número informado, por modo de operação.
  pontos_dia_controle: z.number().min(0).max(200).optional(),
  pontos_dia_producao: z.number().min(0).max(200).optional(),
  // Trava do write-back ao ProJuris (arquivar/marcar lido). Nasce desligada.
  projuris_writeback_ativo: z.boolean().optional(),
});

export const updateDistributionConfigFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateConfigSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<{ ok: true }> => {
      await requireModule("controladoria", "edit");
      const patch: ConfigUpdate = { updated_at: new Date().toISOString() };
      if (data.mode !== undefined) patch.mode = data.mode;
      if (data.batch_hour !== undefined) patch.batch_hour = data.batch_hour;
      if (data.pontos_dia_controle !== undefined)
        patch.pontos_dia_controle = data.pontos_dia_controle;
      if (data.pontos_dia_producao !== undefined)
        patch.pontos_dia_producao = data.pontos_dia_producao;
      if (data.projuris_writeback_ativo !== undefined)
        patch.projuris_writeback_ativo = data.projuris_writeback_ativo;
      const sb = getSupabaseAdmin();
      const { error } = await sb
        .from("system_distribution_config")
        .update(patch)
        .eq("organization_id", ORG_ID);
      if (error) throw new AuthError("Falha ao salvar configuração", 500);
      return { ok: true };
    }),
  );

// ----------------------------------------------------------------------------
// LIGAR/DESLIGAR o motor em produção (`active`) — ação crítica. Gate de edição
// do módulo controladoria no SERVIDOR (a RLS sozinha não bastava).
// ----------------------------------------------------------------------------
export const setDistributionActiveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ active: z.boolean() }).parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<{ ok: true; active: boolean }> => {
      await requireModule("controladoria", "edit");
      const sb = getSupabaseAdmin();
      const { error } = await sb
        .from("system_distribution_config")
        .update({ active: data.active, updated_at: new Date().toISOString() })
        .eq("organization_id", ORG_ID);
      if (error) throw new AuthError("Falha ao alterar o estado do motor", 500);
      return { ok: true, active: data.active };
    }),
  );
