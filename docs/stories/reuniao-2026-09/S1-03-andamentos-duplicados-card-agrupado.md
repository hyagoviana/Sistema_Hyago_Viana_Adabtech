# Story S1-03: Andamentos duplicados — um card agrupado por publicação

- **Sprint:** S1 — Correções que travam o uso hoje
- **ID:** S1-03 · **Item do Thiago:** 11 (parte b) · **Anexo:** `ANDAMENTOS DUPLICADOS.docx`
- **Status:** Ready for Review (escopo REESCRITO pela resposta A1)
- **Estimativa relativa:** G (migration + agrupamento + UI + regra de distribuição)
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** controladoria varrendo os andamentos pendentes,
**quero** ver **um card por publicação** (mesmo processo, mesma data, mesmo teor), com o selo de quantas
intimações o ProJuris mandou,
**para que** eu não distribua quatro tarefas idênticas para a mesma coisa.

---

## Contexto / causa raiz

O anexo do Thiago traz 21 prints. O padrão é sempre o mesmo — exemplo do processo
`1003999-60.2025.4.01.3311` (GABRIELA FERRAZ TRINDADE, 31/08):

| Código | Parte a que se refere |
|---|---|
| INT.0126036 | CAIXA ECONÔMICA FEDERAL |
| INT.0126038 | UNIÃO FEDERAL |
| INT.0126039 | FNDE |
| INT.0126040 | CAIXA ECONÔMICA FEDERAL |
| INT.0126044 | UNIÃO FEDERAL |
| INT.0126045 | FNDE |

Mesma publicação do diário, mesmo NPU, mesma data. Muda só a parte destinatária (e às vezes nem isso).

A dedupe atual não pega isso:

- `system_distribution_movements` tem `UNIQUE (organization_id, origem, projuris_id)`
  (`20260824000001_task_types_entity_e_motor_staging.sql:138`) — e o `projuris_id` é o `codigoIntimacao`,
  que **é diferente em cada linha**.
- `staging-core.ts:219` descarta só o que o ProJuris já marcou como `descartada`/`duplicada` —
  nenhum desses casos vem marcado.

**Decisão do owner (D9):** um card agrupado, expansível, e distribuir gera **uma** tarefa, baixando as irmãs.

---

## Acceptance Criteria

1. **Chave de agrupamento** determinística, calculada na ingestão e persistida em coluna nova
   `grupo_hash` de `system_distribution_movements`:
   `sha256(origem + numero_cnj_normalizado + data_referencia + tipo_intimacao + trecho_normalizado_do_teor)`,
   onde o trecho do teor é o texto **sem** o pedaço "Parte a qual se refere a intimação: ..." e sem o
   contador `#: NNNN` (que varia entre as irmãs). Migration aditiva + índice.
2. **Backfill** da coluna para as linhas já existentes (mesma função de hash, rodada em script).
3. A tela **Andamentos pendentes** (`controladoria.distribuicao.andamentos.tsx`) lista **um card por
   `grupo_hash`** com decisão `PENDENTE`, exibindo:
   - selo `N intimações` quando `N > 1`;
   - um expandir/recolher que mostra as linhas originais (código + parte a que se refere).
4. **Distribuir** a partir do card agrupado gera **uma** tarefa e marca **todas** as linhas do grupo como
   decididas (a escolhida = `DISTRIBUIR`; as irmãs = `ARQUIVADO` com registro de que foram agrupadas).
   **Arquivar** o card arquiva o grupo inteiro. Tudo numa transação/RPC só.
5. O **writeback ao ProJuris** (quando ligado) continua respeitando a trava
   `projuris_writeback_ativo`: se ligada, marca as irmãs como lidas/arquivadas lá também; se desligada,
   só o nosso banco muda.
6. Contadores das telas (Painel, Histórico) passam a contar **grupos**, não linhas soltas — sem inflar
   o número de pendências.
7. Testes: fixture com as 6 intimações do print produz **1** grupo; intimações do mesmo processo em
   **datas diferentes** produzem grupos diferentes; processo diferente na mesma data, idem.
8. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Migration `2026090X000001_movements_grupo_hash.sql`: coluna `grupo_hash TEXT` + índice
      `(organization_id, grupo_hash) WHERE decisao='PENDENTE'`. Aditiva, idempotente, com rollback.
- [ ] Função pura `grupoHashDoMovimento(...)` + testes (AC 1, 7). (`src/lib/distribuicao/`)
- [ ] Preencher na ingestão (`staging-core.ts`, junto do `linhas.push`) (AC 1).
- [ ] Script de backfill com dry-run (AC 2).
- [ ] Agrupar na leitura da fila e no card (AC 3). (`controladoria.distribuicao.andamentos.tsx` + hook)
- [ ] RPC de decisão em grupo (AC 4, 5). (`src/rpc/distribuicao-staging.ts`)
- [ ] Ajustar contadores (AC 6).

