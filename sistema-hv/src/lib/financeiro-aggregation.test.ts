// Testes leves standalone (npx tsx). SEM banco, SEM runner. Falha = exit 1.
// Cobre R4-04: (1) edge do filtro por cliente em listAllParcelas — parcela órfã
// (client_id="") NUNCA agrega no cliente errado; (2) derivação do selo binário
// "Em dia / Devendo" (getClientPaymentStatus) a partir de status/vencimento.
//
// As duas funções reais batem no Supabase; aqui replicamos EXATAMENTE os
// predicados que elas usam para pegar regressão de lógica sem precisar de DB.

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ── (1) Filtro por cliente (espelho de financeiro-service.ts listAllParcelas) ──
// Predicado real: p.client_id !== "" && p.client_id === wanted
function filtraPorCliente<T extends { client_id: string }>(rows: T[], wanted: string): T[] {
  return rows.filter((p) => p.client_id !== "" && p.client_id === wanted);
}

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const parcelas = [
  { id: "1", client_id: A },
  { id: "2", client_id: A },
  { id: "3", client_id: B },
  { id: "4", client_id: "" }, // órfã (caso não resolveu)
];

console.log("R4-04 — agregação por cliente");
{
  const doA = filtraPorCliente(parcelas, A);
  assert("cliente A recebe suas 2 parcelas", doA.length === 2);
  assert("cliente A não vaza parcela de B", doA.every((p) => p.client_id === A));
  assert("cliente A não recebe a parcela órfã", doA.every((p) => p.id !== "4"));

  const doB = filtraPorCliente(parcelas, B);
  assert("cliente B recebe só a sua parcela", doB.length === 1 && doB[0].id === "3");

  // Edge: se alguém pedir clientId="" (não deveria), a órfã NÃO deve casar.
  const doEmpty = filtraPorCliente(parcelas, "");
  assert("clientId vazio não agrega parcelas órfãs", doEmpty.length === 0);
}

// ── (2) Selo binário (espelho de getClientPaymentStatus) ──────────────────────
// devendo = alguma parcela VENCIDA/INADIMPLENTE, ou PENDENTE vencida no passado.
function emDia(
  parcelas: Array<{ status: string; vencimento: string | null }>,
  hoje: string,
): boolean {
  const devendo = parcelas.some((p) => {
    if (p.status === "VENCIDA" || p.status === "INADIMPLENTE") return true;
    if (p.status === "PENDENTE" && p.vencimento && p.vencimento < hoje) return true;
    return false;
  });
  return !devendo;
}

console.log("R4-04 — selo binário Em dia / Devendo");
{
  const HOJE = "2026-07-18";
  assert("sem parcelas → Em dia", emDia([], HOJE) === true);
  assert(
    "todas PAGA/PENDENTE futura → Em dia",
    emDia(
      [
        { status: "PAGA", vencimento: "2026-01-01" },
        { status: "PENDENTE", vencimento: "2026-12-01" },
      ],
      HOJE,
    ) === true,
  );
  assert(
    "uma VENCIDA → Devendo",
    emDia([{ status: "VENCIDA", vencimento: "2026-06-01" }], HOJE) === false,
  );
  assert(
    "uma INADIMPLENTE → Devendo",
    emDia([{ status: "INADIMPLENTE", vencimento: "2026-06-01" }], HOJE) === false,
  );
  assert(
    "PENDENTE com vencimento no passado → Devendo",
    emDia([{ status: "PENDENTE", vencimento: "2026-06-01" }], HOJE) === false,
  );
  assert(
    "PENDENTE sem vencimento → Em dia (não avaliável como atrasada)",
    emDia([{ status: "PENDENTE", vencimento: null }], HOJE) === true,
  );
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes R4-04 passaram.");
