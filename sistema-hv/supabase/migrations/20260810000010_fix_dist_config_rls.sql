-- SEGURANCA: a RLS de system_distribution_config estava ABERTA para escrita.
--   • dist_config_upsert : FOR ALL  USING(true) WITH CHECK(true)  -> QUALQUER
--     usuario autenticado podia INSERIR/ATUALIZAR/DELETAR a config (incl. ligar
--     o motor em producao via active=true).
--   • dist_config_update_admin : apesar do nome, so checava organization_id
--     (nao checava admin).
-- Agora TODA escrita de config passa por server fns (service_role, que ignoram
-- RLS) com gate requireModule("controladoria","edit"):
--   - saveDistributionCredsFn      (credenciais/segredos, write-only)
--   - updateDistributionConfigFn   (mode/batch_hour)
--   - setDistributionActiveFn      (active)
-- Logo, o browser client NAO precisa mais de policy de escrita. Deixamos apenas
-- SELECT org-scoped. (service_role continua bypassando a RLS.)

DROP POLICY IF EXISTS dist_config_upsert       ON system_distribution_config;
DROP POLICY IF EXISTS dist_config_update_admin ON system_distribution_config;

-- SELECT segue org-scoped (recria de forma idempotente).
DROP POLICY IF EXISTS dist_config_select ON system_distribution_config;
CREATE POLICY dist_config_select ON system_distribution_config
  FOR SELECT TO authenticated
  USING (organization_id = system_current_organization_id());
