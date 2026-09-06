# Story S4-01: Menu "Editar caso" — tema, urgência e responsável num lugar só

- **Sprint:** S4 — Caso
- **ID:** S4-01 · **Item do Thiago:** 9 · **Decisão:** D10
- **Status:** CONCLUÍDA (06/09) — QA verde
- **Estimativa relativa:** G
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** coordenador,
**quero** um único menu **"Editar caso"** que mude tema, urgência e **responsável**,
**para que** eu pare de caçar a informação em quatro menus diferentes — e para que dê para trocar o
responsável sem precisar recriar o caso.

---

## Contexto

Anotações do Thiago nos desenhos 15-22. Ele contou os menus que existem hoje na página do caso:

| # | Menu | Onde |
|---|---|---|
| 1 | Menu rápido `Editar caso` (mudar tema/tipo, preencher campos, urgência) | cabeçalho |
| 2 | `Preencher campos` (pop-up "Preencher campos do tema") | cabeçalho |
| 3 | `Novo estágio` (mover etapa / adicionar a outro kanban) | cabeçalho |
| 4 | Painel `Dados do caso` (campos, com bloqueio) | corpo da ficha |

E anotou: *"Nenhum deles permite alterar todas as informações do caso (por exemplo, o responsável
direcionado para o caso, como é selecionado direto na hora de criar o caso na página do cliente)."*

A consolidação que ele desenhou:
- **Mudança de estágios (menu 3)** — já existe, sem alterações, **permitido para todos**;
- **Menu campos do caso (menu 4)** — já existe, sem alterações, **permitido para todos**;
- **Menu de edição do caso (1 + 2)** — vira um só, com **Mudar tema · Mudar urgência · Mudar responsável**,
  e *"só determinados cargos podem"*. Ele também anotou: *"dados dos campos saem daqui e agora são apenas
  direto no menu de campos da página"*.

**Decisão D10:** o gate é o nível **Configurar** do módulo Operacional.

---

## Acceptance Criteria

1. O menu **"Editar caso"** passa a ter exatamente três ações: **Mudar tema/pipeline**, **Mudar urgência**
   (Normal · Prioritário · Urgente — as opções que já existem) e **Mudar responsável**.
2. **"Preencher campos" sai do menu.** Os campos do caso são editados **só** pelo painel Dados do caso, na
   própria página (menu 4). O pop-up `CaseFilterFillDialog` deixa de ser oferecido no cabeçalho —
   continua existindo onde o fluxo de geração de documento o usa.
3. **Mudar responsável** grava em `system_case_responsaveis` (N:N já existente) e alimenta o
   direcionamento do motor (**S1-04**). A tela deixa claro o efeito: um responsável = motor direciona
   para ele; mais de um = motor volta à distribuição por pontuação.
4. **Gate:** o menu inteiro só aparece para quem tem **Configurar** no módulo Operacional. Mudança de
   estágio e painel de campos continuam disponíveis para quem tem `edit` (permitido para todos, como ele
   pediu).
5. Toda alteração feita pelo menu é registrada na **timeline do caso** (quem, quando, de/para).
6. Enquanto a S5 não entregar o nível *Configurar*, o gate usa o equivalente mais próximo (admin +
   coordenação) com `TODO` explícito referenciando **S5-04**.
7. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Redesenhar o menu no cabeçalho do caso (AC 1, 2). (`src/routes/casos.$id.index.tsx`)
- [ ] Ação **Mudar responsável** (seletor multi já existe: `AssigneeMultiSelect`) com aviso do efeito no
      motor (AC 3).
- [ ] Aplicar o gate (AC 4, 6).
- [ ] Registro na timeline (AC 5).
- [ ] Testes de gate: papel sem Configurar não vê o menu; com Configurar vê e altera.

---

## Dev Notes

- **Não** remover o `CaseFilterFillDialog` do repositório — ele segue em uso no fluxo de geração de
  documento (pop-up pós-Word).
- "Mudar tema/pipeline" já existe (`LinkCaseToTemaDialog` / mudar tipo) — reaproveitar, não reescrever.
- A urgência já tem RPC (`useCases.ts:233`, `cases-service.ts:2095`).

## Definition of Done

- [ ] Três menus na página do caso, com papéis claros
- [ ] Responsável editável e chegando no motor
- [ ] Gate provado com dois papéis diferentes

---

## Execução — 06/09/2026

O menu já tinha **Mudar tema/tipo** e **Mudar urgência**. Faltavam duas coisas, fechadas agora:

**AC1/AC3 — "Mudar responsável" não existia.** A ficha só MOSTRAVA o responsável, e o próprio comentário
no código dizia "a edição continua no 'Editar caso'" — onde não estava. Agora existe:
`CaseResponsavelDialog`, com o endpoint `setCaseResponsaveisFn` gateado por **Configurar no
operacional** (mudar responsável muda para quem o motor direciona as tarefas — é régua, não conteúdo).

Um responsável por caso (A2, Thiago 04/09). Só usuários **ativos** aparecem na lista: atribuir a alguém
suspenso deixaria o caso sem dono de fato e o motor sem para quem direcionar. A tela diz o efeito em
uma frase, porque é o que a pessoa precisa saber ao escolher.

**AC2 — "Preencher campos" saiu do menu.** Os campos do caso são editados no painel Dados do caso, na
própria página; ter duas portas para a mesma edição fazia o menu de *configuração* parecer o lugar de
mexer em *conteúdo*. O `CaseFilterFillDialog` continua nos dois fluxos de geração de documento, que é
onde ele resolve um problema real — preencher antes de gerar o Word.

**AC4/AC6 — o gate.** Fechado pela S5-04: `usePodeConfigurar("operacional")`. O `TODO` que apontava para
a S5-04 deixou de existir.

### QA — `npm run qa:s401`

13 verificações: as três ações presentes, "Preencher campos" fora do menu **mas vivo no fluxo de
geração**, o gate nos dois lados (tela e endpoint), o limite de um responsável e o filtro de ativos.

O teste de "saiu do menu" procura o `DropdownMenuItem`, não a string — o comentário que explica a
remoção cita o nome, e citar o que mudou é justamente o que um bom comentário faz.
