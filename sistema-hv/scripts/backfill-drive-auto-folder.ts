// D1 (reunião 2026-08-26) — cria a subpasta "Documentos automáticos" nos casos
// que JÁ existem e move para dentro dela o que o sistema gerou.
//
// O owner autorizou explicitamente mover o que já existe ("já pode mover, essa
// pasta serve para tudo que for criado para o cliente, por dentro do sistema").
//
// O que MOVE:      system_case_documents com source em (GERADO, ZAPSIGN)
// O que NÃO MOVE:  source = UPLOAD (anexo manual fica na raiz da pasta do caso)
//
// Mover no Drive preserva o fileId — `drive_file_id` e `drive_url` continuam
// válidos e NÃO são reescritos. Se um link antigo quebrar depois disto, é sinal
// de que a implementação copiou em vez de mover: pare e investigue.
//
// Uso:
//   npx tsx scripts/backfill-drive-auto-folder.ts                 # dry-run (padrão)
//   npx tsx scripts/backfill-drive-auto-folder.ts --commit        # aplica
//   npx tsx scripts/backfill-drive-auto-folder.ts --commit --case <uuid>   # 1 caso
//   npx tsx scripts/backfill-drive-auto-folder.ts --limit 20      # amostra
//   npx tsx scripts/backfill-drive-auto-folder.ts --todos         # inclui casos SEM documento gerado
//
// Por PADRÃO só entram os casos que têm algo a mover. Motivo: dos 409 casos com
// pasta, apenas 3 têm documento gerado pelo sistema (o resto veio da importação
// Mais Médicos). Criar 400+ subpastas VAZIAS dentro das pastas dos clientes é
// poluição visível para eles — e desnecessária, porque a subpasta nasce sozinha
// na primeira geração de documento (ensureCaseAutoFolder) e na criação do caso.
// Use --todos se quiser a estrutura completa desde já.
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { ensureCaseAutoFolder } from "../src/lib/case-documents-service";
import { moveFile } from "../src/lib/google/drive";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const caseArg = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;
const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : null;
const todos = args.includes("--todos");

// Só o que o SISTEMA gerou. UPLOAD (anexo manual) fica onde está — regra do owner.
const SOURCES_QUE_MOVEM = ["GERADO", "ZAPSIGN"];

async function main() {
  const sb = getSupabaseAdmin();

  let q = sb
    .from("system_cases")
    .select("id, case_code, drive_folder_id, drive_auto_folder_id")
    .is("deleted_at", null)
    .not("drive_folder_id", "is", null)
    .order("created_at", { ascending: true });
  if (caseArg) q = q.eq("id", caseArg);
  if (limitArg) q = q.limit(limitArg);

  const { data: casos, error } = await q;
  if (error) throw new Error(`Falha ao listar casos: ${error.message}`);

  console.log(`${commit ? "COMMIT" : "DRY-RUN"} · ${casos?.length ?? 0} caso(s) na fila\n`);

  let pastasCriadas = 0;
  let pastasJaTinha = 0;
  let arquivosMovidos = 0;
  let arquivosJaLa = 0;
  let pulados = 0;
  let falhas = 0;

  for (const caso of casos ?? []) {
    const rotulo = `${caso.case_code ?? caso.id}`;
    try {
      // Documentos gerados deste caso.
      const { data: docs } = await sb
        .from("system_case_documents")
        .select("id, title, source, drive_file_id")
        .eq("case_id", caso.id)
        .in("source", SOURCES_QUE_MOVEM)
        .is("deleted_at", null)
        .not("drive_file_id", "is", null);

      const aMover = docs ?? [];

      // Sem nada a mover e sem --todos: pula (não cria pasta vazia).
      if (aMover.length === 0 && !todos && !caseArg) {
        pulados++;
        continue;
      }

      if (!commit) {
        const acaoPasta = caso.drive_auto_folder_id ? "já tem subpasta" : "CRIARIA subpasta";
        console.log(`· ${rotulo}: ${acaoPasta} · moveria ${aMover.length} arquivo(s)`);
        if (!caso.drive_auto_folder_id) pastasCriadas++;
        else pastasJaTinha++;
        arquivosMovidos += aMover.length;
        continue;
      }

      const jaTinha = !!caso.drive_auto_folder_id;
      const { folderId } = await ensureCaseAutoFolder(caso.id);

      // Quem já está na subpasta não é "movido de novo" — sem isto o relatório
      // da 2ª execução diz que moveu tudo outra vez (achado QA-9).
      let jaLaIds = new Set<string>();
      try {
        const { listFilesInFolder } = await import("../src/lib/google/drive");
        const dentro = await listFilesInFolder(folderId);
        jaLaIds = new Set(dentro.map((f) => f.id));
      } catch {
        /* se não der para listar, segue e tenta mover (move repetido é no-op) */
      }
      if (jaTinha) pastasJaTinha++;
      else pastasCriadas++;

      for (const doc of aMover) {
        if (jaLaIds.has(doc.drive_file_id as string)) {
          arquivosJaLa++;
          continue;
        }
        try {
          // Mover é idempotente na prática: reenviar addParents da pasta em que o
          // arquivo já está não duplica nada.
          await moveFile(doc.drive_file_id as string, folderId, caso.drive_folder_id as string);
          arquivosMovidos++;
        } catch (errDoc) {
          falhas++;
          console.error(
            `  ! ${rotulo} · doc "${doc.title}": ${errDoc instanceof Error ? errDoc.message : String(errDoc)}`,
          );
        }
      }
      console.log(`✓ ${rotulo}: ${aMover.length} arquivo(s) na subpasta`);
    } catch (err) {
      falhas++;
      console.error(`! ${rotulo}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\nResumo (${commit ? "aplicado" : "simulação"}):` +
      `\n  subpastas criadas .... ${pastasCriadas}` +
      `\n  subpastas já existiam  ${pastasJaTinha}` +
      `\n  arquivos movidos ..... ${arquivosMovidos}` +
      `\n  arquivos já estavam .. ${arquivosJaLa}` +
      `\n  casos pulados ........ ${pulados} (sem documento gerado — use --todos p/ incluir)` +
      `\n  falhas ............... ${falhas}`,
  );
  if (!commit) console.log("\nNada foi alterado. Rode com --commit para aplicar.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
