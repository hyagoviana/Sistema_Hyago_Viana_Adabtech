-- ============================================================================
-- Sistema HV — Migration — A4 (Reunião 2026-08-05): Campos DEPENDENTES (pai→filho)
-- ----------------------------------------------------------------------------
-- Adiciona `parent_field_def_id` em system_tema_field_defs: um campo do tema pode
-- DEPENDER de outro campo (grupo pai → grupo filho, ex.: Município → Período). Na
-- ficha do caso, o filho só é EDITÁVEL quando o valor do pai está preenchido.
--
--   • parent_field_def_id — FK AUTO-REFERENTE nullable p/ system_tema_field_defs(id).
--                           NULL = campo sem dependência (comportamento atual).
--                           ON DELETE SET NULL é só rede de segurança: a tabela usa
--                           SOFT-DELETE (deleted_at), então o FK físico raramente
--                           dispara — o service/UI trata "pai com deleted_at" como
--                           dependência inexistente (filho volta a ficar livre).
--
-- REGRAS de hierarquia (mesmo tema/frente, sem ciclo, máx. 3 níveis, máx. 3 filhos
-- por pai) são validadas na APLICAÇÃO (service, 422) — não cabem num CHECK simples
-- do Postgres (recursividade). O CHECK aqui só impede auto-referência direta.
--
-- ADITIVA — 1 coluna nullable com DEFAULT NULL ⇒ regressão zero (linhas existentes
-- ficam sem dependência). Idempotente (ADD COLUMN / CREATE INDEX IF NOT EXISTS +
-- DO-block guardado p/ o CHECK). Recria a view `_active` (SELECT * é congelado na
-- criação). Molde: 20260804000003_tema_field_defs_move_to_stage.sql.
-- ============================================================================

ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS parent_field_def_id UUID NULL
    REFERENCES system_tema_field_defs(id) ON DELETE SET NULL;

-- Impede auto-referência DIRETA (pai = ele mesmo). Ciclos indiretos e limites de
-- profundidade/filhos são validados no service (não cabem em CHECK simples).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'system_tema_field_defs'
      AND c.conname = 'system_tema_field_defs_parent_not_self_check'
  ) THEN
    ALTER TABLE system_tema_field_defs
      ADD CONSTRAINT system_tema_field_defs_parent_not_self_check
      CHECK (parent_field_def_id IS NULL OR parent_field_def_id <> id);
  END IF;
END $$;

-- Índice de leitura por pai (contar filhos / listar descendentes), só entre ativos.
CREATE INDEX IF NOT EXISTS idx_system_tema_field_defs_parent
  ON system_tema_field_defs (parent_field_def_id)
  WHERE deleted_at IS NULL;

-- Reexpande a view p/ expor a coluna nova (SELECT * é congelado na criação).
CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
