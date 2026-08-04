-- Rollback A5 (5b) — reabilitação do checklist op.
-- A migration 20260804000002 é um MARCADOR/NO-OP (só reafirma GRANTs; não toca
-- dados nem cria objetos). O rollback do EFEITO de negócio é feito no APP
-- (reverter os relaxamentos em StageEditor.tsx e checklist-service.ts). Aqui não
-- há schema a reverter; mantemos os GRANTs (removê-los quebraria op E fin).
-- No-op idempotente e seguro.
SELECT 1;
