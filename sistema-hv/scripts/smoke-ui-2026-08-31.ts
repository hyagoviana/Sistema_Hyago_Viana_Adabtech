// Smoke de UI das entregas do doc "31.08 — tarefas", no app REAL rodando
// (npm run dev em http://localhost:8080), autenticado como admin.
//
// Existe pelo mesmo motivo do smoke-ui-2026-08-27: typecheck, lint e build não
// abrem tela nenhuma. Este script responde "isso realmente aparece no navegador?".
//
// Cobre:
//   T1  /tarefas — sem a coluna Prazos, 2 abas (atraso/prazo), filtros novos
//   T1b /tarefas — paginação de 10 quando a lista passa disso
//   T2  kanban — selo do card vem da tarefa; ORDEM ESTÁVEL entre carregamentos
//   T3  workflows — ação "Criar tarefa" com tipo, responsável e encadeamento
//   T4  ficha do caso — selos da tarefa sem sobreposição
//   T5  ficha do caso — auditoria recolhida (nasce fechada) e abre no clique
//
// NÃO grava nada: só navega, lê e tira print.
//
// Uso: (dev server no ar) npx tsx scripts/smoke-ui-2026-08-31.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, type Page } from "playwright";
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

/**
 * Navega e ESPERA o app sair do "Carregando...". O dev server compila sob
 * demanda: no primeiro acesso a uma rota, 3 segundos fixos pegam a tela em
 * branco e o teste reprova o que está certo (aconteceu na primeira rodada).
 */
