# Story S4-02: Rastro financeiro sai da ficha e vai para a aba Financeiro

- **Sprint:** S4 — Caso
- **ID:** S4-02 · **Item do Thiago:** 9
- **Status:** Ready for Review
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa + @ux-design-expert

---

## Story

**Como** quem abre a ficha do caso,
**quero** ver o que é **operacional** na ficha e o que é **financeiro** na aba Financeiro,
**para que** cada aba responda a uma pergunta só.

---

## Contexto

Anotações do Thiago nos desenhos 24-25: *"Esse painel rastro financeiro vai para a aba 'financeiro'"* e,
apontando o espaço que sobra na ficha, *"Vamos levar esse painel para o espaço que vagou"* — o painel de
**Casos vinculados / Observações gerais**, que hoje fica mais abaixo.

Hoje a ficha (`casos.$id.index.tsx`) mostra lado a lado **Rastro operacional** e **Rastro financeiro**
(com etapa, checklist, A pagar/Vencido/Pago e o botão "Abrir financeiro").

---

## Acceptance Criteria

1. O painel **Rastro financeiro** sai da ficha e passa a ocupar o topo da aba **Financeiro do caso**,
   com o mesmo conteúdo (etapa, checklist financeiro, totais e mover etapa).
2. O espaço liberado na ficha recebe **Casos vinculados** e **Observações gerais**, subindo para a
   dobra superior.
3. **Rastro operacional** continua onde está, sem mudança.
4. Quem não pode ver valores continua sem vê-los na aba Financeiro (gate atual preservado); a ficha
   deixa de expor totais financeiros para todos.
5. Nenhum recurso some: mover etapa financeira, checklist financeiro e o atalho para o financeiro
   continuam acessíveis (o atalho vira a própria aba).
6. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [x] Mover o rastro financeiro/rastro financeiro para `casos.$id.financeiro.tsx` (AC 1).
- [x] Reorganizar a grade da ficha: vinculados + observações no espaço vago (AC 2).
- [x] Conferir gates de valores nas duas telas (AC 4).
- [x] Varredura de links quebrados/duplicados ("Abrir financeiro") (AC 5).

---

## Dev Notes

- Componentes: `CaseFinanceiroPanels.tsx`, `CaseLinkedCases.tsx`, `CaseObservacoes.tsx`,
  `casos.$id.index.tsx`, `casos.$id.financeiro.tsx`.
- Vai junto com a **S4-03** (limpeza da aba Financeiro) — o topo da aba muda nas duas; combinar a ordem
  para não conflitar.

## Definition of Done

- [ ] Ficha = operacional; aba Financeiro = financeiro
- [ ] Nada perdido no caminho

---

## Dev Agent Record (03/09/2026)

**Implementado.**
- O card **Rastro Financeiro** saiu da ficha (`casos.$id.index.tsx`) e foi para o topo da aba
  **Financeiro do caso**, com o mesmo conteúdo: etapa + dias no estado, checklist da etapa financeira e
  os totais A pagar / Vencido / Pago. Mesmo formatador de valor, para os números não mudarem de cara.
- **Espaço vago:** `Casos vinculados` subiu para a dobra de cima, ao lado do Rastro Operacional;
  `Observações gerais` ficou logo abaixo em largura inteira (é o painel que mais cresce).
- Limpeza do que ficou órfão na ficha: `useRastroFinanceiroCaso`, `useVoltarOperacional`, `diasFin`,
  `finLabel`, `removidoDoOp`, `MoveCaseFinDialog` e os imports correspondentes.
- **Preservado:** "Enviar para o financeiro" continua no cabeçalho da ficha (o gatilho é operacional, não
  exibição de dinheiro), e mover etapa/entrar/voltar continuam no cabeçalho da aba Financeiro.

**Validação:** `npx tsc --noEmit`, `eslint` e `npm run build` verdes.

**Para a validação visual do Thiago:** a disposição nova da ficha (vinculados em cima, observações em
largura inteira) é a leitura que fizemos do desenho dele — vale confirmar no preview.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS (após correção de 1 achado MEDIUM)**

### MEDIUM — selo "Fora do operacional" sumiu da ficha (CORRIGIDO)

O selo vinha dentro do card do rastro financeiro. Com o card migrado, ele passou a existir **só** na aba
Financeiro — que quem não tem `financeiro:view` **não enxerga**. Ou seja: para o usuário operacional, um
caso removido do operacional deixou de ter qualquer indicativo na ficha.

O selo é informação **operacional**, não financeira. Devolvido ao cabeçalho da ficha, ao lado do selo de
ciclo de vida, sem gate de financeiro.

### Verificado

- **"Abrir financeiro" não é perda**: a aba Financeiro no topo do caso (`casos.$id.tsx`) já é o atalho, e
  está gate-ada por `podeVerFinanceiro`. AC 5 cumprido.
- **"Trazer de volta ao operacional"** continua na aba Financeiro (verificado no arquivo).
- **"Enviar para o financeiro"** continua no cabeçalho da ficha — mantido corretamente, é gatilho
  operacional, não exibição de valores.
- Totais e checklist chegaram íntegros na aba, com o mesmo formatador (`brlCentavos`) — os números não
  mudam de aparência.
- Limpeza de órfãos conferida: nenhum símbolo removido tinha outro uso.

**Pendente:** validação visual do Thiago sobre a nova disposição (vinculados em cima, observações em
largura inteira) — é interpretação do desenho, não instrução literal.
