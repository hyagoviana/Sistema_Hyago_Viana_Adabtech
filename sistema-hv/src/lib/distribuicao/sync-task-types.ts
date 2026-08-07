// Nucleo (server-only, Node) da SINCRONIZACAO DE TIPOS DE TAREFA do ProJuris
// (story H6). Espelha scripts/reconcile-projuris-tipos.ts (de-para por nome, A9
// v0.5) mas roda pelo Supabase admin client (nao pg direto) para ser chamado por
// uma server function (botao "Sincronizar tipos"). Idempotente.
//
// O QUE FAZ:
//   1) Autentica no ProJuris (SO LEITURA) via buildProjurisClientFromConfig (H11).
//   2) Puxa os tipos de tarefa: GET /tipo?chave-tipo=tarefa-tipo
//      (envelope consultaTipoRetorno[0].simpleDto[{chave,valor}]).
//   3) Casa cada linha de system_task_type_mapping por NOME normalizado (sem
//      acento/caixa). Nome logico ESTAVEL (re-executavel): descricao > codigo-se-
//      placeholder > motor_task_type_id.
//   4) Para os que casam, UPDATE ... WHERE motor_task_type_id (chave estavel):
//      projuris_tipo_codigo = <codigo real>, projuris_tipo_descricao = <nome>.
//   5) Near-miss/ambiguo/colisao FICAM como estao — apenas reportados (owner
//      decide), NUNCA sobrescritos silenciosamente.
//
// SO LEITURA no ProJuris. A UNICA escrita e o UPDATE dos codigos (nosso banco).
//
// H7 (criar tipo no ProJuris) NAO esta aqui: depende de spike de endpoint de
// escrita na API (T0). Ver Dev Notes da story H6.

import { AuthError } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig } from "@/lib/distribuicao/sync-core";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

/** Normaliza nome p/ de-para (mesmo criterio do reconcile-projuris-tipos.ts). */
function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Desempacota GET /tipo?chave-tipo=tarefa-tipo → simpleDto[{chave,valor}]. */
function unwrapTipoSimpleDto(raw: unknown): Array<{ chave: unknown; valor: unknown }> {
  if (!raw || typeof raw !== "object") return [];
  const cont = (raw as Record<string, unknown>).consultaTipoRetorno;
  const bloco = Array.isArray(cont) ? cont[0] : cont;
  if (bloco && typeof bloco === "object") {
    const sd = (bloco as Record<string, unknown>).simpleDto;
    if (Array.isArray(sd)) return sd as Array<{ chave: unknown; valor: unknown }>;
  }
  return [];
}

interface Row {
  projuris_tipo_codigo: string | null;
  projuris_tipo_descricao: string | null;
  motor_task_type_id: string | null;
}

/** Nome logico ESTAVEL de uma linha do mapping (p/ casar por nome, re-executavel). */
function logicalName(row: Row): string {
  const desc = (row.projuris_tipo_descricao ?? "").trim();
  if (desc) return desc;
  const cod = (row.projuris_tipo_codigo ?? "").trim();
  if (cod && !/^\d+$/.test(cod)) return cod; // placeholder de NOME (ainda nao e codigo)
  return (row.motor_task_type_id ?? "").replace(/_/g, " ");
}

export interface SyncTaskTypesResult {
  /** Total de tipos lidos do ProJuris. */
  projurisTipos: number;
  /** Total de linhas SHV inspecionadas. */
  shvLinhas: number;
  /** Linhas que casaram e foram aplicadas (idempotente). */
  matched: Array<{ motor: string; nomeLogico: string; codigo: string; nome: string }>;
  /** Linhas sem correspondencia por nome (aguardam owner). */
  nearMiss: string[];
  /** Linhas cujo codigo ja foi usado por outra linha (UNIQUE) — aguardam owner. */
  collisions: string[];
  /** Quantas linhas ja tem codigo NUMERICO real apos a rodada. */
  numericos: number;
}

