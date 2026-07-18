# Story R7-02: Agente de IA — sugestão/distribuição automática de tarefas (FUTURO)

- **Épico:** R7 — Inteligência (bloco B7)
- **ID:** R7-02
- **Status:** Draft — DESIGN / FUTURO (não implementar nesta rodada)
- **Estimativa relativa:** L (spike de viabilidade + spec; sem produção)
- **Executor sugerido:** @architect + @analyst (spike) · Quality gate: @architect
- **Natureza:** ALTO NÍVEL / DESIGN — **explicitamente marcado FUTURO** no doc-mestre (§4.3/B7). Só design.

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES

- **R6-04 concluída** (motor de distribuição determinístico existe e expõe o **ponto de extensão** para IA).
- **R6-03** (modelo de tarefa) e **R6-01/02** (dados de intimação) estáveis — a IA opera sobre eles.
- **Massa de dados histórica** suficiente para treinar/avaliar sugestões (pendência do cliente).
- **Decisão do owner** sobre provedor de IA e passagem por **n8n** (padrão de integração externa do stack).

> **Esta story é FUTURO.** Entregável nesta rodada = **spec de viabilidade + guarda-corpos**, sem código de produção.

---

## Story

**Como** controladoria,
**quero** um agente de IA que **sugira** (e, quando confiável, **distribua automaticamente**) tarefas — priorização e responsável — sobre o motor determinístico de R6-04,
**para que** a distribuição fique mais rápida e inteligente, mantendo o humano no controle e o rastro auditável.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (base determinística):** R6-04 define elegibilidade + fura-fila + rodízio e um **hook de extensão** para IA. R7-02 pluga nesse ponto (não substitui a lógica; a **enriquece**).
- **JÁ EXISTE (padrão externo via n8n):** integrações externas passam por n8n (memória `project_stack_simplified`) — o provedor de IA deve seguir o mesmo padrão de fronteira.
- **NOVO:** camada de sugestão (score de responsável/prioridade), modo **sugestão vs automático**, e limiar de confiança para auto-distribuir.

> **DECISÃO A TRAVAR (design):** IA começa em **modo sugestão** (humano confirma); auto-distribuição só acima de um **limiar de confiança** e sempre **reversível/auditável**. Nunca decide sozinha sem fallback para o motor determinístico.

---

## Acceptance Criteria (de DESIGN)

1. **Spec de viabilidade aprovada** em `docs/reforma-2026-07/spec-ia-distribuicao.md`: sinais/features disponíveis (tipo de intimação, histórico de carga, competência do usuário), abordagem candidata e riscos.
2. **Guarda-corpos definidos:** modo sugestão como padrão; auto-distribuição só acima de limiar; **fallback determinístico** obrigatório; toda ação da IA auditável e reversível.
3. **Integração pelo padrão do stack:** IA acessada via **n8n**/fronteira externa, não acoplada ao core.
4. **Métricas de aceitação definidas:** como medir se a sugestão é boa (taxa de aceite pela controladoria) antes de habilitar auto.
5. **Marcada FUTURO:** dependências e "definition of ready" para sair de FUTURO documentadas; nenhuma implementação de produção nesta rodada.

---

## Tasks / Subtasks

- [ ] **Spike — viabilidade** (AC:1) — features disponíveis a partir de R6; abordagem (regras+ML leve vs LLM); riscos de dados/LGPD.
- [ ] **Design — guarda-corpos** (AC:2) — sugestão vs automático; limiar; fallback; auditoria/reversão.
- [ ] **Design — fronteira n8n** (AC:3) — como a IA se pluga sem acoplar o core.
- [ ] **Design — métricas** (AC:4) — taxa de aceite, drift, monitoramento.
- [ ] **Escrever** `docs/reforma-2026-07/spec-ia-distribuicao.md` (marcado FUTURO) e submeter a @architect.

---

## Dev Notes

**Regras de ouro:**
- IA **nunca** substitui o fallback determinístico de R6-04.
- Toda ação é **auditável e reversível** (humano no controle).
- Provedor de IA via **n8n** (padrão do stack); LGPD respeitada nos dados enviados.
- **Não** implementar produção nesta rodada — só design/spike.

### Testing (de design)
- Guarda-corpos revisados: modo sugestão é o default; auto só acima do limiar.
- Fallback determinístico coberto (IA indisponível → R6-04 assume).
- @architect aprova a spec e a "definition of ready" para sair de FUTURO.

---

## Cruzamentos

- **R7↔R6-04:** pluga no ponto de extensão do motor determinístico.
- **R7↔R6-03:** opera sobre o modelo de tarefa.
- **R7↔R3 (D3):** competência/visibilidade do usuário como feature e como limite.

---

## Dependências

- **Bloqueada por:** R6-01/02/03/04; massa de dados; decisão do owner sobre IA/n8n.
- **Habilita:** distribuição assistida por IA (quando sair de FUTURO).

## File List

- `docs/reforma-2026-07/spec-ia-distribuicao.md` (novo — design, FUTURO)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível FUTURO (IA de distribuição) — bloco B7 | @sm |
