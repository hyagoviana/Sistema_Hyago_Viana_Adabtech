# ADR-009 + ADR-010 — Financeiro (bifurcação + acerto parcial)

> **Data:** 2026-06-08 · **Status:** Aceito · **Sprint:** S16

## ADR-009 — Bifurcação: função única idempotente

**Contexto:** hoje a bifurcação é automática (trigger em IMPLANTADO). A ata pede um **botão** "Enviar para o financeiro". O Architect (BLOCKER 5) alertou: trigger + botão coexistindo = risco de dupla bifurcação.

**Decisão:** uma **função única idempotente** `system_fn_bifurcar_financeiro(case_id)`:
- No-op se o caso já está bifurcado (`macrostatus_fin <> 'NAO_APLICAVEL'`).
- Senão, leva o caso para a 1ª etapa financeira (`ELABORANDO`).
- **Tanto o trigger automático quanto o botão chamam essa função** — nunca duplicam lógica. Mover o caso para uma etapa op com `stage_role='won'` continua disparando o automático (compat); o botão é o caminho manual. Resultado é idempotente em qualquer ordem.

## ADR-010 — Marcação "acerto parcial / judicial"

**Contexto:** um caso pode ir **parcialmente** ao financeiro sem encerrar 100% (ex.: ganhou R$10k → acerto; recorreu R$10k → judicial). A marcação **acompanha o caso**.

**Decisão (MVP):** colunas escalares em `system_cases`:
- `acerto_parcial BOOLEAN` — caso foi parcialmente acertado.
- `tem_pendencia_judicial BOOLEAN` — segue parte judicial em paralelo.
- `acerto_parcial_obs TEXT` — observação livre (valores/contexto).

Badge no card e na ficha, visível a quem faz o acerto. Se no futuro precisar de **histórico/valores estruturados** (várias entradas ao longo do tempo), migra para tabela `system_case_settlement_marks` (a coluna vira a "marcação atual"). Para o MVP, escalar atende ("acompanha o caso").
