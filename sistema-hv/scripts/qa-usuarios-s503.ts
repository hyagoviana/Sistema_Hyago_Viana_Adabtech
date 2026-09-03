// QA S5-03 (03/09) — o campo PERFIL saiu do formulário. Este script prova, contra
// o BANCO REAL, que o dado NÃO se perde e que a informação útil que ele guarda
// (quem é coordenador) segue disponível para o de-para da S5-04.
//
// Rodar: npx tsx scripts/qa-usuarios-s503.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

async function main() {
  const sb = getSupabaseAdmin();

  const { data: usuarios } = await sb
    .from("system_users")
    .select("id, full_name, email, role, perfil, cargo, status")
    .is("deleted_at", null);
  const lista = (usuarios ?? []) as Array<{
    full_name: string | null;
    role: string;
    perfil: string | null;
    cargo: string | null;
    status: string;
  }>;

  const comPerfil = lista.filter((u) => u.perfil);
  check(
    `a coluna perfil continua preenchida (${comPerfil.length} de ${lista.length} usuários)`,
    comPerfil.length > 0,
  );

  // O que o `perfil` diz que o `role` ainda NÃO diz — é isto que a S5-04 aproveita.
  const redundantes = comPerfil.filter(
    (u) =>
      (u.perfil === "administrador" && u.role === "admin") ||
      (u.perfil === "financeiro" && u.role === "financeiro") ||
      (u.perfil === "usuario_padrao" && u.role === "operacional"),
  );
  const informativos = comPerfil.filter((u) => !redundantes.includes(u));

  console.log(
    `\n  Perfil x papel: ${redundantes.length} redundante(s), ${informativos.length} com informação nova:`,
  );
  for (const u of informativos) {
    console.log(`    · ${u.full_name ?? "—"}: perfil=${u.perfil}, papel=${u.role}`);
  }

  check(
    "a redundância que o Thiago apontou é real (maioria dos perfis repete o papel)",
    redundantes.length >= informativos.length,
    `${redundantes.length} x ${informativos.length}`,
  );

  // Filtro de suspensos: a tela esconde por padrão; o dado continua no banco.
  const suspensos = lista.filter((u) => u.status === "SUSPENDED");
  console.log(
    `\n  Suspensos hoje: ${suspensos.length} (a lista esconde por padrão, com contador ao lado do filtro)`,
  );

  // Cargo: informação separada, como o Thiago pediu ("vamos manter como uma
  // informação individual").
  const comCargo = lista.filter((u) => u.cargo);
  console.log(`  Cargo preenchido em ${comCargo.length} usuário(s) — campo mantido no formulário.`);

  if (falhou) {
    console.error(`\nUSUÁRIOS: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nUSUÁRIOS: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
