// S5-04 AC2-4 — aplica o de-para de papéis A PARTIR DA PLANILHA REVISADA.
//
// Nunca de um mapa cravado no código: a planilha é o registro do que o
// escritório decidiu, e é ela que manda. Se alguém mudou uma linha à mão, é essa
// linha que vale.
//
// Isto mexe no acesso de gente que está trabalhando. Por isso:
//   • dry-run é o padrão, e mostra cada mudança antes;
//   • um SNAPSHOT dos papéis atuais é gravado em JSON ANTES de qualquer escrita,
//     e `depara-usuarios-reverter.ts` desfaz tudo a partir dele (AC3);
//   • promover a Administrador exige "SIM" na coluna CONFIRMAR_ADMIN — ninguém
//     vira admin porque o script achou que devia (AC4);
//   • papel desconhecido ou linha sem papel proposto ABORTA tudo antes de
//     escrever a primeira linha: melhor não aplicar nada do que aplicar metade.
//
//   npx tsx scripts/depara-usuarios-aplicar.ts <planilha.csv>
//   npx tsx scripts/depara-usuarios-aplicar.ts <planilha.csv> --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync, writeFileSync } from "node:fs";

import { ROLES, type Role } from "../src/lib/rbac";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const ARQUIVO = process.argv[2];
const COMMIT = process.argv.includes("--commit");

if (!ARQUIVO) {
  console.error("Informe a planilha revisada: npx tsx scripts/depara-usuarios-aplicar.ts <csv>");
  process.exit(1);
}

/** CSV com ";" e campos entre aspas quando precisam. Suficiente para o que o Excel devolve. */
function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroDeAspas = false;

  // O Excel grava com BOM; sem tirar, a primeira coluna vem com lixo invisível.
  // O Excel grava com BOM; sem tirar, a primeira coluna vem com lixo invisível
  // e o `indexOf("id")` do cabeçalho não acha nada.
  const t = texto.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') dentroDeAspas = false;
      else campo += c;
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === ";") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo.replace(/\r$/, ""));
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo.replace(/\r$/, ""));
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

async function main() {
  console.log(COMMIT ? "\nMODO COMMIT — vai alterar papéis.\n" : "\nDRY-RUN.\n");

  const linhas = parseCsv(readFileSync(ARQUIVO, "utf8"));
  const cabecalho = linhas[0].map((c) => c.trim());
  const col = (nome: string) => {
    const i = cabecalho.indexOf(nome);
    if (i < 0) throw new Error(`A planilha não tem a coluna "${nome}".`);
    return i;
  };
  const iId = col("id");
  const iNome = col("nome");
  const iAtual = col("papel_atual");
  const iProposto = col("papel_proposto");
  const iConfirmaAdmin = col("CONFIRMAR_ADMIN");

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("system_users").select("id, full_name, role");
  if (error) throw new Error(error.message);
  const atuais = new Map(
    ((data ?? []) as Array<{ id: string; full_name: string | null; role: string }>).map((u) => [
      u.id,
      u,
    ]),
  );

  const mudancas: Array<{ id: string; nome: string; de: string; para: Role }> = [];
  const erros: string[] = [];

  for (const l of linhas.slice(1)) {
    const id = l[iId]?.trim();
    const nome = l[iNome]?.trim() || id;
    const proposto = l[iProposto]?.trim();

    if (!id) {
      erros.push(`linha sem id: ${l.join(";").slice(0, 60)}`);
      continue;
    }
    const usuario = atuais.get(id);
    if (!usuario) {
      erros.push(`${nome}: id não existe no banco`);
      continue;
    }
    if (!proposto) {
      erros.push(`${nome}: sem papel proposto (ninguém pode ficar sem papel)`);
      continue;
    }
    if (!(ROLES as readonly string[]).includes(proposto)) {
      erros.push(`${nome}: papel "${proposto}" não existe`);
      continue;
    }
    // AC4 — a única promoção que exige palavra escrita.
    if (proposto === "admin" && usuario.role !== "admin") {
      if (l[iConfirmaAdmin]?.trim().toUpperCase() !== "SIM") {
        erros.push(
          `${nome}: vira ADMINISTRADOR, mas CONFIRMAR_ADMIN não está "SIM" — recusado por segurança`,
        );
        continue;
      }
    }
    // A planilha diz de onde a pessoa saía; se o banco mudou nesse meio-tempo,
    // aplicar às cegas sobrescreveria uma decisão mais recente.
    const papelNaPlanilha = l[iAtual]?.trim().split(" ")[0];
    if (papelNaPlanilha && papelNaPlanilha !== usuario.role) {
      erros.push(
        `${nome}: a planilha diz que era "${papelNaPlanilha}", mas hoje é "${usuario.role}" — gere a planilha de novo`,
      );
      continue;
    }

    if (usuario.role === proposto) continue;
    mudancas.push({ id, nome, de: usuario.role, para: proposto as Role });
  }

  if (erros.length) {
    console.error(`${erros.length} problema(s) na planilha — NADA foi aplicado:\n`);
    for (const e of erros) console.error(`   ✗ ${e}`);
    process.exit(1);
  }

  if (!mudancas.length) {
    console.log("Nenhuma mudança de papel a aplicar.");
    return;
  }

  console.log(`${mudancas.length} mudança(s):`);
  for (const m of mudancas) console.log(`   ${m.nome.padEnd(34)} ${m.de} → ${m.para}`);

  if (!COMMIT) {
    console.log("\nRode com --commit para aplicar.");
    return;
  }

  // AC3 — snapshot ANTES de escrever. Sem ele não há como voltar.
  const snapshot = {
    aplicado_em: new Date().toISOString(),
    planilha: ARQUIVO,
    papeis: mudancas.map((m) => ({
      id: m.id,
      nome: m.nome,
      role_anterior: m.de,
      role_novo: m.para,
    })),
  };
  const caminhoSnapshot = ARQUIVO.replace(/\.csv$/i, "") + ".snapshot.json";
  writeFileSync(caminhoSnapshot, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`\nSnapshot: ${caminhoSnapshot}`);

  let ok = 0;
  for (const m of mudancas) {
    const { error: errUp } = await sb
      .from("system_users")
      .update({ role: m.para } as never)
      .eq("id", m.id);
    if (errUp) {
      console.error(`   ✗ ${m.nome}: ${errUp.message}`);
      continue;
    }
    ok++;
  }

  console.log(`\n${ok}/${mudancas.length} aplicada(s).`);
  console.log(`Para desfazer:  npx tsx scripts/depara-usuarios-reverter.ts ${caminhoSnapshot}`);

  // AC7 — relatório pós-aplicação.
  const { data: depois } = await sb.from("system_users").select("role, status");
  const contagem = new Map<string, number>();
  for (const u of (depois ?? []) as Array<{ role: string; status: string | null }>) {
    const k = `${u.role} (${u.status ?? "?"})`;
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  console.log("\nComo ficou:");
  for (const [k, n] of [...contagem].sort()) console.log(`   ${String(n).padStart(3)}  ${k}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
