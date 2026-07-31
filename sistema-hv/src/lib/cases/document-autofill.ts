// Auto-preenchimento de placeholders de modelo de documento com dados do
// cliente/caso. Lógica PURA (sem React) — usada tanto no front (GenerateDialog)
// quanto no servidor (geração da procuração ao criar caso comercial).

import { FIES_FIELD_DEFS, FIES_KEY_VALOR_CENTAVOS } from "@/lib/cases/fies-fields";
import { VINCULO_FIELD_DEFS } from "@/lib/cases/vinculo-fields";
import { formatCpfCnpj } from "@/lib/format";

export type TemplateField = {
  key: string;
  label: string;
  source: "auto" | "manual" | "blank";
  required?: boolean;
  auto_field?: string;
};

/** Dados de cliente/caso usados para preencher os placeholders. */
export type AutoFillData = {
  clientName?: string;
  clientCpf?: string;
  municipio?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  crm_numero?: string;
  crm_uf?: string;
  oab_numero?: string;
  oab_uf?: string;
  especialidade?: string;
  vinculo_institucional?: string;
  caseCode?: string;
  responsavel?: string;
  // Autofill (2026-07-08) — usados para montar o bloco "dados pessoais" completo.
  rg?: string;
  rgOrgao?: string;
  estadoCivil?: string;
  enderecoCompleto?: string;
  cep?: string;
  // Autofill B — dados do MUNICÍPIO (tabela system_municipios).
  populacao?: string;
  densidade?: string;
  salarioMedio?: string;
  percentual?: string;
  ibge?: string;
  secretario?: string;
  secretarioCargo?: string;
  // Autofill C — PERFIL (tabela system_perfis).
  numeroPerfil?: string;
  perfilTexto?: string;
  // Autofill D — campos do CASO (canonical_fields): chave (nome do campo) → valor.
  canonical?: Record<string, string>;
};

// Normaliza texto p/ casar placeholder ↔ nome de campo canônico do caso: remove
// acentos, sufixo "- obrigatório", pontuação e caixa.
function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*-\s*obrigat[oó]rio\s*$/i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

// Autofill D — ALIASES de placeholder → campo canônico do caso.
// Root cause R5-08 (D1/D2): as Declarações ESF trazem "Posto de Saúde",
// "Unidade de Saúde", "UBS", "CBO", "CNES" com REDAÇÕES diferentes do rótulo do
// campo canônico gravado no caso. Como esses dados variam POR CASO/VÍNCULO, a
// fonte natural é `canonical_fields` (campo do serviço). Aqui mapeamos as
// variações comuns de um placeholder para o MESMO grupo de chaves canônicas, de
// modo que qualquer redação encontre o dado sem exigir texto idêntico no modelo.
// Cada valor é uma lista de nomes canônicos ACEITOS (normalizados por normKey).
const CANONICAL_ALIASES: { match: RegExp; keys: string[] }[] = [
  {
    // Unidade/Posto de Saúde / UBS / ESF (nome da unidade onde atua).
    match:
      /\b(unidade de sa[uú]de|posto de sa[uú]de|ubs|unidade b[aá]sica|estabelecimento de sa[uú]de|nome da unidade|unidade de lota[cç][aã]o|lota[cç][aã]o)\b/,
    keys: [
      "unidade de saude",
      "posto de saude",
      "ubs",
      "unidade basica de saude",
      "estabelecimento de saude",
      "nome da unidade",
      "unidade de lotacao",
      "lotacao",
    ],
  },
  {
    // CBO — Classificação Brasileira de Ocupações.
    match: /\bcbo\b|classifica[cç][aã]o brasileira de ocupa[cç][oõ]es/,
    keys: ["cbo", "codigo cbo", "classificacao brasileira de ocupacoes"],
  },
  {
    // CNES — Cadastro Nacional de Estabelecimentos de Saúde.
    match: /\bcnes\b|cadastro nacional de estabelecimentos de sa[uú]de/,
    keys: ["cnes", "codigo cnes", "cadastro nacional de estabelecimentos de saude"],
  },
];

