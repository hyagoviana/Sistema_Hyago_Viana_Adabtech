# Story R6-02: Dedup + triagem de intimações (confirmar/arquivar → vincular ao caso)

- **Épico:** R6 — Controladoria + distribuição de tarefas (E6, bloco B6)
- **ID:** R6-02
- **Status:** Draft — DESIGN (spec + fluxo; codar só após R6-01)
- **Estimativa relativa:** M (design do fluxo de triagem + regras de dedup)
- **Executor sugerido:** @architect (regras) + @dev (fluxo/UI) · Quality gate: @qa
- **Natureza:** ALTO NÍVEL / DESIGN. Entregável = **fluxo + regras de dedup aprovados**.

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES

- **R6-01 concluída** (staging `system_intimacoes` + ingestão definidas).
- **Regra de dedup por escrito** — o cliente/controladoria precisa dizer o que conta como "intimação repetida" (mesmo processo + mesmo prazo? mesma movimentação no mesmo dia? hash do texto?). *(pendência §9.3)*
- **Mockup** da lista de triagem (§9.3).

---

## Story

**Como** controladoria,
**quero** uma lista de intimações **deduplicadas** onde eu **confirmo** (vincula ao caso/cliente) ou **arquivo** cada uma,
**para que** o mesmo prazo não gere trabalho duplicado e cada intimação válida vire ponto de partida de uma tarefa (R6-03) já amarrada ao caso certo.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE:** rota `controladoria.index.tsx` (casca) — vira a **caixa de entrada** de intimações.
- **JÁ EXISTE (padrão de idempotência):** `provider_ext_id` (Conta Azul) — reusar como base do dedup por origem.
- **NOVO:** motor de dedup (`dedup_group_id`), ações confirmar/arquivar, e o vínculo `intimacao → system_cases`/`system_clients`.

> **DECISÃO A TRAVAR:** a dedup é **por lote na ingestão** (marca `dedup_group_id`) e a controladoria só vê **1 representante por grupo**; arquivar/confirmar o representante decide o grupo. Regra exata do agrupamento vem do cliente (bloqueante).

---

## Acceptance Criteria (de DESIGN)

1. **Regra de dedup documentada e aprovada:** definição formal de "intimação repetida" (campos que compõem o hash/grupo) em `docs/reforma-2026-07/spec-proiuris.md` (seção dedup).
2. **Fluxo de triagem especificado:** estados da intimação (`nova → confirmada | arquivada`), efeito de cada ação, e o que acontece ao grupo dedup ao decidir o representante.
3. **Vínculo confirmar→caso definido:** ao confirmar, como amarra ao `system_cases` (usa a chave de correlação de R6-01/N7); tratamento quando **não há caso correspondente** (criar pendência? deixar sem vínculo e alertar?).
4. **RBAC definido:** só papéis com acesso ao módulo Controladoria veem/triam a caixa (cruza com R3/permissão efetiva D3).
5. **Sem produção nesta story:** entregável é o design; implementação depende de R6-01 aplicada.

---

## Tasks / Subtasks

- [ ] **Design — motor de dedup** (AC:1) — definir composição do `content_hash`/`dedup_group_id`; documentar casos de borda (mesma intimação em 2 crons; texto ligeiramente diferente).
- [ ] **Design — máquina de estados** (AC:2) — `nova/confirmada/arquivada`; auditoria (quem/quando) reusando padrão de eventos do sistema.
- [ ] **Design — ação confirmar→vínculo** (AC:3) — resolver `case_id` via correlação; política para "sem caso".
- [ ] **Design — UI da caixa de entrada** (AC:2,4) — lista com 1 representante por grupo, botões Confirmar/Arquivar, badge de duplicatas colapsadas, filtro por status/órgão/prazo. Reaproveitar `controladoria.index.tsx`.
- [ ] **Design — gate RBAC** (AC:4) — via `permissaoEfetiva(user,'controladoria','view'/'edit')` (D3). Cruza com R3-P7.
- [ ] **Documentar** no `spec-proiuris.md` (seção triagem/dedup).

---

## Dev Notes

**Regras de ouro:**
- Vínculo intimação→caso **não** deve escrever em `case_type`/`macrostatus_*` (só `case_id`/referência lateral).
- Toda ação de triagem é **auditável** (padrão de eventos existente, ex.: `canonical_fields_updated`).
- RBAC pela **permissão efetiva** (D3), não por `role` hardcoded.

### Testing (de design)
- Cenários de dedup revisados: 2 crons repetindo a mesma intimação → 1 representante.
- Confirmar sem caso correspondente tem caminho definido.
- QA aprova a máquina de estados.

---

## Cruzamentos

- **R6↔R6-01:** consome a staging e a chave de correlação.
- **R6↔R3 (D3):** gate por permissão efetiva do módulo Controladoria.
- **R6→R6-03:** intimação confirmada é o gatilho de criação de tarefa.

---

## Dependências

- **Bloqueada por:** R6-01; regra de dedup escrita; mockup.
- **Habilita:** R6-03 (gerar tarefa), R6-04 (distribuição).

## File List

- `docs/reforma-2026-07/spec-proiuris.md` (seção dedup/triagem — design)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível (dedup + triagem) — bloco B6 | @sm |
