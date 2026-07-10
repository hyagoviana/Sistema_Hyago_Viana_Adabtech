// SERVER-ONLY — verificação de "entregabilidade" de e-mail sem API paga:
//   1) Formato (sanidade básica).
//   2) Sugestão de typo de domínios populares (gmaill.com → gmail.com), que é a
//      causa real dos e-mails que não chegam (o domínio é sintaticamente válido).
//   3) DNS: o domínio tem servidor de e-mail (registro MX, ou A como fallback)?
//      Se o DNS diz CLARAMENTE que o domínio não existe / não tem MX, bloqueamos.
//      Em erro transitório (timeout/servfail) fazemos FAIL-OPEN (não bloqueia) para
//      não travar cadastro por instabilidade de rede.
//
// NÃO confirma se a caixa (parte antes do @) existe — isso exigiria SMTP/serviço
// pago e o Gmail "aceita tudo" mesmo assim. O foco é pegar erro de digitação.

import { promises as dns } from "node:dns";

export type EmailCheckResult = {
  ok: boolean; // pode cadastrar? (false só quando o domínio claramente não recebe e-mail)
  hasMx: boolean; // domínio tem servidor de e-mail
  suggestion?: string; // e-mail corrigido sugerido (typo de domínio popular)
  reason?: string; // motivo legível quando ok=false
};

// Domínios populares (BR + globais) para detectar erro de digitação por proximidade.
const POPULAR_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "hotmail.com.br",
  "outlook.com.br",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "me.com",
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Sugere um domínio popular quando o digitado é "quase" um deles (mas não igual).
function suggestDomain(domain: string): string | undefined {
  if (POPULAR_DOMAINS.includes(domain)) return undefined;
  let best: { d: string; dist: number } | null = null;
  for (const pop of POPULAR_DOMAINS) {
    const dist = levenshtein(domain, pop);
    if (!best || dist < best.dist) best = { d: pop, dist };
  }
  // Distância pequena (1–2) → provável erro de digitação. Acima disso, é outro domínio.
  if (best && best.dist > 0 && best.dist <= 2) return best.d;
  return undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("dns-timeout")), ms)),
  ]);
}

// Resultado da consulta de "tem servidor de e-mail?":
//   "yes"     → tem MX (ou A) → aceita
//   "no"      → domínio não existe / sem MX nem A → bloqueia
//   "unknown" → não deu para determinar (rede) → fail-open (não bloqueia)
type MailHost = "yes" | "no" | "unknown";

// --- DNS-over-HTTPS (funciona atrás de firewalls que bloqueiam DNS na porta 53).
// Resolvers públicos que devolvem JSON (formato do dns.google / RFC 8484-json).
const DOH_ENDPOINTS = ["https://dns.google/resolve", "https://cloudflare-dns.com/dns-query"];

type DohAnswer = { Status: number; Answer?: Array<{ type: number; data: string }> };

async function dohQuery(domain: string, type: "MX" | "A"): Promise<DohAnswer | null> {
  for (const base of DOH_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${base}?name=${encodeURIComponent(domain)}&type=${type}`, {
        headers: { accept: "application/dns-json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) continue;
      return (await res.json()) as DohAnswer;
    } catch {
      // tenta o próximo resolver
    }
  }
  return null;
}

// Determina se o domínio recebe e-mail. Prioriza DoH (robusto em qualquer rede);
// se DoH falhar, cai no DNS nativo; se ambos falharem, "unknown" (fail-open).
async function resolveMailHost(domain: string): Promise<MailHost> {
  const RCODE_NXDOMAIN = 3;
  const TYPE_MX = 15;

  const mx = await dohQuery(domain, "MX");
  if (mx) {
    if (mx.Status === RCODE_NXDOMAIN) return "no"; // domínio não existe
    if ((mx.Answer ?? []).some((a) => a.type === TYPE_MX)) return "yes";
    // NOERROR sem MX → alguns domínios recebem via A record.
    const a = await dohQuery(domain, "A");
    if (a && (a.Answer ?? []).length > 0) return "yes";
    return "no";
  }

  // Fallback: DNS nativo (pode falhar por rede — daí "unknown").
  try {
    const rec = await withTimeout(dns.resolveMx(domain), 4000);
    if (rec && rec.length > 0) return "yes";
    const a = await withTimeout(dns.resolve(domain), 4000);
    return a && a.length > 0 ? "yes" : "no";
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") return "no";
    return "unknown";
  }
}

export async function checkEmailDeliverability(rawEmail: string): Promise<EmailCheckResult> {
  const email = (rawEmail ?? "").trim();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    return { ok: false, hasMx: false, reason: "E-mail inválido." };
  }
  const domain = email.slice(at + 1).toLowerCase();
  const suggestion = suggestDomain(domain);
  const suggestedEmail = suggestion ? `${email.slice(0, at)}@${suggestion}` : undefined;

  const host = await resolveMailHost(domain);
  if (host === "no") {
    return {
      ok: false,
      hasMx: false,
      suggestion: suggestedEmail,
      reason: `O domínio "${domain}" não existe ou não recebe e-mails.`,
    };
  }
  // "yes" (tem servidor) ou "unknown" (rede indeterminada) → não bloqueia. Ainda
  // devolve a sugestão de typo quando houver (pega o gmaill.com mesmo com MX).
  return { ok: true, hasMx: host === "yes", suggestion: suggestedEmail };
}
