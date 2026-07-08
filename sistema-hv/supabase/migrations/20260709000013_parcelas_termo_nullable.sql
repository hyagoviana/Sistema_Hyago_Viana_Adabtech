-- Torna termo_id nullable em system_parcelas para permitir cobranças
-- diretas (Conta Azul / Asaas) sem depender de um Termo de Acerto.
-- Também remove a constraint UNIQUE (termo_id, numero) que impede
-- parcelas sem termo, e cria um índice parcial no lugar.

ALTER TABLE system_parcelas
  ALTER COLUMN termo_id DROP NOT NULL;

-- Drop a UNIQUE constraint antiga (termo_id, numero) — impede inserts sem termo
DO $$
DECLARE
  _con TEXT;
BEGIN
  SELECT conname INTO _con
  FROM pg_constraint
  WHERE conrelid = 'system_parcelas'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2;
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE system_parcelas DROP CONSTRAINT %I', _con);
  END IF;
END $$;

-- Recria como índice parcial: unicidade só quando termo_id é NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_parcelas_termo_numero
  ON system_parcelas (termo_id, numero)
  WHERE termo_id IS NOT NULL;

COMMENT ON COLUMN system_parcelas.termo_id IS
  'FK para o Termo de Acerto. NULL quando a cobrança é gerada diretamente (sem termo).';
