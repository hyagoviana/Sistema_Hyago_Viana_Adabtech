// Doc 31.08 (Thiago) — ORDEM dos cards dentro de cada coluna do kanban.
//
//   "Essa tela está desordenada. A ordem de visualização dos casos em cada coluna
//    muda sempre. Sugiro definirmos a ordem seguir a data e horário de ingresso
//    do caso na lista (ordem de inserção do caso na etapa)."
//
// Por que "mudava sempre": a consulta ordenava por `created_at`, e os casos
// importados em lote têm created_at praticamente idêntico. Com empate, o Postgres
// não garante ordem nenhuma entre execuções — daí o embaralhamento a cada refresh.
//
// A correção tem duas partes, e as duas importam:
//   1. ordenar pelo carimbo de ENTRADA NA ETAPA (não pela criação do caso);
//   2. desempatar por `id`, para que a ordem seja ESTÁVEL mesmo com carimbos iguais.
//
// Módulo puro (sem servidor): roda no cliente, depois dos filtros da tela.

/** Carimbo de entrada na etapa, conforme o kanban de onde o card é visto. */
export type KanbanKind = "op" | "fin" | "board";

type Ordenavel = {
  id: string;
  status_changed_at?: string | null;
  status_fin_changed_at?: string | null;
  board_entered_at?: string | null;
  created_at?: string | null;
};

function entradaNaEtapa(c: Ordenavel, kind: KanbanKind): string {
  const carimbo =
    kind === "fin"
      ? c.status_fin_changed_at
      : kind === "board"
        ? c.board_entered_at
        : c.status_changed_at;
  // Sem carimbo (dado antigo), cai para a criação do caso — melhor que aleatório.
  return carimbo ?? c.created_at ?? "";
}

/**
 * Ordena os cards por ordem de ingresso na etapa (mais antigo primeiro: quem
 * está parado há mais tempo aparece no topo), com desempate estável por id.
 * Não muta o array recebido.
 */
export function ordenarPorEntradaNaEtapa<T extends Ordenavel>(cases: T[], kind: KanbanKind): T[] {
  return [...cases].sort((a, b) => {
    const ea = entradaNaEtapa(a, kind);
    const eb = entradaNaEtapa(b, kind);
    if (ea !== eb) return ea < eb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
