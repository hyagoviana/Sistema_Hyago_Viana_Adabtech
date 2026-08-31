// Smoke da tela Permissões depois da reorganização de 31/08.
//
// O que precisa continuar valendo: as flags do motor NÃO mudaram de
// comportamento — só ganharam um resumo em cima. Então o teste confere que o
// selo aparece com o mesmo veredito que a regra do motor dá, e que o diálogo
// de edição continua abrindo com tudo no lugar.
//
// Uso: (dev server no ar) npx tsx scripts/smoke-ui-permissoes.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { diagnosticarElegibilidade } from "../src/lib/distribuicao/elegibilidade-shared";

const BASE = "http://localhost:8080";
const SHOTS = ".smoke-ui-0831";
const url = process.env.VITE_SUPABASE_URL!;
const anon = process.env.VITE_SUPABASE_ANON_KEY!;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.error(`  ❌ ${name}`, extra ?? "");
    fail++;
  }
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const admin = getSupabaseAdmin();

  // Quantos DEVERIAM aparecer como "Recebe tarefas", pela regra do motor.
  const { data: us } = await admin
    .from("system_users")
    .select("id, full_name, status, peticionante, participa_distribuicao_padrao");
  const { data: mp } = await admin
    .from("system_projuris_executor_mapping")
    .select("executor_id, active, weight");
  const byId = new Map(
    (mp ?? []).map((m) => [
      (m as { executor_id: string }).executor_id,
      m as { active: boolean; weight: number },
    ]),
  );
  const esperados = (us ?? []).filter((u) => {
    const m = byId.get((u as { id: string }).id);
    return diagnosticarElegibilidade({
      status: (u as { status: string }).status,
      peticionante: (u as { peticionante: boolean }).peticionante,
      participaGeral: (u as { participa_distribuicao_padrao: boolean })
        .participa_distribuicao_padrao,
      vinculoAtivo: m?.active,
      peso: m?.weight,
    }).recebeNaFila;
  });
  console.log(`Pela regra do motor, ${esperados.length} pessoa(s) recebem na fila.\n`);

  const { data: admins } = await admin
    .from("system_users")
    .select("id, email, full_name, role, status")
    .eq("role", "admin");
  const target =
    (admins ?? []).find((u) => (u.status ?? "").toUpperCase() === "ACTIVE") ?? (admins ?? [])[0];
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target!.email,
  });
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verify } = await anonClient.auth.verifyOtp({
    email: target!.email,
    token: link!.properties!.email_otp!,
    type: "email",
  });
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => {
        for (const c of cs) jar.set(c.name, c.value);
      },
    },
  });
  await ssr.auth.setSession({
    access_token: verify!.session!.access_token,
    refresh_token: verify!.session!.refresh_token,
  });
  await ssr.auth.getUser();
  const cookies = [...jar.entries()].map(([name, value]) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
  }));

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/permissoes`, { waitUntil: "domcontentloaded" });
    await page
      .waitForFunction(() => !/^\s*Carregando\.\.\.\s*$/.test(document.body?.innerText ?? ""), {
        timeout: 60000,
      })
      .catch(() => {});
    await page.waitForSelector("text=/Recebe tarefas|Fora do motor|Só por exceção/", {
      timeout: 40000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/09-permissoes-lista.png`, fullPage: false });

    const recebe = await page.getByText(/^Recebe tarefas/).count();
    const excecao = await page.getByText(/^Só por exceção/).count();
    const fora = await page.getByText(/^Fora do motor/).count();
    console.log(`  Selos na tela: recebe=${recebe} exceção=${excecao} fora=${fora}`);

    check(
      "o selo 'Recebe tarefas' bate com a regra do motor",
      recebe === esperados.length,
      `tela=${recebe} regra=${esperados.length}`,
    );
    check("existe selo de 'Só por exceção'", excecao > 0);
    check("existe selo de 'Fora do motor'", fora > 0);

    // Abre a edição do primeiro usuário e confere o resumo dentro do diálogo.
    const editar = page.locator('button[title*="Editar"]').first();
    if ((await editar.count()) > 0) {
      await editar.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${SHOTS}/10-permissoes-editar.png`, fullPage: false });
      const dlg = await page.locator('[role="dialog"]').innerText();
      check(
        "o diálogo mostra o resumo do motor",
        /Recebe tarefas|Fora do motor|Só por exceção/.test(dlg),
      );
      check(
        "as chaves do motor continuam lá",
        /Peticionante/i.test(dlg) && /fila ordinária/i.test(dlg),
      );
      check("o peso na fila continua editável", /Peso na fila/i.test(dlg));
      check("os dados do colaborador continuam", /Perfil/i.test(dlg) && /Cargo/i.test(dlg));
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${pass} passou · ${fail} falhou · prints em ${SHOTS}/`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
