-- ROLLBACK — M13 (T3): campo distribution_urgency. Simétrico/idempotente.
ALTER TABLE system_cases DROP CONSTRAINT IF EXISTS system_cases_distribution_urgency_check;
ALTER TABLE system_cases DROP COLUMN IF EXISTS distribution_urgency;
