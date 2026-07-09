-- ============================================================================
-- Sistema HV — Migration — Pastas do Drive POR CATEGORIA (caso + procuração)
-- ----------------------------------------------------------------------------
-- Pedido do owner (2026-07-09), itens 1-3 — vincular corretamente os documentos
-- de CASO e as PROCURAÇÕES a cada pipeline operacional (tipo de serviço).
--
-- Substitui/estende:
--   • `system_service_types.templates_folder_id` (1 pasta só por tipo) e
--   • a lista fixa `case-document-folders.ts` (global, não filtrava por tipo)
-- por um vínculo N:1 configurável: cada tipo pode ter VÁRIAS pastas de caso
-- (ex.: FIES ESF tem 3) e sua(s) pasta(s) de procuração.
--
-- kind: 'caso'       → pasta de documentos de caso (parent: "07- Modelos" 1su0XT…)
--       'procuracao' → pasta de procuração        (parent: "08- Contratos…" 1ed5k…)
--
-- Idempotente: UNIQUE(service_type_id, kind, drive_folder_id) + ON CONFLICT.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_service_type_folders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  service_type_id  UUID NOT NULL REFERENCES system_service_types(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('caso', 'procuracao')),
  drive_folder_id  TEXT NOT NULL,
  name             TEXT NOT NULL,
  ordem            INT NOT NULL DEFAULT 0,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE (service_type_id, kind, drive_folder_id)
);

CREATE INDEX IF NOT EXISTS idx_system_service_type_folders_lookup
  ON system_service_type_folders(service_type_id, kind)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW system_service_type_folders_active AS
  SELECT id, organization_id, service_type_id, kind, drive_folder_id, name, ordem,
         created_by, created_at, deleted_at
  FROM system_service_type_folders
  WHERE deleted_at IS NULL;

GRANT ALL ON TABLE system_service_type_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_service_type_folders TO anon, authenticated;
GRANT SELECT ON system_service_type_folders_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Seed do mapa informado pelo owner (nomes reais lidos do Drive em 2026-07-09).
-- ----------------------------------------------------------------------------
INSERT INTO system_service_type_folders
  (organization_id, service_type_id, kind, drive_folder_id, name, ordem)
SELECT st.organization_id, st.id, m.kind, m.drive_folder_id, m.name, m.ordem
FROM system_service_types st
JOIN (VALUES
  -- FIES ESF — 3 pastas de caso + 1 de procuração
  ('FIES_ESF','caso','16ySv_cUciMNT9_YzrtAAsp8OwTReYRmI','01- Abatimento ESF DGM',0),
  ('FIES_ESF','caso','1AQjL14THUGA5MyJ_9JXB8c4a2OTLGIAL','02- Abatimento ESF Censo 05',1),
  ('FIES_ESF','caso','1NJ8OYXhn2ZhScyGfyiLbJjQpLh0zDdiq','03- Abatimento ESF Portaria',2),
  ('FIES_ESF','procuracao','1LXyncOGy09UTwOJgm4PgQ3JwqNpDUdgF','FIES ESF',0),
  -- ABATIMENTO MILITAR (slug FIES_DGM)
  ('FIES_DGM','caso','1cxylOE61H2PuMI-cii2b5Vn-Dh4pIoLI','04- Abatimento Militar',0),
  ('FIES_DGM','procuracao','1GezjNoSjGSPXWn5_cA_gmgNZeWIfvyae','FIES ABATIMENTO MILITAR',0),
  -- COVID
  ('COVID','caso','1NHISSQSsq17Jvlg5D-NqOnhHUgI4K4mL','05- Abatimento COVID',0),
  ('COVID','procuracao','15yAQl2E3ZEPauqxcLvwLGdWgea8bAPqf','FIES ABATIMENTO COVID',0),
  -- MAIS MÉDICOS — só procuração
  ('MAIS_MEDICOS','procuracao','1LgPu1xfOf8hxfRRDnPiY6UpP7PKuOeSs','MAIS MÉDICOS',0),
  -- RESIDÊNCIA — só procuração
  ('RESIDENCIA','procuracao','1srjytnpl3ajzH_rTLFmLSZjUoWnkw2ND','RESIDÊNCIA',0),
  -- CFM/CRM — só procuração (pasta vazia hoje)
  ('CFM_CRM','procuracao','1WG8aQuk7Bi6y4aVsNfjKnIncc0KAu6rI','CFM/CRM',0),
  -- OUTROS — só procuração
  ('OUTROS','procuracao','1mrlxE7zE5nb9c4_YJS05ik1vdW7nVQEY','OUTROS',0)
) AS m(service_slug, kind, drive_folder_id, name, ordem)
  ON m.service_slug = st.slug
WHERE st.deleted_at IS NULL
ON CONFLICT (service_type_id, kind, drive_folder_id) DO NOTHING;
