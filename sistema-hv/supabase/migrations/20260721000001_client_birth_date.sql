-- Adiciona data de nascimento ao cadastro de clientes (obrigatório pra sync Conta Azul).
ALTER TABLE system_clients ADD COLUMN IF NOT EXISTS birth_date date;
