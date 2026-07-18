-- Rollback — R3-01 — Infra de permissão efetiva por módulo.
-- Remove a tabela de overrides por usuário×módulo. Como a story é ADITIVA e a
-- tabela é isolada (nenhuma FK aponta PARA ela; a única FK é user_id → system_users),
-- o DROP não afeta nenhum outro objeto. NÃO toca system_cases / papéis / funções.
DROP TRIGGER IF EXISTS trg_system_user_module_perms_updated_at ON system_user_module_perms;
DROP TABLE IF EXISTS system_user_module_perms CASCADE;
