// Seed de casos demo pra Hyago testar a UI cheia.
// Cria 3 clientes (se não existirem) e ~18 casos distribuídos pelas colunas
// do Kanban. Idempotente: identifica os clientes/casos pelos prefixos "DEMO".
//
// Uso:
//   npx tsx scripts/seed-cases-demo.ts
//   npx tsx scripts/seed-cases-demo.ts --reset    (apaga DEMOs antes)

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { createCase } from "../src/lib/cases-service";
import { createClient } from "../src/lib/clients-service";
import { type CaseType, type MacroOp } from "../src/lib/cases/constants";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const RESET = process.argv.includes("--reset");

const DEMO_CLIENTS = [
  { name: "DEMO Ana Beatriz Souza", cpf: "39053344705", tipo: "Médico" },
  { name: "DEMO Carlos Henrique Lima", cpf: "11144477735", tipo: "Médico" },
  { name: "DEMO Mariana Albuquerque", cpf: "85274100632", tipo: "Dentista" },
];

import { type MacroFin } from "../src/lib/cases/constants";

type CaseSpec = {
  type: CaseType;
  status: MacroOp;
  passo: string;
  // Override do status financeiro depois da bifurcação automática (opcional).
  // Só faz sentido pra casos com status op em IMPLANTADO/IMPLANTACAO_PARCIAL.
  fin?: MacroFin;
  valor_centavos?: number;
};

const CASOS: CaseSpec[] = [
  { type: "FIES_ESF", status: "ONBOARDING", passo: "Coletar CPF e procuração" },
  { type: "FIES_ESF", status: "ANALISE", passo: "Verificar histórico SISFIES" },
  { type: "FIES_DGM", status: "ANALISE", passo: "Cruzar dados com FNDE" },
  { type: "FIES_DGM", status: "CONFERENCIA", passo: "Validar parecer técnico" },
  { type: "COVID", status: "PRONTO_AJUIZAR", passo: "Aguardando assinatura ZapSign" },
  { type: "COVID", status: "EM_ANDAMENTO", passo: "Petição protocolada — aguardando juiz" },
  { type: "MAIS_MEDICOS", status: "EM_ANDAMENTO", passo: "Réplica enviada" },
  { type: "RESIDENCIA", status: "AGUARDANDO_DECISAO", passo: "Aguardar decisão liminar" },
  { type: "RESIDENCIA", status: "AGUARDANDO_DECISAO", passo: "Embargos opostos" },
  // Implantados — bifurcação automática vai pra ELABORANDO; override pra cenários ricos
  {
    type: "CFM_CRM",
    status: "IMPLANTADO",
    passo: "Implantação confirmada",
    fin: "ATIVO",
    valor_centavos: 1_500_000,
  },
  {
    type: "FIES_ESF",
    status: "IMPLANTACAO_PARCIAL",
    passo: "Falta 1 parcela",
    fin: "PARCIAL",
    valor_centavos: 800_000,
  },
  {
    type: "FIES_ESF",
    status: "IMPLANTADO",
    passo: "Quitação em curso",
    fin: "QUITANDO",
    valor_centavos: 2_400_000,
  },
  {
    type: "FIES_DGM",
    status: "IMPLANTADO",
    passo: "Cobrar parcela #4",
    fin: "INADIMPLENTE",
    valor_centavos: 1_200_000,
  },
  {
    type: "MAIS_MEDICOS",
    status: "IMPLANTADO",
    passo: "Cliente em atraso há 60d",
    fin: "INADIMPLENTE",
    valor_centavos: 950_000,
  },
  {
    type: "FIES_ESF",
    status: "IMPLANTADO",
    passo: "Tudo quitado",
    fin: "QUITADO",
    valor_centavos: 1_800_000,
  },
  { type: "FIES_DGM", status: "ENCERRADO", passo: "Caso encerrado por acordo" },
  { type: "MAIS_MEDICOS", status: "CANCELADO", passo: "Cliente desistiu" },
];

async function purgeDemo() {
  const sb = getSupabaseAdmin();
  console.log("🧹 Apagando DEMOs existentes...");
  // Pega clientes DEMO
  const { data: clients } = await sb
    .from("system_clients")
    .select("id")
    .like("full_name", "DEMO %");
  const ids = (clients ?? []).map((c) => c.id);
  if (ids.length === 0) {
    console.log("   nada pra apagar\n");
    return;
  }
  // Hard delete (não soft) — é só demo
  const { data: cases } = await sb.from("system_cases").select("id").in("client_id", ids);
  const caseIds = (cases ?? []).map((c) => c.id);
  if (caseIds.length > 0) {
    await sb.from("system_case_events").delete().in("case_id", caseIds);
    await sb.from("system_cases").delete().in("id", caseIds);
  }
  await sb.from("system_clients").delete().in("id", ids);
  console.log(`   ✓ ${ids.length} cliente(s) DEMO + ${caseIds.length} caso(s) apagados\n`);
}

async function main() {
  console.log("🌱 Seed Cases Demo — Sistema HV\n");
  if (RESET) await purgeDemo();

  // 1) Criar clientes (se não existirem)
  const sb = getSupabaseAdmin();
  const createdClients: Array<{ id: string; full_name: string }> = [];
  for (const c of DEMO_CLIENTS) {
    const { data: existing } = await sb
      .from("system_clients")
      .select("id, full_name")
      .eq("cpf_cnpj", c.cpf)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) {
      console.log(`  ↪︎  cliente já existe: ${existing.full_name}`);
      createdClients.push(existing);
    } else {
      const cli = await createClient({
        full_name: c.name,
        cpf_cnpj: c.cpf,
        tipo: c.tipo,
        email: null,
        phone: null,
        address: { city: "Maceió", state: "AL" },
      });
      console.log(`  ✓  criado: ${cli.full_name}`);
      createdClients.push({ id: cli.id, full_name: cli.full_name });
    }
  }
  console.log();

  // 2) Distribuir casos rotativamente entre os 3 clientes
  console.log("Criando casos demo...");
  for (let i = 0; i < CASOS.length; i++) {
    const cli = createdClients[i % createdClients.length];
    const spec = CASOS[i];
    const created = await createCase({
      client_id: cli.id,
      case_type: spec.type,
      proximo_passo: spec.passo,
      responsavel: "Hyago",
      municipio: "Maceió/AL",
      valor_centavos: spec.valor_centavos ?? null,
    });
    // Move macrostatus_op se não for ONBOARDING. Se for IMPLANTADO/PARCIAL,
    // a bifurcação automática (trigger) seta fin = ELABORANDO.
    if (spec.status !== "ONBOARDING") {
      await sb.from("system_cases").update({ macrostatus_op: spec.status }).eq("id", created.id);
    }
    // Override do macrostatus_fin pra ter cenários variados na demo
    if (spec.fin) {
      await sb.from("system_cases").update({ macrostatus_fin: spec.fin }).eq("id", created.id);
    }
    console.log(
      `  ✓  ${created.case_code} → op=${spec.status}${spec.fin ? ` · fin=${spec.fin}` : ""}`,
    );
  }
  console.log(`\n🎉 ${CASOS.length} casos criados pra ${createdClients.length} clientes DEMO.`);
}

main().catch((err) => {
  console.error("❌ Falha:", err);
  process.exit(1);
});
