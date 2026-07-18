# Story R8-02: Tema de atuação "Clientes Inadimplentes" (casos do escritório contra quem não paga)

- **Épico:** R8 — Inadimplência (E8, bloco B8)
- **ID:** R8-02
- **Status:** Draft — DESIGN (modelagem do tema; codar após B2 + fonte de dados)
- **Estimativa relativa:** M (modelagem do tema no modelo canônico + campos/filtros próprios)
- **Executor sugerido:** @architect + @dev · Quality gate: @qa
- **Natureza:** ALTO NÍVEL / DESIGN. Entregável = **modelagem do tema aprovada**.

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES

- **B2 (camada TEMA + FRENTE/TIPO)** — o modelo canônico TEMA→CASO→TIPO precisa existir para "Inadimplentes" ser um TEMA de primeira classe (§4.1/§4.2). *(bloco mais sensível — precede)*
- **Fonte de dados de débito** — API ProIuris/Conta Azul (§9.4) para popular/qualificar os casos. *(bloqueante)*
- **Definição do cliente:** campos personalizados do tema (valor devido, origem do débito, fase de cobrança), lista de temas confirmada (§9.1/§9.2).

---

## Story

**Como** escritório,
**quero** um TEMA de atuação **"Clientes Inadimplentes"** (casos do escritório contra quem não paga), com pipeline, campos e filtros próprios,
**para que** a cobrança judicial/extrajudicial contra devedores seja tratada como uma frente de trabalho real no sistema — não só um relatório.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (modelo alvo):** o doc-mestre §4.1 lista **"Inadimplentes"** entre os TEMAS previstos ("1%/FIES, Indenização, COVID, Residência, Cível/Outros, **Inadimplentes**"). Esta story detalha esse tema.
- **JÁ EXISTE (padrão de campos do caso):** `system_cases.canonical_fields` JSONB (S2-07) — base para os campos próprios do tema (valor devido, fase). **Reusar.**
- **JÁ EXISTE (pipeline por tema, alvo B2/D2):** uma pipeline operacional única por tema — Inadimplentes terá as suas etapas (ex.: Notificação → Negociação → Ação judicial → Encerrado).
- **NOVO:** o tema "Inadimplentes" instanciado no modelo canônico (após B2), com frentes/tipos (judicial/extrajudicial?), campos personalizados e filtros dedicados na lista/Kanban.

> **DECISÃO A TRAVAR:** "Inadimplentes" é um **TEMA** (não um filtro do financeiro) — o relatório R8-01 é a **porta de entrada**; o tema é o **espaço de atuação**. Etapas/frentes/campos vêm do cliente (bloqueante).

---

## Acceptance Criteria (de DESIGN)

1. **Modelagem do tema aprovada** em `docs/reforma-2026-07/spec-inadimplencia.md` (seção tema): frentes/tipos (ex.: extrajudicial/judicial), etapas da pipeline op própria, campos personalizados (via `canonical_fields`).
2. **Ligação com B2 definida:** como o tema entra na camada TEMA→FRENTE→CASO sem quebrar o dual-write (`case_type`/`macrostatus_*`) — respeitando a Matriz §5.1 e a Sequência §7 (só depois da fundação B2).
3. **Filtros/campos próprios definidos:** lista/Kanban do tema com filtros por valor devido, dias de atraso, fase de cobrança (reusa aging de R8-01).
4. **Entrada de casos definida:** como um devedor do relatório R8-01 vira um CASO do tema Inadimplentes (manual? assistido?) e o vínculo com o cliente/caso original.
5. **Gate de $:** valores no tema exigem `financeiro:view` (§4.4).
6. **Sem produção:** entregável é a modelagem; implementação após B2 + fonte de dados.

---

## Tasks / Subtasks

- [ ] **Design — frentes/tipos do tema** (AC:1) — extrajudicial/judicial (ou conforme cliente); campos `canonical_fields` do tema.
- [ ] **Design — pipeline op do tema** (AC:1,2) — etapas próprias, ancoradas no modelo B2 (uma pipeline por tema, D2); mapear no `system_pipeline_stages`.
- [ ] **Design — encaixe em B2** (AC:2) — como criar o tema aditivamente (§7.5a) sem tocar service_types legados; backfill não se aplica (tema novo).
- [ ] **Design — filtros/UI** (AC:3) — lista/Kanban com filtros de dívida/atraso; reusa aging de R8-01.
- [ ] **Design — entrada de casos** (AC:4) — do relatório R8-01 ao caso do tema; vínculo ao cliente/caso de origem.
- [ ] **Design — gate de $** (AC:5) — `financeiro:view`.
- [ ] **Escrever** seção "tema Inadimplentes" em `docs/reforma-2026-07/spec-inadimplencia.md`.

---

## Dev Notes

**Regras de ouro:**
- Tema é **aditivo** sobre o modelo B2 — **não** tocar `case_type`/`macrostatus_*` nem service_types legados (Matriz §5.1, Sequência §7).
- Se criar/expor colunas em `system_cases`, **recriar `system_cases_active` (DROP+CREATE)** preservando todas as colunas (regra de ouro 2) — na implementação, não no design.
- Campos próprios via `canonical_fields` (S2-07), não novas colunas soltas.
- Valores exigem `financeiro:view` (§4.4).

### Testing (de design)
- Modelagem revisada contra a Matriz de Impacto §5 (não quebra dual-write).
- Fluxo devedor→caso do tema tem caminho definido.
- QA valida que o tema respeita a Sequência Segura (só após B2).

---

## Cruzamentos

- **R8↔R2 (B2):** "Inadimplentes" é um TEMA do modelo canônico — depende da camada TEMA/FRENTE.
- **R8↔R8-01:** relatório é a porta de entrada; tema é o espaço de atuação.
- **R8↔R4/B4:** gate de $ e fonte de dados de débito.
- **R8↔S2-07:** campos do tema em `canonical_fields`.

---

## Dependências

- **Bloqueada por:** B2 (camada TEMA/FRENTE); API ProIuris/Conta Azul; definição de temas/campos do cliente.
- **Habilita:** atuação de cobrança como frente de trabalho no sistema.

## File List

- `docs/reforma-2026-07/spec-inadimplencia.md` (novo — seção tema, design)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível (tema de atuação Inadimplentes) — bloco B8 | @sm |
