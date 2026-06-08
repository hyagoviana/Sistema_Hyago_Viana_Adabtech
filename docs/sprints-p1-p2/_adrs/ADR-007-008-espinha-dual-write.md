# ADR-007 + ADR-008 — Espinha configurável (dual-write seguro)

> **Data:** 2026-06-08 · **Status:** Aceito · **Sprint:** S13 (Fase A)

## ADR-007 — Fonte da verdade durante a migração (dual-write)

**Contexto:** trocar `case_type`/`macrostatus_op`/`macrostatus_fin` (CHECK fixos) por entidades configuráveis (`service_type_id`, `stage_op_id`, `stage_fin_id`) sem quebrar produção.

**Decisão:**
- O **alvo canônico** é `stage_op_id` / `stage_fin_id` (e `service_type_id`).
- **Durante a transição (S13)**, a **UI ainda escreve `macrostatus_*`** (o Kanban dinâmico só chega na S14). Então, em S13, mantemos um **trigger de projeção `macrostatus_* → stage_*`** (BEFORE INSERT/UPDATE) que sincroniza os `stage_id` automaticamente. A bifurcação automática **atual permanece intacta** (continua disparando por `macrostatus_op`), evitando o BLOCKER de quebra silenciosa.
- **Na S14**, quando a UI passar a escrever `stage_id`, a direção da projeção **inverte** (`stage_* → macrostatus_*`) e a bifurcação passa a ler `stage_role` (ADR-008). As colunas `macrostatus_*` só são removidas na **S15** (gated).

**Consequência:** rollback trivial em S13 (basta dropar as colunas/triggers novos; `macrostatus_*` continua sendo a verdade). Zero downtime.

## ADR-008 — Marcador semântico de etapa (`stage_role`)

**Contexto:** com etapas dinâmicas e renomeáveis, a bifurcação não pode mais comparar strings (`'IMPLANTADO'`).

**Decisão:** `system_pipeline_stages.stage_role TEXT CHECK ('normal','won','lost','closed')`.
- `won` = etapa que **dispara o financeiro** (hoje IMPLANTADO / IMPLANTACAO_PARCIAL).
- `closed` = encerrado feliz (ENCERRADO / QUITADO). `lost` = cancelado. `normal` = demais.
- Botão "Enviar para o financeiro" (S16) e o trigger de bifurcação (quando ativado na S14/S16) leem `stage_role = 'won'`, nunca o label. Admin pode renomear etapas livremente sem quebrar nada.

**Mapa seed (op):** IMPLANTADO, IMPLANTACAO_PARCIAL → `won`; ENCERRADO → `closed`; CANCELADO → `lost`; resto `normal`.
**Mapa seed (fin):** QUITADO → `closed`; CANCELADO → `lost`; resto `normal`.
