// Manda para a LIXEIRA do Drive as pastas dos 5 temas de teste removidos em
// 27/08 (frente 3, Tema 10, tema teste, TESTE6, teste7).
//
// Os ids ficaram registrados aqui porque o tema já saiu do banco — sem isso não
// haveria como reencontrá-las depois.
//
// `deleteFile` do projeto marca `trashed: true`: as pastas vão para a lixeira do
// Drive e podem ser restauradas por 30 dias. Nada é apagado em definitivo.
//
// DRY-RUN por padrão. Use --commit.
import { config } from "dotenv";

config({ path: ".env.local" });

import { deleteFile, getFileMeta } from "../src/lib/google/drive";

const COMMIT = process.argv.includes("--commit");

const PASTAS: Array<[string, string]> = [
  ["frente 3", "1Q96nkez6pcv3C38-rrH_6g6iuON5cy4T"],
  ["frente 3", "1i0A0lrdQQqxX196x-3UJhkpfwxLp_jLB"],
  ["frente 3", "16T4fRnfhlm2eoBdGSMLpTjjmEWRqPoPv"],
  ["Tema 10", "17OWvL60jLr8QtFUgAN6x_LQC2KYLkPET"],
  ["Tema 10", "1LVJ9PnMC4eKwR2aXvjPeR5FZ7LWV2-Ap"],
  ["Tema 10", "17B8W_29StlhPIS9UwSL9W2V2iI3dJDIh"],
  ["tema teste", "1dx8qaPtTvoe0Fi_V1XPJZwKU2YvNUW-H"],
  ["tema teste", "1ZZTzhA7e4Dcu5gFFpaD6dCQ8XjdVY5E4"],
  ["tema teste", "1gb_fzf0-Zo9ruv17JDmghqVuz9eWFJaX"],
  ["TESTE6", "14hjc3TAAWsIye6Ke4Gnw09SE9c3rWAhs"],
  ["TESTE6", "1_7OvY0I0qoWn5fK9FsifQRU4wRb-_ZrX"],
  ["TESTE6", "1FoMkls1pgvGo0nhZxOfRFaP-32X7f8xR"],
  ["teste7", "1WHjTGW5II2p-3grH_8LMbrfW2iEsWHMZ"],
  ["teste7", "1ezKTM1Rr7nCiJxZl9jIzTImfkmefUx7c"],
  ["teste7", "1k5OjUqATuQxtNBuX6__6uGmYvgmm3gr7"],
];

async function main() {
  console.log(COMMIT ? "MODO COMMIT\n" : "DRY-RUN (use --commit)\n");
  let ok = 0;
  let jaFora = 0;
  let erro = 0;

  for (const [tema, id] of PASTAS) {
    const meta = await getFileMeta(id).catch(() => null);
    if (!meta) {
      console.log(`  · ${tema.padEnd(12)} ${id} — não encontrada (já removida?)`);
      jaFora++;
      continue;
    }
    const nome = (meta as { name?: string }).name ?? "?";
    console.log(`  ${COMMIT ? "→" : "·"} ${tema.padEnd(12)} "${nome}"`);
    if (COMMIT) {
      try {
        await deleteFile(id);
        ok++;
      } catch (e) {
        console.log(`      ✘ ${e instanceof Error ? e.message : e}`);
        erro++;
      }
    }
  }
  console.log(
    `\n${PASTAS.length} pasta(s) · ${ok} para a lixeira · ${jaFora} não encontrada(s) · ${erro} erro(s)`,
  );
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
