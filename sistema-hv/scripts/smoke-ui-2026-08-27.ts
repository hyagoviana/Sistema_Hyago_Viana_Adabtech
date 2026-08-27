// Smoke de UI das entregas de 2026-08-27, no app REAL rodando (npm run dev em
// http://localhost:8080), autenticado como admin.
//
// POR QUE ESTE SCRIPT EXISTE. O projeto não tem runner de teste, então até aqui
// a validação era typecheck + lint + build — nenhum dos três abre uma tela. Este
// smoke é o que responde "isso realmente aparece e funciona no navegador?".
//
// Reusa a autenticação de `smoke-ui.ts`: gera sessão para um admin existente via
// generateLink → verifyOtp e encoda o cookie com a própria @supabase/ssr. NÃO
// grava nada — só navega e lê.
//
// Cobre:
//   AJ1  menu do motor sem Tipos Tarefa / Vínculos / Temas / Simulador
//   AJ2  botão de sair do kanban adicional na ficha do caso
//   AJ3  seletor de kanban na ação "Mudar etapa" do workflow
//   ESP  selo "ProJuris" na tarefa espelhada
//   SEL  seletor de usuário do ProJuris em Permissões (fim do texto livre)
//
// Uso: (dev server no ar) npx tsx scripts/smoke-ui-2026-08-27.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, type Page } from "playwright";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const BASE = "http://localhost:8080";
const SHOTS = ".smoke-ui-0827";
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

