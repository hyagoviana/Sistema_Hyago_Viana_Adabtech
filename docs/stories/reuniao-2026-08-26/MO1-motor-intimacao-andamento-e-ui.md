# Story MO1: Motor — separar intimação × andamento, busca por processo, scroll do Kanban e acerto visual

**Épico:** Reunião 2026-08-26 · **ID:** MO1 · **Onda:** 1 · **Status:** Ready for Review
**Executor:** @dev (UI) · Quality gate: @qa
**Risco:** BAIXO — tudo é apresentação/filtro sobre dado que **já é gravado**. Nenhuma migration.

---

## Story

**Como** pessoa da controladoria que abre "Andamentos pendentes" toda manhã,
**quero** ver de bate-pronto o que é **intimação** e o que é **andamento**, com a tela mostrando **só intimações por padrão**,
**para que** eu trabalhe a fila real (intimação = prazo aberto pelo juiz; andamento = ruído de monitoramento).

Thiago, na reunião: "hoje eles não conseguem olhar o que é andamento, eles só olham o que é intimação. Porque quando é intimação, o juiz já abriu o nosso prazo, e aí a gente não faz, morreu." E: "o padrão é só mostrar aqui as intimações, mas que ele pode ver também, tipo uma chavezinha, os andamentos".

Mais três incômodos de rotina da mesma tela: **marcar como lido** aparecendo onde o ProJuris não aceita, **falta de busca por número do processo** no histórico, e o **Kanban que não rola para o lado**.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — não recriar nada)

- **O dado já vem separado.** `src/lib/distribuicao/staging-core.ts` grava `origem = INTIMACAO` (linha ~256) e `origem = ANDAMENTO` em `system_distribution_movements`. **Não precisa mexer no sync nem no banco** — é só usar a coluna.
- **Situação do ProJuris** também já é guardada em `situacao_projuris` (mesmo arquivo).
- **Telas afetadas (todas já existem):**
  - `src/routes/controladoria.distribuicao.andamentos.tsx` — a fila da manhã (tag + filtro + botão marcar lido).
  - `src/routes/controladoria.distribuicao.historico-andamentos.tsx` — histórico (ganha busca por processo).
  - `src/routes/controladoria.distribuicao.kanban.tsx` — Kanban (ganha scroll horizontal).
  - `src/routes/controladoria.distribuicao.tsx` — casca com as abas (nenhuma aba muda aqui).
- **A decisão de arquivar/ler já existe** no writeback: `src/lib/projuris/writeback-acoes.ts` mapeia
  INTIMAÇÃO + ARQUIVADO para `PUT /intimacao/{cod}/situacao/ARQUIVADA`, e volta para PENDENTE via `desarquivar`.
  O tipo `MovementDecisao` (PENDENTE | ARQUIVADO | LIDO | DISTRIBUIR) está em `src/lib/distribuicao/staging-core.ts:51`.
- **Scroll horizontal com barra** já está resolvido nos Kanbans do operacional e do financeiro — copiar o padrão de lá.
- **Padrão visual** de card (fundo bege da página, card branco): classes `card-editorial` / `card-hero`, usadas no resto do sistema.

### NOVO nesta story

1. **Tag visual** por linha: Intimação (verde) / Andamento (âmbar), derivada de `origem`.
2. **Filtro no topo** com 3 estados — **Intimações (padrão)** / Andamentos / Todos.
3. **Marcar como lido só quando `origem = ANDAMENTO`** (intimação no ProJuris só arquiva/desarquiva).
4. **Busca por número do processo (CNJ)** no histórico de andamentos, junto do filtro de data.
5. **Barra de rolagem horizontal** no Kanban da distribuição.
6. **Acerto visual** da lista de andamentos (bege atrás, cards brancos).

---

## Acceptance Criteria

1. **Tag.** Em Andamentos pendentes, cada linha exibe um badge: **Intimação** (verde) quando `origem = INTIMACAO`, **Andamento** (âmbar) quando `origem = ANDAMENTO`.
2. **Filtro com padrão certo.** No topo há um seletor **Intimações | Andamentos | Todos**. Ao abrir a tela vem em **Intimações**. A escolha vale só para a visualização — o sync continua puxando os dois.
3. **Marcar como lido condicional.** A ação só é renderizada para linhas com `origem = ANDAMENTO`. Para intimação continuam Arquivar / Desarquivar / Distribuir tarefa.
4. **Busca por processo.** Em Hist. andamentos existe busca por número do processo (CNJ) que filtra a lista e funciona **combinada** com o filtro de data já existente.
5. **Kanban rola.** O Kanban da distribuição tem barra de rolagem horizontal visível e arrastável.
6. **Visual.** A lista de andamentos usa o mesmo par de cores do resto do sistema, sem o bloco monocromático que o Thiago apontou.
7. **Regressão.** `npm run typecheck` e `npm run lint` limpos. Sync, distribuição, aprovação e writeback inalterados — nenhum arquivo de `src/lib/distribuicao/` ou `src/lib/projuris/` deve mudar; se parecer necessário, parar e revisar o AC-3.

