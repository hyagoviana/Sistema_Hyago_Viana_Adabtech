// Smoke do fluxo "Cadastrar processo no ProJuris" (31/08), no app rodando.
//
// PARA ANTES DO ENVIO de propósito: vai até a tela de conferência, confirma que
// o corpo foi montado com dados reais, e NÃO clica em "Cadastrar no ProJuris".
// Criar processo lá é escrita irreversível por API — isso só com autorização e
// pelo script dedicado.
//
// Cobre:
//   · o botão aparece no caso SEM processo vinculado;
//   · o diálogo abre e as listas do ProJuris carregam de verdade;
//   · o formulário já vem preenchido com o que o caso sabe;
//   · "Conferir antes de enviar" mostra o JSON que iria.
//
// Uso: (dev server no ar) npx tsx scripts/smoke-ui-criar-processo.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

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

  // Caso SEM processo vinculado — é onde o botão novo aparece.
  const { data: caso } = await admin
    .from("system_cases")
    .select("id, case_code")
    .is("deleted_at", null)
    .is("projuris_codigo_processo", null)
    .limit(1)
    .maybeSingle();
  if (!caso) {
    console.error("Nenhum caso sem processo vinculado — não dá para testar o botão.");
    process.exit(2);
  }
  console.log(`Admin: ${target!.full_name} · Caso: ${(caso as { case_code: string }).case_code}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/casos/${(caso as { id: string }).id}/judicial`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForFunction(() => !/^\s*Carregando\.\.\.\s*$/.test(document.body?.innerText ?? ""), {
        timeout: 60000,
      })
      .catch(() => {});
    // O gate de permissão depende do perfil + overrides, que chegam por query.
    // Esperar o BOTÃO (e não um tempo fixo) evita reprovar por corrida.
    await page
      .getByRole("button", { name: /cadastrar no projuris/i })
      .first()
      .waitFor({ timeout: 25000 })
      .catch(() => {});
    await page.screenshot({ path: `${SHOTS}/06-judicial-sem-processo.png` });

    const btn = page.getByRole("button", { name: /cadastrar no projuris/i }).first();
    check("botão 'Cadastrar no ProJuris' aparece", (await btn.count()) > 0);
    if ((await btn.count()) === 0) throw new Error("sem botão — nada a testar adiante");

    await btn.click();
    // As listas passam por autenticação + API externa e, no dev server, ainda pela
    // compilação da rota sob demanda. Esperar as OPÇÕES aparecerem (e não um tempo
    // fixo) — com 9s fixos o teste reprovava algo que funciona em 2,8s no servidor.
    await page
      .waitForFunction(
        () => document.querySelectorAll('[role="dialog"] select option').length > 20,
        { timeout: 90000 },
      )
      .catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/07-dialog-cadastro.png` });

    const dlg = await page.locator('[role="dialog"]').innerText();
    check("diálogo abriu", /cadastrar processo no projuris/i.test(dlg));
    check("já vem preenchido com o caso", (await page.locator("input[value]").count()) > 0);

    // As listas do ProJuris precisam ter vindo com conteúdo de verdade.
    const opcoes = await page.locator('[role="dialog"] select option').count();
    check("listas do ProJuris carregaram", opcoes > 20, `${opcoes} opções`);
    const temJusticaFederal = /justi[çc]a federal/i.test(dlg);
    check("lista traz dados reais (ex.: Justiça Federal)", temJusticaFederal);

    // Conferência — monta o corpo no servidor, sem enviar.
    const conferir = page.getByRole("button", { name: /conferir antes de enviar/i }).first();
    check("botão de conferência existe", (await conferir.count()) > 0);
    if ((await conferir.count()) > 0) {
      await conferir.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${SHOTS}/08-conferencia.png` });
      const conf = await page.locator('[role="dialog"]').innerText();
      check("mostra o JSON que seria enviado", conf.includes("nomePasta"), conf.slice(0, 160));
      check("avisa que é escrita real", /não tem desfazer|de verdade/i.test(conf));
      check(
        "NÃO enviou nada (o botão de envio ainda está lá)",
        (await page.getByRole("button", { name: /^cadastrar no projuris$/i }).count()) > 0,
      );
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