// Casa o placeholder com um campo canônico do CASO por um dos aliases acima.
function canonicalAliasLookup(
  fieldKey: string,
  label: string,
  canonical?: Record<string, string>,
): string | undefined {
  if (!canonical) return undefined;
  const hay = `${fieldKey} ${label}`.toLowerCase();
  for (const alias of CANONICAL_ALIASES) {
    if (!alias.match.test(hay)) continue;
    const wanted = new Set(alias.keys);
    for (const [ck, cv] of Object.entries(canonical)) {
      if (cv && wanted.has(normKey(ck))) return cv;
    }
  }
  return undefined;
}

// Autofill D — casa o placeholder com um campo canônico do CASO pelo nome.
function canonicalLookup(fieldKey: string, canonical?: Record<string, string>): string | undefined {
  if (!canonical) return undefined;
  const nk = normKey(fieldKey);
  for (const [ck, cv] of Object.entries(canonical)) {
    if (cv && normKey(ck) === nk) return cv;
  }
  return undefined;
}

/** Mescla os dados de um município (tabela) no AutoFillData. Puro.
 *  Injeta TAMBÉM no canonical com rótulos PT para canonicalLookup. */
export function augmentWithMunicipio(
  data: AutoFillData,
  m?: {
    populacao?: string | null;
    densidade?: string | null;
    salario_medio?: string | null;
    percentual?: string | null;
    ibge?: string | null;
    secretario_nome?: string | null;
    secretario_cargo?: string | null;
  } | null,
): AutoFillData {
  if (!m) return data;
  const canonical = { ...(data.canonical ?? {}) };
  if (m.populacao) {
    canonical["População"] = m.populacao;
    canonical["População do Município"] = m.populacao;
  }
  if (m.densidade) {
    canonical["Densidade"] = m.densidade;
    canonical["Densidade Demográfica"] = m.densidade;
  }
  if (m.salario_medio) {
    canonical["Salário Médio"] = m.salario_medio;
    canonical["Salário"] = m.salario_medio;
  }
  if (m.percentual) {
    canonical["Percentual"] = m.percentual;
    canonical["Percentual do Município"] = m.percentual;
  }
  if (m.ibge) {
    canonical["IBGE"] = m.ibge;
    canonical["Código IBGE"] = m.ibge;
  }
  if (m.secretario_nome) {
    canonical["Secretário"] = m.secretario_nome;
    canonical["Secretário de Saúde"] = m.secretario_nome;
    canonical["Nome do Secretário"] = m.secretario_nome;
  }
  if (m.secretario_cargo) {
    canonical["Cargo do Secretário"] = m.secretario_cargo;
  }
  return {
    ...data,
    populacao: m.populacao ?? data.populacao,
    densidade: m.densidade ?? data.densidade,
    salarioMedio: m.salario_medio ?? data.salarioMedio,
    percentual: m.percentual ?? data.percentual,
    ibge: m.ibge ?? data.ibge,
    secretario: m.secretario_nome ?? data.secretario,
    secretarioCargo: m.secretario_cargo ?? data.secretarioCargo,
    canonical,
  };
}

/** Mescla o texto de um perfil (tabela) no AutoFillData. Puro.
 *  Injeta TAMBÉM no canonical com rótulos PT para canonicalLookup. */
export function augmentWithPerfil(
  data: AutoFillData,
  p?: { nome?: string | null; texto?: string | null } | null,
): AutoFillData {
  if (!p) return data;
  const canonical = { ...(data.canonical ?? {}) };
  if (p.nome) {
    canonical["Perfil"] = p.nome;
    canonical["Número do Perfil"] = p.nome;
  }
  if (p.texto) {
    canonical["Informações sobre o Perfil"] = p.texto;
    canonical["Texto do Perfil"] = p.texto;
  }
  return {
    ...data,
    numeroPerfil: p.nome ?? data.numeroPerfil,
    perfilTexto: p.texto ?? data.perfilTexto,
    canonical,
  };
}

