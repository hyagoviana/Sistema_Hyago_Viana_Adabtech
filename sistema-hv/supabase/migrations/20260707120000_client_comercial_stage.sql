-- Item 1 (2026-07-07): funil COMERCIAL por CADASTRO.
-- A etapa comercial do lead passa a viver no próprio cadastro (system_clients),
-- NÃO num caso. Arrastar o card no funil comercial só atualiza esta coluna —
-- não cria caso, não semeia financeiro e não gera documento. A vinculação de
-- caso ao cadastro/lead é 100% manual (feita pelo usuário).
alter table system_clients
  add column if not exists macrostatus_comercial text default 'NOVO';

-- Backfill defensivo: cadastros sem etapa entram em NOVO (1ª etapa comercial).
update system_clients
   set macrostatus_comercial = 'NOVO'
 where macrostatus_comercial is null;
