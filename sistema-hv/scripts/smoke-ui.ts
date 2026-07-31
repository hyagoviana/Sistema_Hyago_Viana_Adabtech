// Smoke de UI das melhorias de CAMPOS por TEMA — dirige o app REAL rodando
// (npm run dev em http://localhost:8080) via Playwright, autenticado como um admin.
//
// Autentica SEM senha e SEM criar usuário: gera uma sessão para um admin existente
// (admin.generateLink → verifyOtp) e ENCODA o cookie usando a PRÓPRIA lib
// @supabase/ssr (createServerClient + setSession num cookie-store em memória),
// garantindo o formato exato que cliente e servidor esperam. Injeta o cookie no
// contexto do Playwright. NÃO grava dados (só lê telas); a sessão expira sozinha.
//
// Uso: (dev server no ar) npx tsx scripts/smoke-ui.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const BASE = "http://localhost:8080";
const SHOTS = ".smoke-ui";
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

  // 1) Escolhe um admin ACTIVE e gera sessão (sem senha, sem criar usuário).
  const { data: admins } = await admin
    .from("system_users")
    .select("id, email, full_name, role, status")
    .eq("role", "admin");
  const target =
    (admins ?? []).find((u) => (u.status ?? "").toUpperCase() === "ACTIVE") ?? (admins ?? [])[0];
  if (!target?.email) {
    console.error("Sem admin com email em system_users — não dá para autenticar.");
    process.exit(2);
  }
  console.log(`Admin de teste: ${target.full_name ?? target.email} (${target.email})`);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });
  if (linkErr || !link?.properties?.email_otp) {
    console.error("Falha ao gerar OTP:", linkErr?.message);
    process.exit(1);
  }
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verify, error: vErr } = await anonClient.auth.verifyOtp({
    email: target.email,
    token: link.properties.email_otp,
    type: "email",
  });
  if (vErr || !verify.session) {
    console.error("Falha no verifyOtp:", vErr?.message);
    process.exit(1);
  }

  // 2) Encoda o cookie via a própria @supabase/ssr (formato exato base64url/chunk).
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const c of cookies) jar.set(c.name, c.value);
      },
    },
  });
  await ssr.auth.setSession({
    access_token: verify.session.access_token,
    refresh_token: verify.session.refresh_token,
  });
  await ssr.auth.getUser(); // força flush da persistência
  const cookies = [...jar.entries()].map(([name, value]) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
  }));
  check("cookie de sessão gerado", cookies.length > 0, cookies.map((c) => c.name).join(","));

  // 3) Dados p/ navegação: um tema e um caso com tema.
  const { data: temaRow } = await admin
    .from("system_temas_active")
    .select("id, name")
    .limit(1)
    .maybeSingle();
  const { data: casoRow } = await admin
    .from("system_cases_active")
    .select("id, case_code, tema_id")
    .not("tema_id", "is", null)
    .limit(1)
    .maybeSingle();
  console.log(`Tema: ${temaRow?.name ?? "?"} | Caso c/ tema: ${casoRow?.case_code ?? "nenhum"}`);

  // 4) Playwright — usa o chrome FULL (headless-shell dá "spawn UNKNOWN" aqui).
  const exe = process.env.PW_CHROME_EXE;
  const browser = await chromium.launch({
    headless: true,
    ...(exe ? { executablePath: exe } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  const consoleErrors: string[] = [];
  const badResponses: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });

  try {
    // 4a) Autenticado? Vai para a Lista já com o tema pré-selecionado.
    const listUrl = temaRow?.id
      ? `${BASE}/casos/lista?tema=${temaRow.id}`
      : `${BASE}/casos/lista`;
    await page.goto(listUrl, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    const onLogin = page.url().includes("/login");
    check("autenticado (não caiu no /login)", !onLogin, page.url());
    await page.screenshot({ path: `${SHOTS}/1-lista.png`, fullPage: false });
    if (onLogin) throw new Error("Não autenticou — abortando navegação.");

    // 4b) Abre o editor de campos do tema ("Editar campos" — admin).
    const editar = page.getByRole("button", { name: /Editar campos/i });
    const temEditar = (await editar.count()) > 0;
    check("botão 'Editar campos' visível (admin)", temEditar);
    if (temEditar) {
      await editar.first().click();
      await page.waitForTimeout(800);
      const dialog = page.getByRole("dialog");
      await dialog.first().waitFor({ timeout: 8000 }).catch(() => {});
      const bodyText = await page.locator("body").innerText();
      check("editor mostra 'Onde fica o valor' (#3 origem)", /Onde fica o valor/i.test(bodyText));
      check(
        "editor mostra 'Nº de preenchimentos' (#6 ocorrências)",
        /N.?º?\s*de preenchimentos/i.test(bodyText) || /preenchimentos/i.test(bodyText),
      );
      check("editor mostra 'Ocultar na lista' (#5)", /Ocultar na lista/i.test(bodyText));
      check(
        "editor mostra origem cliente (opção)",
        /Do cliente|compartilhado/i.test(bodyText),
      );
      await page.screenshot({ path: `${SHOTS}/2-editor-campos.png`, fullPage: false });
      // Fecha o dialog (Esc).
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
    }

    // 4c) Ficha do caso — bloco "Dados do serviço" (#2 exposto na ficha).
    if (casoRow?.id) {
      await page.goto(`${BASE}/casos/${casoRow.id}`, {
        waitUntil: "networkidle",
        timeout: 45000,
      });
      await page.waitForTimeout(1500);
      const fichaText = await page.locator("body").innerText();
      check("ficha renderiza (tem o código do caso)", fichaText.includes(casoRow.case_code ?? "§"));
      check("ficha mostra bloco 'Dados do serviço' (#2)", /Dados do serviço/i.test(fichaText));
      await page.screenshot({ path: `${SHOTS}/3-ficha-dados-servico.png`, fullPage: true });
    } else {
      console.log("  ⏭️ Sem caso com tema — pulando checagem da ficha.");
    }

    // 4d) Erros de console/runtime?
    check(
      "sem erros de runtime/console críticos",
      consoleErrors.length === 0,
      consoleErrors.slice(0, 5).join(" | "),
    );
    if (badResponses.length) {
      console.log("\n  Requests >= 400 observados:");
      for (const b of badResponses) console.log("   • " + b);
    }
  } finally {
    await browser.close();
  }
}

main()
  .catch((err) => {
    console.error("\nERRO no smoke de UI:", err instanceof Error ? err.message : err);
    fail++;
  })
  .finally(() => {
    console.log(`\nRESULTADO UI: ${pass} passou, ${fail} falhou. Screenshots em ${SHOTS}/`);
    process.exit(fail > 0 ? 1 : 0);
  });
