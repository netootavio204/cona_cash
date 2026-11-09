-- ============================================================================
-- FASE 9: MIGRATION 008 — Compras Parceladas (Cartão e Boleto) e Contas a Pagar (v1.4.0)
-- 100% Aditiva, Idempotente e Segura para Dados Reais em Produção.
-- ============================================================================

-- 1. Preferências de Avisos de Vencimento no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS due_alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS due_alert_time text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS due_alert_days_before int NOT NULL DEFAULT 1;

-- 2. Tabela de Compras Parceladas (installment_purchases)
CREATE TABLE IF NOT EXISTS public.installment_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('credit_card', 'boleto')),
  title text NOT NULL,
  expense_item_id uuid REFERENCES public.expense_items(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  income_source_id uuid REFERENCES public.income_sources(id) ON DELETE SET NULL,
  card_name text,
  total_cents bigint NOT NULL CHECK (total_cents > 0),
  installments_count int NOT NULL CHECK (installments_count >= 1 AND installments_count <= 48),
  first_due_date date NOT NULL,
  note text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installment_purchases_user_lookup
  ON public.installment_purchases(user_id, deleted_at, created_at DESC);

DROP TRIGGER IF EXISTS trg_installment_purchases_updated_at ON public.installment_purchases;
CREATE TRIGGER trg_installment_purchases_updated_at
  BEFORE UPDATE ON public.installment_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.installment_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_select_own" ON public.installment_purchases;
CREATE POLICY "purchases_select_own"
  ON public.installment_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "purchases_insert_own" ON public.installment_purchases;
CREATE POLICY "purchases_insert_own"
  ON public.installment_purchases FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "purchases_update_own" ON public.installment_purchases;
CREATE POLICY "purchases_update_own"
  ON public.installment_purchases FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "purchases_delete_own" ON public.installment_purchases;
CREATE POLICY "purchases_delete_own"
  ON public.installment_purchases FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. Tabela de Parcelas Individuais (installments)
CREATE TABLE IF NOT EXISTS public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.installment_purchases(id) ON DELETE CASCADE,
  number int NOT NULL CHECK (number >= 1),
  due_date date NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  paid_amount_cents bigint,
  paid_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_installments_purchase_number UNIQUE (purchase_id, number)
);

CREATE INDEX IF NOT EXISTS idx_installments_user_due_status
  ON public.installments(user_id, status, due_date, deleted_at);

DROP TRIGGER IF EXISTS trg_installments_updated_at ON public.installments;
CREATE TRIGGER trg_installments_updated_at
  BEFORE UPDATE ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installments_select_own" ON public.installments;
CREATE POLICY "installments_select_own"
  ON public.installments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "installments_insert_own" ON public.installments;
CREATE POLICY "installments_insert_own"
  ON public.installments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "installments_update_own" ON public.installments;
CREATE POLICY "installments_update_own"
  ON public.installments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "installments_delete_own" ON public.installments;
CREATE POLICY "installments_delete_own"
  ON public.installments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Adiciona installment_id na tabela transactions (aditivo)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_installment
  ON public.transactions(user_id, installment_id);

