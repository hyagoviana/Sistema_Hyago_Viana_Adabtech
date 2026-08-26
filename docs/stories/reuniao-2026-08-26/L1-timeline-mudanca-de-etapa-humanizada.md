# Story L1: Linha do tempo — mudança de etapa escrita em português

**Épico:** Reunião 2026-08-26 · **ID:** L1 (item 10 do owner) · **Onda:** 2 · **Status:** Ready for Review
**Executor:** @dev · Quality gate: @qa
**Risco:** BAIXO — camada de apresentação. Nenhum evento novo, nenhum dado alterado.

---

## Story

**Como** quem lê a linha do tempo de um caso,
**quero** ver **"Mudou de etapa: Entrar em contato → Dado judicial"** em vez do código cru,
**para que** a informação sirva para gente e não para máquina.

Thiago: "quando a gente tem uma mudança de etapa dentro da situação dos casos, ele ainda tá aparecendo uma informação robotizada enorme… tivesse como isso aqui ser um pouquinho mais humanizado: mudou, então a etapa era tal, entrar em contato, e para dado judicial."

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Renderização dos eventos:** `src/components/cases/CaseTimeline.tsx` (função `renderEventLabel`, linha ~59) e o gêmeo `src/components/cases/CaseFeed.tsx` (linha ~112). Os dois precisam do mesmo tratamento — **hoje o texto está duplicado nos dois arquivos**.
- **Os eventos problemáticos:**
  - `status_changed` (linha 66) → hoje: `Status mudou: ${e.from_macrostatus_op} → ${e.to_macrostatus_op}` (slug cru).
  - `board_stage_changed` (linha ~103) → `Mudou de etapa no kanban: ${d.from} → ${d.to}` (slug cru).
  - `stage_auto_advanced`, `stage_moved_by_checkbox`, `fin_status_changed`, `fin_stage_auto_advanced` — mesma doença.
- **Os rótulos existem** em dois lugares, conforme a natureza da etapa:
  - **Macrostatus legado:** `MACRO_OP_LABELS` / `MACRO_FIN_LABELS` em `src/lib/cases/constants.ts:52` e `:81`.
  - **Etapas de pipeline/board:** tabela `system_pipeline_stages` (colunas `slug` + `label`), lida por `useStages(serviceTypeId, kind)` (`src/hooks/usePipeline.ts:77`) e `useBoardStages(boardId)` (`src/hooks/useBoards.ts:84`).
- **A timeline já filtra eventos `fin_`** na apresentação (linha ~172) — o padrão de "resolver na camada de exibição" já está estabelecido aqui.

### NOVO

1. Um **resolvedor de rótulo de etapa** compartilhado: dado um slug (e o tema/board do caso), devolve o `label`; se não achar, devolve o slug formatado (sem underscore, capitalizado) — nunca um espaço em branco.
2. Textos reescritos: "Mudou de etapa: **X** → **Y**", "Avançou sozinho pelo checklist: X → Y" etc.
3. Um **único lugar** com esses textos, consumido por `CaseTimeline` e `CaseFeed`.

---

## Acceptance Criteria

1. **Etapa em português.** Eventos `status_changed` e `board_stage_changed` exibem os **rótulos** das etapas (ex.: "Entrar em contato"), não os slugs (`entrar_contato`).
2. **Fallback seguro.** Slug sem rótulo correspondente (etapa renomeada ou apagada) é exibido formatado — underscore vira espaço e a primeira letra sobe. **Nunca** aparece vazio, `null` ou `·` sozinho.
3. **Mesma frase nos dois componentes.** `CaseTimeline` e `CaseFeed` mostram exatamente o mesmo texto — nada de divergir.
4. **Cobre os primos.** `stage_auto_advanced`, `stage_moved_by_checkbox`, `fin_status_changed` e `fin_stage_auto_advanced` também usam os rótulos.
5. **Sem mudança de dado.** Nenhum evento é reescrito no banco, nenhum evento novo é criado, nenhum evento deixa de ser gravado. É só exibição.
6. **Não conflita com a Auditoria.** Esta story **não** remove nada da linha do tempo — a remoção do "dados do serviço atualizados" é a story **AU1**.
7. **Regressão.** `typecheck` + `lint` limpos; a timeline continua exibindo todos os outros tipos de evento como hoje.

---

