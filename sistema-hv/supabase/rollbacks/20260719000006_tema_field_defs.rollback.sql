-- Rollback R2-07 — Campos personalizados por TEMA/FRENTE.
-- Simétrico: dropa a view _active, a trigger de auditoria e updated_at, as
-- policies, e a tabela system_tema_field_defs. Os VALORES por caso continuam em
-- system_cases.canonical_fields (S2-07) — NÃO são tocados aqui (a UI da ficha
-- volta ao modo chave/valor livre). NÃO toca system_cases / view / trigger.

DROP VIEW IF EXISTS system_tema_field_defs_active;

DROP TRIGGER IF EXISTS trg_audit_tema_field_defs ON system_tema_field_defs;
DROP TRIGGER IF EXISTS trg_system_tema_field_defs_updated_at ON system_tema_field_defs;

DROP POLICY IF EXISTS system_tema_field_defs_select_own_org ON system_tema_field_defs;
DROP POLICY IF EXISTS system_tema_field_defs_insert_own_org ON system_tema_field_defs;
DROP POLICY IF EXISTS system_tema_field_defs_update_own_org ON system_tema_field_defs;
DROP POLICY IF EXISTS system_tema_field_defs_delete_own_org ON system_tema_field_defs;

DROP INDEX IF EXISTS system_tema_field_defs_uq;
DROP INDEX IF EXISTS idx_system_tema_field_defs_tema_active;

DROP TABLE IF EXISTS system_tema_field_defs;
