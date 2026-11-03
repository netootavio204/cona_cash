-- ============================================================================
-- CONA CASH — MIGRATION 003: LANÇAMENTOS, LOTE ATÔMICO, LIXEIRA, AUDITORIA E SALDOS
-- Versão: v0.3.0 beta
-- ============================================================================

-- 1. Atualizar versão em app_settings
UPDATE public.app_settings
SET schema_version = '003_transactions',
    app_version = 'v0.3.0 beta',
    updated_at = now()
WHERE id = 1;

-- 2. Tabela de Lançamentos (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  gross_cents bigint NOT NULL CHECK (gross_cents > 0),
  fee_cents bigint NOT NULL DEFAULT 0 CHECK (fee_cents >= 0 AND fee_cents <= gross_cents),
  net_cents bigint NOT NULL CHECK (net_cents >= 0 AND net_cents = gross_cents - fee_cents),
  note text NOT NULL DEFAULT '',
  batch_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_transfer_accounts CHECK (
    (kind = 'transfer' AND to_account_id IS NOT NULL AND to_account_id <> account_id)
    OR (kind <> 'transfer' AND to_account_id IS NULL)
  ),
  CONSTRAINT chk_non_income_zero_fee CHECK (
    kind = 'income' OR fee_cents = 0
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_occurred
  ON public.transactions(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_account
  ON public.transactions(user_id, account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_to_account
  ON public.transactions(user_id, to_account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted
  ON public.transactions(user_id, deleted_at);

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Tabela de Log de Auditoria (audit_log)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  before jsonb,
  after jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_record
  ON public.audit_log(user_id, record_id, at DESC);

-- 4. Trigger automático de auditoria para transactions
CREATE OR REPLACE FUNCTION public.trg_fn_audit_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, table_name, record_id, action, before, after, at)
    VALUES (NEW.user_id, 'transactions', NEW.id, 'create', NULL, to_jsonb(NEW), now());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'delete';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_action := 'restore';
    ELSE
      v_action := 'update';
    END IF;

    INSERT INTO public.audit_log (user_id, table_name, record_id, action, before, after, at)
    VALUES (NEW.user_id, 'transactions', NEW.id, v_action, to_jsonb(OLD), to_jsonb(NEW), now());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_audit ON public.transactions;
CREATE TRIGGER trg_transactions_audit
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_audit_transactions();

-- 5. Ativar Row Level Security (RLS) em transactions e audit_log
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own"
  ON public.transactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own"
  ON public.transactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "audit_log_select_own" ON public.audit_log;
CREATE POLICY "audit_log_select_own"
  ON public.audit_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6. Função SQL para salvar Lote do Dia em transação única (Tudo ou Nada)
CREATE OR REPLACE FUNCTION public.insert_income_batch(
  p_occurred_at timestamptz,
  p_note text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_batch_id uuid := gen_random_uuid();
  v_item jsonb;
  v_gross bigint;
  v_fee bigint;
  v_net bigint;
  v_account_id uuid;
  v_pm_id uuid;
  v_line_note text;
  v_count int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos uma linha válida no lote.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_gross := COALESCE((v_item->>'gross_cents')::bigint, 0);
    v_fee := COALESCE((v_item->>'fee_cents')::bigint, 0);
    v_net := COALESCE((v_item->>'net_cents')::bigint, v_gross - v_fee);
    v_account_id := NULLIF(v_item->>'account_id', '')::uuid;
    v_pm_id := NULLIF(v_item->>'payment_method_id', '')::uuid;
    v_line_note := COALESCE(NULLIF(btrim(v_item->>'note'), ''), COALESCE(p_note, ''));

    IF v_gross <= 0 THEN
      RAISE EXCEPTION 'Valor bruto inválido na linha % do lote.', v_count + 1;
    END IF;

    IF v_fee < 0 OR v_fee > v_gross OR v_net <> (v_gross - v_fee) THEN
      RAISE EXCEPTION 'Taxa inválida na linha % do lote.', v_count + 1;
    END IF;

    IF v_account_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.accounts WHERE id = v_account_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Conta de destino inválida na linha % do lote.', v_count + 1;
    END IF;

    INSERT INTO public.transactions (
      user_id,
      kind,
      occurred_at,
      account_id,
      payment_method_id,
      gross_cents,
      fee_cents,
      net_cents,
      note,
      batch_id
    ) VALUES (
      v_user_id,
      'income',
      COALESCE(p_occurred_at, now()),
      v_account_id,
      v_pm_id,
      v_gross,
      v_fee,
      v_net,
      v_line_note,
      v_batch_id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_batch_id;
END;
$$;

-- 7. Função SQL de Saldo por Conta (PRD 3: saldo inicial + entradas líquidas - saídas +- transferências)
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

