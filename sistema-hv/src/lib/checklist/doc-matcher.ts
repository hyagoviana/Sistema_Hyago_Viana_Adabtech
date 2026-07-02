// Matcher PARAMETRIZÁVEL nome-de-arquivo → item de checklist (S2-06).
//
// ⚠ A CONVENÇÃO DE NOMES DOS ARQUIVOS AINDA VIRÁ DO OWNER. Enquanto isso:
//   - o auto-check fica DESLIGADO por padrão (flag AUTO_CHECK_DRIVE_ENABLED);
//   - a regra de matching é isolada aqui, SEM regra fixa hardcoded de negócio.
//
// A interface `matchDocPattern(fileName, expectedDocPattern)` é o único ponto que
// precisa mudar quando a convenção chegar. A implementação atual é um matcher
// genérico e conservador (glob simples + substring case-insensitive), útil só para
// testes; não representa a convenção real do escritório.

/** Liga/desliga o auto-check de sugestão por upload. Default: DESLIGADO. */
export function isAutoCheckEnabled(): boolean {
  return (process.env.AUTO_CHECK_DRIVE_ENABLED ?? "").toLowerCase() === "true";
}

/**
 * Avalia se o nome do arquivo casa com o padrão esperado de um item de checklist.
 *
 * `expectedDocPattern` suporta (provisoriamente, até a convenção do owner):
 *   - `*` como curinga (glob simples), ex.: "procuracao_*.pdf";
 *   - caso não haja `*`, faz match por SUBSTRING case-insensitive.
 *
 * TODO(owner): substituir por regra real quando a convenção de nomes chegar.
 * Nada aqui deve marcar item done — só sugere (ver checklist-service).
 */
export function matchDocPattern(
  fileName: string | null | undefined,
  expectedDocPattern: string | null | undefined,
): boolean {
  if (!fileName || !expectedDocPattern) return false;
  const name = fileName.trim().toLowerCase();
  const pattern = expectedDocPattern.trim().toLowerCase();
  if (!name || !pattern) return false;

  if (pattern.includes("*")) {
    // Glob simples: escapa regex e troca '*' por '.*'.
    const escaped = pattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    try {
      return new RegExp(`^${escaped}$`).test(name);
    } catch {
      return false;
    }
  }

  return name.includes(pattern);
}
