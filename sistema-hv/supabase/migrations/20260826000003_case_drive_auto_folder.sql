-- ============================================================================
-- Sistema HV — Migration — D1 — Subpasta "Documentos automáticos" (ADITIVA)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-26 (Thiago): "o sistema criou a pasta do caso da pessoa (…)
-- quando a gente gera o documento, ele joga aqui no todo. E aí você tem uma
-- situação de que você tem um cliente que tem 40 documentos aqui. Na hora que
-- ele cria essa pasta desse caso, ele já cria aqui uma pasta documento
-- automático de uma vez só."
--
-- Duas colunas guardam a subpasta por caso. O `_url` é conveniência de UI (abrir
-- direto no Drive); o `_id` é o que o sistema usa.
--
-- Decisão do owner na mesma conversa: só o que o SISTEMA gera vai para a
-- subpasta. Anexo manual continua na raiz da pasta do caso.
-- ============================================================================

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS drive_auto_folder_id  TEXT,
  ADD COLUMN IF NOT EXISTS drive_auto_folder_url TEXT;

COMMENT ON COLUMN system_cases.drive_auto_folder_id IS
  'D1: subpasta "Documentos automaticos" dentro da pasta do caso. Recebe TUDO que o SHV gera (documento por modelo, procuracao, contrato, assinado do ZapSign). Anexo manual NAO vai para ca.';
