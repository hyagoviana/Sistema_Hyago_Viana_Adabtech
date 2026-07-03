-- ============================================================================
-- Sistema HV — Migration (DADOS) — S9-06 — rebaixar CLIENTE-por-procuração → LEAD
-- ----------------------------------------------------------------------------
-- Modelo novo (Sprint 9): SÓ o CONTRATO assinado promove a CLIENTE. Casos que
-- viraram CLIENTE apenas por PROCURAÇÃO (legado) voltam a LEAD, movendo o carimbo
-- para procuracao_assinada_at e mantendo macrostatus_comercial='GANHO'.
--
-- CRITÉRIO (validado com dados reais 2026-07-03): CLIENTE + SEM documento
--   doc_kind='contrato' ASSINADO no caso. Diagnóstico rodado antes do UPDATE:
--   1 candidato → FIES-2026-0065 (id 0568b602-...), 0 contratos assinados,
--   1 procuração assinada, assinatura_liberada_at IS NULL (o n8n promoveu sem
--   carimbar assinatura_liberada_at — por isso o critério é "sem contrato",
--   não "assinatura_liberada_at NOT NULL" como no draft da story).
--
-- procuracao_assinada_at recebe COALESCE(assinatura_liberada_at, created_at do
--   caso, now()) — preserva o instante quando existir; senão usa o nascimento do
--   caso (fallback determinístico e reversível).
--
-- AUDITADO + REVERSÍVEL: cada rebaixamento grava um system_case_events
--   (action='rebaixado_lead_migracao_s9') com os valores ORIGINAIS no diff. O
--   rollback restaura lifecycle='CLIENTE' + assinatura_liberada_at a partir dele.
--
-- REGRA DE OURO 2: NÃO toca COLUNAS de system_cases (só DADOS) → NÃO recria a
--   view. REGRA DE OURO 6: NÃO recria trg_system_cases_bifurcacao.
-- IDEMPOTENTE: o WHERE só casa CLIENTE sem contrato; após rodar, os casos já são
--   LEAD e não recaem. Rodar 2x não rebaixa de novo nem duplica evento (guarda
--   por NOT EXISTS de evento anterior).
-- ============================================================================

-- 1) Auditoria (por caso candidato) ANTES do UPDATE — grava o estado original.
INSERT INTO system_case_events (case_id, organization_id, action, diff, triggered_by)
SELECT
  c.id,
  c.organization_id,
  'rebaixado_lead_migracao_s9',
  jsonb_build_object(
    'from', c.lifecycle,
    'to', 'LEAD',
    'motivo', 'procuracao<>contrato',
    'assinatura_liberada_at_original', c.assinatura_liberada_at,
    'assinatura_liberada_by_original', c.assinatura_liberada_by,
    'procuracao_assinada_at_novo',
      COALESCE(c.assinatura_liberada_at, c.created_at, now())
  ),
  NULL
FROM system_cases c
WHERE c.deleted_at IS NULL
  AND c.lifecycle = 'CLIENTE'
  AND NOT EXISTS (
    SELECT 1 FROM system_case_documents d
     WHERE d.case_id = c.id
       AND d.doc_kind = 'contrato'
       AND d.status = 'ASSINADO'
       AND d.deleted_at IS NULL
  )
  -- Idempotência: não regrava o evento se já rebaixamos este caso antes.
  AND NOT EXISTS (
    SELECT 1 FROM system_case_events e
     WHERE e.case_id = c.id
       AND e.action = 'rebaixado_lead_migracao_s9'
  );

-- 2) Rebaixamento: CLIENTE → LEAD, move o carimbo, limpa assinatura de contrato.
--    Respeita o CHECK de S9-01 (LEAD sem assinatura_liberada_at é válido).
UPDATE system_cases c
   SET lifecycle = 'LEAD',
       procuracao_assinada_at =
         COALESCE(c.procuracao_assinada_at, c.assinatura_liberada_at, c.created_at, now()),
       assinatura_liberada_at = NULL,
       assinatura_liberada_by = NULL,
       macrostatus_comercial = 'GANHO'
 WHERE c.deleted_at IS NULL
   AND c.lifecycle = 'CLIENTE'
   AND NOT EXISTS (
     SELECT 1 FROM system_case_documents d
      WHERE d.case_id = c.id
        AND d.doc_kind = 'contrato'
        AND d.status = 'ASSINADO'
        AND d.deleted_at IS NULL
   );