-- 5. RPC: Criar compra parcelada com todas as suas parcelas de forma atômica
CREATE OR REPLACE FUNCTION public.create_installment_purchase(
  p_kind text,
  p_title text,
  p_total_cents bigint,
  p_installments_count int,
  p_first_due_date date,
  p_expense_item_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_income_source_id uuid DEFAULT NULL,
  p_card_name text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_installments_override jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_first_day int;
  v_base_amount bigint;
  v_remainder bigint;
  v_inst_num int;
  v_due date;
  v_amount bigint;
  v_item jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_installments_count < 1 OR p_installments_count > 48 THEN
    RAISE EXCEPTION 'O número de parcelas deve ser entre 1 e 48.';
  END IF;

  IF p_total_cents <= 0 THEN
    RAISE EXCEPTION 'O valor total deve ser maior que zero.';
  END IF;

  -- Insere a compra parcelada (NÃO mexe em saldo e NÃO cria saída)
  INSERT INTO public.installment_purchases (
    user_id,
    kind,
    title,
    expense_item_id,
    category_id,
    income_source_id,
    card_name,
    total_cents,
    installments_count,
    first_due_date,
    note
  ) VALUES (
    v_user_id,
    p_kind,
    trim(p_title),
    p_expense_item_id,
    p_category_id,
    p_income_source_id,
    nullif(trim(COALESCE(p_card_name, '')), ''),
    p_total_cents,
    p_installments_count,
    p_first_due_date,
    nullif(trim(COALESCE(p_note, '')), '')
  )
  RETURNING id INTO v_purchase_id;

  -- Se foi passado override personalizado de parcelas
  IF p_installments_override IS NOT NULL AND jsonb_array_length(p_installments_override) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_installments_override)
    LOOP
      INSERT INTO public.installments (
        user_id,
        purchase_id,
        number,
        due_date,
        amount_cents,
        status
      ) VALUES (
        v_user_id,
        v_purchase_id,
        (v_item->>'number')::int,
        (v_item->>'due_date')::date,
        (v_item->>'amount_cents')::bigint,
        'pending'
      );
    END LOOP;
  ELSE
    -- Cálculo padrão de divisão igual com sobra na 1ª parcela
    v_base_amount := p_total_cents / p_installments_count;
    v_remainder := p_total_cents % p_installments_count;
    v_first_day := extract(day from p_first_due_date)::int;

    FOR v_inst_num IN 1..p_installments_count
    LOOP
      v_amount := v_base_amount + CASE WHEN v_inst_num = 1 THEN v_remainder ELSE 0 END;

      -- Cálculo mensal no mesmo dia com ajuste para o último dia do mês
      -- Garante cálculo a partir da 1ª data sem acumular erro
      v_due := (
        (date_trunc('month', p_first_due_date) + ((v_inst_num - 1) || ' months')::interval)
        + ((LEAST(
            v_first_day,
            extract(day from (date_trunc('month', p_first_due_date) + (v_inst_num || ' months')::interval - interval '1 day'))::int
          ) - 1) || ' days')::interval
      )::date;

      INSERT INTO public.installments (
        user_id,
        purchase_id,
        number,
        due_date,
        amount_cents,
        status
      ) VALUES (
        v_user_id,
        v_purchase_id,
        v_inst_num,
        v_due,
        v_amount,
        'pending'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'installments_count', p_installments_count,
    'total_cents', p_total_cents
  );
END;
$$;

