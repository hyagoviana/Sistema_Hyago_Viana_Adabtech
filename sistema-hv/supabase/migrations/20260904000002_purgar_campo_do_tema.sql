-- ============================================================================
-- Sistema HV — Bug 2 (Thiago, 04/09) — purgar o valor ao excluir campo do tema
-- ----------------------------------------------------------------------------
-- "quando estamos excluindo algum campo personalizado existente, os dados que
--  estavam nesse campo estão ficando assim logo abaixo, como se o campo fosse
--  preservado mesmo após excluirmos da configuração do tema"
--
-- O que acontecia: `deleteTemaFieldDef` fazia soft-delete só da DEFINIÇÃO. O
-- valor continuava em `system_cases.canonical_fields`, e a ficha — que mostra as
-- chaves sem definição num bloco "Outros campos", justamente para nunca perder
-- dado — passava a exibir a chave órfã. Para quem usa, o campo "voltou".
--
-- O lado do CLIENTE já resolvia isso desde sempre (`system_fn_purge_client_field`,
-- chamada por `deleteFieldDef`). Esta migration cria a função equivalente para os
-- casos; quem passa a chamá-la é o `deleteTemaFieldDef`.
--
-- ESCOPO da purga: só os casos do TEMA em questão. Uma mesma chave pode existir
-- em temas diferentes (é comum: `status_caso`, `link_chatguru`), e apagar em
-- todos destruiria dado de quem não pediu nada.
--
-- Idempotente. Não altera nenhuma definição.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.system_fn_purge_case_field(
  p_org UUID,
  p_tema UUID,
  p_key TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
AS $function$
DECLARE
  v_afetados INTEGER;
BEGIN
  UPDATE system_cases
     SET canonical_fields = canonical_fields - p_key
   WHERE organization_id = p_org
     AND tema_id = p_tema
     AND canonical_fields ? p_key;

  GET DIAGNOSTICS v_afetados = ROW_COUNT;
  RETURN v_afetados;
END;
$function$;

COMMENT ON FUNCTION public.system_fn_purge_case_field IS
  'Bug 2 (04/09): remove a chave dos canonical_fields dos casos de UM tema, ao excluir a definição do campo. Sem isto o valor sobrevive à exclusão e reaparece na ficha em "Outros campos". Devolve quantos casos foram afetados.';

GRANT EXECUTE ON FUNCTION public.system_fn_purge_case_field TO service_role;

-- ============================================================================
-- ROLLBACK: DROP FUNCTION IF EXISTS public.system_fn_purge_case_field(UUID, UUID, TEXT);
-- (o dado já purgado não volta — a exclusão do campo passa a ser definitiva,
--  que é exatamente o comportamento pedido)
-- ============================================================================
