-- Campos judiciais espelhados (parte 2, docx Thiago): Monitoramento (Push) e
-- Resultado/Tipo da ULTIMA DECISAO. Todos ESPELHADOS do ProJuris (so leitura),
-- extraidos do proprio GET /processo (sem request extra):
--   monitoramento_push       <- capturaHabilitada (boolean)
--   data_julgamento          <- dataJulgamento (epoch-ms)
--   resultado_encerramento   <- resultadoEncerramento ({chave,valor} -> rotulo)
--   descricao_encerramento   <- descricaoEncerramento (texto livre)
--   data_ultima_modificacao  <- dataUltimaModificacao (epoch-ms) = ultima movimentacao
-- OBS: o endpoint de andamentos (v2/processo-andamento/consulta) e' instavel
-- (524/timeout), por isso a "ultima decisao" usa os campos de encerramento/
-- julgamento do /processo, que sao populados quando ha decisao.

ALTER TABLE system_case_judicial_processos
  ADD COLUMN IF NOT EXISTS monitoramento_push      BOOLEAN,
  ADD COLUMN IF NOT EXISTS data_julgamento         DATE,
  ADD COLUMN IF NOT EXISTS resultado_encerramento  TEXT,
  ADD COLUMN IF NOT EXISTS descricao_encerramento  TEXT,
  ADD COLUMN IF NOT EXISTS data_ultima_modificacao DATE;

COMMENT ON COLUMN system_case_judicial_processos.monitoramento_push IS
  'Espelho ProJuris: capturaHabilitada (monitoramento/push automatico ativo).';
COMMENT ON COLUMN system_case_judicial_processos.resultado_encerramento IS
  'Espelho ProJuris: resultadoEncerramento (tipo/resultado da ultima decisao).';
