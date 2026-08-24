-- ============================================================================
-- TELA 1 do motor — dois ajustes vindos do teste com dados REAIS (2026-08-24).
--
-- 1) SITUAÇÃO NO PROJURIS. O doc do Thiago é explícito: a tela 1 lista "o que
--    está lá no ProJuris (...) que não está marcado como baixado, como
--    arquivado". No primeiro teste, as 79 intimações da janela vieram TODAS com
--    tipoSituacao = ARQUIVADA — ou seja, a equipe já as tratou lá. Sem guardar e
--    filtrar essa situação, a fila de análise nasce cheia de trabalho já feito.
--
-- 2) CLIENTE. O payload traz `nomeCliente`, e hoje NENHUM dos 411 casos tem
--    vínculo com processo do ProJuris (nem CNJ nem código) — então o casamento
--    processo→caso não acontece. Guardar o cliente identificado permite ao menos
--    saber de quem é a intimação, e casar o caso quando o cliente tiver um só.
-- ============================================================================

ALTER TABLE system_distribution_movements
  ADD COLUMN IF NOT EXISTS situacao_projuris TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES system_clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN system_distribution_movements.situacao_projuris IS
  'tipoSituacao da intimação no ProJuris (ARQUIVADA, PENDENTE, ...). Arquivadas não entram na fila de análise.';
COMMENT ON COLUMN system_distribution_movements.client_id IS
  'Cliente identificado pelo nome que veio na intimação — usado quando o processo não está vinculado a nenhum caso.';

CREATE INDEX IF NOT EXISTS idx_dist_movements_client
  ON system_distribution_movements(client_id);
