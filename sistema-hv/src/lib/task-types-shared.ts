// Constantes e tipos do catálogo de TIPOS DE TAREFA que a interface também usa.
//
// Por que este arquivo existe separado de `task-types-service.ts`:
// o serviço importa `auth-guard`, que importa `@tanstack/react-start/server`. O
// import-protection do TanStack Start barra qualquer caminho que leve código de
// servidor para o bundle do cliente — e uma ROTA importando daqui cria justamente
// esse caminho, mesmo que só queira uma constante (o import puxa o módulo inteiro).
//
// Este módulo é PURO: sem imports, sem efeitos. Pode ser usado dos dois lados.
// Mesma armadilha já documentada no projeto quando `src/server/` virou `src/rpc/`.

/** Classes internas do SHV (doc 21.08) — NÃO confundir com a "Classificação" do ProJuris. */
export const TASK_TYPE_CLASSES = [
  "JUDICIAL",
  "ADMINISTRATIVO",
  "COMERCIAL",
  "FINANCEIRO",
] as const;

export type TaskTypeClasse = (typeof TASK_TYPE_CLASSES)[number];

export const TASK_TYPE_CLASSE_LABEL: Record<TaskTypeClasse, string> = {
  JUDICIAL: "Judicial",
  ADMINISTRATIVO: "Administrativo",
  COMERCIAL: "Comercial",
  FINANCEIRO: "Financeiro",
};

/** Filtro de estado da listagem (doc 21.08: "ativos / arquivados / todos"). */
export type TaskTypeEstado = "ativos" | "arquivados" | "todos";

export interface TaskTypeThemeExclusive {
  id: string;
  task_type_id: string;
  tema_id: string;
  executor_id: string;
}

export interface TaskType {
  id: string;
  nome: string;
  classe: TaskTypeClasse | null;
  points: number;
  complexity_level: number;
  temporal_level: number;
  prazo_previsto_dias: number | null;
  prazo_fatal_dias: number | null;
  aparece_no_motor: boolean;
  sync_projuris: boolean;
  active: boolean;
  archived_at: string | null;
  exclusive_executor_id: string | null;
  projuris_tipo_codigo: string;
  projuris_tipo_descricao: string | null;
  projuris_classificacao: string | null;
  /** Exceções de exclusivo por tema (carregadas junto — a UI precisa do Sim/Não). */
  excecoes: TaskTypeThemeExclusive[];
}
