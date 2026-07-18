// Cria N temas fictícios/placeholder (Tema 1..N) via createTema — cada um já nasce
// com o service_type interno espelho + pipeline semeada (Opção 1, R2-03). Editáveis
// depois pelo admin na UI (R2-06). Idempotente: pula nomes/slugs já existentes.
// Uso: npx tsx scripts/seed-temas-manuais.ts [quantidade]
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

async function main() {
  const qtd = Number(process.argv[2] ?? "5");
  const { createTema, listTemas } = await import("../src/lib/tema-service");

  const existentes = await listTemas();
  const nomesExistentes = new Set(existentes.map((t) => t.name));

  for (let i = 1; i <= qtd; i++) {
    const nome = `Tema ${i}`;
    if (nomesExistentes.has(nome)) {
      console.log(`- ${nome}: já existe, pulando`);
      continue;
    }
    try {
      const t = await createTema({ name: nome, ordem: i });
      console.log(`OK: ${nome} criado (tema ${t.id})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`ERRO ao criar ${nome}: ${msg}`);
    }
  }

  const final = await listTemas();
  console.log(`\nTotal de temas ativos: ${final.length}`);
  for (const t of final) console.log(`  · ${t.name} (slug ${t.slug})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
