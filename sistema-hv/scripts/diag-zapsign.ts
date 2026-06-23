// Diagnóstico do envio de e-mail do ZapSign (assinatura). Só LEITURA (GET) —
// lista os documentos criados e inspeciona os signatários do mais recente para
// confirmar: e-mail registrado? send_automatic_email? status do envio?
// Rodar: npx tsx --env-file=.env.local scripts/diag-zapsign.ts

const token = process.env.ZAPSIGN_API_TOKEN;
const baseUrl = (
  process.env.ZAPSIGN_API_BASE_URL || "https://sandbox.api.zapsign.com.br/api/v1"
).replace(/\/+$/, "");

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl}/${path.replace(/^\/+/, "")}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : (undefined as T);
}

async function main() {
  if (!token) {
    console.error("❌ ZAPSIGN_API_TOKEN ausente no .env.local");
    process.exit(1);
  }
  console.log("🌐 baseUrl:", baseUrl);
  console.log("   sandbox?", baseUrl.includes("sandbox") ? "SIM" : "NÃO (produção)");

  // 1) Lista os documentos da conta e ordena por created_at DESC (a API devolve
  //    em ordem crescente). Aceita um token por argumento para detalhar direto.
  const argToken = process.argv[2];
  const list = await req<{ count?: number; results?: any[] } | any[]>("/docs/");
  const docs = (Array.isArray(list) ? list : (list.results ?? [])).sort((a: any, b: any) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
  console.log(`\n📋 ${docs.length} documento(s) retornado(s). Mais recentes:`);
  for (const d of docs.slice(0, 8)) {
    console.log(`   • ${d.created_at ?? "?"} | ${d.status ?? "?"} | ${d.name} | ${d.token}`);
  }
  if (!docs.length) {
    console.log("\n⚠️  Nenhum documento nesse token/ambiente. O envio caiu em outro token?");
    return;
  }

  // 2) Detalha o token passado por argumento, ou o mais recente.
  const latest = argToken ? { token: argToken, name: "(por argumento)" } : docs[0];
  console.log(`\n🔎 Detalhe do mais recente: "${latest.name}" (${latest.token})`);
  const detail = await req<{ status: string; signers: any[] }>(`/docs/${latest.token}/`);
  console.log("   status do documento:", detail.status);
  console.log("   signatários:");
  for (const s of detail.signers ?? []) {
    console.log("   ----------------------------------------");
    console.log("   nome:               ", s.name);
    console.log("   email:              ", s.email ?? "(VAZIO — sem e-mail = sem envio)");
    console.log("   status:             ", s.status);
    console.log("   auth_mode:          ", s.auth_mode);
    console.log("   send_automatic_email:", s.send_automatic_email);
    console.log("   sign_url:           ", s.sign_url);
    console.log("   times_viewed:       ", s.times_viewed ?? 0);
  }
  console.log("\n🧭 Leitura:");
  console.log("   - email VAZIO  → o ZapSign não tinha para quem enviar (preencha no cadastro).");
  console.log("   - send_automatic_email=false → e-mail desativado nessa criação.");
  console.log("   - email OK + send_automatic_email=true → ZapSign enviou; verifique SPAM/lixeira");
  console.log("     e o remetente (sandbox costuma vir de remetente de teste).");
}

main().catch((e) => {
  console.error("erro fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
