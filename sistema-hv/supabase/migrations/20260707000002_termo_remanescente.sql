-- ============================================================================
-- Sistema HV — Migration — S7-02 — Remanescente anterior no snapshot do termo
-- ----------------------------------------------------------------------------
-- Reconciliação dos placeholders do COMPLEMENTAR: hoje o remanescente anterior é
-- só input de tela (S6-03/S6-04) e não persiste. Para que:
--   - honorarios_total = valor_total (abatimento) + remanescente_anterior
--   - <remanescente_anterior> saia com o valor digitado
-- persistimos o remanescente digitado na elaboração numa coluna nova do snapshot.
--
-- Nullable (só faz sentido no COMPLEMENTAR; PARCIAL fica NULL/vazio).
-- NÃO entra no gatilho de imutabilidade (system_fn_termo_immutable) — o
-- remanescente é gravado ainda em RASCUNHO, junto com o cálculo.
--
-- REGRA DE OURO: NÃO toca system_cases → NÃO recria system_cases_active.
-- NÃO recriar trg_system_cases_bifurcacao (dropado).
-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   DROP VIEW IF EXISTS system_termo_snapshots_active;
--   ALTER TABLE system_termo_snapshots DROP COLUMN IF EXISTS remanescente_anterior_centavos;
--   CREATE OR REPLACE VIEW system_termo_snapshots_active AS
--     SELECT * FROM system_termo_snapshots;
--   GRANT SELECT ON system_termo_snapshots_active TO anon, authenticated, service_role;
-- ============================================================================

ALTER TABLE system_termo_snapshots
  ADD COLUMN IF NOT EXISTS remanescente_anterior_centavos BIGINT;

-- A view do snapshot é SELECT * — recriar para expor a coluna nova.
CREATE OR REPLACE VIEW system_termo_snapshots_active AS
  SELECT * FROM system_termo_snapshots;

GRANT SELECT ON system_termo_snapshots_active TO anon, authenticated, service_role;
