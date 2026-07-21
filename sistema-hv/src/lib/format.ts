// Formatação de documentos (CPF/CNPJ) para inputs e exibição.
// Diferente de mocks/fixtures.maskCPF (que OCULTA dígitos) — aqui formatamos
// com pontuação padrão para o usuário digitar e ler.

export function onlyDigits(value: string): string {
  return (value ?? "").replace(/\D+/g, "");
}

/**
 * Formata progressivamente como CPF (000.000.000-00) até 11 dígitos,
 * ou como CNPJ (00.000.000/0000-00) a partir de 12 dígitos.
 * Aceita entrada parcial — pontua conforme o usuário digita.
 */
export function formatCpfCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);

  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/** Heurística: o campo (por key ou label) representa um CPF/CNPJ? */
export function isCpfCnpjField(...candidates: Array<string | undefined>): boolean {
  return candidates.some((c) => /\bcpf\b|\bcnpj\b|cpf_cnpj|cpfcnpj/i.test(c ?? ""));
}

/**
 * Formata progressivamente como telefone BR: (82) 9999-9999 (fixo, 10 díg.) ou
 * (82) 99999-9999 (celular, 11 díg.). Pontua conforme o usuário digita.
 */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/^\((\d{2})\)\s(\d{4})(\d)/, "($1) $2-$3");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/^\((\d{2})\)\s(\d{5})(\d)/, "($1) $2-$3");
}

/**
 * Máscara de valor monetário em BRL tratando a entrada como REAIS.
 * O usuário digita só números (opcionalmente vírgula p/ centavos) e o campo
 * formata no padrão BR: "20000" → "20.000", "200" → "200", "20000,5" → "20.000,5".
 * A parte inteira ganha separador de milhar; a decimal (após vírgula) é
 * preservada com até 2 casas enquanto o usuário digita.
 */
export function maskBrlReais(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^\d,]/g, "");
  const [intRaw, decRaw] = cleaned.split(",");
  const intNum = intRaw ? parseInt(intRaw, 10) : 0;
  const intFmt = intNum.toLocaleString("pt-BR");
  if (decRaw === undefined) return intFmt; // digitando o inteiro
  return `${intFmt},${decRaw.slice(0, 2)}`;
}

/**
 * Normaliza um valor mascarado para SEMPRE ter 2 casas decimais (usado no onBlur).
 * Ex.: "20.000" → "20.000,00"; "200,5" → "200,50"; "" → "".
 */
export function normalizeBrl(raw: string): string {
  const s = (raw ?? "").trim();
  if (s === "") return "";
  const cleaned = s.replace(/[^\d,]/g, "");
  const [intRaw, decRaw = ""] = cleaned.split(",");
  const intNum = intRaw ? parseInt(intRaw, 10) : 0;
  const intFmt = intNum.toLocaleString("pt-BR");
  const dec = (decRaw + "00").slice(0, 2);
  return `${intFmt},${dec}`;
}

/**
 * Máscara de PERCENTUAL no padrão BR (vírgula decimal). Diferente de maskBrlReais,
 * NÃO aplica separador de milhar (percentuais são pequenos). O usuário digita
 * "100" → "100"; "100,5" → "100,5". Preserva até 2 casas após a vírgula enquanto digita.
 */
export function maskPercentBr(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^\d,]/g, "");
  const [intRaw, decRaw] = cleaned.split(",");
  const intPart = intRaw ?? "";
  if (decRaw === undefined) return intPart; // digitando o inteiro
  return `${intPart},${decRaw.slice(0, 2)}`;
}

/**
 * Normaliza um percentual mascarado para SEMPRE ter 2 casas decimais (onBlur).
 * Ex.: "100" → "100,00"; "100,5" → "100,50"; "" → "".
 */
export function normalizePercentBr(raw: string): string {
  const s = (raw ?? "").trim();
  if (s === "") return "";
  const cleaned = s.replace(/[^\d,]/g, "");
  const [intRaw, decRaw = ""] = cleaned.split(",");
  const intPart = intRaw === "" ? "0" : intRaw;
  const dec = (decRaw + "00").slice(0, 2);
  return `${intPart},${dec}`;
}

/** Formata progressivamente como CEP: 57000-000 (8 dígitos). */
export function formatCep(value: string): string {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

/**
 * Formata progressivamente como RG no padrão mais comum: 12.345.678-9.
 * Aceita o dígito verificador "X" (maiúsculo). RG varia por estado — esta é a
 * máscara usual (2.3.3-1); os 9 primeiros caracteres ganham a pontuação usual e
 * o excedente (RGs com mais de 9 caracteres, por variação de UF) é preservado
 * legível ao final. NUNCA trunca dígitos digitados — a máscara é só apresentação.
 */
export function formatRg(value: string): string {
  const clean = (value ?? "")
    .toUpperCase()
    .replace(/[^0-9X]/g, "")
    .slice(0, 12);
  const head = clean.slice(0, 9);
  const tail = clean.slice(9); // excedente além do 9º caractere (não descartar)
  const masked = head
    .replace(/^([0-9X]{2})([0-9X])/, "$1.$2")
    .replace(/^([0-9X]{2})\.([0-9X]{3})([0-9X])/, "$1.$2.$3")
    .replace(/^([0-9X]{2})\.([0-9X]{3})\.([0-9X]{3})([0-9X])/, "$1.$2.$3-$4");
  return masked + tail;
}

/**
 * Sanitiza a DIGITAÇÃO de RG sem reformatar a cada tecla. Mantém dígitos, o
 * verificador "X" e os separadores usuais (. e -), com um limite generoso.
 * Usar no onChange e deixar `formatRg` só para o onBlur — assim o campo controlado
 * não reposiciona o cursor nem "perde" um dígito durante a digitação rápida
 * (bug relatado: "não consigo digitar o número no todo"). RG varia por estado.
 */
export function sanitizeRgTyping(value: string): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^0-9X.-]/g, "")
    .slice(0, 15);
}