-- 6. RPC: Pagar uma parcela (cria saída e reduz saldo da conta)
CREATE OR REPLACE FUNCTION public.pay_installment(
  p_installment_id uuid,
  p_account_id uuid,
  p_paid_at timestamptz DEFAULT now(),
  p_paid_amount_cents bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inst RECORD;
  v_purchase RECORD;
  v_paid_cents bigint;
  v_tx_id uuid;
  v_note text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_inst
  FROM public.installments
  WHERE id = p_installment_id AND user_id = v_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.';
  END IF;

  IF v_inst.status = 'paid' THEN
    RAISE EXCEPTION 'Esta parcela já foi paga.';
  END IF;

  SELECT * INTO v_purchase
  FROM public.installment_purchases
  WHERE id = v_inst.purchase_id AND user_id = v_user_id;

  v_paid_cents := COALESCE(p_paid_amount_cents, v_inst.amount_cents);
  v_note := 'Parcela ' || v_inst.number || '/' || v_purchase.installments_count || ' — ' || v_purchase.title;

  -- 1. Cria a transação de saída (expense) vinculada à parcela
  INSERT INTO public.transactions (
    user_id,
    kind,
    occurred_at,
    account_id,
    category_id,
    expense_item_id,
    income_source_id,
    gross_cents,
    fee_cents,
    net_cents,
    note,
    installment_id
  ) VALUES (
    v_user_id,
    'expense',
    p_paid_at,
    p_account_id,
    v_purchase.category_id,
    v_purchase.expense_item_id,
    v_purchase.income_source_id,
    v_paid_cents,
    0,
    v_paid_cents,
    v_note,
    v_inst.id
  )
  RETURNING id INTO v_tx_id;

  -- 2. Atualiza a parcela para paga
  UPDATE public.installments
  SET
    status = 'paid',
    paid_at = p_paid_at,
    paid_amount_cents = v_paid_cents,
    paid_account_id = p_account_id,
    updated_at = now()
  WHERE id = v_inst.id;

  RETURN jsonb_build_object(
    'success', true,
    'installment_id', v_inst.id,
    'transaction_id', v_tx_id,
    'paid_amount_cents', v_paid_cents
  );
END;
$$;

-- 7. RPC: Desfazer pagamento de uma parcela (volta a pendente e lixeira na saída)
CREATE OR REPLACE FUNCTION public.unpay_installment(
  p_installment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inst RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_inst
  FROM public.installments
  WHERE id = p_installment_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.';
  END IF;

  IF v_inst.status <> 'paid' THEN
    RAISE EXCEPTION 'Esta parcela não está paga.';
  END IF;

  -- 1. Soft-delete na saída gerada
  UPDATE public.transactions
  SET deleted_at = now()
  WHERE user_id = v_user_id
    AND installment_id = p_installment_id
    AND deleted_at IS NULL;

  -- 2. Reverte a parcela para pendente
  UPDATE public.installments
  SET
    status = 'pending',
    paid_at = NULL,
    paid_amount_cents = NULL,
    paid_account_id = NULL,
    updated_at = now()
  WHERE id = p_installment_id;

  RETURN jsonb_build_object(
    'success', true,
    'installment_id', p_installment_id,
    'status', 'pending'
  );
END;
$$;

-- 8. RPC: Listar Contas a Pagar com Resumo e Parcelas
CREATE OR REPLACE FUNCTION public.get_installments_summary(
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_overdue_cents bigint := 0;
  v_overdue_count int := 0;
  v_due_today_cents bigint := 0;
  v_due_today_count int := 0;
  v_next_7_days_cents bigint := 0;
  v_next_7_days_count int := 0;
  v_month_total_cents bigint := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Atrasadas: pendente com due_date < hoje
  SELECT
    COALESCE(SUM(amount_cents), 0),
    COUNT(id)
  INTO v_overdue_cents, v_overdue_count
  FROM public.installments
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
    AND status = 'pending'
    AND due_date < p_today;

  -- Vencem hoje: pendente com due_date = hoje
  SELECT
    COALESCE(SUM(amount_cents), 0),
    COUNT(id)
  INTO v_due_today_cents, v_due_today_count
  FROM public.installments
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
    AND status = 'pending'
    AND due_date = p_today;

  -- Próximos 7 dias: pendente com due_date entre hoje e hoje + 7 dias
  SELECT
    COALESCE(SUM(amount_cents), 0),
    COUNT(id)
  INTO v_next_7_days_cents, v_next_7_days_count
  FROM public.installments
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
    AND status = 'pending'
    AND due_date >= p_today
    AND due_date <= p_today + 7;

  -- Total do mês corrente (pendentes no mês de hoje)
  SELECT
    COALESCE(SUM(amount_cents), 0)
  INTO v_month_total_cents
  FROM public.installments
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
    AND status = 'pending'
    AND date_trunc('month', due_date) = date_trunc('month', p_today);

  RETURN jsonb_build_object(
    'overdue_cents', v_overdue_cents,
    'overdue_count', v_overdue_count,
    'due_today_cents', v_due_today_cents,
    'due_today_count', v_due_today_count,
    'next_7_days_cents', v_next_7_days_cents,
    'next_7_days_count', v_next_7_days_count,
    'month_total_cents', v_month_total_cents
  );
END;
$$;
