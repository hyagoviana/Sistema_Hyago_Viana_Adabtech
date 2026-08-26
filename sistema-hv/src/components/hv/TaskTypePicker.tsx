// Escolha de TIPO DE TAREFA em dois passos: primeiro a CLASSE, depois o tipo.
//
// T1 (reunião 2026-08-26). Thiago, ao criar uma tarefa na tela: "quando eu vou
// selecionar o tipo de tarefa, ele mostra tudo que existe. A ideia de ter essa
// classe é que eu primeiro seleciono, eu quero ver quais são as tarefas da
// classe administrativo, da classe comercial. Aí clico, aparece a lista dessa
// classe, mais limpa."
//
// É FILTRO DE VISUALIZAÇÃO, não regra de negócio — ele foi explícito: "pode ter
// essa opção todas, não tem problema. É só um filtro da visualização, só porque
// fica mais intuitivo". Por isso "Todas" existe e nada é bloqueado.
//
// Importa só de `task-types-shared` (módulo puro): importar do serviço levaria
// código de servidor para o bundle do cliente e o import-protection derruba o
// build — o `tsc` não pega isso, só o `vite build`.

import { useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTaskTypesCatalog } from "@/hooks/useTaskTypes";
import { TASK_TYPE_CLASSE_LABEL, TASK_TYPE_CLASSES } from "@/lib/task-types-shared";

const TODAS = "__todas__";
const SEM_CLASSE = "__sem_classe__";

export interface TaskTypePickerProps {
  /** id do tipo escolhido (ou null/"" quando nada escolhido). */
  value: string | null;
  onChange: (taskTypeId: string | null) => void;
  /** Só os tipos marcados como "aparece no motor". Use nas telas da distribuição. */
  somenteMotor?: boolean;
  /** "ativos" (padrão) esconde os arquivados. */
  estado?: "ativos" | "arquivados" | "todos";
  /** Oferece uma opção vazia (ex.: "Sem tipo") no seletor de tipo. */
  emptyLabel?: string;
  disabled?: boolean;
  /** Rótulos acima dos campos. Passe `false` para embutir sem legenda. */
  showLabels?: boolean;
  classeWidth?: string;
  tipoWidth?: string;
}

const SEM_TIPO = "__sem_tipo__";

export function TaskTypePicker({
  value,
  onChange,
  somenteMotor = false,
  estado = "ativos",
  emptyLabel,
  disabled = false,
  showLabels = true,
  classeWidth = "w-[150px]",
  tipoWidth = "w-[220px]",
}: TaskTypePickerProps) {
  const [classe, setClasse] = useState<string>(TODAS);

  // "Sem classe" precisa ser pedido como classe nula ao servidor; o hook aceita
  // `classe: null` como "não filtra", então esse caso é resolvido aqui na tela.
  const { data: tipos } = useTaskTypesCatalog({
    estado,
    classe: classe === TODAS || classe === SEM_CLASSE ? null : classe,
    soMotor: somenteMotor,
  });

  const lista = useMemo(() => {
    const todos = tipos ?? [];
    if (classe === SEM_CLASSE) return todos.filter((t) => !t.classe);
    return todos;
  }, [tipos, classe]);

  return (
    <>
      <div className="space-y-1">
        {showLabels && <Label className="text-xs">Classe</Label>}
        <Select
          value={classe}
          onValueChange={(nova) => {
            setClasse(nova);
            // Trocar de classe pode tirar da lista o tipo que estava escolhido —
            // deixar um id "invisível" selecionado é o que faz a pessoa distribuir
            // a tarefa errada sem perceber (achado QA-4).
            //
            // A comparação é pela CLASSE do tipo escolhido, não pela lista: no
            // momento do clique `tipos` ainda é da classe anterior, então checar
            // "está na lista?" daria sempre verdadeiro e nunca limparia nada.
            if (!value || nova === TODAS) return; // "Todas" mostra tudo: nada some
            const escolhido = (tipos ?? []).find((t) => t.id === value);
            const continuaVisivel =
              nova === SEM_CLASSE ? !escolhido?.classe : escolhido?.classe === nova;
            if (!continuaVisivel) onChange(null);
          }}
          disabled={disabled}
        >
          <SelectTrigger className={classeWidth}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas</SelectItem>
            {TASK_TYPE_CLASSES.map((c) => (
              <SelectItem key={c} value={c}>
                {TASK_TYPE_CLASSE_LABEL[c]}
              </SelectItem>
            ))}
            <SelectItem value={SEM_CLASSE}>Sem classe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        {showLabels && <Label className="text-xs">Tipo de tarefa</Label>}
        <Select
          value={value ?? (emptyLabel ? SEM_TIPO : "")}
          onValueChange={(v) => onChange(v === SEM_TIPO ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger className={tipoWidth}>
            <SelectValue placeholder="Escolha o tipo…" />
          </SelectTrigger>
          <SelectContent>
            {emptyLabel && <SelectItem value={SEM_TIPO}>{emptyLabel}</SelectItem>}
            {lista.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome}
              </SelectItem>
            ))}
            {lista.length === 0 && (
              <div className="px-2 py-1.5 text-[12px] text-muted-foreground">
                Nenhum tipo nesta classe
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
