-- ============================================================================
-- ROLLBACK: MIGRATION 006 — Lote do Dia em Duas Etapas (v1.2.0)
-- Use apenas se precisar reverter a migration 006 para o estado da v1.1.
-- ============================================================================

-- 1. Remover RPCs da Fase 7
DROP FUNCTION IF EXISTS public.get_daily_batches(date, date);
DROP FUNCTION IF EXISTS public.undistribute_part(uuid);
DROP FUNCTION IF EXISTS public.distribute_batch_line(uuid, jsonb);
DROP FUNCTION IF EXISTS public.create_daily_batch(date, text, jsonb);
DROP FUNCTION IF EXISTS public.ensure_user_pending_account(uuid);

-- 2. Tabela daily_batches
DROP TABLE IF EXISTS public.daily_batches CASCADE;

-- 3. Remover índices e coluna parent_id de transactions
DROP INDEX IF EXISTS public.idx_transactions_user_parent_id;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS parent_id CASCADE;

-- 4. Restaurar get_account_balances da v1.1
CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE (
  account_id uuid,
  account_name text,
  account_type text,
  account_color text,
  archived boolean,
  initial_balance_cents bigint,
  income_net_cents bigint,
  expense_cents bigint,
  transfer_in_cents bigint,
  transfer_out_cents bigint,
  current_balance_cents bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH tx_summary AS (
    SELECT
      a.id AS acc_id,
      COALESCE(SUM(CASE WHEN t.kind = 'income' AND t.account_id = a.id THEN t.net_cents ELSE 0 END), 0)::bigint AS inc_net,
      COALESCE(SUM(CASE WHEN t.kind = 'expense' AND t.account_id = a.id THEN t.net_cents ELSE 0 END), 0)::bigint AS exp_net,
      COALESCE(SUM(CASE WHEN t.kind = 'transfer' AND t.to_account_id = a.id THEN t.net_cents ELSE 0 END), 0)::bigint AS trf_in,
      COALESCE(SUM(CASE WHEN t.kind = 'transfer' AND t.account_id = a.id THEN t.net_cents ELSE 0 END), 0)::bigint AS trf_out
    FROM public.accounts a
    LEFT JOIN public.transactions t
      ON t.user_id = a.user_id
     AND t.deleted_at IS NULL
     AND (t.account_id = a.id OR t.to_account_id = a.id)
    WHERE a.user_id = auth.uid()
    GROUP BY a.id
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    a.color AS account_color,
    a.archived,
    a.initial_balance_cents,
    s.inc_net AS income_net_cents,
    s.exp_net AS expense_cents,
    s.trf_in AS transfer_in_cents,
    s.trf_out AS transfer_out_cents,
    (a.initial_balance_cents + s.inc_net - s.exp_net + s.trf_in - s.trf_out)::bigint AS current_balance_cents
  FROM public.accounts a
  JOIN tx_summary s ON s.acc_id = a.id
  WHERE a.user_id = auth.uid()
  ORDER BY a.archived ASC, a.created_at ASC;
$$;
