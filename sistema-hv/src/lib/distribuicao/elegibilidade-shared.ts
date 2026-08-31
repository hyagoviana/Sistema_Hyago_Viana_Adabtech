// "Esta pessoa recebe tarefa do motor?" — em UM lugar só.
//
// REUNIÃO 31/08. O Thiago, sobre a tela de cadastro: "ficou muito complexo essas
// opções aqui, tá redundante (…) a gente tem que marcar se tá aqui peticionante,
// se entra na lista, e aí aqui também tem outra coisa que muda". E foi justamente
// uma dessas caixinhas que deixou o Hudson sem receber nada por dias — ninguém
// percebeu porque a resposta exigia conferir CINCO campos, em DUAS telas.
//
// Este módulo não muda regra nenhuma: ele apenas LÊ as mesmas condições que o
// motor já aplica hoje (`sync-core.ts` → filtro de executores + getEligibleExecutors)
// e devolve a resposta pronta, com o motivo. As telas passam a mostrar o
// resultado em vez de obrigar a pessoa a simular a combinação de cabeça.
//
// ⚠️ Se a regra do motor mudar, muda aqui junto — é uma cópia declarada da
// condição, não a condição em si. As duas ficam lado a lado no comentário abaixo
// exatamente para essa conferência ser possível.
//
// Módulo PURO (sem imports): roda no cliente e no servidor. Importar o serviço
// levaria código de servidor para o bundle e o import-protection derruba o build.

/** O que o motor exige, campo a campo. Espelha `sync-core.ts` linhas ~371 e ~450. */
export type DadosElegibilidade = {
  /** `system_users.status` — só ACTIVE distribui. */
  status?: string | null;
  /** `system_users.peticionante` — sem isto, fora do motor por completo. */
  peticionante?: boolean | null;
  /** `system_users.participa_distribuicao_padrao` — entra na fila ordinária. */
  participaGeral?: boolean | null;
  /** `system_projuris_executor_mapping.active` — o vínculo com o ProJuris. */
  vinculoAtivo?: boolean | null;
  /** `system_projuris_executor_mapping.weight` — 0 tira da fila ordinária. */
  peso?: number | null;
};

export type ResultadoElegibilidade = {
  /** Recebe pela fila ordinária (o caso normal). */
  recebeNaFila: boolean;
  /** Está no motor, mas só recebe quando é executor exclusivo de um tipo/tema. */
  soPorExcecao: boolean;
  /** Frase curta para o selo: "Recebe tarefas", "Só por exceção", "Fora do motor". */
  rotulo: string;
  /** O que falta, em português, para quem está fora. Vazio quando recebe. */
  pendencias: string[];
};

/**
 * Diagnostica a participação de uma pessoa no motor.
 *
 * A ordem das checagens é a mesma do motor:
 *   1. usuário ACTIVE          (sync-core: `u.status === "ACTIVE"`)
 *   2. peticionante            (sync-core: `u.peticionante === true`)
 *   3. vínculo ativo           (sync-core: consulta filtra `.eq("active", true)`)
 *   4. fila ordinária          (sync-core: `general_weight = participa ? weight : 0`
 *                               + responsible-engine: `general_weight <= 0` reprova)
 *
 * Falhar 1, 2 ou 3 = fora do motor. Passar nas três e falhar a 4 = só por exceção.
 */
export function diagnosticarElegibilidade(d: DadosElegibilidade): ResultadoElegibilidade {
  const pendencias: string[] = [];

  if ((d.status ?? "").toUpperCase() !== "ACTIVE") {
    pendencias.push("o acesso da pessoa não está ativo");
  }
  if (d.peticionante !== true) {
    pendencias.push('a chave "Peticionante" está desligada');
  }
  if (d.vinculoAtivo !== true) {
    pendencias.push('a chave "Vínculo com o ProJuris ativo" está desligada');
  }

  // Bloqueios acima tiram do motor inteiro — nem por exceção a pessoa recebe.
  if (pendencias.length > 0) {
    return { recebeNaFila: false, soPorExcecao: false, rotulo: "Fora do motor", pendencias };
  }

  const peso = d.peso ?? 100;
  const naFila = d.participaGeral === true && peso > 0;
  if (naFila) {
    return { recebeNaFila: true, soPorExcecao: false, rotulo: "Recebe tarefas", pendencias: [] };
  }

  // Passou nas três primeiras, mas está fora da fila ordinária.
  const motivo =
    d.participaGeral !== true
      ? 'a chave "Entra na fila ordinária" está desligada'
      : "o peso na fila está em 0";
  return {
    recebeNaFila: false,
    soPorExcecao: true,
    rotulo: "Só por exceção",
    pendencias: [motivo],
  };
}

/** Uma frase pronta para o selo/tooltip, já com o motivo quando houver. */
export function textoElegibilidade(r: ResultadoElegibilidade): string {
  if (r.recebeNaFila) return "Recebe tarefas na distribuição normal.";
  if (r.soPorExcecao) {
    return `Só recebe quando é executor exclusivo de um tipo ou tema — ${r.pendencias[0]}.`;
  }
  return `Não recebe tarefa nenhuma porque ${r.pendencias.join(", ")}.`;
}
