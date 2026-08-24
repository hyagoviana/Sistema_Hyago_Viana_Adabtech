// SMOKE do write-back ao ProJuris (arquivar intimação).
//
// Escolhido de propósito o caminho que NÃO altera nada: todas as intimações do
// escritório já estão ARQUIVADA, então mandar "arquivar" é idempotente — valida
// autenticação, rota, permissão e o registro local, sem mudar estado real.
//
// A trava é ligada no começo e DEVOLVIDA ao valor anterior no fim, aconteça o
// que acontecer.
//
// Uso: npx tsx scripts/smoke-writeback-projuris.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";
import { refletirDecisaoNoProjuris, isWritebackAtivo } from "@/lib/projuris/writeback-acoes";

async function setTrava(valor: boolean) {
  await getSupabaseAdmin()
    .from("system_distribution_config")
    .update({ projuris_writeback_ativo: valor } as never)
    .eq("organization_id", ORG_ID);
}

async function main() {
  const sb = getSupabaseAdmin();
  const travaOriginal = await isWritebackAtivo();
  console.log(`trava antes do teste: ${travaOriginal ? "LIGADA" : "desligada"}`);

  // 1) Com a trava DESLIGADA, nada pode ser enviado.
  await setTrava(false);
  const { data: alvo } = await sb
    .from("system_distribution_movements")
    .select("id, projuris_id, numero_cnj, situacao_projuris")
    .eq("origem", "INTIMACAO")
    .not("projuris_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!alvo) throw new Error("nenhuma intimação na fila para testar");
  console.log(
    `\nintimação de teste: código ${alvo.projuris_id} · ${alvo.numero_cnj} · situação lá: ${alvo.situacao_projuris}`,
  );

  const off = await refletirDecisaoNoProjuris(alvo.id, "ARQUIVADO");
  console.log(`\n[trava desligada] enviado=${off.enviado} · motivo="${off.motivo}"`);
  if (off.enviado) throw new Error("FALHA DE SEGURANÇA: enviou com a trava desligada!");

  // 2) Estado atual no ProJuris, antes.
  const client = await buildProjurisClientFromConfig(sb);
  await client.authenticateTryingVariants();
  // Atenção: no GET individual a chave é `situacao`; no /consulta em lote é
  // `tipoSituacao`. Nomes diferentes para a mesma coisa.
  const antes = await client.projurisGet<Record<string, unknown>>(`intimacao/${alvo.projuris_id}`);
  console.log(`situação no ProJuris ANTES: ${String(antes?.situacao ?? "?")}`);

  // 3) Liga e envia (arquivar algo que já está arquivado = sem efeito prático).
  await setTrava(true);
  const on = await refletirDecisaoNoProjuris(alvo.id, "ARQUIVADO");
  console.log(`\n[trava ligada] enviado=${on.enviado}${on.motivo ? ` · ${on.motivo}` : ""}`);

  const depois = await client.projurisGet<Record<string, unknown>>(`intimacao/${alvo.projuris_id}`);
  console.log(`situação no ProJuris DEPOIS: ${String(depois?.situacao ?? "?")}`);

  const { data: registro } = await sb
    .from("system_distribution_movements")
    .select("projuris_sync_at, projuris_sync_error")
    .eq("id", alvo.id)
    .maybeSingle();
  console.log(
    `registro local: sync_at=${registro?.projuris_sync_at ?? "—"} · erro=${registro?.projuris_sync_error ?? "—"}`,
  );

  // 4) Restaura a trava como estava.
  await setTrava(travaOriginal);
  console.log(`\ntrava restaurada para: ${travaOriginal ? "LIGADA" : "desligada"}`);

  const ok = on.enviado && !off.enviado && antes?.situacao === depois?.situacao;
  console.log(ok ? "\n✅ write-back validado (e sem mudar estado)" : "\n⚠️ revisar o resultado");
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("\n❌ falhou:", e instanceof Error ? e.message : e);
    await setTrava(false); // fail-closed
    console.error("trava forçada para DESLIGADA por segurança.");
    process.exit(1);
  });
