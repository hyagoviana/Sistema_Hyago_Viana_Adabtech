-- ============================================================================
-- Sistema HV — Migration — FN1 — SEED das categorias financeiras
-- ----------------------------------------------------------------------------
-- Copiado literalmente dos dois mapas do doc "25.08 _ Financeiro SHV":
--   [MAPA - CATEGORIAS FINANCEIRAS DE RECEITAS CONTAAZUL ...]
--   [MAPA - CATEGORIAS FINANCEIRAS DE DESPESAS CONTAAZUL ...]
--
-- O Thiago explicou por que os códigos são novos: "decidi primeiramente apenas
-- criarmos novas categorias, centro de custo e etc, que serão relacionados aos
-- novos registros que vem da API pelo SHV. Assim podemos testar com mais
-- segurança e calma, e depois de concluído, se validarmos, nos preocupamos de
-- voltar e corrigir os registros passados."
--
-- Idempotente: ON CONFLICT (organization_id, codigo) não faz nada. Rodar de novo
-- não duplica nem sobrescreve ajuste manual de nome.
--
-- ATENÇÃO: o doc tem uma inconsistência de numeração em Reembolsos (4.01.02 tem
-- filhos numerados 4.01.03.0x). Mantive os códigos EXATAMENTE como ele escreveu —
-- eles serão conferidos contra o ContaAzul real na FN2; corrigir por conta
-- própria agora criaria divergência silenciosa com o que ele cadastrou lá.
-- ============================================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000001';
  v_fiscal UUID; v_gerencial UUID;
  v_f_hon UUID; v_f_reemb UUID; v_g_hon UUID; v_g_reemb UUID;
  v_d_custas UUID; v_d_dilig UUID;
BEGIN
  -- ---------------- RECEITAS: nível 1 (identificação do faturamento) ----------
  INSERT INTO system_fin_categorias (organization_id, kind, codigo, nome, ordem)
  VALUES (v_org, 'RECEITA', '4.01', 'Fiscal', 1)
  ON CONFLICT (organization_id, codigo) DO NOTHING;
  SELECT id INTO v_fiscal FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '4.01';

  INSERT INTO system_fin_categorias (organization_id, kind, codigo, nome, ordem)
  VALUES (v_org, 'RECEITA', '4.02', 'Gerencial', 2)
  ON CONFLICT (organization_id, codigo) DO NOTHING;
  SELECT id INTO v_gerencial FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '4.02';

  -- ---------------- RECEITAS: nível 2 (natureza) ------------------------------
  INSERT INTO system_fin_categorias (organization_id, kind, codigo, nome, parent_id, ordem) VALUES
    (v_org, 'RECEITA', '4.01.01', 'Honorários contratuais', v_fiscal, 1),
    (v_org, 'RECEITA', '4.01.02', 'Reembolsos',             v_fiscal, 2),
    (v_org, 'RECEITA', '4.01.03', 'Sucumbência',            v_fiscal, 3),
    (v_org, 'RECEITA', '4.02.01', 'Honorários contratuais', v_gerencial, 1),
    (v_org, 'RECEITA', '4.02.02', 'Reembolsos',             v_gerencial, 2),
    (v_org, 'RECEITA', '4.02.03', 'Sucumbência',            v_gerencial, 3)
  ON CONFLICT (organization_id, codigo) DO NOTHING;

  SELECT id INTO v_f_hon   FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '4.01.01';
  SELECT id INTO v_f_reemb FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '4.01.02';
  SELECT id INTO v_g_hon   FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '4.02.01';
  SELECT id INTO v_g_reemb FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '4.02.02';

  -- ---------------- RECEITAS: nível 3 (tipo) ----------------------------------
  INSERT INTO system_fin_categorias (organization_id, kind, codigo, nome, parent_id, ordem) VALUES
    (v_org, 'RECEITA', '4.01.01.01', 'Entrada',                            v_f_hon, 1),
    (v_org, 'RECEITA', '4.01.01.02', 'Êxito',                              v_f_hon, 2),
    (v_org, 'RECEITA', '4.01.01.03', 'Rescisão',                           v_f_hon, 3),
    (v_org, 'RECEITA', '4.01.01.04', 'Consulta / Parecer',                 v_f_hon, 4),
    (v_org, 'RECEITA', '4.01.01.05', 'Recuperados / Acordo / Renegociação', v_f_hon, 5),
    -- (numeração do doc: filhos de 4.01.02 vêm como 4.01.03.0x — mantido)
    (v_org, 'RECEITA', '4.01.03.01', 'Custas processuais, taxas e emolumentos', v_f_reemb, 1),
    (v_org, 'RECEITA', '4.01.03.02', 'Diligências',                        v_f_reemb, 2),
    (v_org, 'RECEITA', '4.01.03.03', 'Outras despesas reembolsadas',       v_f_reemb, 3),

    (v_org, 'RECEITA', '4.02.01.01', 'Entrada',                            v_g_hon, 1),
    (v_org, 'RECEITA', '4.02.01.02', 'Êxito',                              v_g_hon, 2),
    (v_org, 'RECEITA', '4.02.01.03', 'Rescisão',                           v_g_hon, 3),
    (v_org, 'RECEITA', '4.02.01.04', 'Consulta / Parecer',                 v_g_hon, 4),
    (v_org, 'RECEITA', '4.02.01.05', 'Recuperados / Acordo / Renegociação', v_g_hon, 5),
    (v_org, 'RECEITA', '4.02.02.01', 'Custas processuais, taxas e emolumentos', v_g_reemb, 1),
    (v_org, 'RECEITA', '4.02.02.02', 'Diligências',                        v_g_reemb, 2),
    (v_org, 'RECEITA', '4.02.02.03', 'Outras despesas reembolsadas',       v_g_reemb, 3)
  ON CONFLICT (organization_id, codigo) DO NOTHING;

  -- ---------------- DESPESAS (o doc marca todas como "(teste)") ---------------
  INSERT INTO system_fin_categorias (organization_id, kind, codigo, nome, ordem)
  VALUES (v_org, 'DESPESA', '10.01', 'Custas processuais, taxas e emolumentos', 1)
  ON CONFLICT (organization_id, codigo) DO NOTHING;
  SELECT id INTO v_d_custas FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '10.01';

  INSERT INTO system_fin_categorias (organization_id, kind, codigo, nome, ordem)
  VALUES (v_org, 'DESPESA', '10.02', 'Diligências', 2)
  ON CONFLICT (organization_id, codigo) DO NOTHING;
  SELECT id INTO v_d_dilig FROM system_fin_categorias WHERE organization_id = v_org AND codigo = '10.02';

  -- O `reembolsavel` é o que destrava a chave "Reembolsável" no formulário de
  -- despesa e, com ela, a receita-espelho automática.
  INSERT INTO system_fin_categorias (organization_id, kind, codigo, nome, parent_id, reembolsavel, ordem) VALUES
    (v_org, 'DESPESA', '10.01.01', 'Custas processuais, taxas e emolumentos (reembolsáveis)',     v_d_custas, TRUE,  1),
    (v_org, 'DESPESA', '10.01.02', 'Custas processuais, taxas e emolumentos (não reembolsáveis)', v_d_custas, FALSE, 2),
    (v_org, 'DESPESA', '10.02.01', 'Diligências (reembolsáveis)',                                  v_d_dilig,  TRUE,  1),
    (v_org, 'DESPESA', '10.02.02', 'Diligências (não reembolsáveis)',                              v_d_dilig,  FALSE, 2)
  ON CONFLICT (organization_id, codigo) DO NOTHING;
END $$;
