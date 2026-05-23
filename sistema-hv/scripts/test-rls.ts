// Valida o isolamento de RLS organization-scoped no schema do Sistema HV.
//
// Estratégia:
//   1. Como service_role (bypassa RLS): cria org-B + 1 cliente em org-default + 1 cliente em org-B.
//   2. Como anon (sem JWT custom): o fallback de system_current_organization_id() retorna
//      org-default → SELECT deve mostrar SOMENTE o cliente da org-default, nunca o de org-B.
//   3. Cleanup tudo no final (mesmo se falhar).
//
// Uso:
//   npx tsx scripts/test-rls.ts

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "../src/lib/supabase/server";

let failed = 0;

function assert(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function main() {
  console.log("🔒 Test-RLS — Sistema HV\n");

  const admin = getSupabaseAdmin();
  const anonUrl = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false } });

  const ORG_DEFAULT_ID = "00000000-0000-0000-0000-000000000001";
  const orgBId = crypto.randomUUID();
  const clientDefaultId = crypto.randomUUID();
  const clientBId = crypto.randomUUID();
  const cpfA = `${Date.now()}`.slice(-11).padStart(11, "0");
  const cpfB = `${Date.now() + 1}`.slice(-11).padStart(11, "0");

  // ─── Setup ───────────────────────────────────────────────────────────────
  console.log("1) Setup: criando org-B e 2 clientes via service_role...");

  const { error: orgErr } = await admin.from("system_organizations").insert({
    id: orgBId,
    name: `Org-B-RLS-${Date.now()}`,
  });
  assert("org-B criada", !orgErr);

  const { error: cAErr } = await admin.from("system_clients").insert({
    id: clientDefaultId,
    organization_id: ORG_DEFAULT_ID,
    full_name: `RLS-TEST cliente-A ${Date.now()}`,
    cpf_cnpj: cpfA,
  });
  assert("cliente em org-default criado", !cAErr);

  const { error: cBErr } = await admin.from("system_clients").insert({
    id: clientBId,
    organization_id: orgBId,
    full_name: `RLS-TEST cliente-B ${Date.now()}`,
    cpf_cnpj: cpfB,
  });
  assert("cliente em org-B criado", !cBErr);

  // ─── Teste 1: anon SELECT direto ─────────────────────────────────────────
  console.log("\n2) Anon role (fallback → org-default): SELECT clientes...");
  const { data: anonClients, error: anonErr } = await anon
    .from("system_clients")
    .select("id, full_name, organization_id")
    .in("id", [clientDefaultId, clientBId]);

  assert("query anon não retornou erro", !anonErr);
  const ids = (anonClients ?? []).map((c) => c.id);
  assert("anon VÊ cliente-A (org-default)", ids.includes(clientDefaultId));
  assert("anon NÃO VÊ cliente-B (org-B) — isolamento RLS funciona", !ids.includes(clientBId));

  // ─── Teste 2: anon tenta INSERT em org-B ─────────────────────────────────
  console.log("\n3) Anon role tenta inserir em org-B (deve falhar por WITH CHECK)...");
  const { error: anonInsertErr } = await anon.from("system_clients").insert({
    organization_id: orgBId,
    full_name: "RLS-TEST cliente-malicioso",
    cpf_cnpj: `${Date.now() + 999}`.slice(-11).padStart(11, "0"),
  });
  assert(
    "anon NÃO consegue inserir em org-B (RLS bloqueia)",
    !!anonInsertErr &&
      (anonInsertErr.code === "42501" || anonInsertErr.message.toLowerCase().includes("policy")),
  );

  // ─── Teste 3: documentos respeitam RLS por org ───────────────────────────
  console.log("\n4) RLS em system_client_documents...");
  const docAId = crypto.randomUUID();
  const docBId = crypto.randomUUID();
  await admin.from("system_client_documents").insert([
    {
      id: docAId,
      client_id: clientDefaultId,
      organization_id: ORG_DEFAULT_ID,
      name: "doc-A.pdf",
      drive_file_id: "fake-A",
      drive_url: "https://example/A",
    },
    {
      id: docBId,
      client_id: clientBId,
      organization_id: orgBId,
      name: "doc-B.pdf",
      drive_file_id: "fake-B",
      drive_url: "https://example/B",
    },
  ]);

  const { data: anonDocs } = await anon
    .from("system_client_documents")
    .select("id, organization_id")
    .in("id", [docAId, docBId]);
  const docIds = (anonDocs ?? []).map((d) => d.id);
  assert("anon VÊ doc de org-default", docIds.includes(docAId));
  assert("anon NÃO VÊ doc de org-B (isolamento de docs OK)", !docIds.includes(docBId));

  // ─── Teste 4: casos respeitam RLS por org ────────────────────────────────
  console.log("\n5) RLS em system_cases...");
  const caseAId = crypto.randomUUID();
  const caseBId = crypto.randomUUID();
  await admin.from("system_cases").insert([
    {
      id: caseAId,
      client_id: clientDefaultId,
      organization_id: ORG_DEFAULT_ID,
      case_code: `HV-RLS-A-${Date.now()}`,
      case_type: "FIES_ESF",
    },
    {
      id: caseBId,
      client_id: clientBId,
      organization_id: orgBId,
      case_code: `HV-RLS-B-${Date.now()}`,
      case_type: "FIES_ESF",
    },
  ]);

  const { data: anonCases } = await anon
    .from("system_cases")
    .select("id, organization_id")
    .in("id", [caseAId, caseBId]);
  const caseIds = (anonCases ?? []).map((c) => c.id);
  assert("anon VÊ caso de org-default", caseIds.includes(caseAId));
  assert("anon NÃO VÊ caso de org-B (isolamento OK)", !caseIds.includes(caseBId));

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  console.log("\n6) Cleanup...");
  await admin.from("system_case_events").delete().in("case_id", [caseAId, caseBId]);
  await admin.from("system_cases").delete().in("id", [caseAId, caseBId]);
  await admin.from("system_client_documents").delete().in("id", [docAId, docBId]);
  await admin.from("system_clients").delete().in("id", [clientDefaultId, clientBId]);
  await admin.from("system_organizations").delete().eq("id", orgBId);
  console.log("   ✓ tudo limpo\n");

  if (failed > 0) {
    console.error(`❌ ${failed} assertion(s) falhou(aram).`);
    process.exit(1);
  }
  console.log("🎉 Todos os testes de RLS passaram.");
}

main().catch((err) => {
  console.error("❌ Falha geral:", err);
  process.exit(1);
});
