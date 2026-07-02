-- ============================================================================
-- Sistema HV — Migration 0031 — S1-05: abas Leads/Clientes/Perdidos como VIEWS
-- ----------------------------------------------------------------------------
-- Princípio travado: pessoa única por CPF; status DERIVADO por caso. As "abas"
-- Leads/Clientes/Perdidos são FILTROS sobre a mesma base (system_clients), não
-- tabelas físicas. O ciclo de vida vive no CASO (system_cases.lifecycle, S1-01).
-- Uma pessoa pode ser LEAD num caso e CLIENTE em outro SIMULTANEAMENTE — por isso
-- cada aba lista PESSOAS DISTINTAS com >=1 caso naquele lifecycle (sem duplicar).
--
-- NÃO redefine system_cases_active (não toca colunas de system_cases). São views
-- derivadas novas que apenas LEEM. Grants no padrão do sistema.
--
-- `dias_parado`: derivado do último evento/mudança de status do caso mais recente
-- da pessoa naquele lifecycle (max(status_changed_at)); é CALCULADO na consulta
-- (não persiste valor stale).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- LEADS — pessoas com >=1 caso lifecycle='LEAD' (ativo, não perdido).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_clients_leads;
CREATE VIEW system_clients_leads AS
  SELECT
    cli.*,
    agg.casos_no_lifecycle,
    agg.ultimo_movimento,
    GREATEST(0, EXTRACT(DAY FROM (now() - agg.ultimo_movimento))::int) AS dias_parado
  FROM system_clients cli
  JOIN (
    SELECT
      c.client_id,
      count(*)                  AS casos_no_lifecycle,
      max(c.status_changed_at)  AS ultimo_movimento
    FROM system_cases c
    WHERE c.deleted_at IS NULL
      AND c.lifecycle = 'LEAD'
      AND c.perdido_at IS NULL
    GROUP BY c.client_id
  ) agg ON agg.client_id = cli.id
  WHERE cli.deleted_at IS NULL;
GRANT SELECT ON system_clients_leads TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- CLIENTES — pessoas com >=1 caso lifecycle='CLIENTE'.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_clients_clientes;
CREATE VIEW system_clients_clientes AS
  SELECT
    cli.*,
    agg.casos_no_lifecycle,
    agg.ultimo_movimento,
    GREATEST(0, EXTRACT(DAY FROM (now() - agg.ultimo_movimento))::int) AS dias_parado
  FROM system_clients cli
  JOIN (
    SELECT
      c.client_id,
      count(*)                  AS casos_no_lifecycle,
      max(c.status_changed_at)  AS ultimo_movimento
    FROM system_cases c
    WHERE c.deleted_at IS NULL
      AND c.lifecycle = 'CLIENTE'
    GROUP BY c.client_id
  ) agg ON agg.client_id = cli.id
  WHERE cli.deleted_at IS NULL;
GRANT SELECT ON system_clients_clientes TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- PERDIDOS — pessoas com >=1 caso lifecycle='PERDIDO' (filtro separado; NÃO
-- aparece em Leads).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_clients_perdidos;
CREATE VIEW system_clients_perdidos AS
  SELECT
    cli.*,
    agg.casos_no_lifecycle,
    agg.ultimo_movimento,
    GREATEST(0, EXTRACT(DAY FROM (now() - agg.ultimo_movimento))::int) AS dias_parado
  FROM system_clients cli
  JOIN (
    SELECT
      c.client_id,
      count(*)              AS casos_no_lifecycle,
      max(c.perdido_at)     AS ultimo_movimento
    FROM system_cases c
    WHERE c.deleted_at IS NULL
      AND c.lifecycle = 'PERDIDO'
    GROUP BY c.client_id
  ) agg ON agg.client_id = cli.id
  WHERE cli.deleted_at IS NULL;
GRANT SELECT ON system_clients_perdidos TO anon, authenticated, service_role;
