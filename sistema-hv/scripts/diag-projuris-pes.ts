// Investiga a ponte PES <-> codigo do usuario + telefones, via /pessoa/consulta.
// SO LEITURA.
import { config } from "dotenv";
config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        const inner = firstArrayDeep(v);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  // usuarios (chave=codigo numerico, valor=nome)
  const us = firstArrayDeep(await client.projurisGet<unknown>("usuario")) as Array<
    Record<string, unknown>
  >;
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const usuarioByNome = new Map<string, string>();
  for (const u of us) {
    const nome = norm(String(u.valor ?? u.nome ?? ""));
    if (nome) usuarioByNome.set(nome, String(u.chave ?? ""));
  }

  const ps = firstArrayDeep(await client.projurisGet<unknown>("pessoa/consulta")) as Array<
    Record<string, unknown>
  >;
  console.log(`/pessoa/consulta: ${ps.length} registros.\n`);

  // Mostra os que casam por nome com um USUARIO (colaboradores) — a ponte.
  console.log("PES (identificador) | codigoPessoa | codUsuario | nome | email | telefone");
  console.log("-".repeat(100));
  let casaram = 0;
  for (const p of ps) {
    const nome = String(p.nome ?? "").trim();
    const codUsuario = usuarioByNome.get(norm(nome));
    if (!codUsuario) continue; // só os que são usuarios (colaboradores)
    casaram++;
    console.log(
      `${String(p.identificador ?? "-").padEnd(14)} | ${String(p.codigoPessoa ?? "-").padEnd(10)} | ` +
        `${codUsuario.padEnd(8)} | ${nome.slice(0, 26).padEnd(26)} | ` +
        `${String(p.emailPrincipal ?? "-")
          .slice(0, 30)
          .padEnd(30)} | ${p.telefonePrincipal ?? "-"}`,
    );
  }
  console.log(`\n${casaram} pessoas casaram com usuario por nome (a ponte PES<->codigo funciona).`);
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
