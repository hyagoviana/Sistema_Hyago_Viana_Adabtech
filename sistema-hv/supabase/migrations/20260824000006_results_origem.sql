-- ============================================================================
-- 🔴 CORRIGE: o batch automático apagava a distribuição feita à mão
--
-- Achado do QA (2026-08-24). `runSync` limpa os resultados da data antes de
-- reinserir — é assim que ele garante idempotência ao rodar de novo:
--
--     DELETE FROM system_distribution_results
--      WHERE organization_id = ... AND distribution_date = ...
--
-- Só que agora existe uma SEGUNDA origem de resultados: o lote que a
-- controladoria distribui pela tela "A distribuir". Se alguém distribui de manhã
-- e o cron das 8h (ou o botão "Rodar sync") passa depois, o DELETE leva junto o
-- trabalho humano — sem erro, sem aviso. As linhas do staging ficam marcadas
-- como DISTRIBUIDA, mas o executor e a regra somem do histórico.
--
-- A correção é dar RG a cada linha: o cron só apaga o que o cron criou.
-- ============================================================================

ALTER TABLE system_distribution_results
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'batch';

COMMENT ON COLUMN system_distribution_results.origem IS
  'Quem gerou a linha: "batch" (sync automático, apagável na reexecução do dia) ou "staging" (distribuição revisada por uma pessoa — NUNCA apagada pelo batch).';

-- As linhas que já existem vieram todas do batch (o caminho do staging nasceu
-- hoje), então o DEFAULT já as classifica corretamente.

-- O DELETE do runSync passa a filtrar por origem; este índice o acompanha.
CREATE INDEX IF NOT EXISTS idx_dist_results_org_data_origem
  ON system_distribution_results(organization_id, distribution_date, origem);
