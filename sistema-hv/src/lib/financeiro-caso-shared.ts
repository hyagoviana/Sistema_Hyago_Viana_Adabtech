// Vocabulário do FINANCEIRO DO CASO (FN1) — doc "25.08 _ Financeiro SHV".
//
// Módulo PURO (sem imports, sem efeitos): a UI e o servidor leem daqui. Mesma
// razão documentada em `task-types-shared.ts` — uma rota importando do serviço
// levaria código de servidor para o bundle do cliente e o build cai.

export const FIN_KINDS = ["RECEITA", "DESPESA"] as const;
export type FinKind = (typeof FIN_KINDS)[number];

/** Tipos de RECEITA (mapa "CLASSIFICAÇÕES E CAMPOS" do doc). */
export const TIPOS_RECEITA = [
  "ENTRADA",
  "EXITO",
  "RESCISAO",
  "CONSULTA_PARECER",
  "RECUPERADOS_ACORDO_RENEGOCIACAO",
  "REEMBOLSO_CUSTAS",
  "REEMBOLSO_DILIGENCIAS",
  "REEMBOLSO_OUTRAS",
] as const;

/** Tipos de DESPESA (o doc lista só estes dois). */
export const TIPOS_DESPESA = ["CUSTAS_TAXAS_EMOLUMENTOS", "DILIGENCIAS"] as const;

export type TipoReceita = (typeof TIPOS_RECEITA)[number];
export type TipoDespesa = (typeof TIPOS_DESPESA)[number];
export type FinTipo = TipoReceita | TipoDespesa;

export const FIN_TIPO_LABEL: Record<FinTipo, string> = {
  ENTRADA: "Entrada",
  EXITO: "Êxito",
  RESCISAO: "Rescisão",
  CONSULTA_PARECER: "Consulta / Parecer",
  RECUPERADOS_ACORDO_RENEGOCIACAO: "Recuperados / Acordo / Renegociação",
  REEMBOLSO_CUSTAS: "Reembolso de custas, taxas e emolumentos",
  REEMBOLSO_DILIGENCIAS: "Reembolso de diligências",
  REEMBOLSO_OUTRAS: "Reembolso de outras despesas",
  CUSTAS_TAXAS_EMOLUMENTOS: "Custas processuais, taxas e emolumentos",
  DILIGENCIAS: "Diligências",
};

/**
 * Status do lançamento NO SHV (não é o status no ContaAzul).
 *
 *  AGUARDANDO — registrado aqui, ainda não foi ao ERP. É o estado que dá sentido
 *               ao módulo: "valores que temos que pagar/receber sejam
 *               visualizados, sem necessariamente ter que estar no sistema, em
 *               razão de uma especificidade da advocacia" (Thiago).
 *  DISPENSADO — decidiu-se que não vai ao ERP (a hipótese futura não se confirmou).
 *  LANCADO    — existe no ContaAzul.
 */
export const FIN_STATUSES = ["AGUARDANDO", "DISPENSADO", "LANCADO"] as const;
export type FinStatus = (typeof FIN_STATUSES)[number];

export const FIN_STATUS_LABEL: Record<FinStatus, string> = {
  AGUARDANDO: "Aguardando",
  DISPENSADO: "Dispensado",
  LANCADO: "Lançado",
};

/** Status de cada PARCELA. */
export const PARCELA_STATUSES = ["AGUARDANDO", "VENCIDA", "PAGA", "CANCELADA"] as const;
export type ParcelaStatus = (typeof PARCELA_STATUSES)[number];

export const PARCELA_STATUS_LABEL: Record<ParcelaStatus, string> = {
  AGUARDANDO: "Aguardando vencimento",
  VENCIDA: "Em atraso",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};

export function tipoLabel(tipo: string): string {
  return FIN_TIPO_LABEL[tipo as FinTipo] ?? tipo;
}

export function tiposDoKind(kind: FinKind): readonly string[] {
  return kind === "RECEITA" ? TIPOS_RECEITA : TIPOS_DESPESA;
}

/**
 * Descrição padronizada da DESPESA, no formato exato do doc:
 *   {Tipo da despesa}: caso {tema} - {Nome cliente}
 */
export function descricaoPadraoDespesa(
  tipo: string,
  tema: string | null | undefined,
  cliente: string | null | undefined,
): string {
  return `${tipoLabel(tipo)}: caso ${tema?.trim() || "—"} - ${cliente?.trim() || "—"}`;
}

/**
 * Divide um valor em N parcelas SEM perder centavo: a diferença da divisão
 * inteira vai toda para a primeira parcela. Somar as parcelas devolve o total.
 */
export function dividirEmParcelas(totalCentavos: number, parcelas: number): number[] {
  const n = Math.max(1, Math.floor(parcelas));
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + resto : base));
}

/** Soma meses a uma data ISO (YYYY-MM-DD) preservando o fim de mês. */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(a, (m ?? 1) - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + meses);
  // Dia 31 em mês de 30 vira o último dia do mês — nunca "pula" para o mês seguinte.
  const ultimoDia = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate();
  base.setUTCDate(Math.min(d ?? 1, ultimoDia));
  return base.toISOString().slice(0, 10);
}
