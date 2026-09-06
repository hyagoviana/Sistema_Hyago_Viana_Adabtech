// S2-04 — constrói a estrutura MODELOS/{JUDICIAL, CONTRATO E PROCURAÇÃO,
// ADMINISTRATIVO} dentro de cada TIPO que já existe.
//
// Árvore aprovada pelo owner em 06/09 (desenho do Thiago, resposta B2):
//
//   PASTA DO TEMA
//   └── TIPO
//       └── MODELOS
//           ├── JUDICIAL
//           ├── CONTRATO E PROCURAÇÃO
//           └── ADMINISTRATIVO
//
// Idempotente: reusa as pastas que já existem (por nome) e só cria o que falta.
// Só CRIA pasta — não move, não apaga, não mexe em modelo nenhum.
//
// Dry-run por padrão:
//   npx tsx scripts/construir-estrutura-modelos.ts
//   npx tsx scripts/construir-estrutura-modelos.ts --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  CATEGORIAS_MODELO,
  ensureTipoModelStructure,
  listTypeFolders,
  pastaDaCategoria,
} from "../src/lib/service-type-folders-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const COMMIT = process.argv.includes("--commit");

async function main() {
  console.log(COMMIT ? "\nMODO COMMIT — vai criar as pastas.\n" : "\nDRY-RUN.\n");

  const sb = getSupabaseAdmin();
  const { data: temas, error } = await sb
    .from("system_temas")
    .select("id, name, system_service_types!inner(id, name)")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);

  const linhas = (temas ?? []) as unknown as Array<{
    id: string;
    name: string;
    system_service_types: Array<{ id: string; name: string }>;
  }>;

  let tipos = 0;
  let feitos = 0;
  let falhas = 0;

  for (const tema of linhas) {
    for (const st of tema.system_service_types) {
      const pastas = await listTypeFolders(st.id, "caso");
      if (!pastas.length) {
        console.log(`\n📁 ${tema.name} → nenhum TIPO vinculado, nada a fazer.`);
        continue;
      }
      console.log(`\n📁 ${tema.name} — ${pastas.length} tipo(s)`);

      for (const tipo of pastas) {
        tipos++;
        const jaTem = CATEGORIAS_MODELO.every((c) => pastaDaCategoria(tipo, c.id));
        if (jaTem) {
          console.log(`   ✓ ${tipo.name} — estrutura já completa`);
          continue;
        }

        const faltando = CATEGORIAS_MODELO.filter((c) => !pastaDaCategoria(tipo, c.id)).map(
          (c) => c.pasta,
        );
        if (!COMMIT) {
          console.log(`   → ${tipo.name} — criaria MODELOS/{${faltando.join(", ")}}`);
          continue;
        }

        try {
          const atualizado = await ensureTipoModelStructure(tipo.id);
          const ok = CATEGORIAS_MODELO.filter((c) => pastaDaCategoria(atualizado, c.id)).length;
          console.log(`   ✓ ${tipo.name} — MODELOS + ${ok}/3 categorias`);
          feitos++;
        } catch (err) {
          console.error(`   ✗ ${tipo.name}:`, err instanceof Error ? err.message : err);
          falhas++;
        }
      }
    }
  }

  console.log(`\n${tipos} tipo(s) no total.`);
  if (COMMIT) console.log(`${feitos} estrutura(s) criada(s), ${falhas} falha(s).`);
  else console.log("Rode com --commit para aplicar.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
