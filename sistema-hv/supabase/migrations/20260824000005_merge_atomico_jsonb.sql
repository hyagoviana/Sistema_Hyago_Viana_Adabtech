-- ============================================================================
-- CORRIGE PERDA DE DADOS EM EDIÇÃO SIMULTÂNEA (campos personalizados)
--
-- Relato do Thiago na reunião de 19/08:
--   "teve umas informações que a gente tinha preenchido aqui, que depois o Pablo
--    estava preenchendo (...) eles viram que não estava sendo salvo."
-- E o diagnóstico do Adavio, na hora:
--   "quando vocês salvam em uma tabela específica (...) pode ser que tenha
--    sobrescrevido naquele determinado momento. Mas a gente vai passar uma
--    análise nessas coisas, que são RPCs."
--
-- A auditoria confirmou a causa. Os campos personalizados são JSONB e eram
-- gravados em três passos, no servidor:
--     1) SELECT canonical_fields   2) merge em memória   3) UPDATE do objeto TODO
--
-- Entre o passo 1 e o 3 existe uma janela. Duas pessoas editando o MESMO caso ao
-- mesmo tempo (ou a mesma pessoa em duas abas) leem a mesma base; quem salva por
-- último grava o objeto inteiro e APAGA o que o outro acabou de escrever. Não dá
-- erro, não fica log: o dado simplesmente some. É exatamente o sintoma relatado.
--
-- A correção é fazer o merge DENTRO do banco, numa única instrução — sem janela.
-- Estas funções substituem o read-modify-write do serviço.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Merge + limpeza. Mantém a regra que o app já aplicava: chave com valor vazio
-- (null, "", [] ou {}) é REMOVIDA do balde, para não poluir o JSONB.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_jsonb_merge_clean(base JSONB, patch JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_object_agg(chave, valor)
      FROM jsonb_each(COALESCE(base, '{}'::jsonb) || COALESCE(patch, '{}'::jsonb))
        AS t(chave, valor)
      WHERE valor IS NOT NULL
        AND valor <> 'null'::jsonb
        AND valor <> '""'::jsonb
        AND valor <> '[]'::jsonb
        AND valor <> '{}'::jsonb
    ),
    '{}'::jsonb
  );
$$;

COMMENT ON FUNCTION system_jsonb_merge_clean IS
  'Merge de dois JSONB removendo chaves de valor vazio. Usado para gravar campos personalizados sem read-modify-write.';

-- ----------------------------------------------------------------------------
-- Campos canônicos do CASO. Devolve o estado final e se algo mudou de verdade
-- (o app usa isso para não emitir evento em gravação redundante).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_merge_case_canonical_fields(
  p_case_id UUID,
  p_patch   JSONB
)
RETURNS TABLE (canonical_fields JSONB, mudou BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  -- FOR UPDATE serializa duas gravações concorrentes na MESMA linha: a segunda
  -- espera a primeira terminar e enxerga o valor já atualizado.
  SELECT c.canonical_fields INTO v_antes
  FROM system_cases c
  WHERE c.id = p_case_id AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caso não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  v_depois := system_jsonb_merge_clean(v_antes, p_patch);

  IF v_depois IS DISTINCT FROM COALESCE(v_antes, '{}'::jsonb) THEN
    UPDATE system_cases SET canonical_fields = v_depois WHERE id = p_case_id;
    RETURN QUERY SELECT v_depois, TRUE;
  ELSE
    RETURN QUERY SELECT COALESCE(v_antes, '{}'::jsonb), FALSE;
  END IF;
END;
$$;

COMMENT ON FUNCTION system_merge_case_canonical_fields IS
  'Grava campos personalizados do caso de forma ATÔMICA (sem a janela do read-modify-write que causava perda de dados em edição simultânea).';

-- ----------------------------------------------------------------------------
-- Campos personalizados do CLIENTE — mesmo problema, mesma solução.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_merge_client_custom_fields(
  p_client_id UUID,
  p_patch     JSONB
)
RETURNS TABLE (custom_fields JSONB, mudou BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  SELECT c.custom_fields INTO v_antes
  FROM system_clients c
  WHERE c.id = p_client_id AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  v_depois := system_jsonb_merge_clean(v_antes, p_patch);

  IF v_depois IS DISTINCT FROM COALESCE(v_antes, '{}'::jsonb) THEN
    UPDATE system_clients SET custom_fields = v_depois WHERE id = p_client_id;
    RETURN QUERY SELECT v_depois, TRUE;
  ELSE
    RETURN QUERY SELECT COALESCE(v_antes, '{}'::jsonb), FALSE;
  END IF;
END;
$$;

COMMENT ON FUNCTION system_merge_client_custom_fields IS
  'Grava campos personalizados do cliente de forma ATÔMICA (mesma correção do caso).';

-- Só o service_role executa: toda escrita passa pelos serviços do app, que já
-- aplicam os gates de permissão antes de chamar.
REVOKE ALL ON FUNCTION system_jsonb_merge_clean(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_merge_case_canonical_fields(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_merge_client_custom_fields(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION system_jsonb_merge_clean(JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION system_merge_case_canonical_fields(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION system_merge_client_custom_fields(UUID, JSONB) TO service_role;