/** Mescla dados de honorários do caso no AutoFillData. Puro.
 *  Injeta no canonical com rótulos PT para canonicalLookup. */
export function augmentWithHonorarios(
  data: AutoFillData,
  h?: {
    percentual_honorarios?: number | null;
    valor_parcela_centavos?: number | null;
    desconto_avista_pct?: number | null;
    forma_pagamento?: string | null;
    honorarios_total_centavos?: number | null;
  } | null,
): AutoFillData {
  if (!h) return data;
  const canonical = { ...(data.canonical ?? {}) };
  if (h.percentual_honorarios != null) {
    const pct = `${h.percentual_honorarios}%`.replace(".", ",");
    canonical["Percentual de Honorários"] = pct;
    canonical["Honorários Percentual"] = pct;
    canonical["% Honorários"] = pct;
    // Alinhamento (owner, 2026-07-21) — modelos de procuração usam "porcentagem"
    // / "porcentagem do êxito" para o mesmo % de honorários.
    canonical["Porcentagem"] = pct;
    canonical["Porcentagem do Êxito"] = pct;
  }
  if (h.valor_parcela_centavos != null) {
    const v = `R$ ${(h.valor_parcela_centavos / 100).toFixed(2).replace(".", ",")}`;
    canonical["Valor da Parcela"] = v;
    canonical["Parcela"] = v;
  }
  if (h.desconto_avista_pct != null) {
    const d = `${h.desconto_avista_pct}%`.replace(".", ",");
    canonical["Desconto à Vista"] = d;
    canonical["Desconto"] = d;
  }
  if (h.forma_pagamento) {
    canonical["Forma de Pagamento"] = h.forma_pagamento;
    canonical["Formas de Pagamento"] = h.forma_pagamento;
    canonical["Pagamento"] = h.forma_pagamento;
  }
  if (h.honorarios_total_centavos != null) {
    const t = `R$ ${(h.honorarios_total_centavos / 100).toFixed(2).replace(".", ",")}`;
    canonical["Total de Honorários"] = t;
    canonical["Honorários Total"] = t;
    canonical["Valor dos Honorários"] = t;
  }
  return { ...data, canonical };
}

/** Mescla dados dos responsáveis (advogados) do caso no AutoFillData. Puro.
 *  Injeta no canonical com rótulos PT para canonicalLookup. */
export function augmentWithResponsaveis(
  data: AutoFillData,
  responsaveis?: Array<{
    full_name: string | null;
    email: string;
    role: string;
  }> | null,
): AutoFillData {
  if (!responsaveis?.length) return data;
  const canonical = { ...(data.canonical ?? {}) };
  // Primeiro responsável = advogado principal
  const principal = responsaveis[0];
  if (principal.full_name) {
    canonical["Advogado"] = principal.full_name;
    canonical["Advogado Responsável"] = principal.full_name;
    canonical["Nome do Advogado"] = principal.full_name;
  }
  if (principal.email) {
    canonical["Email do Advogado"] = principal.email;
    canonical["E-mail do Advogado"] = principal.email;
  }
  // Todos os responsáveis juntos (para documentos que listam a equipe)
  const nomes = responsaveis.map((r) => r.full_name || r.email).filter(Boolean);
  if (nomes.length > 1) {
    canonical["Advogados"] = nomes.join(", ");
    canonical["Equipe Responsável"] = nomes.join(", ");
  }
  return { ...data, canonical };
}

