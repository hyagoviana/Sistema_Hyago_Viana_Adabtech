# Story R6-03: Geração de tarefa a partir da intimação (tipo/prioridade/título auto/vencimento) + conclusão obriga observação + painel de atrasos

- **Épico:** R6 — Controladoria + distribuição de tarefas (E6, bloco B6)
- **ID:** R6-03
- **Status:** Draft — DESIGN (spec do modelo de tarefa; codar só após R6-01/02)
- **Estimativa relativa:** M (modelo de tarefa + ciclo de vida + painel de atrasos)
- **Executor sugerido:** @architect + @dev · Quality gate: @qa
- **Natureza:** ALTO NÍVEL / DESIGN. Entregável = **modelo de tarefa + fluxo aprovados**.

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES

- **R6-02 concluída** (intimação confirmada + vinculada ao caso).
- **Mockup** da tarefa/painel de atrasos (§9.3).
- **Regras de tipo/prioridade/vencimento por escrito** (como derivar prioridade e prazo do tipo de intimação). *(pendência §9.3)*

---

## Story

**Como** controladoria/responsável,
**quero** que uma intimação confirmada gere uma **tarefa** (tipo, prioridade, título automático, descrição, responsável, vencimento) que caia no responsável e cuja **conclusão obrigue uma observação**, com um **painel de atrasos** visível,
**para que** nenhum prazo se perca e todo trabalho tenha rastro e explicação.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (agregação de tarefas):** aba **Tarefas** (`src/routes/tarefas.tsx`) + `useWorkItems`/`useAllDeadlines` + `listWorkItems` (agrega tarefas + itens de checklist; não-admin só o dele; admin filtra) — memória `project_tarefas_e_multiresponsavel_2026_07_10`. **Reusar como base de UI e RBAC.**
- **JÁ EXISTE (multi-responsável):** `system_case_checklist_item_assignees` (N:N) + `AssigneeMultiSelect` — padrão de atribuição já validado.
- **JÁ EXISTE (visibilidade):** `src/lib/visibility.ts` — advogado vê só o que é dele; aplicar às tarefas geradas.
- **NOVO:** entidade **tarefa da controladoria** (distinta do item de checklist), com origem em intimação, prioridade, vencimento, e obrigatoriedade de observação na conclusão.

> **DECISÃO A TRAVAR:** tarefa da controladoria é entidade própria (`system_tasks` — proposta) OU estende o modelo de work-item existente? Default recomendado: **tabela própria** `system_tasks` que o `listWorkItems` passa a agregar (aditivo), mantendo o mesmo RBAC.

---

## Acceptance Criteria (de DESIGN)

1. **Modelo de tarefa especificado:** `system_tasks` (proposta) com campos `case_id`, `intimacao_id`, `tipo`, `prioridade` (URGENTE/ALTA/MEDIA/BAIXA — alinhado às tones já usadas em `tarefas.tsx`), `titulo`, `descricao`, `responsavel_id(s)`, `vencimento`, `status`, `observacao_conclusao`, auditoria.
2. **Título/descrição/prioridade/vencimento automáticos:** regra de derivação a partir do tipo de intimação documentada e aprovada.
3. **Conclusão obriga observação:** especificado que `status=CONCLUIDA` exige `observacao_conclusao` não-vazia (gate no serviço + UI).
4. **Painel de atrasos:** definição do painel (tarefas vencidas por responsável/área), reaproveitando `useAllDeadlines`/`tarefas.tsx`.
5. **RBAC/visibilidade:** tarefa cai no responsável; não-admin vê só as suas (via `visibility.ts` + permissão efetiva D3); admin vê todas. Cruza com R3-P7.
6. **Sem produção nesta story:** entregável é o design; agregação em `listWorkItems` fica marcada como aditiva.

---

## Tasks / Subtasks

- [ ] **Design — schema `system_tasks`** (AC:1) — rascunho migration + rollback (não aplicar); FKs `case_id`/`intimacao_id`; multi-responsável reusando padrão N:N `system_case_checklist_item_assignees`.
- [ ] **Design — auto-preenchimento** (AC:2) — mapa tipo-de-intimação → {tipo tarefa, prioridade, prazo, template de título}. *(depende de regras do cliente)*
- [ ] **Design — gate de conclusão** (AC:3) — regra "sem observação, não conclui" (serviço + UI), auditável.
- [ ] **Design — agregação em Tarefas** (AC:4,5) — como `listWorkItems` passa a incluir `system_tasks` sem quebrar RBAC/filtros atuais.
- [ ] **Design — painel de atrasos** (AC:4) — layout + fonte de dados (`useAllDeadlines`).
- [ ] **Documentar** em `docs/reforma-2026-07/spec-controladoria-tarefas.md`.

---

## Dev Notes

**Regras de ouro:**
- Agregação em `listWorkItems` é **aditiva** — não quebrar filtros/RBAC atuais (memória `project_tarefas_e_multiresponsavel`).
- Multi-responsável reusa o padrão N:N já existente (não inventar outro).
- Visibilidade por `visibility.ts` + permissão efetiva (D3), nunca `role` hardcoded.
- Tarefa **não** escreve em `case_type`/`macrostatus_*`.

### Testing (de design)
- Regras de auto-preenchimento cobrem todos os tipos de intimação previstos.
- Conclusão sem observação é bloqueada (cenário de teste definido).
- QA valida que a agregação não altera o comportamento atual de Tarefas para não-admin.

---

## Cruzamentos

- **R6↔R6-02:** intimação confirmada dispara a tarefa.
- **R6↔R3-P7:** responsável/visibilidade por permissão efetiva.
- **R6→R6-04:** a tarefa criada é o objeto que o motor de distribuição atribui.

---

## Dependências

- **Bloqueada por:** R6-02; regras de tipo/prioridade/prazo; mockup.
- **Habilita:** R6-04 (distribuição); R7 (IA de distribuição usa este modelo).

## File List

- `docs/reforma-2026-07/spec-controladoria-tarefas.md` (novo — design)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível (modelo de tarefa + atrasos) — bloco B6 | @sm |