## Tasks / Subtasks

### T1 — Resolvedor (@dev)
- [x] `src/lib/cases/stage-label.ts` (módulo puro): `formatStageSlug(slug)` (fallback) e `makeStageLabelResolver(stages, macroLabels)` devolvendo `(slug) => string`. (AC-1, AC-2)

### T2 — Texto único (@dev)
- [x] Extrair `renderEventLabel` para um módulo compartilhado usado por `CaseTimeline` e `CaseFeed`, recebendo o resolvedor por parâmetro. (AC-3)
- [x] Reescrever as frases dos 6 eventos de etapa. (AC-1, AC-4)

### T3 — Ligar os dados (@dev)
- [x] Nos dois componentes, carregar as etapas do caso (`useStages` pelo `service_type_id` + kind, e `useBoardStages` quando o evento traz `board_key`) e montar o resolvedor. Enquanto carrega, usar o fallback (nunca renderizar vazio). (AC-1, AC-2)

### T4 — QA (@qa)
- [ ] Mover um caso de etapa e conferir a frase na ficha e no feed. (AC-1, AC-3)
- [ ] Renomear uma etapa e conferir eventos **antigos**: mostram o rótulo atual ou o fallback — nunca vazio. (AC-2)
- [ ] Avanço automático por checklist e por checkbox: frases corretas. (AC-4)
- [ ] Conferir que a lista de eventos não encolheu nem cresceu. (AC-5, AC-6)

---

## Dev Notes

- **Evento antigo guarda slug, não rótulo.** Por isso a tradução é na leitura. Se a etapa foi renomeada, o histórico passa a mostrar o nome novo — é o comportamento desejado (e o mais barato).
- **`CaseFeed` e `CaseTimeline` são gêmeos divergentes.** A duplicação do `renderEventLabel` é dívida antiga; esta story é a hora certa de unificar, porque senão o Thiago vê a frase nova em um lugar e a velha no outro.
- **Kanban custom:** um tema pode ter vários boards com etapas de mesmo slug. Quando o evento trouxer `board_key`/`board_label` no `diff`, resolver pelo board certo.
- **Não misture com AU1.** A tentação é já tirar o "Dados do serviço atualizados" daqui — não. Isso tem story própria, com destino (auditoria) definido.

## Testing

- **UI:** ficha e feed lado a lado, com caso que já tem histórico longo.
- **Gates:** typecheck + lint.

## Dependências

- **AU1** mexe nos mesmos arquivos (filtra `canonical_fields_updated`) — fazer **L1 primeiro**, AU1 depois.
- **W1** acrescenta o sufixo do workflow no mesmo `renderEventLabel` — coordenar a ordem (W1 depois de L1 aproveita o módulo já extraído).

## File List

**Novos**
- `sistema-hv/src/lib/cases/stage-label.ts`
- `sistema-hv/src/components/cases/case-event-label.ts` (texto único dos eventos)

**Alterados**
- `sistema-hv/src/components/cases/CaseTimeline.tsx`
- `sistema-hv/src/components/cases/CaseFeed.tsx`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial | @sm (River) |
| 2026-08-26 | v0.2 | **Implementada.** `lib/cases/stage-label.ts` (resolvedor + fallback) e `components/cases/case-event-label.ts` (texto ÚNICO dos eventos — antes duplicado e já divergente entre Timeline e Feed). Os dois componentes montam o resolvedor com `useStages(op)` + `useStages(fin)` + os macrostatus legados. Frases reescritas: "Mudou de etapa: Entrar em contato → Dado judicial". O módulo também já acomoda o sufixo do workflow (W1) e o `status_label` da TK1 — os três se encontram no mesmo lugar, de propósito. typecheck OK, eslint OK, build OK. **Falta o T4 (UI).** | @dev (via Orion) |

## QA Results

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Parecer completo:** `QA-onda-2.md`

**PASS.** A extração preservou os filtros locais de cada componente (o Feed continua escondendo `fin_*` e `note_added`; a Timeline, `fin_*`). Como o texto unificado é o superset do Timeline, o Feed até ganhou frases para eventos que antes mostrava como `action` crua.

**Gates reproduzidos pelo QA:** `typecheck` limpo · `eslint` limpo · `vite build` OK.
**Pendente:** passeio manual na UI (nenhum agente exercitou a tela).