function formatCep(cep?: string): string {
  const d = (cep ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (cep ?? "");
}

// Autofill E (owner, 2026-07-21) — DATA automática (data de emissão = hoje).
const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
function todayNumeric(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function todayExtenso(): string {
  const d = new Date();
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

// Monta o bloco "dados pessoais" completo (nome, nacionalidade, [estado civil],
// profissão, RG + órgão, CPF, endereço). O GÊNERO é inferido do próprio nome do
// placeholder: "dados pessoais DA médica" = feminino; "DO médico" = masculino.
// Tudo o que faltar no cadastro é simplesmente omitido — e o campo é editável.
function buildDadosPessoais(fieldKey: string, data: AutoFillData): string | undefined {
  if (!data.clientName) return undefined;
  const k = fieldKey.toLowerCase();
  const fem = /m[ée]dica/.test(k) || /\bda\b/.test(k);
  const g = (masc: string, fmn: string) => (fem ? fmn : masc);

  const parts: string[] = [data.clientName, g("brasileiro", "brasileira")];
  if (data.estadoCivil) parts.push(data.estadoCivil);
  parts.push(g("médico", "médica"));
  let s = parts.join(", ");
  if (data.rg) {
    s += `, portador${g("", "a")} da Cédula de Identidade/RG nº: ${data.rg}${
      data.rgOrgao ? ` ${data.rgOrgao}` : ""
    }`;
  }
  if (data.clientCpf) {
    s += `, inscrit${g("o", "a")} no CPF nº: ${formatCpfCnpj(data.clientCpf)}`;
  }
  if (data.enderecoCompleto) {
    s += `, residente e domiciliad${g("o", "a")} na ${data.enderecoCompleto}`;
    if (data.cep) s += `, CEP: ${data.cep}`;
  }
  return s;
}

/** Resolve o valor de um placeholder a partir dos dados do cliente/caso. */
export function resolveAutoValue(field: TemplateField, data: AutoFillData): string | undefined {
  // Try auto_field first (set by sync), then fall back to key-based heuristics
  const autoField = field.auto_field?.toLowerCase();
  if (autoField) {
    if (autoField === "client_name") return data.clientName;
    if (autoField === "cpf") return data.clientCpf ? formatCpfCnpj(data.clientCpf) : undefined;
    if (autoField === "municipio") return data.municipio;
    if (autoField === "email") return data.email;
    if (autoField === "phone" || autoField === "telefone") return data.phone;
    if (autoField === "crm" || autoField === "crm_numero") return data.crm_numero;
    if (autoField === "crm_uf") return data.crm_uf;
    if (autoField === "oab" || autoField === "oab_numero") return data.oab_numero;
    if (autoField === "oab_uf") return data.oab_uf;
    if (autoField === "especialidade") return data.especialidade;
    if (autoField === "vinculo_institucional") return data.vinculo_institucional;
    if (autoField === "case_code" || autoField === "codigo_caso") return data.caseCode;
    if (autoField === "responsavel") return data.responsavel;
    if (autoField === "cidade" || autoField === "city") return data.city;
    if (autoField === "estado" || autoField === "uf" || autoField === "state") return data.state;
    // "dados_pessoais" = bloco completo (nome, nacionalidade, RG, CPF, endereço)
    if (autoField === "dados_pessoais") {
      return buildDadosPessoais(field.key, data);
    }
    // Novos auto_fields — resolvem via canonical (rótulos PT injetados em
    // buildAutoFillFromClient). Se o canonical não resolver, tenta o campo direto.
    if (autoField === "rg") return data.rg ?? canonicalLookup("RG", data.canonical);
    if (autoField === "estado_civil")
      return data.estadoCivil ?? canonicalLookup("Estado Civil", data.canonical);
    if (autoField === "endereco")
      return data.enderecoCompleto ?? canonicalLookup("Endereço", data.canonical);
    if (autoField === "cep") return data.cep ?? canonicalLookup("CEP", data.canonical);
    if (autoField === "data_nascimento")
      return canonicalLookup("Data de Nascimento", data.canonical);
    if (autoField === "nacionalidade") return canonicalLookup("Nacionalidade", data.canonical);
    if (autoField === "orgao_expedidor")
      return data.rgOrgao ?? canonicalLookup("Órgão Expedidor", data.canonical);
    if (autoField === "bairro") return canonicalLookup("Bairro", data.canonical);
    if (autoField === "logradouro") return canonicalLookup("Rua", data.canonical);
  }

  // Fallback: match by key content (for manually created templates)
  const key = field.key.toLowerCase();
  const label = (field.label ?? "").toLowerCase();
  const match = (patterns: RegExp) => patterns.test(key) || patterns.test(label);

  if (/\bdados pessoais\b/.test(key)) {
    return buildDadosPessoais(field.key, data);
  }
  // Nome do cliente / médico / profissional → sempre é o nome do cliente
  if (
    match(
      /\b(nome.*cliente|nome.*m[eé]dico|client.*name|nome.*profissional|nome_cliente|nome_do_cliente|nome_medico)\b/,
    ) ||
    key === "nome" ||
    key === "client_name"
  )
    return data.clientName;
  if (match(/\b(cpf|cpf_cnpj|documento)\b/))
    return data.clientCpf ? formatCpfCnpj(data.clientCpf) : undefined;
  if (match(/\bmunic[ií]pio\b/)) return data.municipio;
  if (match(/\be[-_]?mail\b/)) return data.email;
  if (match(/\b(telefone|phone|celular|fone)\b/)) return data.phone;
  if (match(/\b(crm_uf|uf.*crm)\b/)) return data.crm_uf;
  if (match(/\bcrm\b/) && !match(/\buf\b/)) return data.crm_numero;
  if (match(/\b(oab_uf|uf.*oab)\b/)) return data.oab_uf;
  if (match(/\boab\b/) && !match(/\buf\b/)) return data.oab_numero;
  if (match(/\bespecialidade\b/)) return data.especialidade;
  if (match(/\bv[ií]nculo\b/)) return data.vinculo_institucional;
  if (match(/\b(c[oó]digo.*caso|case.*code|numero.*caso)\b/)) return data.caseCode;
  if (match(/\brespons[aá]vel\b/)) return data.responsavel;
  if (match(/\b(cidade|city)\b/)) return data.city;
  if (key === "uf" || key === "estado" || key === "state") return data.state;

  const canon = () => canonicalLookup(field.key, data.canonical);

  // Autofill D (R5-08) — aliases de saúde (Unidade/Posto/UBS, CBO, CNES).
  // Resolve ANTES do fallback genérico: campos que variam por caso/vínculo e cuja
  // redação no modelo raramente bate exatamente com o rótulo do campo canônico.
  // NUNCA emite o token literal — só devolve o valor do canonical, ou undefined.
  const alias = canonicalAliasLookup(field.key, field.label ?? "", data.canonical);
  if (alias !== undefined) return alias;

  // Autofill B — dados do município (tabela). Fallback: campo canônico do caso.
  if (match(/\bpopula[cç][aã]o\b/) && !match(/percentual/)) return data.populacao ?? canon();
  if (match(/\bdensidade\b/)) return data.densidade ?? canon();
  if (match(/\bsal[aá]rio\b/)) return data.salarioMedio ?? canon();
  if (match(/\bpercentual\b/)) return data.percentual ?? canon();
  if (match(/\bibge\b/)) return data.ibge ?? canon();
  if (match(/\bcargo\b/) && match(/secret/)) return data.secretarioCargo ?? canon();
  if (match(/secret[aá]rio/)) return data.secretario ?? canon();
  // Autofill C — perfil (tabela).
  if (match(/informa[cç][oõ]es sobre o perfil/)) return data.perfilTexto ?? canon();
  if (match(/\bperfil\b/)) return data.numeroPerfil ?? canon();

  // Autofill E (owner, 2026-07-21) — DATA de emissão = hoje. SÓ placeholders de
  // data "genérica" (assinatura do documento). Datas específicas do caso ("data da
  // parcela", "data de retorno", "data_assinatura_fies") têm normKey diferente de
  // "data" e NÃO são tocadas. Se o caso já gravou uma data canônica com esse nome,
  // ela prevalece (canon() antes de cair no hoje).
  const nkData = normKey(field.key);
  if (nkData === "data") return canon() ?? todayNumeric();
  if (nkData === "data extenso" || nkData === "data por extenso") return canon() ?? todayExtenso();
  if (nkData === "local e data") {
    const canonVal = canon();
    if (canonVal) return canonVal;
    const local = data.city || data.municipio;
    return local ? `${local}, ${todayExtenso()}` : todayExtenso();
  }

  // Autofill D — qualquer outro placeholder casa com um campo canônico do caso
  // (UBS, CNES, período de vínculo, período trabalhado, carga horária, unidade…).
  return canon();
}

/** Monta o AutoFillData a partir de um registro de cliente + dados do caso. */
export function buildAutoFillFromClient(
  client: {
    full_name?: string | null;
    cpf_cnpj?: string | null;
    rg?: string | null;
    email?: string | null;
    phone?: string | null;
    birth_date?: string | null;
    person_type?: string | null;
    address?: unknown;
    professional_data?: unknown;
    custom_fields?: unknown;
  },
  caso?: {
    municipio?: string | null;
    case_code?: string | null;
    case_type?: string | null;
    responsavel?: string | null;
    canonical_fields?: unknown;
  },
): AutoFillData {
  const addr = (client.address ?? {}) as Record<string, unknown>;
  const prof = (client.professional_data ?? {}) as Record<string, unknown>;
  const pick = (o: Record<string, unknown>, k: string) =>
    typeof o[k] === "string" && o[k] ? (o[k] as string) : undefined;

  // Autofill D — campos canônicos do caso (nome do campo → valor string).
  const canonRaw = (caso?.canonical_fields ?? {}) as Record<string, unknown>;
  const canonical: Record<string, string> = {};
  for (const [k, v] of Object.entries(canonRaw)) {
    if (typeof v === "string" && v) canonical[k] = v;
    else if (typeof v === "number") canonical[k] = String(v);
    // 2026-07-29 — boolean (Sim/Não) e ARRAY (múltipla escolha / múltiplas
    // ocorrências #6) também alimentam os placeholders do Word; antes eram
    // silenciosamente descartados. Array vira lista "a, b, c".
    else if (typeof v === "boolean") canonical[k] = v ? "Sim" : "Não";
    else if (Array.isArray(v)) {
      const joined = v
        .map((x) => String(x).trim())
        .filter(Boolean)
        .join(", ");
      if (joined) canonical[k] = joined;
    }
  }

  // R5-06 (A2) — expõe os campos FIES também sob RÓTULO amigável, para casar com
  // placeholders humanos ("Instituição Financeira", "Situação", "Ano do
  // contrato", "Valor"). O canonicalLookup casa por nome normalizado, e as chaves
  // técnicas (fies_*) não bateriam sozinhas. O valor monetário (centavos) é
  // formatado em R$ para o documento.
  for (const def of FIES_FIELD_DEFS) {
    const raw = canonRaw[def.key];
    if (raw === null || raw === undefined || raw === "") continue;
    if (def.key === FIES_KEY_VALOR_CENTAVOS) {
      const cents = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      if (Number.isFinite(cents)) {
        canonical[def.label] = `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
      }
      continue;
    }
    canonical[def.label] = String(raw);
  }

  // R1-05 (N2) — expõe os campos de VÍNCULO do CASO (chaves técnicas vinculo_*)
  // também sob RÓTULO amigável, para casar com placeholders humanos ("Vínculo
  // empregatício/institucional", "Papel da pessoa no caso"). O canonicalLookup
  // casa por nome normalizado; as chaves técnicas não bateriam sozinhas. O
  // vínculo é do CASO (canonical_fields), independente por caso.
  for (const def of VINCULO_FIELD_DEFS) {
    const raw = canonRaw[def.key];
    if (raw === null || raw === undefined || raw === "") continue;
    canonical[def.label] = String(raw);
  }

  // -------------------------------------------------------------------------
  // DADOS DO CLIENTE expostos com rótulos em PORTUGUÊS no canonical.
  // O canonicalLookup no final de resolveAutoValue casa por nome normalizado,
  // então qualquer placeholder no documento escrito em português
  // (ex.: <RG>, <estado civil>, <endereço>) resolve automaticamente.
  // -------------------------------------------------------------------------

  // Dados base
  if (client.full_name) {
    canonical["Nome"] = client.full_name;
    canonical["Nome Completo"] = client.full_name;
    canonical["Nome do Cliente"] = client.full_name;
    canonical["Nome do Médico"] = client.full_name;
    canonical["Nome do Profissional"] = client.full_name;
  }
  if (client.cpf_cnpj) {
    canonical["CPF"] = formatCpfCnpj(client.cpf_cnpj);
    canonical["CPF/CNPJ"] = formatCpfCnpj(client.cpf_cnpj);
    canonical["Documento"] = formatCpfCnpj(client.cpf_cnpj);
  }
  if (client.email) {
    canonical["E-mail"] = client.email;
    canonical["Email"] = client.email;
  }
  if (client.phone) {
    canonical["Telefone"] = client.phone;
    canonical["Celular"] = client.phone;
    canonical["Fone"] = client.phone;
  }
  if (client.rg) {
    canonical["RG"] = client.rg;
    canonical["Identidade"] = client.rg;
  }

  // Tipo de pessoa
  if (client.person_type) {
    canonical["Tipo de Pessoa"] = client.person_type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física";
  }

  // Data de nascimento
  if (client.birth_date) {
    // Formata ISO (YYYY-MM-DD) → DD/MM/YYYY
    const [y, m, d] = client.birth_date.split("-");
    const formatted = d && m && y ? `${d}/${m}/${y}` : client.birth_date;
    canonical["Data de Nascimento"] = formatted;
    canonical["Nascimento"] = formatted;
  }

  // Dados profissionais
  const estadoCivil = pick(prof, "estado_civil");
  const rgOrgao = pick(prof, "rg_orgao");
  const crm = pick(prof, "crm_numero");
  const crmUf = pick(prof, "crm_uf");
  const oab = pick(prof, "oab_numero");
  const oabUf = pick(prof, "oab_uf");
  const espec = pick(prof, "especialidade");
  const vincInst = pick(prof, "vinculo_institucional");

  if (estadoCivil) canonical["Estado Civil"] = estadoCivil;
  if (rgOrgao) {
    canonical["Órgão Expedidor"] = rgOrgao;
    canonical["Orgão Expedidor"] = rgOrgao; // sem acento
    canonical["RG Órgão"] = rgOrgao;
  }
  if (crm) canonical["CRM"] = crm;
  if (crmUf) canonical["CRM UF"] = crmUf;
  if (crm && crmUf) canonical["CRM Completo"] = `${crm}/${crmUf}`;
  if (oab) canonical["OAB"] = oab;
  if (oabUf) canonical["OAB UF"] = oabUf;
  if (oab && oabUf) canonical["OAB Completo"] = `${oab}/${oabUf}`;
  canonical["Especialidade"] = espec || "Sem especialidade";
  if (vincInst) canonical["Vínculo Institucional"] = vincInst;

  // Campos extras do professional_data (graduação, residência)
  const instGrad = pick(prof, "instituicao_graduacao");
  const anoForm = pick(prof, "ano_formatura");
  const resHosp = pick(prof, "residencia_hospital");
  const resInicio = pick(prof, "residencia_inicio");
  const resTermino = pick(prof, "residencia_termino");
  const resEspec = pick(prof, "residencia_especialidade");
  const observacoes = pick(prof, "observacoes");

  if (instGrad) {
    canonical["Instituição de Graduação"] = instGrad;
    canonical["Universidade"] = instGrad;
    canonical["Faculdade"] = instGrad;
  }
  if (anoForm) {
    canonical["Ano de Formatura"] = anoForm;
    canonical["Formatura"] = anoForm;
  }
  canonical["Hospital da Residência"] = resHosp || "Sem residência";
  canonical["Residência Hospital"] = resHosp || "Sem residência";
  if (resInicio) {
    canonical["Início da Residência"] = resInicio;
    canonical["Residência Início"] = resInicio;
  }
  if (resTermino) {
    canonical["Término da Residência"] = resTermino;
    canonical["Residência Término"] = resTermino;
  }
  canonical["Especialidade da Residência"] = resEspec || "Sem residência";
  canonical["Residência Especialidade"] = resEspec || "Sem residência";
  if (observacoes) canonical["Observações"] = observacoes;

  // Endereço — componentes individuais + completo
  const street = pick(addr, "street");
  const number = pick(addr, "number");
  const complement = pick(addr, "complement");
  const neighborhood = pick(addr, "neighborhood");
  const addrCity = pick(addr, "city");
  const addrState = pick(addr, "state");
  const zipcode = pick(addr, "zipcode");

  if (street) {
    canonical["Rua"] = street;
    canonical["Logradouro"] = street;
  }
  if (number) canonical["Número"] = number;
  if (complement) canonical["Complemento"] = complement;
  if (neighborhood) {
    canonical["Bairro"] = neighborhood;
  }
  if (addrCity) canonical["Cidade"] = addrCity;
  if (addrState) {
    canonical["Estado"] = addrState;
    canonical["UF"] = addrState;
  }
  if (zipcode) {
    canonical["CEP"] = formatCep(zipcode);
    canonical["Código Postal"] = formatCep(zipcode);
  }

  const endParts = [
    street ? (number ? `${street}, nº ${number}` : street) : undefined,
    complement,
    neighborhood,
    addrCity ? (addrState ? `${addrCity} - ${addrState}` : addrCity) : undefined,
  ].filter(Boolean) as string[];

  if (endParts.length) {
    canonical["Endereço"] = endParts.join(", ");
    canonical["Endereço Completo"] = endParts.join(", ");
  }

  // Nacionalidade — hardcoded (não há campo no cadastro, mas é comum em docs).
  canonical["Nacionalidade"] = "brasileiro(a)";

  // Dados do CASO
  if (caso?.municipio) {
    canonical["Município"] = caso.municipio;
  }
  if (caso?.case_code) {
    canonical["Código do Caso"] = caso.case_code;
    canonical["Número do Caso"] = caso.case_code;
  }
  if (caso?.case_type) {
    canonical["Tipo do Caso"] = caso.case_type;
  }
  if (caso?.responsavel) {
    canonical["Responsável"] = caso.responsavel;
  }

  // Custom fields do cliente — expostos com as chaves originais (já em PT).
  const customRaw = (client.custom_fields ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(customRaw)) {
    if (typeof v === "string" && v) canonical[k] = v;
    else if (typeof v === "number") canonical[k] = String(v);
    else if (typeof v === "boolean") canonical[k] = v ? "Sim" : "Não";
    // Campo de tema scope='cliente' com múltipla escolha/ocorrências → array.
    else if (Array.isArray(v)) {
      const joined = v
        .map((x) => String(x).trim())
        .filter(Boolean)
        .join(", ");
      if (joined) canonical[k] = joined;
    }
  }

  return {
    clientName: client.full_name ?? undefined,
    clientCpf: client.cpf_cnpj ?? undefined,
    municipio: caso?.municipio ?? undefined,
    email: client.email ?? undefined,
    phone: client.phone ?? undefined,
    city: addrCity,
    state: addrState,
    crm_numero: crm,
    crm_uf: crmUf,
    oab_numero: oab,
    oab_uf: oabUf,
    especialidade: espec,
    vinculo_institucional: vincInst,
    caseCode: caso?.case_code ?? undefined,
    responsavel: caso?.responsavel ?? undefined,
    // Autofill do bloco "dados pessoais".
    rg: client.rg ?? undefined,
    rgOrgao,
    estadoCivil,
    enderecoCompleto: endParts.length ? endParts.join(", ") : undefined,
    cep: zipcode ? formatCep(zipcode) : undefined,
    canonical: Object.keys(canonical).length ? canonical : undefined,
  };
}

/** Resolve todos os placeholders auto-preenchíveis em um mapa key→value. */
export function buildAutoFillValues(
  fields: TemplateField[],
  data: AutoFillData,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.source === "blank") continue;
    const v = resolveAutoValue(f, data);
    if (v) out[f.key] = v;
  }
  return out;
}
