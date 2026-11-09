-- ============================================================================
-- ROLLBACK FASE 8: MIGRATION 007
-- Use APENAS se for necessário reverter a Fase 8.
-- Não afeta dados essenciais de transações nem contas pré-existentes.
-- ============================================================================

DROP FUNCTION IF EXISTS public.report_item_detail(uuid, date, date);
DROP FUNCTION IF EXISTS public.report_expenses_by_item(date, date, int);
DROP FUNCTION IF EXISTS public.merge_expense_items(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_or_create_expense_item(text, uuid, uuid, bigint, text);

DROP INDEX IF EXISTS idx_transactions_user_item_date;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS expense_item_id;

ALTER TABLE public.payment_methods DROP COLUMN IF EXISTS icon;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS icon;

DROP TABLE IF EXISTS public.expense_items;
DROP FUNCTION IF EXISTS public.normalize_text(text);
