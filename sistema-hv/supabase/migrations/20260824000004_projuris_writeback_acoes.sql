-- ============================================================================
-- WRITE-BACK DAS AÇÕES DA TELA 1 (arquivar intimação · marcar andamento lido)
--
-- O Thiago já tinha respondido isso na reunião de 19/08, falando dos botões:
--   "Quando é intimação, ele dá a opção de arquivar. Quando é movimentação, ele
--    dá a opção de marcar lido, que é o baixa, deu baixa, já viu. ISSO NO PROJURIS."
--
-- Os endpoints existem (confirmados no WADL que ele enviou em 24/08):
--   PUT /intimacao/{codigo}/situacao/{chave}   → arquivar (chave "ARQUIVADA")
--   PUT /intimacao/{codigo}/desarquivar        → desfazer
--   PUT /andamento/alterar-status-lido/{codigo}→ marcar lido
--
-- Até aqui o sistema era LEITURA-ONLY no ProJuris (decisão de 14/08, motor
-- ligado com zero write-back). Esta migration abre a porta — mas com chave:
--
--   1. `projuris_writeback_ativo` nasce FALSE. Sem ligar, nada é enviado; as
--      decisões continuam valendo só no SHV, como hoje.
--   2. É um flag de BANCO (não env): dá para desligar na hora, sem deploy, se
--      algo sair errado.
--   3. Toda tentativa fica registrada no movimento (quando foi, e o erro se
--      houver) — o write-back é best-effort e NUNCA desfaz a decisão local.
-- ============================================================================

ALTER TABLE system_distribution_config
  ADD COLUMN IF NOT EXISTS projuris_writeback_ativo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN system_distribution_config.projuris_writeback_ativo IS
  'Liga o envio das ações da controladoria (arquivar/marcar lido) de volta ao ProJuris. FALSE = leitura-only, comportamento histórico.';

ALTER TABLE system_distribution_movements
  ADD COLUMN IF NOT EXISTS projuris_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS projuris_sync_error TEXT;

COMMENT ON COLUMN system_distribution_movements.projuris_sync_at IS
  'Quando a decisão desta linha foi refletida no ProJuris (null = não enviada).';
COMMENT ON COLUMN system_distribution_movements.projuris_sync_error IS
  'Erro da última tentativa de refletir no ProJuris. A decisão local vale mesmo assim.';
