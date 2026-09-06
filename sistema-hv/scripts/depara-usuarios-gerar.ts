// S5-04 AC1 — gera a planilha de de-para dos usuários para o owner revisar.
//
// NÃO ESCREVE NADA. Só lê o estado atual e propõe o papel novo, com o que cada
// pessoa GANHA e PERDE de acesso. O arquivo sai em CSV para ser aberto no Excel,
// ajustado à mão e devolvido — é dele que `depara-usuarios-aplicar.ts` parte,
// nunca de um mapa cravado no código (AC2).
//
// A proposta é ponto de partida, não decisão: quem decide quem vira o quê é o
// escritório.
//
// Rodar: npx tsx scripts/depara-usuarios-gerar.ts [caminho.csv]
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { writeFileSync } from "node:fs";

import {
  MODULES,
  permissaoEfetiva,
  ROLE_LABELS,
  seesOnlyOwnCases,
  type Module,
  type Role,
} from "../src/lib/rbac";
import { getRoleModuleDefaults } from "../src/lib/rbac-perms-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const SAIDA = process.argv[2] ?? "docs/reunioes/depara-usuarios-2026-09-06.csv";

// Proposta da story S5-04, com a resposta C3.1 do Thiago já embutida:
// "Remove o perfil prestador externo (não temos um trabalho nesse sentido),
//  mantem como operacional, e ai se for o caso em alguma situação especifica
//  fazemos isso de alterar as permissões do usuario em especifico."
const PROPOSTA: Record<string, Role> = {
  admin: "admin",
  advogado_titular: "coordenador",
  advogado_associado: "operacional",
  prestador_externo: "operacional",
  controladoria: "controladoria",
  comercial: "atendimento",
  financeiro: "financeiro",
  operacional: "operacional",
  marketing: "marketing",
};

function csvCampo(v: string): string {
  return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main() {
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("system_users")
    .select("id, full_name, email, role, status, perfil")
    .order("full_name");
  if (error) throw new Error(error.message);

  const usuarios = (data ?? []) as unknown as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    status: string | null;
    perfil: string | null;
  }>;

  // Padrões de cada papel, para calcular ganho/perda de módulo sem chutar.
  const papeis = [...new Set([...usuarios.map((u) => u.role), ...Object.values(PROPOSTA)])];
  const defaults = new Map<string, Awaited<ReturnType<typeof getRoleModuleDefaults>>>();
  for (const p of papeis) defaults.set(p, await getRoleModuleDefaults(p));

  function acessos(role: string): Set<Module> {
    const s = new Set<Module>();
    for (const m of MODULES) {
      if (permissaoEfetiva(role as Role, {}, m, "view", defaults.get(role))) s.add(m);
    }
    return s;
  }

  const linhas: string[][] = [
    [
      "id",
      "nome",
      "email",
      "status",
      "perfil_antigo",
      "papel_atual",
      "papel_proposto",
      "ganha_modulos",
      "perde_modulos",
      "atencao",
      "CONFIRMAR_ADMIN",
    ],
  ];

  for (const u of usuarios) {
    const proposto = PROPOSTA[u.role] ?? u.role;
    const antes = acessos(u.role);
    const depois = acessos(proposto);

    const ganha = [...depois].filter((m) => !antes.has(m));
    const perde = [...antes].filter((m) => !depois.has(m));

    const alertas: string[] = [];

    // A armadilha desta migração: quem só via os PRÓPRIOS casos passa a ver a
    // base inteira. É ampliação silenciosa de acesso — o Thiago aceitou para o
    // prestador externo, mas quem aplica tem que enxergar isso na planilha.
    if (seesOnlyOwnCases(u.role as Role) && !seesOnlyOwnCases(proposto)) {
      alertas.push("PASSA A VER TODOS OS CASOS (hoje só vê os próprios)");
    }
    // Pista da S5-03: o campo Perfil às vezes guarda a informação que o papel
    // não tem. Wesley Ramos é `perfil=coordenador` com `role=operacional`.
    if (u.perfil && u.perfil.trim().toLowerCase() !== proposto) {
      alertas.push(`perfil antigo diz "${u.perfil}"`);
    }
    if (u.status && u.status.toUpperCase() !== "ACTIVE") {
      alertas.push(`usuário ${u.status.toLowerCase()}`);
    }
    if (!PROPOSTA[u.role]) {
      alertas.push("sem proposta automática — decidir na mão");
    }

    linhas.push([
      u.id,
      u.full_name ?? "",
      u.email ?? "",
      u.status ?? "",
      u.perfil ?? "",
      `${u.role} (${ROLE_LABELS[u.role as Role] ?? u.role})`,
      proposto,
      ganha.join(" "),
      perde.join(" "),
      alertas.join(" · "),
      // AC4 — virar Administrador exige marcação explícita. Já vem "SIM" para
      // quem JÁ é admin (não é promoção); para os demais, quem quiser promover
      // escreve SIM na planilha.
      u.role === "admin" && proposto === "admin" ? "SIM" : "",
    ]);
  }

  // BOM para o Excel abrir os acentos direito.
  const csv = "﻿" + linhas.map((l) => l.map(csvCampo).join(";")).join("\r\n") + "\r\n";
  writeFileSync(SAIDA, csv, "utf8");

  console.log(`\n${usuarios.length} usuário(s) → ${SAIDA}\n`);

  const porProposta = new Map<string, number>();
  for (const l of linhas.slice(1)) porProposta.set(l[6], (porProposta.get(l[6]) ?? 0) + 1);
  console.log("Distribuição proposta:");
  for (const [p, n] of [...porProposta].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(3)}  ${p}`);
  }

  const comAlerta = linhas.slice(1).filter((l) => l[9]);
  if (comAlerta.length) {
    console.log(`\n${comAlerta.length} linha(s) merecem olhada:`);
    for (const l of comAlerta) console.log(`   ${l[1] || l[2]} — ${l[9]}`);
  }

  console.log("\nRevise o arquivo e aplique com:");
  console.log(`   npx tsx scripts/depara-usuarios-aplicar.ts ${SAIDA} --commit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
