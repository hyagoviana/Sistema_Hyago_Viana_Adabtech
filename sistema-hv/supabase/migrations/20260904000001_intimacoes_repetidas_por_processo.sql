-- ============================================================================
-- Sistema HV — S1-03 — Intimações repetidas do mesmo processo — 2026-09-04
-- ----------------------------------------------------------------------------
-- Resposta A1 do Thiago (04/09). A proposta anterior (agrupar por publicação e
-- gerar UMA tarefa) foi RECUSADA por não bater com a metodologia do SHV/ProJuris:
--
--   "Existem 2 situações/etapas diferentes: o quê fazer com a intimação; se ela
--    gera tarefa ou não. Independentemente da intimação gerar tarefa, ela vai ser
--    arquivada após ser conferida. O gerar tarefa é uma outra funcionalidade."
--
-- O problema real é o retrabalho de LEITURA:
--
--   "a pessoa vê tudo, e precisa lembrar se já olhou aquele processo ou não"
--
-- O fluxo que ele definiu:
--   1. recebe as intimações do dia;
--   2. identifica repetidas NO DIA, do mesmo PROCESSO (não da mesma publicação);
--   3. lista apenas a primeira; as outras ficam "em stand by";
--   4. a decisão tomada em qualquer uma vale para o grupo;
--   5. no ProJuris, TODAS são arquivadas (movimento normal de toda intimação);
--   6. no SHV, a que gerou a tarefa fica vinculada (histórico) e as outras ficam
--      com "arquivado por repetição", que é DIFERENTE de "arquivado".
--
-- O que esta migration faz:
--   1. `ARQUIVADO_REPETICAO` no CHECK de `decisao`;
--   2. coluna `grupo_processo_dia` — a chave de agrupamento (processo + dia),
--      calculada na ingestão e preenchida aqui para o que já existe;
--   3. índice para a fila agrupar sem varrer a tabela.
--
-- Impacto medido antes de escrever: 674 intimações → 458 grupos (-32% de linhas
-- para conferir). Há processos com 7 intimações no mesmo dia.
--
-- Aditiva e idempotente. Não altera nenhuma decisão já tomada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Novo estado de decisão
-- ----------------------------------------------------------------------------
ALTER TABLE system_distribution_movements
  DROP CONSTRAINT IF EXISTS system_distribution_movements_decisao_check;
ALTER TABLE system_distribution_movements
  ADD CONSTRAINT system_distribution_movements_decisao_check
  CHECK (decisao IN ('PENDENTE', 'ARQUIVADO', 'LIDO', 'DISTRIBUIR', 'ARQUIVADO_REPETICAO'));

COMMENT ON COLUMN system_distribution_movements.decisao IS
  'PENDENTE | ARQUIVADO (conferida e arquivada) | LIDO | DISTRIBUIR (gerou tarefa) | ARQUIVADO_REPETICAO (S1-03: era repetição de outra intimação do MESMO processo no MESMO dia; foi arquivada junto, sem ter sido lida uma a uma).';

-- ----------------------------------------------------------------------------
-- 2) Chave de agrupamento: processo + dia
--
-- Preferência de identificação do processo: código do ProJuris (estável) → CNJ
-- (texto, só dígitos) → o próprio id (sem processo identificado, cada linha é seu
-- próprio grupo — nunca agrupamos o que não sabemos que é o mesmo processo).
-- ----------------------------------------------------------------------------
ALTER TABLE system_distribution_movements
  ADD COLUMN IF NOT EXISTS grupo_processo_dia TEXT;

COMMENT ON COLUMN system_distribution_movements.grupo_processo_dia IS
  'S1-03: chave "processo + dia" usada para exibir uma intimação por processo na fila. Linha sem processo identificado recebe uma chave própria (id) e nunca é agrupada com outra.';

UPDATE system_distribution_movements
SET grupo_processo_dia =
  COALESCE(
    NULLIF(projuris_processo_codigo, ''),
    NULLIF(regexp_replace(COALESCE(numero_cnj, ''), '\D', '', 'g'), ''),
    id::text
  ) || '|' || COALESCE(data_referencia::text, 'sem-data')
WHERE grupo_processo_dia IS NULL;

CREATE INDEX IF NOT EXISTS idx_dist_movements_grupo
  ON system_distribution_movements(organization_id, grupo_processo_dia)
  WHERE decisao = 'PENDENTE';

-- ============================================================================
-- ROLLBACK (manual):
--   DROP INDEX IF EXISTS idx_dist_movements_grupo;
--   ALTER TABLE system_distribution_movements DROP COLUMN IF EXISTS grupo_processo_dia;
--   UPDATE system_distribution_movements SET decisao='ARQUIVADO' WHERE decisao='ARQUIVADO_REPETICAO';
--   ALTER TABLE system_distribution_movements DROP CONSTRAINT system_distribution_movements_decisao_check;
--   ALTER TABLE system_distribution_movements ADD CONSTRAINT system_distribution_movements_decisao_check
--     CHECK (decisao IN ('PENDENTE','ARQUIVADO','LIDO','DISTRIBUIR'));
-- ============================================================================
