# 🏗 Architect Review — Plano de Sprints S12–S18 (Projetos 1 e 2)

> **Revisor:** @architect Winston · **Coordenação:** Orion (aios-master) · **Data:** 2026-06-08

## Veredito
**APROVADO COM RESSALVAS.** Sequenciamento macro correto; dual-write→drop é a estratégia certa. 5 BLOCKERs antes de codar S12/S13/S16/S17.

## BLOCKERs
1. **Trigger de bifurcação acoplado a strings de enum** — `system_cases_bifurcacao_trg()` (migration 0007) compara literais `IMPLANTADO`/`NAO_APLICAVEL`. No dual-write de S13, definir fonte da verdade (`stage_id` canônico; `macrostatus_*` vira projeção) e reescrever o gatilho desacoplado de strings.
2. **`system_pipeline_stages` precisa de marcador semântico** (`triggers_financeiro BOOLEAN` ou `stage_role TEXT CHECK ('normal','won','lost','closed')`) — admin renomeia etapa e não pode quebrar a bifurcação. Pré-S13. Desacopla S16 (botão lê o mesmo marcador).
3. **Numeração `document_number` com race condition** — `SELECT MAX()+1` em BEFORE INSERT sem lock. Usar `pg_advisory_xact_lock(hashtext(case_id))` ou `UNIQUE(case_id, document_number)`+retry. Corrigir em **S12**.
4. **Idempotência do webhook (ADR-005) nunca foi migrada** — não há `webhook_dedupe`. S12 deve criar a migration de fato antes de plugar o handler.
5. **Dupla bifurcação (trigger+botão) via flag é armadilha** — ambos devem chamar a MESMA função idempotente `fn_bifurcar_para_financeiro(case_id)` (no-op se já bifurcado). A flag escolhe o gatilho, nunca duplica a lógica.

## Ressalvas
- **R1** "Acerto parcial": coluna em `system_cases` só se for estado escalar; se tiver histórico/valor → tabela própria `system_case_settlement_marks`. Decidir antes de S16.
- **R2** Iframe Google Docs (cookies de terceiros): "nova aba + Concluí a edição" deve ser o caminho PRIMÁRIO testado, não fallback teórico. AC em S12.
- **R3** Imutabilidade do Termo: RLS insuficiente (service_role bypassa) → trigger `prevent_termo_mutation_after_approval()`. S17.
- **R4** Segregação: CHECK vê só a linha; a trava real é **quem pode setar `conferidor_id`** (RLS/trigger validando `auth.uid() <> elaborador_id` no set). S17.
- **R5** Truncamento §9.2 determinístico: cálculo server-side em **inteiros (centavos)**, nunca float no client. Testes de borda. S17.
- **R6** Drop das colunas hardcoded (S15): gate de verificação (`COUNT WHERE stage_id IS NULL = 0` + grep no código), migration separada reversível-por-restore.
- **R7** Migração (S13): tabela de-para versionada e auditável, não inline; regra para estados sem equivalente (ex. CANCELADO).

## ADRs necessários antes de codar
1. Fonte da verdade no dual-write (`stage_id` canônico) — **pré-S13, bloqueante**
2. Marcador semântico de etapa (`triggers_financeiro`/`stage_role`) — **pré-S13, bloqueante**
3. Bifurcação trigger vs botão vs ambos (função única idempotente) — pré-S16
4. Modelo do "acerto parcial" (coluna vs tabela) — pré-S16
5. Imutabilidade + segregação do Termo — pré-S17
6. Atualizar ADR-005 (idempotência ZapSign efetivamente migrada) — pré-S12

## Ajuste estrutural
- **Quebrar S17** em **S17a** (calculadora + snapshot imutável + PDF/hash) e **S17b** (conferência segregada + aprovação híbrida + supersedes).
- **Serializar migrations S12↔S13** (S12 toca colunas Drive em `system_cases`; S13 reestrutura `system_cases`).
