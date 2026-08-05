// Smoke test SÓ-LEITURA da integração ProJuris ADV (story A9).
//
// REGRA CRÍTICA: apenas GET/leitura. NÃO faz POST/PUT/DELETE de ESCRITA, NÃO cria
// nem altera NADA no ProJuris. (POST de "/consulta" é permitido pois é leitura,
// mas aqui usamos só GET.)
//
// O que faz:
//   1) Autentica em https://apigw.projurisadv.com.br/auth/token (grant_type=password).
//   2) GET colaboradores/usuários  (/adv-service/usuario).
//   3) GET assuntos/temas          (/adv-service/processo/assunto).
//   4) Reconciliação (relatório, SEM escrever): compara os assuntos do ProJuris
//      com system_theme_mapping (onde projuris_tema_codigo hoje é NOME placeholder).
//
// Rodar (de dentro de sistema-hv/):
//   npx tsx --env-file=.env.local scripts/projuris-smoke.ts
//
// Se a auth falhar (401/403/faltar username/senha), imprime o erro EXATO + a
// leitura da doc sobre o fluxo correto e sai — sem tentar cegamente.

import {
  createProjurisClientFromEnv,
  projurisCredentialsFromEnv,
  ProjurisAuthError,
  PROJURIS_DEFAULT_AUTH_URL,
  PROJURIS_DEFAULT_BASE_URL,
} from "../src/lib/projuris/client.js";

// ----------------------------------------------------------------------------
// Helpers de normalização das respostas (a API ADV varia o envelope por rota).
// ----------------------------------------------------------------------------

function firstArray(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    // Procura a 1ª propriedade que seja um array (envelopes tipo
    // {usuarioConsultaResultados:[...]}, {assunto:[...]}, {simpleDto:[...]}...).
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        const inner = firstArray(v);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

/**
 * Desempacota a resposta de `GET /tipo?chave-tipo=...`, cujo envelope real é
 * `{ consultaTipoRetorno: [ { chaveTipo, quantidadeRegistros, simpleDto:[{chave,valor}] } ] }`.
 * Retorna o `simpleDto[]` (cada item: `chave`=código, `valor`=nome).
 */
function unwrapTipoSimpleDto(raw: unknown): Array<{ chave: unknown; valor: unknown }> {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const cont = r.consultaTipoRetorno;
  const bloco = Array.isArray(cont) ? cont[0] : cont;
  if (bloco && typeof bloco === "object") {
    const sd = (bloco as Record<string, unknown>).simpleDto;
    if (Array.isArray(sd)) return sd as Array<{ chave: unknown; valor: unknown }>;
  }
  // Fallback: procura qualquer simpleDto aninhado.
  const found = firstArray(raw);
  return found as Array<{ chave: unknown; valor: unknown }>;
}

function pick(row: unknown, keys: string[]): string | number | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as Record<string, unknown>;
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null) {
      const v = r[k];
      if (typeof v === "string" || typeof v === "number") return v;
    }
  }
  return undefined;
}

function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
}

// ----------------------------------------------------------------------------
// Reconciliação com system_theme_mapping (leitura via pg — best-effort).
// ----------------------------------------------------------------------------

interface ThemeRow {
  projuris_tema_codigo: string;
  motor_theme_id: string | null;
  multiplier: number | null;
}

interface TaskTypeRow {
  projuris_tipo_codigo: string;
  motor_task_type_id: string | null;
  points: number | null;
}

/** Abre uma conexão pg (dev=prod) usando SUPABASE_PROJECT_REF/SUPABASE_DB_PASSWORD
 *  OU DATABASE_URL/SUPABASE_DB_URL. Retorna null se faltar credencial. */