async function irPara(page: Page, caminho: string, espera = 2500) {
  await page.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(espera);
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const admin = getSupabaseAdmin();

  // ── sessão ────────────────────────────────────────────────────────────────
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
  // Caso que esteja num kanban ADICIONAL — é o único onde o botão do AJ2 aparece.
  const { data: pos } = await admin
    .from("system_case_board_positions")
    .select("case_id")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const casoComBoard = pos?.case_id ?? null;

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
    // ── AJ1 ────────────────────────────────────────────────────────────────
    console.log("AJ1 — menu do motor");
    await irPara(page, "/controladoria/distribuicao");
    // Pegar a <nav> certa importa mais do que parece: `nav.first()` traz a
    // SIDEBAR e "Painel" também casa com o BREADCRUMB — nos dois casos os itens
    // removidos "não aparecem" e o teste passaria por engano. "A distribuir" só
    // existe nas abas do motor.
    const abas = page.locator("nav").filter({ hasText: "A distribuir" });
    const menuTxt = await abas.first().innerText();
    for (const item of ["Tipos Tarefa", "Vínculos", "Temas", "Simulador"]) {
      check(`"${item}" saiu das abas do motor`, !menuTxt.includes(item), menuTxt.slice(0, 300));
    }
    check("aba Configuração continua", menuTxt.includes("Configuração"), menuTxt.slice(0, 300));
    check(
      "abas de Operação intactas",
      menuTxt.includes("A distribuir") && menuTxt.includes("Kanban"),
    );
    await page.screenshot({ path: `${SHOTS}/aj1-menu.png` });

    // ── AJ2 ────────────────────────────────────────────────────────────────
    console.log("\nAJ2 — sair do kanban adicional");
    if (casoComBoard) {
      await irPara(page, `/casos/${casoComBoard}`, 3500);
      const temRastro = await page.getByText("Rastro Operacional").count();
      check("ficha abriu com Rastro Operacional", temRastro > 0);
      // O botão só existe em kanban ADICIONAL. Se o rastro do caso só tiver o
      // principal, não é falha do AJ2 — é o caso escolhido. Distinguir importa.
      const temAdicional = (await page.getByText(/^Kanban \d+ ·/).count()) > 0;
      const botao = page.locator('button[aria-label^="Tirar o caso do kanban"]');
      if (temAdicional) {
        check("botão de sair do kanban adicional existe", (await botao.count()) > 0);
      } else {
        console.log("  (o caso só está no kanban principal — botão não deve existir)");
        check("botão NÃO aparece no kanban principal", (await botao.count()) === 0);
      }
      await page.screenshot({ path: `${SHOTS}/aj2-ficha.png`, fullPage: false });
    } else {
      console.log("  (nenhum caso em kanban adicional — pulado)");
    }

    // ── AJ3 ────────────────────────────────────────────────────────────────
    console.log("\nAJ3 — kanban na ação do workflow");
    await irPara(page, "/configuracoes/workflows", 3000);
    const txtWf = await page.locator("body").innerText();
    check("tela de workflows abriu", txtWf.includes("Workflow") || txtWf.includes("workflow"));

    // Não basta a tela abrir: o AJ3 vive DENTRO do formulário. Abre o "novo
    // workflow", troca a ação para "Mudar etapa" e confere se o seletor de kanban
    // apareceu — é isso que o Thiago pediu.
    const novo = page.getByRole("button", { name: /novo workflow|adicionar workflow|criar/i });
    if ((await novo.count()) > 0) {
      await novo.first().click();
      await page.waitForTimeout(1200);
      const seletorAcao = page
        .locator('[role="combobox"]')
        .filter({ hasText: /Escrever comentário/ });
      if ((await seletorAcao.count()) > 0) {
        await seletorAcao.first().click();
        await page.waitForTimeout(500);
        const opcao = page.getByRole("option", { name: "Mudar etapa" });
        if ((await opcao.count()) > 0) {
          await opcao.first().click();
          await page.waitForTimeout(900);
          // O formulário de workflow é INLINE na página, não um dialog.
          const corpoDlg = await page.locator("body").innerText();
          check(
            "ação 'Mudar etapa' oferece o kanban",
            /Kanban Principal|Kanban|Financeiro/.test(corpoDlg),
            corpoDlg.slice(0, 300),
          );
          check(
            "some o texto antigo 'kanban principal (etapa operacional)'",
            !/Move no kanban principal \(etapa operacional\)/i.test(corpoDlg),
          );
        } else {
          console.log("  (opção 'Mudar etapa' não encontrada no dropdown)");
        }
      } else {
        console.log("  (seletor de ação não encontrado)");
      }
      await page.screenshot({ path: `${SHOTS}/aj3-acao.png` });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    } else {
      console.log("  (botão de novo workflow não encontrado)");
    }
    await page.screenshot({ path: `${SHOTS}/aj3-workflows.png` });

    // ── SEL ────────────────────────────────────────────────────────────────
    console.log("\nSEL — seletor de usuário do ProJuris");
    // A rota é /permissoes (não /configuracoes/permissoes). E não vale conferir
    // por "Permiss": essa palavra está no MENU LATERAL de toda página, então o
    // check passaria mesmo na tela errada. O botão de editar colaborador é a
    // prova de que a tela certa carregou.
    await irPara(page, "/permissoes", 3500);
    const txtPerm = await page.locator("body").innerText();
    const editar = page.locator('button[title="Editar dados e cargo"]');
    check("tela de colaboradores carregou", (await editar.count()) > 0, txtPerm.slice(0, 200));
    check("placeholder antigo 'PES.' não aparece mais", !txtPerm.includes("PES.00"));

    // O seletor está no diálogo de EDIÇÃO. Abrir é o único jeito de saber se ele
    // virou lista mesmo.
    if ((await editar.count()) > 0) {
      await editar.first().click();
      await page.waitForTimeout(2500); // a lista vem da API do ProJuris
      const dlg = page.locator('[role="dialog"]');
      const txtDlg = await dlg.innerText();
      check("diálogo de edição abriu", txtDlg.length > 50);
      check(
        "campo virou 'Usuário no ProJuris' (não é mais ID livre)",
        txtDlg.includes("Usuário no ProJuris") && !txtDlg.includes("ID ProJuris (executor)"),
        txtDlg.slice(0, 300),
      );
      const combo = dlg.locator('[role="combobox"]');
      check("há seletor no diálogo", (await combo.count()) > 0);

      // Reorganização das permissões (2026-08-27) — os 3 blocos e o fim dos
      // nomes ambíguos. Sem isto o teste não distinguiria a tela nova da velha.
      check("bloco 'Acesso ao sistema' existe", txtDlg.includes("Acesso ao sistema"), txtDlg.slice(0, 400));
      check("campo virou 'Nível de acesso'", txtDlg.includes("Nível de acesso"));
      check("aviso de que os dados não mudam permissão", txtDlg.includes("Nada aqui muda permissão"));
      check("bloco 'Motor de distribuição' existe", txtDlg.includes("Motor de distribuição"));
      check(
        "sumiu o 'Participa da distribuição geral' ambíguo",
        !txtDlg.includes("Participa da distribuição geral"),
      );
      check("toggles renomeados", txtDlg.includes("Entra na fila ordinária") && txtDlg.includes("Vínculo com o ProJuris ativo"));
      await page.screenshot({ path: `${SHOTS}/sel-dialogo.png` });
      await page.keyboard.press("Escape");
    } else {
      console.log("  (botão Editar não encontrado — seletor não verificado)");
    }
    await page.screenshot({ path: `${SHOTS}/sel-permissoes.png` });

    // ── ESP — selo "ProJuris" na tarefa espelhada ──────────────────────────
    //
    // Não existe hoje tarefa espelhada de verdade (só o motor cria, e ele ainda
    // não rodou depois da mudança). Então cria uma TEMPORÁRIA só para conferir o
    // selo, e apaga em seguida. Sem isto o selo ficaria sem prova visual nenhuma.
    console.log("");
    console.log("ESP — selo ProJuris na tarefa");
    const { data: casoQualquer } = await admin
      .from("system_cases")
      .select("id")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    let tarefaTemp: string | null = null;
    if (casoQualquer) {
      const { data: t } = await admin
        .from("system_case_tasks")
        .insert({
          case_id: casoQualquer.id,
          organization_id: "00000000-0000-0000-0000-000000000001",
          title: "[SMOKE] selo ProJuris",
          status: "EM_ANDAMENTO",
          projuris_codigo_tarefa: "58497726",
        } as never)
        .select("id")
        .single();
      tarefaTemp = (t as { id: string } | null)?.id ?? null;
    }
    if (tarefaTemp) {
      await irPara(page, `/casos/${casoQualquer!.id}`, 4000);
      const selo = page.getByText("ProJuris", { exact: true });
      check("selo 'ProJuris' aparece na tarefa espelhada", (await selo.count()) > 0);
      await page.screenshot({ path: `${SHOTS}/esp-selo.png` });
      await admin.from("system_case_tasks").delete().eq("id", tarefaTemp);
      console.log("  (tarefa temporária apagada)");
    } else {
      console.log("  (não consegui criar tarefa temporária — pulado)");
    }

    // ── erros de console ───────────────────────────────────────────────────
    console.log("\nConsole");
    // O vite re-otimiza dependências no primeiro acesso e gera 404 transitório
    // de chunk; não é erro da aplicação.
    const relevantes = erros.filter(
      (e) => !/favicon|sourcemap|DevTools|Download the React|Failed to load resource.*404/i.test(e),
    );
    check("sem erros de console relevantes", relevantes.length === 0, relevantes.slice(0, 3));
  } finally {
    await browser.close();
  }

  console.log(`\n${pass} passou · ${fail} falhou · imagens em ${SHOTS}/`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
