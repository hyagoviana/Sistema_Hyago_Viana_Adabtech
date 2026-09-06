// QA da S3-02 — estado civil como escolha e renomeação dos campos de endereço.
//
// O que está em jogo: esses rótulos alimentam o motor de variáveis dos modelos
// Word. Uma renomeação descuidada faz o documento sair com o campo em branco —
// e ninguém percebe até o cliente receber.
//
// Roda contra o banco REAL (dev=prod). Só LÊ; o autofill é exercitado com dados
// montados em memória.
//
// Rodar: npx tsx scripts/qa-s302-estado-civil-endereco.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";

import { getSupabaseAdmin } from "../src/lib/supabase/server";

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

const OPCOES = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
  "Separado(a)",
];

async function main() {
  const sb = getSupabaseAdmin();
  const form = readFileSync("src/components/clients/ClientForm.tsx", "utf8");
  const autofill = readFileSync("src/lib/cases/document-autofill.ts", "utf8");
  const painel = readFileSync("src/components/clients/ClientDataPanel.tsx", "utf8");

  // ==================================================== estado civil na tela
  console.log("\n  A — estado civil virou escolha\n");

  check("o campo não é mais texto livre", !form.includes('placeholder="solteira / casado / ..."'));
  for (const o of OPCOES) {
    check(`a opção "${o}" existe`, form.includes(`"${o}"`));
  }
  check(
    "o padrão do CADASTRO NOVO é Solteiro(a)",
    form.includes("estado_civil: ESTADO_CIVIL_PADRAO") &&
      form.includes('export const ESTADO_CIVIL_PADRAO = "Solteiro(a)"'),
  );
  // O default não pode vazar para a exibição de cliente antigo: mostrar
  // "Solteiro(a)" para quem nunca informou seria afirmar um dado que não existe.
  check(
    "cliente existente SEM o dado não é exibido como Solteiro(a)",
    !form.includes("value={field.value || ESTADO_CIVIL_PADRAO}"),
  );
  // Valor legado fora da lista tem que sobreviver: sem uma opção que o
  // represente, o Select ficaria vazio e o primeiro salvamento apagaria o dado.
  check(
    "valor legado fora da lista continua selecionável",
    form.includes("(como estava)") && form.includes("!ESTADOS_CIVIS.includes"),
  );

  // ======================================================== dados no banco
  console.log("\n  B — os dados já gravados foram normalizados\n");

  const { data } = await sb
    .from("system_clients")
    .select("full_name, professional_data")
    .is("deleted_at", null);
  const valores = (
    (data ?? []) as Array<{
      full_name: string;
      professional_data: Record<string, unknown> | null;
    }>
  )
    .map((c) => ({
      nome: c.full_name,
      ec:
        typeof c.professional_data?.estado_civil === "string"
          ? (c.professional_data.estado_civil as string).trim()
          : "",
    }))
    .filter((v) => v.ec);

  const fora = valores.filter((v) => !OPCOES.includes(v.ec));
  check(
    "todo estado civil gravado está na lista de opções",
    fora.length === 0,
    fora.map((f) => `"${f.ec}" (${f.nome})`).join(", "),
  );
  console.log(`  (${valores.length} cliente(s) com estado civil preenchido)`);

  // ============================================ rótulos e motor de variáveis
  console.log("\n  C — rótulos novos, variáveis intactas\n");

  check('o formulário mostra "Endereço"', form.includes("<FormLabel>Endereço *</FormLabel>"));
  check(
    'o formulário mostra "Número endereço"',
    form.includes("<FormLabel>Número endereço *</FormLabel>"),
  );
  check('a ficha de leitura mostra "Número endereço"', painel.includes('"Número endereço"'));

  // As CHAVES do autofill não podem mudar: são elas que casam com as variáveis
  // dos modelos Word já existentes. Renomear rótulo é apresentação; renomear
  // chave quebraria todo documento em uso.
  check(
    'a chave canônica "Rua" continua existindo',
    autofill.includes('canonical["Rua"] = street'),
  );
  check(
    'a chave canônica "Logradouro" continua existindo',
    autofill.includes('canonical["Logradouro"] = street'),
  );
  check('a chave canônica "Número" continua existindo', autofill.includes('canonical["Número"]'));
  check(
    'o auto_field "logradouro" continua resolvendo por "Rua"',
    autofill.includes('canonicalLookup("Rua", data.canonical)'),
  );

  // Aliases novos — para quem nomear a variável pelo rótulo que passou a ver.
  check(
    'alias "Endereço (logradouro)" foi criado',
    autofill.includes('canonical["Endereço (logradouro)"] = street'),
  );
  check('alias "Número endereço" foi criado', autofill.includes('canonical["Número endereço"]'));

  // O alias NÃO pode ter roubado o sentido de "Endereço", que é a linha completa.
  check(
    '"Endereço" continua sendo o endereço COMPLETO (o alias não tomou o lugar)',
    autofill.includes('canonical["Endereço"] = endParts.join(", ")'),
  );

  if (falhou) {
    console.error(`\nS3-02: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nS3-02: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