async function openPg(): Promise<import("pg").Client | null> {
  const pg = (await import("pg")).default;
  const url =
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  const ref = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD;
  let client: import("pg").Client;
  if (url) {
    client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
  } else if (ref && password) {
    client = new pg.Client({
      host: `db.${ref}.supabase.co`,
      port: 5432,
      user: "postgres",
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
  } else {
    return null;
  }
  try {
    await client.connect();
    return client;
  } catch (err) {
    console.warn("  (pg indisponível:", err instanceof Error ? err.message : String(err), ")");
    await client.end().catch(() => {});
    return null;
  }
}

async function loadThemeMapping(client: import("pg").Client): Promise<ThemeRow[] | null> {
  try {
    const res = await client.query(
      "select projuris_tema_codigo, motor_theme_id, multiplier from system_theme_mapping order by projuris_tema_codigo",
    );
    return res.rows as ThemeRow[];
  } catch (err) {
    console.warn(
      "  (não consegui ler system_theme_mapping:",
      err instanceof Error ? err.message : String(err),
      ")",
    );
    return null;
  }
}

async function loadTaskTypeMapping(client: import("pg").Client): Promise<TaskTypeRow[] | null> {
  try {
    const res = await client.query(
      "select projuris_tipo_codigo, motor_task_type_id, points from system_task_type_mapping order by projuris_tipo_codigo",
    );
    return res.rows as TaskTypeRow[];
  } catch (err) {
    console.warn(
      "  (não consegui ler system_task_type_mapping:",
      err instanceof Error ? err.message : String(err),
      ")",
    );
    return null;
  }
}

// ----------------------------------------------------------------------------

async function main() {
  const creds = projurisCredentialsFromEnv();
  console.log("=== ProJuris ADV — SMOKE (SÓ LEITURA) ===");
  console.log("  authUrl :", creds.authUrl || PROJURIS_DEFAULT_AUTH_URL);
  console.log("  baseUrl :", creds.baseUrl || PROJURIS_DEFAULT_BASE_URL);
  console.log("  client_id (api_cliente_codigo):", creds.clientId || "(vazio)");
  console.log("  client_secret:", creds.clientSecret ? "(presente)" : "(vazio)");
  console.log("  username     :", creds.username ? creds.username : "(AUSENTE)");
  console.log("  dominio      :", creds.dominio ? creds.dominio : "(AUSENTE)");
  console.log("  password     :", creds.password ? "(presente)" : "(AUSENTE)");

  if (!creds.username || !creds.password) {
    console.warn(
      "\n⚠ AVISO: o fluxo oficial /auth/token usa grant_type=password e EXIGE " +
        "username (USUARIO$$DOMINIO) + password de um usuário ProJuris real, " +
        "além de client_id/client_secret. Só temos client_id+client_secret.\n" +
        "  Defina PROJURIS_USERNAME, PROJURIS_DOMINIO e PROJURIS_PASSWORD no " +
        ".env.local para autenticar. Tentando mesmo assim para capturar a " +
        "resposta exata do servidor...\n",
    );
  }

  const client = createProjurisClientFromEnv();

  // 1) AUTH — tenta as variantes de username em ordem, para na 1ª 200.
  console.log("\n--- (1) AUTH (grant_type=password) — tentando variantes de username ---");
  console.log("   Variantes (em ordem):");
  client.buildUsernameVariants().forEach((v, i) => console.log(`     ${i + 1}. ${v}`));
  let usernameOk = "";
  try {
    const { token: tok, username } = await client.authenticateTryingVariants((u, status, ok) => {
      console.log(`   → tentativa username="${u}"  =>  HTTP ${status}${ok ? " ✅" : ""}`);
    });
    usernameOk = username;
    console.log(`\n✅ AUTH OK com username="${username}".`);
    console.log("   token_type:", tok.token_type, "| expires_in:", tok.expires_in, "s");
  } catch (err) {
    if (err instanceof ProjurisAuthError) {
      console.error("\n❌ AUTH FALHOU (todas as variantes)");
      console.error("   HTTP (última):", err.status);
      console.error("   msg :", err.message);
      console.error("   body:", err.body || "(vazio)");
    } else {
      console.error("\n❌ AUTH FALHOU (erro inesperado):", err);
    }
    console.error(
      "\nLeitura da doc (fluxo correto): POST application/x-www-form-urlencoded em " +
        PROJURIS_DEFAULT_AUTH_URL +
        " com { grant_type=password, client_id, client_secret, username=USUARIO$$DOMINIO, password }. " +
        "Resposta { access_token, expires_in, token_type:'Bearer' }. " +
        "Token nas chamadas seguintes: header Authorization: <access_token>.",
    );
    process.exit(1);
  }

  // helper de leitura + amostra (15)
  async function readAndSample(
    label: string,
    path: string,
    query: Record<string, string | number | undefined> | undefined,
    codKeys: string[],
    nomeKeys: string[],
  ): Promise<unknown[]> {
    console.log(`\n--- ${label}: GET /${path}${query ? " " + JSON.stringify(query) : ""} ---`);
    try {
      const raw = await client.projurisGet<unknown>(path, query);
      const rows = firstArray(raw);
      console.log(`   total: ${rows.length}`);
      rows.slice(0, 15).forEach((r, i) => {
        const cod = pick(r, codKeys);
        const nome = pick(r, nomeKeys);
        console.log(`   ${i + 1}. [${cod ?? "?"}] ${nome ?? JSON.stringify(r).slice(0, 90)}`);
      });
      return rows;
    } catch (err) {
      console.error(`   ⚠ erro ao ler ${label}:`, err instanceof Error ? err.message : err);
      return [];
    }
  }

  // 2a) USUÁRIOS / COLABORADORES
  // Envelope real: { simpleDto: [ { chave: <codigoUsuario>, valor: <nome> } ] }.
  // O CÓDIGO do executor (candidato a projuris_responsavel_id) vem em `chave`.
  const usuarios = await readAndSample(
    "(a) Usuários / colaboradores",
    "usuario",
    undefined,
    ["chave", "codigoUsuario", "codigo", "codigoPessoa", "id"],
    ["valor", "nome", "nomeUsuario", "login"],
  );
  console.log("\n   >>> Colaboradores (CÓDIGO | nome) — candidatos a EXECUTORES:");
  usuarios.forEach((u, i) => {
    const cod = pick(u, ["chave", "codigoUsuario", "codigo", "id"]);
    const nome = pick(u, ["valor", "nome", "nomeUsuario"]);
    const email = pick(u, ["email", "emailUsuario", "login"]);
    console.log(
      `     ${String(i + 1).padStart(2)}. ${String(cod ?? "?").padStart(8)} | ${nome ?? "?"}${
        email ? "  <" + email + ">" : ""
      }`,
    );
  });

  // 2b) ASSUNTOS / TEMAS
  const assuntos = await readAndSample(
    "(b) Assuntos / temas",
    "processo/assunto",
    undefined,
    ["chave", "codigo", "codigoAssunto", "id"],
    ["valor", "descricao", "nome", "nomeAssunto"],
  );

  // 2c) TIPOS DE TAREFA — envelope aninhado:
  //   { consultaTipoRetorno: [ { chaveTipo, quantidadeRegistros, simpleDto:[{chave,valor}] } ] }
  //   Cada simpleDto: `chave`=código do tipo, `valor`=nome.
  console.log('\n--- (c) Tipos de tarefa: GET /tipo {"chave-tipo":"tarefa-tipo"} ---');
  let tiposTarefa: unknown[] = [];
  try {
    const rawTipo = await client.projurisGet<unknown>("tipo", { "chave-tipo": "tarefa-tipo" });
    tiposTarefa = unwrapTipoSimpleDto(rawTipo);
    console.log(`   total (desempacotado): ${tiposTarefa.length}`);
    console.log("   CÓDIGO | nome:");
    tiposTarefa.forEach((t, i) => {
      const cod = pick(t, ["chave", "codigo", "codigoTipo", "id"]);
      const nome = pick(t, ["valor", "descricao", "nome"]);
      console.log(
        `     ${String(i + 1).padStart(2)}. ${String(cod ?? "?").padStart(9)} | ${nome ?? "?"}`,
      );
    });
  } catch (err) {
    console.error("   ⚠ erro ao ler tipos de tarefa:", err instanceof Error ? err.message : err);
  }

  // 2d) INTIMAÇÕES (entrada do motor) — contadores GET + a CONSULTA real (POST).
  console.log("\n--- (d) Intimações (entrada do motor) ---");
  console.log("   Contadores (GET, leitura pura):");
  for (const [rota, label] of [
    ["intimacao/contar-pendentes", "contar-pendentes"],
    ["intimacao/total-intimacoes", "total-intimacoes"],
    ["intimacao/health-check", "health-check"],
  ] as const) {
    try {
      const v = await client.projurisGet<unknown>(rota);
      console.log(`     GET /${label} =>`, JSON.stringify(v).slice(0, 120));
    } catch (err) {
      console.log(`     GET /${label} falhou:`, err instanceof Error ? err.message : err);
    }
  }

  // Consulta REAL (POST /intimacao/consulta = leitura). Filtra últimos 7 dias por
  // data de disponibilização. Envelope: { totalRegistros, intimacaoConsultaWs:[...] }.
  console.log("\n   Consulta (POST /intimacao/consulta — LEITURA, últimos 7 dias):");
  const hoje = new Date();
  const seteAtras = new Date(hoje.getTime() - 7 * 86400_000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const msToYmd = (ms: unknown) =>
    typeof ms === "number" ? new Date(ms).toISOString().slice(0, 10) : null;
  const filtro = {
    tipoDataFiltroIntimacao: "DATA_DA_DISPONIBILIZACAO",
    dataPeriodoInicial: ymd(seteAtras),
    dataPeriodoFinal: ymd(hoje),
    dadosOrigemFiltro: true,
  };
  try {
    const resp = await client.projurisPostConsulta<{
      totalRegistros?: number;
      intimacaoConsultaWs?: Array<Record<string, unknown>>;
    }>("intimacao/consulta", filtro);
    const lista = resp.intimacaoConsultaWs ?? [];
    console.log(
      `     filtro: ${JSON.stringify(filtro)}\n     totalRegistros=${resp.totalRegistros} | itens nesta página=${lista.length}`,
    );
    console.log("     Amostra das 5 primeiras (campos p/ o motor):");
    lista.slice(0, 5).forEach((it, i) => {
      const resp2 = (it.usuariosResponsaveis as Array<Record<string, unknown>> | undefined) ?? [];
      const codResp = resp2.map((u) => pick(u, ["codigoUsuario", "codigo", "chave", "id"]));
      const sugeridas = (it.tarefasSugeridas as unknown[] | undefined) ?? [];
      console.log(
        `       ${i + 1}. proc=${it.numeroProcesso} | tipoIntimacao=${it.tipoIntimacao} | situacao=${it.tipoSituacao}\n` +
          `          orgao=${String(it.orgao).slice(0, 50)} | cliente=${JSON.stringify(it.nomeCliente)}\n` +
          `          responsavel="${it.nomeResponsavel}" cod=${JSON.stringify(codResp)}\n` +
          `          dispon=${msToYmd(it.dataDisponibilizacao)} jornal=${msToYmd(it.dataJornal)} | tarefasSugeridas=${sugeridas.length}\n` +
          `          texto="${String(it.texto ?? "")
            .replace(/<[^>]+>/g, "")
            .slice(0, 70)}"`,
      );
    });
    console.log(
      "\n     NOTA (shape p/ o motor): a intimação bruta traz PROCESSO + RESPONSÁVEL(cod) +\n" +
        "     data(disponibilização/jornal) + texto + situação, mas NÃO traz assunto/tema,\n" +
        "     tipo-de-tarefa nem prazo (previsto/fatal). Prazo/tipo vêm da TAREFA sugerida\n" +
        "     (tarefasSugeridas → prazoPrevisto/prazoFatal) ou da tarefa gerada a partir da\n" +
        "     intimação; assunto/tema vem do PROCESSO vinculado (codigoProcesso). Paginação\n" +
        "     keyset: POST /v2/intimacao/consulta-keyset → { totalRegistros, proximoCursor,\n" +
        "     intimacaoConsultaWs[] } (passar proximoCursor p/ a próxima página).",
    );
  } catch (err) {
    console.log("     POST /intimacao/consulta falhou:", err instanceof Error ? err.message : err);
  }

  // 3) RECONCILIAÇÃO (relatório, NÃO escreve) — assuntos E tipos de tarefa.
  const pg = await openPg();
  if (!pg) {
    console.log(
      "\n--- Reconciliação: (sem acesso ao banco — defina SUPABASE_PROJECT_REF+SUPABASE_DB_PASSWORD ou DATABASE_URL) ---",
    );
  } else {
    try {
      // 3a) assuntos × system_theme_mapping
      console.log(
        "\n--- Reconciliação ASSUNTOS ProJuris × system_theme_mapping (SÓ RELATÓRIO) ---",
      );
      const themeMap = await loadThemeMapping(pg);
      reconcile(
        themeMap,
        "projuris_tema_codigo",
        assuntos,
        ["chave", "codigo", "codigoAssunto", "id"],
        ["valor", "descricao", "nome", "nomeAssunto"],
      );

      // 3b) tipos de tarefa × system_task_type_mapping
      console.log(
        "\n--- Reconciliação TIPOS DE TAREFA ProJuris × system_task_type_mapping (SÓ RELATÓRIO) ---",
      );
      const taskMap = await loadTaskTypeMapping(pg);
      reconcile(
        taskMap,
        "projuris_tipo_codigo",
        tiposTarefa,
        ["chave", "codigo", "codigoTipo", "id"],
        ["valor", "descricao", "nome"],
      );
      console.log(
        `   (referência: ProJuris tem ${tiposTarefa.length} tipos de tarefa; SHV tem ${
          taskMap?.length ?? "?"
        } linhas em system_task_type_mapping)`,
      );
    } finally {
      await pg.end().catch(() => {});
    }
  }

  console.log(`\n=== FIM (nenhuma escrita realizada; username vencedor: "${usernameOk}") ===`);
}

/** Compara um mapping do SHV (linhas com placeholder no campo `codeField`) contra
 *  as linhas do ProJuris, casando por NOME normalizado. Só imprime relatório. */
function reconcile(
  mapping: Array<Record<string, unknown>> | null,
  codeField: string,
  pjRows: unknown[],
  pjCodKeys: string[],
  pjNomeKeys: string[],
): void {
  if (!mapping) {
    console.log("   (mapping indisponível no banco — pulado)");
    return;
  }
  if (pjRows.length === 0) {
    console.log("   (sem linhas vindas do ProJuris — nada a reconciliar)");
    return;
  }
  const pjByName = new Map<string, { cod: string | number | undefined; nome: string }>();
  for (const a of pjRows) {
    const cod = pick(a, pjCodKeys);
    const nome = pick(a, pjNomeKeys);
    if (typeof nome === "string") pjByName.set(normalizeName(nome), { cod, nome });
  }
  let casaram = 0;
  const shvSemMatch: string[] = [];
  const matchedPjNames = new Set<string>();
  console.log(`   SHV(${codeField} placeholder)  ->  ProJuris(código real | nome)`);
  for (const row of mapping) {
    const placeholder = String(row[codeField]);
    const hit = pjByName.get(normalizeName(placeholder));
    if (hit) {
      casaram++;
      matchedPjNames.add(normalizeName(hit.nome));
      console.log(`   ✔ "${placeholder}"  ->  código ${hit.cod ?? "?"} | "${hit.nome}"`);
    } else {
      shvSemMatch.push(placeholder);
      console.log(`   ✘ "${placeholder}"  ->  (SEM correspondência por nome)`);
    }
  }
  console.log(
    `\n   Resumo: ${casaram}/${mapping.length} casaram por nome. (NÃO gravado — revisão manual)`,
  );
  if (shvSemMatch.length) {
    console.log(
      `   SHV pontuado SEM match no ProJuris (${shvSemMatch.length}): ${shvSemMatch.join(", ")}`,
    );
  }
  // Reciprocal: linhas do ProJuris que NÃO têm pontuação no SHV.
  const pjSemPontuacao: string[] = [];
  for (const a of pjRows) {
    const cod = pick(a, pjCodKeys);
    const nome = pick(a, pjNomeKeys);
    if (typeof nome === "string" && !matchedPjNames.has(normalizeName(nome))) {
      pjSemPontuacao.push(`${cod ?? "?"}=${nome.trim()}`);
    }
  }
  if (pjSemPontuacao.length) {
    console.log(
      `   ProJuris SEM pontuação no SHV (${pjSemPontuacao.length}): ${pjSemPontuacao.join(", ")}`,
    );
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
