-- ============================================================================
-- Sistema HV — Migration 0032 — S1-06: classificação inicial dos LEGADOS
-- ----------------------------------------------------------------------------
-- REGRA SIMPLES INICIAL (v2.3) + CORREÇÃO MANUAL (S1-03, fora desta migration).
--
-- Classifica os casos legados por uma regra OBJETIVA e IDEMPOTENTE:
--   caso com procuração ASSINADA NO SISTEMA → lifecycle='CLIENTE'; resto → LEAD.
--
-- Sinal de "assinada no sistema" (schema real):
--   (a) system_cases.assinatura_liberada_at IS NOT NULL  (mig. 0027), OU
--   (b) EXISTS system_case_documents com doc_kind='procuracao' e status='ASSINADO'.
--
-- O backfill de S1-01 (mig. 0030) já cobriu o sinal (a). Esta migration ADICIONA
-- o sinal (b) — docs ASSINADO cujo caso ainda ficou LEAD por não ter o carimbo
-- assinatura_liberada_at.
--
-- IDEMPOTENTE E REVERSÍVEL: só toca quem AINDA está lifecycle='LEAD' e
-- perdido_at IS NULL (não corrigido à mão). Rodar 2x dá o mesmo resultado e NÃO
-- sobrescreve correções manuais (CLIENTE/PERDIDO feitos pelos botões da S1-03).
--
-- NÃO altera macrostatus_op/fin, posição no Kanban nem stage_*_id — só popula
-- lifecycle. Nenhum caso é rebaixado nem promovido em massa fora da regra.
-- NÃO recria trg_system_cases_bifurcacao (segue dropado desde a 0022).
-- NÃO redefine system_cases_active (só UPDATE de dados).
-- ============================================================================

UPDATE system_cases c
   SET lifecycle = 'CLIENTE'
 WHERE c.deleted_at IS NULL
   AND c.lifecycle = 'LEAD'          -- só quem ainda não foi corrigido/backfillado
   AND c.perdido_at IS NULL          -- nunca reclassifica um perdido manual
   AND (
     c.assinatura_liberada_at IS NOT NULL      -- sinal (a) — redundante c/ S1-01
     OR EXISTS (                                -- sinal (b) — doc procuração ASSINADO
       SELECT 1
       FROM system_case_documents d
       WHERE d.case_id = c.id
         AND d.doc_kind = 'procuracao'
         AND d.status = 'ASSINADO'
         AND d.deleted_at IS NULL
     )
   );