async function irPara(page: Page, caminho: string, espera = 1200) {
  await page.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(
      () => !/^\s*Carregando\.\.\.\s*$/.test(document.body?.innerText ?? ""),
      { timeout: 60000 },
    );
    // A sidebar é o primeiro sinal de que o shell montou.
    await page.waitForSelector("text=OPERAÇÃO", { timeout: 30000 });
  } catch {
    /* segue e deixa as asserções falarem */
  }
  await page.waitForTimeout(espera);
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const admin = getSupabaseAdmin();

  // ── sessão (mesmo caminho do smoke de 27/08) ──────────────────────────────
  const { data: admins } = await admin
    .from("system_users")
    .select("id, email, full_name, role, status")
    .eq("role", "admin");
  const target =
    (admins ?? []).find((u) => (u.status ?? "").toUpperCase() === "ACTIVE") ?? (admins ?? [])[0];
  if (!target?.email) {
    console.error("Sem admin ACTIVE — não dá para autenticar.");
    process.exit(2);
  }
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });
  const otp = link?.properties?.email_otp;
  if (!otp) {
    console.error("Falha ao gerar OTP.");
    process.exit(1);
  }
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verify } = await anonClient.auth.verifyOtp({
    email: target.email,
    token: otp,
    type: "email",
  });
  if (!verify?.session) {
    console.error("Falha no verifyOtp.");
    process.exit(1);
  }
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
    access_token: verify.session.access_token,
    refresh_token: verify.session.refresh_token,
  });
  await ssr.auth.getUser();
  const cookies = [...jar.entries()].map(([name, value]) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
  }));
  console.log(`Admin: ${target.full_name ?? target.email}\n`);

  // ── dados para navegar ────────────────────────────────────────────────────
  // O kanban é aberto por `service_type_id` (search param `cat`). Pegar de um
  // CASO real garante que existe pelo menos um card para ordenar.
  const { data: casoQualquer } = await admin
    .from("system_cases_active")
    .select("service_type_id")
    .not("service_type_id", "is", null)
    .limit(1)
    .maybeSingle();
  const serviceTypeId =
    (casoQualquer as { service_type_id?: string } | null)?.service_type_id ?? null;
  const { data: st } = serviceTypeId
    ? await admin
        .from("system_service_types")
        .select("id, name")
        .eq("id", serviceTypeId)
        .maybeSingle()
    : { data: null };
  const tema = st as { id: string; name: string } | null;

  // Caso que tenha TAREFA — é onde os selos e a auditoria têm o que mostrar.
  const { data: tarefa } = await admin
    .from("system_case_tasks")
    .select("case_id")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const casoComTarefa = tarefa?.case_id ?? null;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text().slice(0, 160));
  });

  try {
    // ── T1 — tela de Tarefas ───────────────────────────────────────────────
    console.log("T1 — /tarefas");
    await irPara(page, "/tarefas");
    await page.screenshot({ path: `${SHOTS}/01-tarefas.png`, fullPage: false });

    const corpo = (await page.locator("body").innerText()).toLowerCase();
    check(
      "as 2 abas existem",
      corpo.includes("tarefas em atraso") && corpo.includes("tarefas em prazo"),
    );
    check(
      "coluna/KPIs de PRAZO sumiram",
      !corpo.includes("prazos abertos") &&
        !corpo.includes("prazos vencidos") &&
        !corpo.includes("prazos ≤"),
      corpo.slice(0, 200),
    );
    check("KPI 'Em atraso' presente", corpo.includes("em atraso"));
    check("nada de checklist na lista", !corpo.includes("tarefas e checklist"));
    // Filtros novos
    const temFiltro = async (texto: string) =>
      (await page.locator(`select:has(option:text-is("${texto}"))`).count()) > 0;
    check("filtro de TEMA", await temFiltro("Todos os temas"));
    check("filtro de PRIORIDADE", await temFiltro("Todas as prioridades"));
    check(
      "filtro de TIPO de tarefa",
      (await page.locator('button:has-text("Todos os tipos"), [role="combobox"]').count()) > 0,
    );
    check("filtro de STATUS removido", !(await temFiltro("Todos os status")));

    // T1b — paginação: só existe quando a lista passa de 10.
    const textoPag = await page.locator("body").innerText();
    const temPaginacao = /p[áa]gina\s+\d+\s+de\s+\d+/i.test(textoPag);
    console.log(`  ℹ️  paginação visível: ${temPaginacao ? "sim" : "não (lista ≤ 10 nesta aba)"}`);

    // ── T2 — kanban: ordem ESTÁVEL entre dois carregamentos ────────────────
    console.log("\nT2 — kanban (ordem estável + selo de prazo)");
    if (!tema) {
      console.log("  ⚠️  nenhum tema com service_type — pulando");
    } else {
      const rota = `/pipeline?cat=${tema.id}&catName=${encodeURIComponent(tema.name)}`;
      await irPara(page, rota, 3500);
      await page.screenshot({ path: `${SHOTS}/02-kanban.png`, fullPage: false });

      // Lê os códigos de caso na ordem em que aparecem.
      const lerOrdem = async () =>
        (await page.locator("text=/^[A-Z]+-\\d{4}-\\d{4}$/").allInnerTexts()).slice(0, 25);
      const ordem1 = await lerOrdem();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);
      const ordem2 = await lerOrdem();

      check("kanban renderiza cards", ordem1.length > 0, `cards lidos: ${ordem1.length}`);
      check(
        "ORDEM ESTÁVEL entre dois carregamentos",
        ordem1.length > 0 && JSON.stringify(ordem1) === JSON.stringify(ordem2),
        { antes: ordem1.slice(0, 5), depois: ordem2.slice(0, 5) },
      );

      // Selo: ou não existe (caso sem tarefa), ou é "Nd"/"Nd atraso"/"hoje".
      const selos = await page.locator("text=/^\\d+d( atraso)?$|^hoje$/").allInnerTexts();
      console.log(
        `  ℹ️  selos de prazo visíveis: ${selos.length} (${selos.slice(0, 4).join(", ")})`,
      );
      check(
        "selo de prazo no formato novo (ou ausente)",
        selos.every((s) => /^\d+d( atraso)?$|^hoje$/.test(s.trim())),
        selos.slice(0, 5),
      );
    }

    // ── T3 — workflows: ação "Criar tarefa" ────────────────────────────────
    console.log("\nT3 — /configuracoes/workflows");
    await irPara(page, "/configuracoes/workflows", 3000);
    const btnNovo = page
      // "Novo" sozinho casava com o "Novo cliente" da barra de topo e abria o
      // cadastro de cliente — o teste reprovava o que estava certo.
      .locator('button:has-text("Novo workflow")')
      .first();
    if ((await btnNovo.count()) === 0) {
      console.log("  ⚠️  botão de criar não encontrado — pulando");
    } else {
      await btnNovo.click();
      await page.waitForTimeout(1200);
      // Troca a ação para "Criar tarefa".
      const seletorAcao = page
        .locator('[role="combobox"]')
        .filter({ hasText: /coment[áa]rio/i })
        .first();
      if ((await seletorAcao.count()) > 0) {
        await seletorAcao.click();
        await page.waitForTimeout(500);
        await page.locator('[role="option"]:has-text("Criar tarefa")').first().click();
        await page.waitForTimeout(900);
      }
      await page.screenshot({ path: `${SHOTS}/03-workflow-criar-tarefa.png`, fullPage: false });
      const dlg = (await page.locator("body").innerText()).toLowerCase();
      // Placeholder NÃO entra em innerText — tem que ser procurado como atributo.
      check(
        "campo de título da tarefa",
        (await page.getByPlaceholder(/t[íi]tulo da tarefa/i).count()) > 0,
      );
      check(
        "seletor de RESPONSÁVEL",
        dlg.includes("responsável") || dlg.includes("sem responsável"),
      );
      check("seletor de TIPO de tarefa", dlg.includes("sem tipo") || dlg.includes("classe"));
      check("bloco de ENCADEAMENTO", dlg.includes("quando esta tarefa for concluída"));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }

    // ── T4/T5 — ficha do caso ──────────────────────────────────────────────
    console.log("\nT4/T5 — ficha do caso");
    if (!casoComTarefa) {
      console.log("  ⚠️  nenhum caso com tarefa — pulando");
    } else {
      await irPara(page, `/casos/${casoComTarefa}`, 4000);
      const ficha = await page.locator("body").innerText();
      check("auditoria NASCE FECHADA", ficha.includes("clique para abrir"), ficha.slice(0, 120));
      // O rótulo é um Eyebrow (uppercase via CSS) — innerText devolve o texto já
      // transformado, então a comparação tem que ignorar caixa.
      check("seção de auditoria presente", /auditoria deste caso/i.test(ficha));

      // Abre a auditoria e confere que a tabela monta.
      const cab = page.getByRole("button", { name: /auditoria deste caso/i }).first();
      if ((await cab.count()) > 0) {
        await cab.click();
        await page.waitForTimeout(2200);
        const aberto = await page.locator("body").innerText();
        check(
          "auditoria ABRE no clique",
          aberto.includes("O QUE ACONTECEU") || aberto.includes("Quem mexeu no quê"),
        );
        await page.screenshot({ path: `${SHOTS}/04-caso-auditoria.png`, fullPage: false });
      }

      // T4 — sobreposição: os selos da tarefa não podem invadir o texto.
      // Mede a caixa do bloco de selos e a do conteúdo; não podem se cruzar.
      const sobrepoe = await page.evaluate(() => {
        const li = Array.from(document.querySelectorAll("li")).find(
          (el) => el.querySelector('[class*="ml-auto"]') && el.querySelector(".flex-1"),
        );
        if (!li) return null;
        const conteudo = li.querySelector(".flex-1")?.getBoundingClientRect();
        const selos = li.querySelector('[class*="ml-auto"]')?.getBoundingClientRect();
        if (!conteudo || !selos) return null;
        // Sobrepõe se o bloco de selos começa antes do fim do conteúdo E estão
        // na mesma faixa vertical.
        const cruzaX = selos.left < conteudo.right - 1;
        const cruzaY = selos.top < conteudo.bottom && selos.bottom > conteudo.top;
        return { cruzaX, cruzaY, conteudo: conteudo.right, selos: selos.left };
      });
      if (sobrepoe === null) {
        console.log("  ℹ️  não achei a linha de tarefa nesta ficha (caso sem tarefa visível)");
      } else {
        check(
          "selos da tarefa NÃO sobrepõem o texto",
          !(sobrepoe.cruzaX && sobrepoe.cruzaY),
          sobrepoe,
        );
      }
      await page.screenshot({ path: `${SHOTS}/05-caso-tarefas.png`, fullPage: false });
    }

    // ── erros de console ───────────────────────────────────────────────────
    console.log("\nConsole");
    const relevantes = erros.filter(
      (e) => !/favicon|sourcemap|Download the React DevTools|ResizeObserver/i.test(e),
    );
    check("sem erro de console relevante", relevantes.length === 0, relevantes.slice(0, 5));
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
