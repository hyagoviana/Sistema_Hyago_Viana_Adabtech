-- Rollback simétrico da migration 20260806000007_case_sigiloso.sql (Story G4).
DROP TABLE IF EXISTS system_case_sigilo_users;
ALTER TABLE system_cases DROP COLUMN IF EXISTS sigiloso;
