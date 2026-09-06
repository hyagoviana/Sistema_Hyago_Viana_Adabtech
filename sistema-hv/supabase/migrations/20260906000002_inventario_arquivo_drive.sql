-- ============================================================================
-- Sistema HV — S2-04 — inventário do que foi arquivado no Drive
-- ----------------------------------------------------------------------------
-- O owner autorizou apagar os modelos legados ("apaga do sistema por enquanto,
-- mas deixa guardado em algum lugar caso precise voltar com ele"), depois de o
-- Thiago confirmar que são todos de teste e que existem cópias.
--
-- "Guardado" aqui é em DOIS lugares, de propósito:
--   1. No Drive — os arquivos são MOVIDOS para uma pasta de arquivo morto, não
--      apagados. Continuam abríveis, só saem de circulação.
--   2. Nesta tabela — o inventário do que saiu, de onde saiu e para onde foi.
--      Sem ele, daqui a três meses ninguém sabe qual arquivo era de qual pasta.
--
-- É registro de auditoria: append-only, nunca atualizado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_drive_archive_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  -- Lote: tudo que saiu na mesma execução compartilha o rótulo, para dar
  -- rollback de um arquivamento inteiro sem pegar os outros junto.
  lote             TEXT NOT NULL,
  motivo           TEXT NOT NULL,

  drive_file_id    TEXT NOT NULL,
  nome             TEXT NOT NULL,
  mime_type        TEXT,
  -- Caminho legível de onde o arquivo estava ("Drive / 07- Modelos / ...").
  -- É o que permite devolver o arquivo ao lugar certo.
  origem_caminho   TEXT,
  origem_parent_id TEXT,
  destino_parent_id TEXT NOT NULL,

  -- Vínculo com o que o sistema conhecia daquele arquivo, quando havia.
  template_id      UUID,

  arquivado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  arquivado_por    UUID
);

CREATE INDEX IF NOT EXISTS idx_drive_archive_lote ON system_drive_archive_log (lote);
CREATE INDEX IF NOT EXISTS idx_drive_archive_file ON system_drive_archive_log (drive_file_id);

COMMENT ON TABLE system_drive_archive_log IS
  'S2-04: inventário dos arquivos do Drive tirados de circulação. Os arquivos são MOVIDOS para uma pasta de arquivo morto (não apagados); esta tabela guarda de onde vieram, para poder devolvê-los.';
COMMENT ON COLUMN system_drive_archive_log.lote IS
  'Rótulo da execução — permite reverter um arquivamento inteiro sem tocar nos outros.';
COMMENT ON COLUMN system_drive_archive_log.origem_caminho IS
  'Caminho legível de origem. Sem isto o inventário não serve para restaurar.';

ALTER TABLE system_drive_archive_log ENABLE ROW LEVEL SECURITY;

-- Leitura para usuários autenticados; escrita só pela service_role (os scripts
-- de arquivamento). Ninguém edita o inventário pela aplicação.
DROP POLICY IF EXISTS system_drive_archive_log_select ON system_drive_archive_log;
CREATE POLICY system_drive_archive_log_select ON system_drive_archive_log
  FOR SELECT TO authenticated USING (true);

-- Habilitar RLS sem conceder nada bloqueia até a service_role: o INSERT dos
-- scripts de arquivamento volta "permission denied for table". O GRANT é o que
-- faz o dono do dado (a service_role) conseguir escrever; a policy acima é só
-- para a leitura dos usuários autenticados.
GRANT SELECT ON system_drive_archive_log TO authenticated;
GRANT SELECT, INSERT ON system_drive_archive_log TO service_role;

-- ============================================================================
-- ROLLBACK: DROP TABLE IF EXISTS system_drive_archive_log;
-- ============================================================================
