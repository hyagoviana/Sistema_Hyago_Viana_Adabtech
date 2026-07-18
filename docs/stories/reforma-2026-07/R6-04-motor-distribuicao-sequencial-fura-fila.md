# Story R6-04: Motor de distribuição sequencial igualitária + fura-fila (Urgente/Complexo/Específico) + regras por usuário

- **Épico:** R6 — Controladoria + distribuição de tarefas (E6, bloco B6)
- **ID:** R6-04
- **Status:** Draft — DESIGN (algoritmo + regras; codar só após R6-03)
- **Estimativa relativa:** L (algoritmo de distribuição + regras por usuário + simulação)
- **Executor sugerido:** @architect (algoritmo) + @dev · Quality gate: @qa
- **Natureza:** ALTO NÍVEL / DESIGN. **Sem IA nesta fase** (IA vem em R7). Distribuição por **lógica** (like/equals/diferente).

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES

- **R6-03 concluída** (modelo de tarefa existe).
- **Regras de distribuição por escrito** — a lógica exata de rodízio, os critérios de fura-fila (o que é "Urgente/Complexo/Específico") e as frentes/tipos que cada usuário atende. *(pendência §9.3 — bloqueante forte)*
- **Mockup** da tela de distribuição/config (§9.3).

---

## Story

**Como** controladoria,
**quero** um motor que distribua as tarefas de forma **sequencial e igualitária** entre os responsáveis elegíveis, com **regras de fura-fila** (caixinhas Urgente/Complexo/Específico) e respeitando **quais frentes/tipos cada usuário atende**,
**para que** a carga fique justa, os casos urgentes/complexos/específicos vão a quem deve, e ninguém receba tarefa fora da sua competência — **tudo por lógica determinística, sem IA** nesta fase.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (competência por usuário — base):** `system_users.role` (9 papéis) + visibilidade por caso (`visibility.ts`). A camada de **frentes/tipos por usuário** cruza com **R3-P7** (regras por usuário: quais frentes/tipos atende).
- **JÁ EXISTE (multi-responsável):** N:N `system_case_checklist_item_assignees` — padrão de elegibilidade/atribuição.
- **NOVO:** motor de distribuição (`system_fn_distribuir_tarefa` — proposta) com estado de rodízio (`last_assigned_at`/contador por usuário×frente), as 3 caixinhas de fura-fila, e a tabela de competências `system_user_frentes` (proposta, cruza R3-P7).

> **DECISÃO A TRAVAR:** distribuição por **lógica** (like/equals/diferente conforme o doc-mestre) — ex.: filtra elegíveis por frente/tipo (`equals`), aplica fura-fila (`like` caixinha), e no restante rodízio igualitário (menor contador/mais antigo `last_assigned_at`). **IA fica para R7 (futuro).**

---

## Acceptance Criteria (de DESIGN)

1. **Algoritmo especificado e aprovado** em `docs/reforma-2026-07/spec-distribuicao.md`: ordem de aplicação (elegibilidade → fura-fila → rodízio), critério de desempate, e estado necessário (contador/último atribuído).
2. **Regras de fura-fila definidas:** o que caracteriza **Urgente**, **Complexo**, **Específico**, e para quem cada caixinha vai (override do rodízio). *(depende das regras do cliente)*
3. **Competência por usuário definida:** modelo `system_user_frentes` (proposta) — quais frentes/tipos cada usuário atende; distribuição só considera elegíveis. **Cruza com R3-P7** (mesma fonte de verdade).
4. **Determinismo/auditoria:** dado o mesmo estado, a distribuição é reprodutível e auditável (registro de por que foi para X).
5. **Sem IA:** explicitamente marcado que esta fase é lógica pura; ponto de extensão para R7 documentado (onde a IA entraria depois).
6. **Simulação/dry-run:** especificar um modo de simulação (ver a fila resultante antes de efetivar) para a controladoria validar as regras.
7. **Sem produção nesta story:** entregável é o design + rascunhos de schema/funções (não aplicados).

---

## Tasks / Subtasks

- [ ] **Design — modelo de competência** (AC:3) — `system_user_frentes` (user × frente/tipo); alinhar com R3-P7 para não duplicar fonte de verdade.
- [ ] **Design — estado de rodízio** (AC:1) — contador/`last_assigned_at` por usuário (por frente?); política de reset.
- [ ] **Design — algoritmo** (AC:1,2) — pseudocódigo: elegíveis (`equals` frente) → fura-fila (`like` caixinha) → rodízio igualitário (`diferente`/menor carga). Casos de borda: ninguém elegível, empate, usuário indisponível.
- [ ] **Design — fura-fila** (AC:2) — definição operacional de Urgente/Complexo/Específico e destino de cada caixinha. *(bloqueado por regras do cliente)*
- [ ] **Design — auditoria/dry-run** (AC:4,6) — o que registrar; como simular.
- [ ] **Documentar** ponto de extensão para IA (AC:5) — interface que R7 poderá plugar.
- [ ] **Escrever** `docs/reforma-2026-07/spec-distribuicao.md` e submeter a @architect/@qa.

---

## Dev Notes

**Regras de ouro:**
- Competência do usuário é **fonte única** compartilhada com R3-P7 — não criar dois lugares para "quais frentes o usuário atende".
- Atribuição reusa o padrão N:N existente; distribuição **não** escreve em `case_type`/`macrostatus_*`.
- **Sem IA** — lógica determinística; deixar hook explícito para R7.
- Toda decisão de distribuição é auditável (rastro do porquê).

### Testing (de design)
- Simulação com N usuários e M tarefas mostra distribuição igualitária + fura-fila aplicada corretamente.
- Cenário "ninguém elegível" tem caminho definido (fila de exceção/controladoria).
- QA valida determinismo (mesmo estado → mesmo resultado).

---

## Cruzamentos

- **R6↔R3-P7:** competência frentes/tipos por usuário = fonte única compartilhada (permissão efetiva D3).
- **R6↔R6-03:** distribui as `system_tasks` geradas.
- **R6→R7:** ponto de extensão onde a IA de sugestão/distribuição automática se pluga (futuro).

---

## Dependências

- **Bloqueada por:** R6-03; regras de distribuição escritas (Urgente/Complexo/Específico); mockup; definição de frentes por usuário (R3-P7).
- **Habilita:** R7 (IA de distribuição).

## File List

- `docs/reforma-2026-07/spec-distribuicao.md` (novo — design)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível (motor de distribuição + fura-fila) — bloco B6 | @sm |
