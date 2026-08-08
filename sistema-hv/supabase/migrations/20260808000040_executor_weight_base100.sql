-- ============================================================================
-- Sistema HV — Migration — M9: peso do executor em BASE 100 (100 = distribui igual)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-07 (Story M9). Decisão T0 = opção (a): escala REAL no banco.
--
-- O motor usa a RAZÃO weight/Σweight (responsible-engine.creditGeneralQueue),
-- então 100/100/100 ≡ 1/1/1 — a distribuição RELATIVA não muda. A base 100 é
-- legibilidade para o admin ("esse recebe 50% do padrão" = peso 50).
--
-- (1) DEFAULT passa de 1.0 → 100 (novos executores nascem "distribui igual").
-- (2) Normaliza os existentes UMA vez: weight (escala 1.0, ~0.1–10) × 100.
--     Guarda `weight <= 10` = idempotência (R1): valores já em base 100 (≥ ~50)
--     NÃO são re-multiplicados numa 2ª execução. Ninguém usa peso ≤10 na base 100
--     (para "tirar do rodízio" usa-se a flag participa/peticionante, não peso 0).
--
-- Coluna: system_projuris_executor_mapping.weight NUMERIC(5,2) (cabe até 999.99).
--
-- Aplicar via (idempotente, de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000040_executor_weight_base100.sql
-- ============================================================================

ALTER TABLE system_projuris_executor_mapping
  ALTER COLUMN weight SET DEFAULT 100;

UPDATE system_projuris_executor_mapping
  SET weight = weight * 100
  WHERE weight > 0 AND weight <= 10;
