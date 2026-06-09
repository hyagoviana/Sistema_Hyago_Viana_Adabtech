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
