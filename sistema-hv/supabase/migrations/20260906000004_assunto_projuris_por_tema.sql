-- ============================================================================
-- Sistema HV — S2-02 / S2-03 — assunto do ProJuris por TEMA
-- ----------------------------------------------------------------------------
-- Thiago (desenho 13): "Identificar do projuris para o ASSUNTO relacionado ao
-- tema. No geral todos os temas já possuem seu próprio assunto no PROJURIS, mas
-- podem existir temas que não tem um assunto próprio (compartilham um registro
-- geral lá). Fazendo dessa forma com identificador ajustável, acho que amarramos
-- bem essa situação, e também a situação do registro 'assunto' quando criarmos
-- um Judicial no projuris direto pelo SHV."
--
-- O problema que isso resolve (desenho 5): `criar-processo` mandava
-- `assunto: caso_pasta_nome || case_code`, então cada caso criado pelo SHV nascia
-- com um ASSUNTO NOVO no ProJuris — o print dele mostra
-- "INADIMPLENCIAHV-2026-0422" no campo ASSUNTO (TEMA). O ProJuris ia acumulando
-- um assunto por caso e os relatórios de lá deixavam de agrupar por tema.
--
-- ONDE GUARDAR — por que não em `system_theme_mapping`, como o rascunho da story
-- supunha: aquela tabela é do MOTOR de distribuição, e seu `motor_theme_id` é um
-- slug próprio ("REDUCAO_INSS", "REVALIDA", "VAGAS_OCIOSAS"), não o id de
-- `system_temas`. São de-paras diferentes. O assunto pertence ao tema do SHV, e
-- `system_temas` já guarda vínculos de integração exatamente assim
-- (`contaazul_centro_custo_id/nome`) — as colunas abaixo seguem esse padrão.
--
-- Thiago (resposta B1, 04/09): o vínculo é preenchido à MÃO, tema a tema, e ele
-- não achou identificador sistêmico para o assunto geral "CÍVEIS" — por isso o
-- nome é TEXTO livre, e o id é opcional.
-- ============================================================================

ALTER TABLE system_temas
  ADD COLUMN IF NOT EXISTS projuris_assunto_id   TEXT,
  ADD COLUMN IF NOT EXISTS projuris_assunto_nome TEXT;

COMMENT ON COLUMN system_temas.projuris_assunto_id IS
  'S2-02: identificador do assunto no ProJuris, quando existe. Opcional — o Thiago não achou id sistêmico para o assunto geral, então o nome sozinho já serve.';
COMMENT ON COLUMN system_temas.projuris_assunto_nome IS
  'S2-02: assunto do ProJuris deste tema. É o que vai no campo ASSUNTO do processo criado pelo SHV, no lugar do código do caso. Vazio = usa o assunto geral da configuração.';

-- Fallback global: "CÍVEIS", o assunto guarda-chuva do ProJuris.
-- Thiago: "o tema 'cíveis' é o 'fallback geral', encaixamos aqui tudo que não
-- encaixe em outro."
ALTER TABLE system_distribution_config
  ADD COLUMN IF NOT EXISTS projuris_assunto_geral_id   TEXT,
  ADD COLUMN IF NOT EXISTS projuris_assunto_geral_nome TEXT;

COMMENT ON COLUMN system_distribution_config.projuris_assunto_geral_nome IS
  'S2-03: assunto usado quando o tema não tem o seu. Sem ele E sem o do tema, a criação de processo é BLOQUEADA — nunca mais cai no código do caso.';

-- Semeia o fallback que o Thiago indicou. Só na linha que já existe, e só se
-- ainda estiver vazio: quem já configurou outra coisa não é sobrescrito.
UPDATE system_distribution_config
   SET projuris_assunto_geral_nome = 'CÍVEIS'
 WHERE projuris_assunto_geral_nome IS NULL;

-- ============================================================================
-- ROLLBACK:
--   ALTER TABLE system_temas
--     DROP COLUMN IF EXISTS projuris_assunto_id,
--     DROP COLUMN IF EXISTS projuris_assunto_nome;
--   ALTER TABLE system_distribution_config
--     DROP COLUMN IF EXISTS projuris_assunto_geral_id,
--     DROP COLUMN IF EXISTS projuris_assunto_geral_nome;
-- (voltar o código junto: sem as colunas, `criar-processo` bloquearia tudo)
-- ============================================================================
