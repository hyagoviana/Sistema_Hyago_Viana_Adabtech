-- ============================================================================
-- Sistema HV — Migration 0012 — Auditoria por trigger + case_code automático
-- ----------------------------------------------------------------------------
-- Endurece a integridade dos dados: TODO insert/update/delete nas tabelas-núcleo
-- é registrado em system_audit_log (cobre app E n8n, sem duplicar). E o case_code
-- passa a ser gerado pela sequence oficial sempre que vier vazio (ex.: n8n).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auditoria genérica (actor_id = auth.uid(), null quando service_role/n8n)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_fn_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_org    UUID;
  v_entity UUID;
  v_diff   JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id; v_entity := OLD.id;
    v_diff := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_org := NEW.organization_id; v_entity := NEW.id;
    v_diff := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    v_org := NEW.organization_id; v_entity := NEW.id;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  INSERT INTO system_audit_log (organization_id, actor_id, action, entity_type, entity_id, diff)
  VALUES (v_org, auth.uid(), TG_OP, TG_TABLE_NAME, v_entity, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_clients ON system_clients;
CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON system_clients
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

DROP TRIGGER IF EXISTS trg_audit_cases ON system_cases;
CREATE TRIGGER trg_audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

DROP TRIGGER IF EXISTS trg_audit_documents ON system_client_documents;
CREATE TRIGGER trg_audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON system_client_documents
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

-- ----------------------------------------------------------------------------
-- case_code oficial: gera pela sequence quando vier nulo/vazio (ex.: via n8n)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_fn_case_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_code IS NULL OR NEW.case_code = '' THEN
    NEW.case_code := 'HV-' || split_part(NEW.case_type, '_', 1) || '-' ||
                     to_char(NOW(), 'YYYY') || '-' ||
                     lpad(nextval('seq_system_case_code')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_cases_case_code ON system_cases;
CREATE TRIGGER trg_system_cases_case_code
  BEFORE INSERT ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_fn_case_code();
