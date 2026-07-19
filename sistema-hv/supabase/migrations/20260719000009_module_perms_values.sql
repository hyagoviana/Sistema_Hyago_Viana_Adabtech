-- ============================================================================
-- Sistema HV — Permissões Fase B — chave "ver valores" por aba — 2026-07-19
-- ----------------------------------------------------------------------------
-- Além do acesso à aba (none/view/edit), o admin pode LIGAR/DESLIGAR "ver valores
-- (R$)" por colaborador, independentemente do acesso à aba. Guardamos essa chave
-- na MESMA tabela de overrides (system_user_module_perms), numa coluna nova
-- `can_view_values` (NULL = segue o padrão do papel).
--
-- Como a chave de valores pode existir SEM override de acesso (o admin deixa o
-- acesso em "Padrão do papel" e só liga/desliga valores), `access` passa a ser
-- NULLABLE (NULL = sem override de acesso). O CHECK de access aceita NULL
-- (CHECK ... IN (...) só falha para valores presentes fora da lista).
--
-- ADITIVO / regressão zero: enquanto ninguém setar `can_view_values`, o
-- comportamento é idêntico (os gates caem no padrão do papel). Idempotente.
-- ============================================================================

ALTER TABLE system_user_module_perms ALTER COLUMN access DROP NOT NULL;
ALTER TABLE system_user_module_perms ALTER COLUMN access DROP DEFAULT;
ALTER TABLE system_user_module_perms ADD COLUMN IF NOT EXISTS can_view_values BOOLEAN;