---

## Dev Notes

- **Normalização do teor:** remover tags, colapsar espaços (já existe `limpaTexto` em `staging-core.ts:200`),
  cortar em `Parte a qual se refere` e remover `#: \d+`. Guardar o trecho normalizado no `raw` ajuda a depurar.
- O `raw` de cada linha guarda o JSON original do ProJuris — **não** apagar as linhas irmãs. Elas continuam
  no banco (auditoria); só não aparecem como cards separados.
- Quando o ProJuris manda a **mesma** intimação de novo (mesmo `codigoIntimacao`), a `UNIQUE` existente já
  resolve — esta story trata o caso de códigos diferentes.
- Não confundir com `system_distribution_exceptions` / `20260817000001_exceptions_dup_context.sql`, que
  trata duplicidade de **tarefa distribuída**, não de intimação na fila.

## Definition of Done

- [ ] A fila de um dia real bate com o que a controladoria enxerga no ProJuris (1 card por publicação)
- [ ] Distribuir um card agrupado gera exatamente 1 tarefa
- [ ] Backfill aplicado; nenhuma linha perdida

---

## ⚠️ Escopo reescrito — resposta A1 do Thiago (04/09)

**A decisão D9 desta story foi recusada por ele.** O que estava escrito acima (agrupar por publicação,
gerar UMA tarefa, arquivar as irmãs como consequência) não corresponde à metodologia do SHV/ProJuris:

> "Existem 2 situações/etapas diferentes: o quê fazer com a intimação; se ela gera tarefa ou não.
> Independentemente da intimação gerar tarefa, ela vai ser arquivada após ser conferida. O gerar tarefa é
> uma outra funcionalidade."

E o problema que ele quer resolver não é tarefa duplicada — é **retrabalho de leitura**:

> "a pessoa vê tudo, e precisa lembrar se já olhou aquele processo ou não"

### O que passou a valer

| Antes (D9, recusado) | Agora (A1) |
|---|---|
| agrupar por **publicação** (processo + data + teor) | agrupar por **PROCESSO + DIA** |
| a tarefa nasce do card agrupado | a tarefa se liga ao **processo**; qual intimação a originou é indiferente |
| irmãs arquivadas como efeito colateral da tarefa | **toda** intimação é arquivada após conferida, gere tarefa ou não |
| um só status de arquivamento | status próprio **"arquivado por repetição"**, diferente de "arquivado" |

---

## Dev Agent Record (04/09/2026)

**Migration `20260904000001_intimacoes_repetidas_por_processo.sql` — APLICADA.**
`ARQUIVADO_REPETICAO` no CHECK de `decisao`, coluna `grupo_processo_dia` (preenchida para as 2144 linhas
existentes) e índice parcial para a fila.

**Chave de agrupamento:** código do ProJuris → CNJ (só dígitos) → o próprio id. Linha **sem processo
identificado vira seu próprio grupo** — agrupar o que não sabemos ser o mesmo processo esconderia
trabalho de verdade. A expressão do código e a da migration são a mesma.

**Leitura:** `listMovements` agrupa **só o que está PENDENTE**; histórico e auditoria continuam vendo
linha a linha (`agrupado: false` força isso). Cada linha exibida traz `repetidas`, e
`listMovementsDoGrupo` devolve as irmãs.

**Decisão:** vale para o grupo, em qualquer decisão (arquivar direto ou distribuir). As irmãs pendentes
viram `ARQUIVADO_REPETICAO` e são arquivadas **uma a uma** no ProJuris — best-effort, a falha de uma não
derruba a decisão nem as outras.

**Tela:** selo `N do mesmo processo hoje` (com explicação no title) e o toast informa quantas repetidas
foram arquivadas junto.

---

## QA Results — 04/09/2026 (Quinn)

**Gate: PASS**

`npm run qa:repetidas`, contra o banco real — 13/13:

- **a fila pendente cai de 500 para 261 linhas** (239 em stand by); 111 linhas representam repetição;
- a soma das contagens bate exatamente com o total do banco — nenhuma linha some da conta;
- nenhum processo aparece duas vezes na mesma data;
- as irmãs de um grupo são do mesmo processo, no mesmo dia, e têm **códigos de intimação diferentes** —
  é repetição de leitura, não duplicata de registro (que a UNIQUE já resolvia);
- linha sem processo identificado tem chave própria;
- telas de decisão já tomada **não agrupam**.

**Ressalva medida:** a consulta da fila tem `limit(500)`. Com 500 linhas pendentes o teto foi atingido, ou
seja o número real de pendentes pode ser maior — o agrupamento reduz o que se lê, mas não substitui
paginação. Vale acompanhar se a fila continuar crescendo.
