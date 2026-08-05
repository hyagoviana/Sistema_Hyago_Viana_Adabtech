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

async function loadThemeMapping(): Promise<ThemeRow[] | null> {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) return null;
  const pg = (await import("pg")).default;
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const res = await client.query(
      "select projuris_tema_codigo, motor_theme_id, multiplier from system_theme_mapping order by projuris_tema_codigo",
    );
    return res.rows as ThemeRow[];
  } catch (err) {
    console.warn(
      "  (reconciliação pulada — não consegui ler system_theme_mapping:",
      err instanceof Error ? err.message : String(err),
      ")",
    );
    return null;
  } finally {
    await client.end().catch(() => {});
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

  // 1) AUTH
  try {
    const tok = await client.authenticate();
    console.log("\n✅ AUTH OK — access_token obtido.");
    console.log("   token_type:", tok.token_type, "| expires_in:", tok.expires_in, "s");
  } catch (err) {
    if (err instanceof ProjurisAuthError) {
      console.error("\n❌ AUTH FALHOU");
      console.error("   HTTP:", err.status);
      console.error("   msg :", err.message);
      console.error("   body:", err.body);
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

  // 2) USUÁRIOS / COLABORADORES
  console.log("\n--- (a) Usuários / colaboradores: GET /usuario ---");
  try {
    const raw = await client.projurisGet<unknown>("usuario");
    const rows = firstArray(raw);
    console.log(`   total: ${rows.length}`);
    rows.slice(0, 10).forEach((r, i) => {
      const cod = pick(r, ["codigoUsuario", "codigo", "codigoPessoa", "id"]);
      const nome = pick(r, ["nome", "nomeUsuario", "login", "valor"]);
      console.log(`   ${i + 1}. [${cod ?? "?"}] ${nome ?? JSON.stringify(r).slice(0, 80)}`);
    });
  } catch (err) {
    console.error("   ⚠ erro ao ler usuários:", err instanceof Error ? err.message : err);
  }

  // 3) ASSUNTOS / TEMAS
  console.log("\n--- (b) Assuntos / temas: GET /processo/assunto ---");
  let assuntos: unknown[] = [];
  try {
    const raw = await client.projurisGet<unknown>("processo/assunto");
    assuntos = firstArray(raw);
    console.log(`   total: ${assuntos.length}`);
    assuntos.slice(0, 10).forEach((r, i) => {
      const cod = pick(r, ["chave", "codigo", "codigoAssunto", "id"]);
      const nome = pick(r, ["valor", "descricao", "nome", "nomeAssunto"]);
      console.log(`   ${i + 1}. [${cod ?? "?"}] ${nome ?? JSON.stringify(r).slice(0, 80)}`);
    });
  } catch (err) {
    console.error("   ⚠ erro ao ler assuntos:", err instanceof Error ? err.message : err);
  }

  // 4) RECONCILIAÇÃO (relatório, NÃO escreve)
  console.log("\n--- Reconciliação assuntos ProJuris × system_theme_mapping (SÓ RELATÓRIO) ---");
  const mapping = await loadThemeMapping();
  if (!mapping) {
    console.log("   (sem acesso ao banco — pulei o de-para; rode com SUPABASE_* no .env.local)");
  } else if (assuntos.length === 0) {
    console.log("   (sem assuntos vindos do ProJuris — nada a reconciliar)");
  } else {
    const pjByName = new Map<string, { cod: string | number | undefined; nome: string }>();
    for (const a of assuntos) {
      const cod = pick(a, ["chave", "codigo", "codigoAssunto", "id"]);
      const nome = pick(a, ["valor", "descricao", "nome", "nomeAssunto"]);
      if (typeof nome === "string") pjByName.set(normalizeName(nome), { cod, nome });
    }
    let casaram = 0;
    console.log("   SHV(projuris_tema_codigo placeholder)  ->  ProJuris(código real | nome)");
    for (const row of mapping) {
      const key = normalizeName(String(row.projuris_tema_codigo));
      const hit = pjByName.get(key);
      if (hit) {
        casaram++;
        console.log(
          `   ✔ "${row.projuris_tema_codigo}"  ->  código ${hit.cod ?? "?"} | "${hit.nome}"`,
        );
      } else {
        console.log(`   ✘ "${row.projuris_tema_codigo}"  ->  (SEM correspondência por nome)`);
      }
    }
    console.log(
      `\n   Resumo: ${casaram}/${mapping.length} temas do SHV casaram por nome com assuntos do ProJuris.`,
    );
    console.log(
      "   AÇÃO (revisão manual): substituir projuris_tema_codigo pelo código real acima. " +
        "NÃO gravado por este script.",
    );
  }

  console.log("\n=== FIM (nenhuma escrita realizada) ===");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
