-- ============================================================================
-- ROLLBACK FASE 9: MIGRATION 008
-- Use APENAS se for necessário reverter a Fase 9.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_installments_summary(date);
DROP FUNCTION IF EXISTS public.unpay_installment(uuid);
DROP FUNCTION IF EXISTS public.pay_installment(uuid, uuid, timestamptz, bigint);
DROP FUNCTION IF EXISTS public.create_installment_purchase(text, text, bigint, int, date, uuid, uuid, uuid, text, text, jsonb);

DROP INDEX IF EXISTS idx_transactions_user_installment;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS installment_id;

DROP TABLE IF EXISTS public.installments;
DROP TABLE IF EXISTS public.installment_purchases;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS due_alert_days_before,
  DROP COLUMN IF EXISTS due_alert_time,
  DROP COLUMN IF EXISTS due_alerts_enabled;

