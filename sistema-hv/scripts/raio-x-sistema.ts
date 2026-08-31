// RAIO-X DO SISTEMA — retrato factual do que existe e do que está EM USO.
//
// Motivo (31/08): as respostas às dúvidas em aberto falavam só do que falta, o
// que dá a impressão errada de que nada foi construído. Este script responde a
// pergunta certa — "qual é o estado real?" — com contagem de dado real e sinal
// de uso recente, não com adjetivo.
//
// SOMENTE LEITURA. Nenhum INSERT/UPDATE/DELETE. Conecta pelo mesmo caminho do
// db-apply-pg.ts (Postgres direto, credenciais do .env.local).
//
// Uso: npx tsx scripts/raio-x-sistema.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("Faltam SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD no .env.local");
  process.exit(1);
}

const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "sa-east-1", "eu-central-1"];

async function conectar(): Promise<pg.Client> {
  const direto = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await direto.connect();
    return direto;
  } catch {
    /* cai para o pooler */
  }
  for (const region of REGIONS) {
    const pooler = new pg.Client({
      host: `aws-0-${region}.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${ref}`,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await pooler.connect();
      return pooler;
    } catch {
      /* tenta a próxima região */
    }
  }
  throw new Error("Não consegui conectar ao banco (direto nem pooler).");
}

/** COUNT que devolve null quando a tabela não existe — o relatório não quebra. */
async function contar(c: pg.Client, tabela: string, where?: string): Promise<number | null> {
  try {
    const r = await c.query(
      `SELECT COUNT(*)::int AS n FROM ${tabela}${where ? ` WHERE ${where}` : ""}`,
    );
    return r.rows[0].n as number;
  } catch {
    return null;
  }
}

function linha(rotulo: string, valor: number | null, nota = ""): string {
  const v = valor === null ? "—" : String(valor);
  return `  ${rotulo.padEnd(38, ".")} ${v.padStart(7)}  ${nota}`;
}

