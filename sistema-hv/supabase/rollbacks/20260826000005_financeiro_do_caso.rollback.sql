-- ROLLBACK — FN1. Remove o financeiro do caso. DESTRUTIVO: apaga os lançamentos
-- e parcelas registrados. O vínculo do tema com o ContaAzul também some.
DROP TABLE IF EXISTS system_case_fin_installments;
DROP TABLE IF EXISTS system_case_fin_entries;
DROP TABLE IF EXISTS system_fin_categorias;

ALTER TABLE system_temas
  DROP COLUMN IF EXISTS contaazul_centro_custo_id,
  DROP COLUMN IF EXISTS contaazul_centro_custo_nome,
  DROP COLUMN IF EXISTS contaazul_servico_id,
  DROP COLUMN IF EXISTS contaazul_servico_nome;