/**
 * Sincroniza os codigos/descricoes dos tipos de tarefa a partir do ProJuris.
 * Idempotente: rodar 2x reescreve os mesmos valores, sem duplicar.
 */
export async function syncTaskTypesCore(): Promise<SyncTaskTypesResult> {
  const supabase = getSupabaseAdmin();

  // 1) ProJuris (leitura). Auth por config do banco (H11), tentando variantes.
  const pj = await buildProjurisClientFromConfig(supabase);
  await pj.authenticateTryingVariants();
  const rawTipo = await pj.projurisGet<unknown>("tipo", { "chave-tipo": "tarefa-tipo" });
  const tipos = unwrapTipoSimpleDto(rawTipo);

  // Mapa NOME normalizado → { codigo, nome }. Colisao de nome → 1a ganha, resto ambiguo.
  const byName = new Map<string, { codigo: string; nome: string }>();
  const ambiguousNames = new Set<string>();
  for (const t of tipos) {
    const codigo = t.chave != null ? String(t.chave) : "";
    const nome = typeof t.valor === "string" ? t.valor : String(t.valor ?? "");
    if (!codigo || !nome) continue;
    const key = normalizeName(nome);
    if (byName.has(key)) ambiguousNames.add(key);
    else byName.set(key, { codigo, nome });
  }

  // 2) SHV mapping (org default).
  const { data, error } = await supabase
    .from("system_task_type_mapping")
    .select("projuris_tipo_codigo, projuris_tipo_descricao, motor_task_type_id")
    .eq("organization_id", ORG_ID)
    .order("motor_task_type_id");
  if (error) throw new AuthError(`Falha ao ler tipos de tarefa: ${error.message}`, 500);
  const rows = (data ?? []) as Row[];

  const matched: SyncTaskTypesResult["matched"] = [];
  const nearMiss: string[] = [];
  const collisions: string[] = [];
  const usedCodes = new Set<string>();

  for (const row of rows) {
    const name = logicalName(row);
    const key = normalizeName(name);
    const hit = byName.get(key);
    const motor = row.motor_task_type_id ?? "(sem motor_id)";
    if (hit && !ambiguousNames.has(key)) {
      if (usedCodes.has(hit.codigo)) {
        collisions.push(
          `${motor} (nome logico="${name}") → codigo ${hit.codigo} JA usado por outra linha SHV (UNIQUE) — nao aplicado`,
        );
        continue;
      }
      usedCodes.add(hit.codigo);
      matched.push({ motor, nomeLogico: name, codigo: hit.codigo, nome: hit.nome });
      const { error: upErr } = await supabase
        .from("system_task_type_mapping")
        .update({
          projuris_tipo_codigo: hit.codigo,
          projuris_tipo_descricao: hit.nome,
          updated_at: new Date().toISOString(),
        })
        .eq("motor_task_type_id", row.motor_task_type_id ?? "")
        .eq("organization_id", ORG_ID);
      if (upErr) throw new AuthError(`Falha ao aplicar de-para (${motor}): ${upErr.message}`, 500);
    } else {
      nearMiss.push(
        `${motor} (nome logico="${name}") → ${
          ambiguousNames.has(key)
            ? "AMBIGUO (multiplas variantes ProJuris com esse nome)"
            : "sem correspondencia por nome"
        }`,
      );
    }
  }

  // 3) Confirmacao: quantos ficaram com codigo NUMERICO real.
  const { data: numData } = await supabase
    .from("system_task_type_mapping")
    .select("projuris_tipo_codigo")
    .eq("organization_id", ORG_ID);
  const numericos = (numData ?? []).filter((r) =>
    /^[0-9]+$/.test(String((r as { projuris_tipo_codigo: string }).projuris_tipo_codigo ?? "")),
  ).length;

  return {
    projurisTipos: tipos.length,
    shvLinhas: rows.length,
    matched,
    nearMiss,
    collisions,
    numericos,
  };
}