async function main() {
  const c = await conectar();
  console.log("Conectado.\n");

  // ---------------------------------------------------------------- MÓDULOS
  console.log("═══ O QUE EXISTE E TEM DADO REAL ═══════════════════════════\n");

  console.log("CADASTRO E CASOS");
  console.log(
    linha("Clientes/leads cadastrados", await contar(c, "system_clients", "deleted_at IS NULL")),
  );
  console.log(linha("Casos ativos", await contar(c, "system_cases", "deleted_at IS NULL")));
  console.log(
    linha(
      "  · já promovidos a CLIENTE",
      await contar(c, "system_cases", "deleted_at IS NULL AND lifecycle = 'CLIENTE'"),
    ),
  );
  console.log(
    linha(
      "  · ainda em fase comercial (LEAD)",
      await contar(c, "system_cases", "deleted_at IS NULL AND lifecycle = 'LEAD'"),
    ),
  );
  console.log(linha("Temas configurados", await contar(c, "system_temas", "deleted_at IS NULL")));
  console.log(
    linha(
      "Etapas de pipeline cadastradas",
      await contar(c, "system_pipeline_stages", "deleted_at IS NULL"),
    ),
  );
  console.log(
    linha("Kanbans (boards)", await contar(c, "system_pipeline_boards", "deleted_at IS NULL")),
  );

  console.log("\nROTINA DE TRABALHO");
  console.log(
    linha("Tarefas (total já criado)", await contar(c, "system_case_tasks", "deleted_at IS NULL")),
  );
  console.log(
    linha(
      "  · abertas agora",
      await contar(c, "system_case_tasks", "deleted_at IS NULL AND status = 'EM_ANDAMENTO'"),
    ),
  );
  console.log(
    linha(
      "  · concluídas",
      await contar(c, "system_case_tasks", "deleted_at IS NULL AND status LIKE 'CONCLUIDA%'"),
    ),
  );
  console.log(
    linha(
      "Itens de checklist instanciados",
      await contar(c, "system_case_checklist_items", "deleted_at IS NULL"),
    ),
  );
  console.log(
    linha(
      "Tipos de tarefa no catálogo",
      await contar(c, "system_task_type_mapping", "archived_at IS NULL"),
    ),
  );
  console.log(linha("Eventos na linha do tempo", await contar(c, "system_case_events")));
  console.log(
    linha("Notas/observações escritas", await contar(c, "system_case_notes", "deleted_at IS NULL")),
  );

  console.log("\nDOCUMENTOS E ASSINATURA");
  console.log(
    linha(
      "Documentos do caso (Drive)",
      await contar(c, "system_case_documents", "deleted_at IS NULL"),
    ),
  );
  console.log(
    linha(
      "Modelos de documento",
      await contar(c, "system_document_templates", "deleted_at IS NULL"),
    ),
  );
  console.log(linha("Termos de acerto (versões)", await contar(c, "system_termo_snapshots")));
  console.log(
    linha(
      "Documentos do cliente",
      await contar(c, "system_client_documents", "deleted_at IS NULL"),
    ),
  );

  console.log("\nFINANCEIRO");
  console.log(linha("Parcelas geradas", await contar(c, "system_parcelas")));
  console.log(linha("  · pagas", await contar(c, "system_parcelas", "status = 'PAGA'")));
  console.log(
    linha(
      "  · com espelho no ContaAzul",
      await contar(c, "system_parcelas", "provider = 'conta_azul' AND provider_ext_id IS NOT NULL"),
    ),
  );
  console.log(linha("Categorias financeiras", await contar(c, "system_fin_categorias")));
  console.log(
    linha(
      "Lançamentos do caso (receita/despesa)",
      await contar(c, "system_case_fin_entries", "deleted_at IS NULL"),
    ),
  );
  console.log(
    linha("Parcelas desses lançamentos", await contar(c, "system_case_fin_installments")),
  );
  console.log(linha("Honorários definidos", await contar(c, "system_case_honorarios")));

  console.log("\nMOTOR DE DISTRIBUIÇÃO / CONTROLADORIA");
  console.log(
    linha("Andamentos/intimações capturados", await contar(c, "system_distribution_movements")),
  );
  console.log(
    linha("Tarefas distribuídas pelo motor", await contar(c, "system_distribution_results")),
  );
  console.log(linha("Fila humana (a distribuir)", await contar(c, "system_distribution_staging")));
  console.log(linha("Kanban do motor", await contar(c, "system_distribution_kanban_tasks")));
  console.log(
    linha("Processos judiciais no caso", await contar(c, "system_case_judicial_processos")),
  );
  console.log(
    linha("Processos do ProJuris vinculados", await contar(c, "system_case_projuris_processos")),
  );
  console.log(
    linha("Executores mapeados no ProJuris", await contar(c, "system_projuris_executor_mapping")),
  );
  console.log(linha("Municípios cadastrados", await contar(c, "system_municipios")));

  console.log("\nAUTOMAÇÕES E ACESSO");
  console.log(linha("Workflows criados", await contar(c, "system_workflow_rules")));
  console.log(linha("  · ativos", await contar(c, "system_workflow_rules", "active")));
  console.log(linha("Disparos de workflow registrados", await contar(c, "system_workflow_runs")));
  console.log(
    linha("Usuários com acesso ativo", await contar(c, "system_users", "status = 'ACTIVE'")),
  );
  console.log(linha("Registros de auditoria", await contar(c, "system_audit_log")));
  console.log(
    linha("Permissões por módulo definidas", await contar(c, "system_user_module_perms")),
  );
  console.log(
    linha(
      "Campos personalizados por tema",
      await contar(c, "system_tema_field_defs", "deleted_at IS NULL"),
    ),
  );
  console.log(
    linha(
      "Definições de checklist por etapa",
      await contar(c, "system_stage_checklist_defs", "deleted_at IS NULL"),
    ),
  );

  // ------------------------------------------------------------ USO RECENTE
  console.log("\n═══ SINAL DE VIDA (o sistema está SENDO USADO?) ════════════\n");
  const janelas: Array<[string, string, string]> = [
    ["Casos criados", "system_cases", "created_at"],
    ["Tarefas criadas", "system_case_tasks", "created_at"],
    ["Tarefas concluídas", "system_case_tasks", "completed_at"],
    ["Eventos na linha do tempo", "system_case_events", "created_at"],
    ["Documentos anexados/gerados", "system_case_documents", "created_at"],
    ["Andamentos capturados do ProJuris", "system_distribution_movements", "created_at"],
    ["Notas/observações escritas", "system_case_notes", "created_at"],
    ["Ações registradas na auditoria", "system_audit_log", "created_at"],
  ];
  console.log(`  ${"".padEnd(38)} ${"7 dias".padStart(7)} ${"30 dias".padStart(9)}`);
  for (const [rotulo, tabela, coluna] of janelas) {
    const d7 = await contar(c, tabela, `${coluna} > NOW() - INTERVAL '7 days'`);
    const d30 = await contar(c, tabela, `${coluna} > NOW() - INTERVAL '30 days'`);
    const f = (v: number | null) => (v === null ? "—" : String(v));
    console.log(`  ${rotulo.padEnd(38, ".")} ${f(d7).padStart(7)} ${f(d30).padStart(9)}`);
  }

  // ------------------------------------------------------- ÚLTIMA ATIVIDADE
  console.log("\n  Última atividade registrada:");
  for (const [rotulo, tabela, coluna] of janelas) {
    try {
      const r = await c.query(
        `SELECT MAX(${coluna}) AS m FROM ${tabela}${tabela === "system_cases" ? " WHERE deleted_at IS NULL" : ""}`,
      );
      const m = r.rows[0].m as Date | null;
      console.log(`  ${rotulo.padEnd(38, ".")} ${m ? new Date(m).toLocaleString("pt-BR") : "—"}`);
    } catch {
      /* tabela ausente */
    }
  }

  await c.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