---

## Tasks / Subtasks

### T1 — Tag + filtro (@dev)
- [x] Em `controladoria.distribuicao.andamentos.tsx`: derivar a tag de `origem`; badge verde/âmbar com o primitivo `Badge`. (AC-1)
- [x] Estado local da visão iniciando em Intimações; filtrar em memória (o RPC já traz os dois). (AC-2)

### T2 — Ação condicional (@dev)
- [x] Renderizar marcar como lido apenas para `origem = ANDAMENTO`. Não alterar `staging-core.ts` nem `writeback-acoes.ts`. (AC-3)

### T3 — Busca no histórico (@dev)
- [x] Em `controladoria.distribuicao.historico-andamentos.tsx`: input de busca por CNJ, normalizando para só dígitos (mesma ideia do `soDigitos` do sync), combinando com o filtro de data. (AC-4)

### T4 — Kanban + visual (@dev)
- [x] `controladoria.distribuicao.kanban.tsx`: container com `overflow-x-auto` e barra visível, copiando o padrão dos Kanbans operacional/financeiro. (AC-5)
- [x] Ajustar as classes da lista de andamentos para o padrão bege/branco. (AC-6)

### T5 — QA (@qa)
- [ ] Abrir a tela: vem em Intimações; trocar para Todos: aparecem os dois com as tags certas. (AC-1, AC-2)
- [ ] Linha de intimação não mostra marcar como lido; linha de andamento mostra. (AC-3)
- [ ] Buscar um CNJ conhecido; depois data + CNJ juntos. (AC-4)
- [ ] Kanban rola até a última coluna pela barra. (AC-5)
- [ ] typecheck + lint. (AC-7)

---

## Dev Notes

- **Não mexer no sync.** A tentação é filtrar na origem — não. O Thiago quer continuar puxando os dois e só esconder na visualização ("ele pode ver também, mas só vai estar puxando e não vai dar em nada").
- **Por que marcar lido só em andamento:** ele testou no ProJuris na hora — intimação lá só tem arquivar/desarquivar; movimento/andamento é que tem marcar como lido. Mandar o verbo errado dá erro na API.
- **CNJ vem com máscara.** Comparar por dígitos (reusar a normalização do `staging-core`), senão a busca não acha por causa de ponto e traço.
- **Duplicidade já está resolvida** (confirmado na tela: "já eliminou os duplicados"). Exceções de duplicidade continuam caindo na aba Exceções — nada a fazer aqui.

## Testing

- **Nota de ambiente:** `npm run build` estoura o heap do Node com a configuração padrão neste projeto. Rodar com `NODE_OPTIONS=--max-old-space-size=8192 npm run build` (assim passou em 45s).
- **UI:** os 6 comportamentos acima com os dados do último sync.
- **Não-regressão:** distribuir uma tarefa de teste depois dos ajustes e confirmar o caminho completo até o ProJuris.

## Dependências

- Nenhuma. É a **primeira story a entrar** — é o que o time do Thiago usa na sexta.
- Não colide com TK1 nem T1 (arquivos diferentes).

## File List

**Alterados**
- `sistema-hv/src/routes/controladoria.distribuicao.andamentos.tsx`
- `sistema-hv/src/routes/controladoria.distribuicao.historico-andamentos.tsx`
- `sistema-hv/src/routes/controladoria.distribuicao.kanban.tsx`
- `sistema-hv/src/styles.css` (classe `.kanban-board-scroll`)

**Consultados (não alterar)**
- `sistema-hv/src/lib/distribuicao/staging-core.ts`
- `sistema-hv/src/lib/projuris/writeback-acoes.ts`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial a partir da reunião 26/08 | @sm (River) |
| 2026-08-26 | v0.2 | **Implementada** (T1-T4). Achado durante a execução: existem **3** origens, não 2 — `INICIAL_SHV` é a inicial mandada da ficha Judicial e **não** vem do ProJuris. Decisão tomada: o filtro nunca a esconde (some da fila = perder trabalho que o próprio escritório mandou distribuir); ela ganhou tag própria "Inicial (SHV)". A busca do histórico também aceita nome do cliente e o CSV passou a exportar o que está filtrado. `card-editorial` no lugar da borda chapada; nova classe `.kanban-board-scroll` (a barra existia mas ficava em overlay no Windows — invisível). typecheck OK, eslint OK, `vite build` OK. **Falta o teste manual do T5.** | @dev (via Orion) |

## QA Results

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Parecer completo:** `QA-onda-1.md`

**PASS.** Nenhum efeito colateral: o filtro é de apresentação e o sync/writeback não foram tocados. A decisão de nunca esconder `INICIAL_SHV` foi conferida e é a correta — o contrário perderia trabalho da própria casa.

**Gates reproduzidos pelo QA:** `typecheck` limpo · `eslint` limpo · `vite build` OK.
**Pendente:** passeio manual na UI (nenhum agente exercitou a tela).
