-- ============================================================================
-- FASE 7: MIGRATION 006 — Lote do Dia em Duas Etapas e Correções (v1.2.0)
-- Aditiva, idempotente e segura para dados existentes.
-- ============================================================================

-- 1. Campos de sistema na tabela accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_kind text;

-- Função auxiliar para assegurar a conta 'A distribuir' do usuário
CREATE OR REPLACE FUNCTION public.ensure_user_pending_account(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_acc_id
  FROM public.accounts
  WHERE user_id = p_user_id
    AND (system_kind = 'pending' OR (is_system = true AND name = 'A distribuir'))
  LIMIT 1;

  IF v_acc_id IS NULL THEN
    INSERT INTO public.accounts (
      user_id,
      name,
      type,
      initial_balance_cents,
      color,
      is_system,
      system_kind,
      archived
    ) VALUES (
      p_user_id,
      'A distribuir',
      'bank',
      0,
      '#FFC940',
      true,
      'pending',
      false
    )
    RETURNING id INTO v_acc_id;
  END IF;

  RETURN v_acc_id;
END;
$$;

-- Criar a conta 'A distribuir' para todos os usuários existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM auth.users LOOP
    PERFORM public.ensure_user_pending_account(r.id);
  END LOOP;
END;
$$;

-- Atualizar seed_user_defaults para sempre incluir a conta do sistema
CREATE OR REPLACE FUNCTION public.seed_user_defaults(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc1 uuid;
  v_acc2 uuid;
  v_acc3 uuid;
  v_bolso uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Conta de sistema para lotes em trânsito
  PERFORM public.ensure_user_pending_account(p_user_id);

  -- Contas padrão normais
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = p_user_id AND is_system = false) THEN
    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color, is_system)
    VALUES (p_user_id, 'Conta 1', 'bank', 0, '#FF7A1A', false)
    RETURNING id INTO v_acc1;

    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color, is_system)
    VALUES (p_user_id, 'Conta 2', 'bank', 0, '#38BDF8', false)
    RETURNING id INTO v_acc2;

    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color, is_system)
    VALUES (p_user_id, 'Conta 3', 'bank', 0, '#A855F7', false)
    RETURNING id INTO v_acc3;

    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color, is_system)
    VALUES (p_user_id, 'Bolso (dinheiro)', 'cash', 0, '#2EE59D', false)
    RETURNING id INTO v_bolso;

    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE user_id = p_user_id) THEN
      INSERT INTO public.payment_methods (user_id, name, default_account_id, fee_percent)
      VALUES
        (p_user_id, 'Maquininha (cartão)', v_acc1, 0.00),
        (p_user_id, 'Pix', v_acc2, 0.00),
        (p_user_id, 'Online (app)', v_acc3, 0.00),
        (p_user_id, 'Dinheiro', v_bolso, 0.00);
    END IF;
  END IF;

  -- Categorias padrão
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id) THEN
    INSERT INTO public.categories (user_id, name, icon, color)
    VALUES
      (p_user_id, 'Abastecimento', 'fuel', '#FF7A1A'),
      (p_user_id, 'Alimentação', 'utensils', '#FFC940'),
      (p_user_id, 'Peça de carro', 'cog', '#38BDF8'),
      (p_user_id, 'Manutenção', 'wrench', '#A855F7'),
      (p_user_id, 'Lavagem', 'droplets', '#2EE59D'),
      (p_user_id, 'Gasto avulso', 'receipt', '#FF3B30');
  END IF;

  -- Fontes de renda padrão
  PERFORM public.seed_user_income_sources(p_user_id);
END;
$$;

-- 2. Tabela de Lotes Diários (daily_batches)
CREATE TABLE IF NOT EXISTS public.daily_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_batches_user_date
  ON public.daily_batches(user_id, work_date DESC);

DROP TRIGGER IF EXISTS trg_daily_batches_updated_at ON public.daily_batches;
CREATE TRIGGER trg_daily_batches_updated_at
  BEFORE UPDATE ON public.daily_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_batches_select_own" ON public.daily_batches;
CREATE POLICY "daily_batches_select_own"
  ON public.daily_batches FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_batches_insert_own" ON public.daily_batches;
CREATE POLICY "daily_batches_insert_own"
  ON public.daily_batches FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_batches_update_own" ON public.daily_batches;
CREATE POLICY "daily_batches_update_own"
  ON public.daily_batches FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_batches_delete_own" ON public.daily_batches;
CREATE POLICY "daily_batches_delete_own"
  ON public.daily_batches FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. Campo parent_id em transactions para ligar as partes distribuídas à linha do lote
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_user_parent_id
  ON public.transactions(user_id, parent_id);

-- 4. Função de saldos por conta (get_account_balances)
-- Transferência: origem perde gross_cents, destino ganha net_cents.
-- Para transferências sem taxa (antigas), gross_cents = net_cents (saldo inalterado).
CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE (
  account_id uuid,
  account_name text,
  account_type text,
  account_color text,
  archived boolean,
  is_system boolean,
  system_kind text,
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
      COALESCE(SUM(CASE WHEN t.kind = 'transfer' AND t.account_id = a.id THEN t.gross_cents ELSE 0 END), 0)::bigint AS trf_out
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
    COALESCE(a.is_system, false) AS is_system,
    a.system_kind,
    a.initial_balance_cents,
    s.inc_net AS income_net_cents,
    s.exp_net AS expense_cents,
    s.trf_in AS transfer_in_cents,
    s.trf_out AS transfer_out_cents,
    (a.initial_balance_cents + s.inc_net - s.exp_net + s.trf_in - s.trf_out)::bigint AS current_balance_cents
  FROM public.accounts a
  JOIN tx_summary s ON s.acc_id = a.id
  WHERE a.user_id = auth.uid()
  ORDER BY a.archived ASC, a.is_system ASC, a.created_at ASC;
$$;

-- 5. RPC: Criar novo lote diário (Etapa 1: Bruto)
CREATE OR REPLACE FUNCTION public.create_daily_batch(
  p_work_date date,
  p_note text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_pending_acc_id uuid;
  v_item jsonb;
  v_gross bigint;
  v_source_id uuid;
  v_line_note text;
  v_occurred_at timestamptz;
  v_count int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos uma linha com valor ao lote.';
  END IF;

  -- Obter conta de trânsito 'A distribuir'
  v_pending_acc_id := public.ensure_user_pending_account(v_user_id);
  IF v_pending_acc_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar a conta do sistema A distribuir.';
  END IF;

  -- Definir data/hora de ocorrência baseada na data do lote
  IF p_work_date IS NULL OR p_work_date = CURRENT_DATE THEN
    v_occurred_at := now();
  ELSE
    v_occurred_at := (p_work_date::text || ' 12:00:00')::timestamptz;
  END IF;

  -- Criar o registro do lote
  INSERT INTO public.daily_batches (
    user_id,
    work_date,
    note
  ) VALUES (
    v_user_id,
    COALESCE(p_work_date, CURRENT_DATE),
    p_note
  )
  RETURNING id INTO v_batch_id;

  -- Inserir cada linha como receita na conta 'A distribuir'
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_gross := COALESCE((v_item->>'gross_cents')::bigint, 0);
    v_source_id := NULLIF(v_item->>'income_source_id', '')::uuid;
    v_line_note := COALESCE(NULLIF(btrim(v_item->>'note'), ''), p_note);

    IF v_gross <= 0 THEN
      RAISE EXCEPTION 'Valor da linha % do lote deve ser maior que zero.', v_count + 1;
    END IF;

    -- Validar se a fonte de renda informada existe para o usuário
    IF v_source_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.income_sources WHERE id = v_source_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Fonte de renda inválida na linha %.', v_count + 1;
    END IF;

    INSERT INTO public.transactions (
      user_id,
      kind,
      occurred_at,
      account_id,
      payment_method_id,
      income_source_id,
      gross_cents,
      fee_cents,
      net_cents,
      note,
      batch_id
    ) VALUES (
      v_user_id,
      'income',
      v_occurred_at,
      v_pending_acc_id,
      NULL,
      v_source_id,
      v_gross,
      0,
      v_gross,
      v_line_note,
      v_batch_id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_batch_id;
END;
$$;

-- 6. RPC: Distribuir partes de uma linha do lote (Etapa 2: Distribuição com taxas)
CREATE OR REPLACE FUNCTION public.distribute_batch_line(
  p_line_id uuid,
  p_parts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_line RECORD;
  v_already_dist bigint;
  v_remaining bigint;
  v_new_total bigint := 0;
  v_part jsonb;
  v_gross bigint;
  v_fee bigint;
  v_net bigint;
  v_dest_acc_id uuid;
  v_pm_id uuid;
  v_note text;
  v_inserted_count int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 1. Buscar a linha do lote com lock para consistência atômica
  SELECT * INTO v_line
  FROM public.transactions
  WHERE id = p_line_id
    AND user_id = v_user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linha de lote não encontrada ou excluída.';
  END IF;

  IF v_line.kind <> 'income' OR v_line.batch_id IS NULL THEN
    RAISE EXCEPTION 'Esta transação não é uma linha de lote válida para distribuição.';
  END IF;

  -- 2. Calcular quanto já foi distribuído para esta linha
  SELECT COALESCE(SUM(gross_cents), 0) INTO v_already_dist
  FROM public.transactions
  WHERE parent_id = p_line_id
    AND user_id = v_user_id
    AND deleted_at IS NULL;

  v_remaining := v_line.gross_cents - v_already_dist;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'Esta linha já foi totalmente distribuída.';
  END IF;

  IF p_parts IS NULL OR jsonb_typeof(p_parts) <> 'array' OR jsonb_array_length(p_parts) = 0 THEN
    RAISE EXCEPTION 'Envie pelo menos uma parte para distribuir.';
  END IF;

  -- 3. Pré-validar a soma total das novas partes enviadas
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts)
  LOOP
    v_gross := COALESCE((v_part->>'gross_cents')::bigint, 0);
    IF v_gross <= 0 THEN
      RAISE EXCEPTION 'O valor de cada parte deve ser maior que zero.';
    END IF;
    v_new_total := v_new_total + v_gross;
  END LOOP;

  IF v_new_total > v_remaining THEN
    RAISE EXCEPTION 'A soma das partes (R$ %) ultrapassa o valor restante da linha (R$ %).',
      to_char(v_new_total / 100.0, 'FM999G999D00'),
      to_char(v_remaining / 100.0, 'FM999G999D00');
  END IF;

  -- 4. Gravar cada parte como transferência de 'A distribuir' para a conta destino
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts)
  LOOP
    v_gross := COALESCE((v_part->>'gross_cents')::bigint, 0);
    v_fee := COALESCE((v_part->>'fee_cents')::bigint, 0);
    v_net := COALESCE((v_part->>'net_cents')::bigint, v_gross - v_fee);
    v_dest_acc_id := NULLIF(v_part->>'account_id', '')::uuid;
    v_pm_id := NULLIF(v_part->>'payment_method_id', '')::uuid;
    v_note := NULLIF(btrim(v_part->>'note'), '');

    IF v_dest_acc_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.accounts WHERE id = v_dest_acc_id AND user_id = v_user_id AND archived = false
    ) THEN
      RAISE EXCEPTION 'Conta de destino inválida na distribuição.';
    END IF;

    IF v_fee < 0 OR v_fee > v_gross OR v_net <> (v_gross - v_fee) THEN
      RAISE EXCEPTION 'Cálculo de taxa inválido na distribuição.';
    END IF;

    INSERT INTO public.transactions (
      user_id,
      kind,
      occurred_at,
      account_id,
      to_account_id,
      payment_method_id,
      income_source_id,
      gross_cents,
      fee_cents,
      net_cents,
      note,
      batch_id,
      parent_id
    ) VALUES (
      v_user_id,
      'transfer',
      v_line.occurred_at,
      v_line.account_id,
      v_dest_acc_id,
      v_pm_id,
      v_line.income_source_id,
      v_gross,
      v_fee,
      v_net,
      COALESCE(v_note, v_line.note),
      v_line.batch_id,
      p_line_id
    );

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'line_id', p_line_id,
    'distributed_now_cents', v_new_total,
    'total_distributed_cents', v_already_dist + v_new_total,
    'remaining_cents', v_remaining - v_new_total,
    'parts_count', v_inserted_count
  );
END;
$$;

-- 7. RPC: Desfazer distribuição de uma parte (volta para 'A distribuir')
CREATE OR REPLACE FUNCTION public.undistribute_part(p_part_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_part RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_part
  FROM public.transactions
  WHERE id = p_part_id
    AND user_id = v_user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parte distribuída não encontrada ou já desfeita.';
  END IF;

  IF v_part.kind <> 'transfer' OR v_part.parent_id IS NULL THEN
    RAISE EXCEPTION 'Esta transação não é uma parte de distribuição.';
  END IF;

  UPDATE public.transactions
  SET deleted_at = now()
  WHERE id = p_part_id;

  RETURN jsonb_build_object(
    'success', true,
    'undone_part_id', p_part_id,
    'parent_line_id', v_part.parent_id,
    'restored_gross_cents', v_part.gross_cents
  );
END;
$$;

-- 8. RPC: Listar lotes diários com detalhe de linhas e distribuição
CREATE OR REPLACE FUNCTION public.get_daily_batches(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT COALESCE(jsonb_agg(batch_row), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      b.id AS batch_id,
      b.work_date,
      b.note AS batch_note,
      b.created_at,
      b.updated_at,
      COALESCE(SUM(l.gross_cents), 0)::bigint AS total_gross_cents,
      COALESCE(SUM(l.distributed_cents), 0)::bigint AS total_distributed_cents,
      (COALESCE(SUM(l.gross_cents), 0) - COALESCE(SUM(l.distributed_cents), 0))::bigint AS total_remaining_cents,
      CASE
        WHEN COALESCE(SUM(l.distributed_cents), 0) = 0 THEN 'pending'
        WHEN COALESCE(SUM(l.distributed_cents), 0) < COALESCE(SUM(l.gross_cents), 0) THEN 'partial'
        ELSE 'distributed'
      END AS status,
      COALESCE(jsonb_agg(l.line_data ORDER BY l.occurred_at ASC, l.created_at ASC), '[]'::jsonb) AS lines
    FROM public.daily_batches b
    LEFT JOIN (
      SELECT
        t.batch_id,
        t.id AS line_id,
        t.occurred_at,
        t.created_at,
        t.gross_cents,
        t.note AS line_note,
        s.id AS source_id,
        s.name AS source_name,
        s.color AS source_color,
        s.icon AS source_icon,
        COALESCE(parts_agg.distributed_cents, 0)::bigint AS distributed_cents,
        (t.gross_cents - COALESCE(parts_agg.distributed_cents, 0))::bigint AS remaining_cents,
        jsonb_build_object(
          'id', t.id,
          'occurred_at', t.occurred_at,
          'gross_cents', t.gross_cents,
          'note', t.note,
          'source', jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'color', s.color,
            'icon', s.icon
          ),
          'distributed_cents', COALESCE(parts_agg.distributed_cents, 0),
          'remaining_cents', t.gross_cents - COALESCE(parts_agg.distributed_cents, 0),
          'status', CASE
            WHEN COALESCE(parts_agg.distributed_cents, 0) = 0 THEN 'pending'
            WHEN COALESCE(parts_agg.distributed_cents, 0) < t.gross_cents THEN 'partial'
            ELSE 'distributed'
          END,
          'parts', COALESCE(parts_agg.parts, '[]'::jsonb)
        ) AS line_data
      FROM public.transactions t
      LEFT JOIN public.income_sources s ON s.id = t.income_source_id
      LEFT JOIN (
        SELECT
          p.parent_id,
          COALESCE(SUM(p.gross_cents), 0)::bigint AS distributed_cents,
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'gross_cents', p.gross_cents,
              'fee_cents', p.fee_cents,
              'net_cents', p.net_cents,
              'payment_method_id', p.payment_method_id,
              'payment_method_name', pm.name,
              'account_id', p.to_account_id,
              'account_name', acc.name,
              'account_color', acc.color,
              'note', p.note,
              'created_at', p.created_at
            ) ORDER BY p.created_at ASC
          ) AS parts
        FROM public.transactions p
        LEFT JOIN public.payment_methods pm ON pm.id = p.payment_method_id
        LEFT JOIN public.accounts acc ON acc.id = p.to_account_id
        WHERE p.user_id = v_user_id
          AND p.kind = 'transfer'
          AND p.deleted_at IS NULL
          AND p.parent_id IS NOT NULL
        GROUP BY p.parent_id
      ) parts_agg ON parts_agg.parent_id = t.id
      WHERE t.user_id = v_user_id
        AND t.kind = 'income'
        AND t.deleted_at IS NULL
        AND t.parent_id IS NULL
    ) l ON l.batch_id = b.id
    WHERE b.user_id = v_user_id
      AND (p_start_date IS NULL OR b.work_date >= p_start_date)
      AND (p_end_date IS NULL OR b.work_date <= p_end_date)
    GROUP BY b.id, b.work_date, b.note, b.created_at, b.updated_at
    ORDER BY b.work_date DESC, b.created_at DESC
  ) batch_row;

  RETURN v_result;
END;
$$;

-- 9. Atualizar get_financial_report para reconhecer taxas da distribuição e 'A distribuir'
CREATE OR REPLACE FUNCTION public.get_financial_report(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_income_source_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_totals jsonb;
  v_by_source jsonb;
  v_by_category jsonb;
  v_by_payment_method jsonb;
  v_by_account jsonb;
  v_daily jsonb;
  v_pending_acc_id uuid;
  v_pending_in_period bigint := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id INTO v_pending_acc_id
  FROM public.accounts
  WHERE user_id = v_user_id
    AND (system_kind = 'pending' OR (is_system = true AND name = 'A distribuir'))
  LIMIT 1;

  -- 1. TOTAIS CONSOLIDADOS
  -- Gross: soma de receitas de fontes que contam como ganho
  -- Fees: soma de taxas de receitas diretas + taxas de distribuição por partes
  -- Net: Gross - Fees
  WITH report_incomes AS (
    SELECT 
      t.id,
      t.gross_cents,
      t.fee_cents,
      s.counts_as_earning
    FROM public.transactions t
    LEFT JOIN public.income_sources s ON s.id = t.income_source_id
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
      AND t.kind = 'income'
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
  ),
  report_dist_fees AS (
    SELECT 
      COALESCE(SUM(p.fee_cents), 0)::bigint AS dist_fees
    FROM public.transactions p
    JOIN public.transactions parent ON parent.id = p.parent_id
    LEFT JOIN public.income_sources s ON s.id = parent.income_source_id
    WHERE p.user_id = v_user_id
      AND p.deleted_at IS NULL
      AND p.kind = 'transfer'
      AND p.parent_id IS NOT NULL
      AND parent.occurred_at >= p_start_date
      AND parent.occurred_at <= p_end_date
      AND (s.counts_as_earning IS NULL OR s.counts_as_earning = true)
      AND (p_income_source_id IS NULL OR parent.income_source_id = p_income_source_id)
  ),
  report_expenses AS (
    SELECT COALESCE(SUM(net_cents), 0)::bigint AS total_expenses
    FROM public.transactions
    WHERE user_id = v_user_id
      AND deleted_at IS NULL
      AND kind = 'expense'
      AND occurred_at >= p_start_date
      AND occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR income_source_id = p_income_source_id)
  )
  SELECT jsonb_build_object(
    'gross_earnings_cents', COALESCE(SUM(CASE WHEN counts_as_earning IS NULL OR counts_as_earning = true THEN gross_cents ELSE 0 END), 0),
    'fees_cents', COALESCE(SUM(CASE WHEN counts_as_earning IS NULL OR counts_as_earning = true THEN fee_cents ELSE 0 END), 0) + (SELECT dist_fees FROM report_dist_fees),
    'net_earnings_cents', (
      COALESCE(SUM(CASE WHEN counts_as_earning IS NULL OR counts_as_earning = true THEN gross_cents ELSE 0 END), 0) -
      (COALESCE(SUM(CASE WHEN counts_as_earning IS NULL OR counts_as_earning = true THEN fee_cents ELSE 0 END), 0) + (SELECT dist_fees FROM report_dist_fees))
    ),
    'expenses_cents', (SELECT total_expenses FROM report_expenses),
    'contributions_cents', COALESCE(SUM(CASE WHEN counts_as_earning = false THEN gross_cents ELSE 0 END), 0),
    'net_result_cents', (
      (
        COALESCE(SUM(CASE WHEN counts_as_earning IS NULL OR counts_as_earning = true THEN gross_cents ELSE 0 END), 0) -
        (COALESCE(SUM(CASE WHEN counts_as_earning IS NULL OR counts_as_earning = true THEN fee_cents ELSE 0 END), 0) + (SELECT dist_fees FROM report_dist_fees))
      ) - (SELECT total_expenses FROM report_expenses)
    ),
    'transaction_count', (SELECT COUNT(id) FROM public.transactions WHERE user_id = v_user_id AND deleted_at IS NULL AND occurred_at >= p_start_date AND occurred_at <= p_end_date)
  )
  INTO v_totals
  FROM report_incomes;

  -- 2. QUEBRA POR FONTE DE RENDA E LUCRO POR FONTE
  SELECT COALESCE(jsonb_agg(source_row), '[]'::jsonb)
  INTO v_by_source
  FROM (
    WITH src_incomes AS (
      SELECT 
        s.id AS source_id,
        s.name AS source_name,
        s.color AS source_color,
        s.icon AS source_icon,
        s.counts_as_earning,
        COALESCE(SUM(t.gross_cents), 0)::bigint AS gross_cents,
        COALESCE(SUM(t.fee_cents), 0)::bigint AS direct_fee_cents,
        COUNT(t.id) AS inc_count
      FROM public.transactions t
      LEFT JOIN public.income_sources s ON s.id = t.income_source_id
      WHERE t.user_id = v_user_id
        AND t.deleted_at IS NULL
        AND t.kind = 'income'
        AND t.occurred_at >= p_start_date
        AND t.occurred_at <= p_end_date
        AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
      GROUP BY s.id, s.name, s.color, s.icon, s.counts_as_earning
    ),
    src_dist_fees AS (
      SELECT
        s.id AS source_id,
        COALESCE(SUM(p.fee_cents), 0)::bigint AS dist_fee_cents
      FROM public.transactions p
      JOIN public.transactions parent ON parent.id = p.parent_id
      LEFT JOIN public.income_sources s ON s.id = parent.income_source_id
      WHERE p.user_id = v_user_id
        AND p.deleted_at IS NULL
        AND p.kind = 'transfer'
        AND p.parent_id IS NOT NULL
        AND parent.occurred_at >= p_start_date
        AND parent.occurred_at <= p_end_date
        AND (p_income_source_id IS NULL OR parent.income_source_id = p_income_source_id)
      GROUP BY s.id
    ),
    src_expenses AS (
      SELECT
        s.id AS source_id,
        COALESCE(SUM(t.net_cents), 0)::bigint AS direct_expenses_cents
      FROM public.transactions t
      LEFT JOIN public.income_sources s ON s.id = t.income_source_id
      WHERE t.user_id = v_user_id
        AND t.deleted_at IS NULL
        AND t.kind = 'expense'
        AND t.income_source_id IS NOT NULL
        AND t.occurred_at >= p_start_date
        AND t.occurred_at <= p_end_date
        AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
      GROUP BY s.id
    )
    SELECT
      COALESCE(si.source_id::text, 'none') AS source_id,
      COALESCE(si.source_name, 'Sem fonte definida') AS source_name,
      COALESCE(si.source_color, '#9A9AA6') AS source_color,
      COALESCE(si.source_icon, 'briefcase') AS source_icon,
      COALESCE(si.counts_as_earning, true) AS counts_as_earning,
      (si.gross_cents - (si.direct_fee_cents + COALESCE(df.dist_fee_cents, 0))) AS earnings_net_cents,
      COALESCE(se.direct_expenses_cents, 0) AS direct_expenses_cents,
      (
        CASE WHEN si.counts_as_earning IS NULL OR si.counts_as_earning = true 
             THEN (si.gross_cents - (si.direct_fee_cents + COALESCE(df.dist_fee_cents, 0)))
             ELSE 0
        END - COALESCE(se.direct_expenses_cents, 0)
      ) AS profit_cents,
      si.inc_count AS count
    FROM src_incomes si
    LEFT JOIN src_dist_fees df ON df.source_id = si.source_id
    LEFT JOIN src_expenses se ON se.source_id = si.source_id
    ORDER BY earnings_net_cents DESC
  ) source_row;

  -- 3. QUEBRA POR CATEGORIA DE SAÍDA
  SELECT COALESCE(jsonb_agg(cat_row), '[]'::jsonb)
  INTO v_by_category
  FROM (
    SELECT 
      c.id as category_id,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      COALESCE(SUM(t.net_cents), 0) as total_cents,
      COUNT(t.id) as count
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
      AND t.kind = 'expense'
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
    GROUP BY c.id, c.name, c.color, c.icon
    ORDER BY total_cents DESC
  ) cat_row;

  -- 4. QUEBRA POR FORMA DE PAGAMENTO (Receitas diretas + Partes distribuídas + A distribuir)
  -- Descobrir quanto ficou pendente de distribuição no período
  IF v_pending_acc_id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      t.gross_cents - COALESCE((
        SELECT SUM(p.gross_cents) 
        FROM public.transactions p 
        WHERE p.parent_id = t.id AND p.deleted_at IS NULL AND p.kind = 'transfer'
      ), 0)
    ), 0)::bigint
    INTO v_pending_in_period
    FROM public.transactions t
    WHERE t.user_id = v_user_id
      AND t.account_id = v_pending_acc_id
      AND t.kind = 'income'
      AND t.deleted_at IS NULL
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id);
  END IF;

  SELECT COALESCE(jsonb_agg(pm_row), '[]'::jsonb)
  INTO v_by_payment_method
  FROM (
    WITH direct_pm AS (
      SELECT 
        pm.id as payment_method_id,
        pm.name as payment_method_name,
        COALESCE(SUM(t.gross_cents), 0)::bigint as gross_cents,
        COALESCE(SUM(t.fee_cents), 0)::bigint as fee_cents,
        COALESCE(SUM(t.net_cents), 0)::bigint as net_cents,
        COUNT(t.id) as count
      FROM public.transactions t
      JOIN public.payment_methods pm ON pm.id = t.payment_method_id
      WHERE t.user_id = v_user_id
        AND t.deleted_at IS NULL
        AND t.kind = 'income'
        AND t.parent_id IS NULL
        AND (v_pending_acc_id IS NULL OR t.account_id <> v_pending_acc_id)
        AND t.occurred_at >= p_start_date
        AND t.occurred_at <= p_end_date
        AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
      GROUP BY pm.id, pm.name
    ),
    dist_pm AS (
      SELECT 
        pm.id as payment_method_id,
        pm.name as payment_method_name,
        COALESCE(SUM(p.gross_cents), 0)::bigint as gross_cents,
        COALESCE(SUM(p.fee_cents), 0)::bigint as fee_cents,
        COALESCE(SUM(p.net_cents), 0)::bigint as net_cents,
        COUNT(p.id) as count
      FROM public.transactions p
      JOIN public.transactions parent ON parent.id = p.parent_id
      JOIN public.payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.user_id = v_user_id
        AND p.deleted_at IS NULL
        AND p.kind = 'transfer'
        AND p.parent_id IS NOT NULL
        AND parent.occurred_at >= p_start_date
        AND parent.occurred_at <= p_end_date
        AND (p_income_source_id IS NULL OR parent.income_source_id = p_income_source_id)
      GROUP BY pm.id, pm.name
    ),
    combined_pm AS (
      SELECT * FROM direct_pm
      UNION ALL
      SELECT * FROM dist_pm
    ),
    unified_pm AS (
      SELECT
        payment_method_id::text,
        payment_method_name,
        SUM(gross_cents)::bigint AS gross_cents,
        SUM(fee_cents)::bigint AS fee_cents,
        SUM(net_cents)::bigint AS net_cents,
        SUM(count)::bigint AS count
      FROM combined_pm
      GROUP BY payment_method_id, payment_method_name
    )
    SELECT * FROM unified_pm
    UNION ALL
    -- Linha de valor a distribuir caso haja saldo pendente no período
    SELECT 
      'pending' AS payment_method_id,
      'A distribuir' AS payment_method_name,
      v_pending_in_period AS gross_cents,
      0::bigint AS fee_cents,
      v_pending_in_period AS net_cents,
      1::bigint AS count
    WHERE v_pending_in_period > 0
    ORDER BY net_cents DESC
  ) pm_row;

  -- 5. QUEBRA POR CONTA
  SELECT COALESCE(jsonb_agg(acc_row), '[]'::jsonb)
  INTO v_by_account
  FROM (
    SELECT 
      a.id as account_id,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      COALESCE(SUM(CASE 
        WHEN t.kind = 'income' AND t.account_id = a.id THEN t.net_cents 
        WHEN t.kind = 'transfer' AND t.to_account_id = a.id THEN t.net_cents
        ELSE 0 
      END), 0) as in_cents,
      COALESCE(SUM(CASE 
        WHEN t.kind = 'expense' AND t.account_id = a.id THEN t.net_cents 
        WHEN t.kind = 'transfer' AND t.account_id = a.id THEN t.gross_cents
        ELSE 0 
      END), 0) as out_cents
    FROM public.accounts a
    LEFT JOIN public.transactions t ON (t.account_id = a.id OR t.to_account_id = a.id)
      AND t.user_id = v_user_id 
      AND t.deleted_at IS NULL
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
    WHERE a.user_id = v_user_id
      AND (a.archived = false OR a.is_system = true)
    GROUP BY a.id, a.name, a.type, a.color
    ORDER BY a.name ASC
  ) acc_row;

  -- 6. EVOLUÇÃO DIÁRIA (Dias no fuso local America/Sao_Paulo)
  SELECT COALESCE(jsonb_agg(daily_row), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT 
      to_char(t.occurred_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as day,
      COALESCE(SUM(CASE WHEN t.kind = 'income' AND (s.counts_as_earning IS NULL OR s.counts_as_earning = true) THEN t.net_cents ELSE 0 END), 0) as earnings_net_cents,
      COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.net_cents ELSE 0 END), 0) as expenses_cents,
      COALESCE(SUM(CASE WHEN t.kind = 'income' AND s.counts_as_earning = false THEN t.net_cents ELSE 0 END), 0) as contributions_cents
    FROM public.transactions t
    LEFT JOIN public.income_sources s ON s.id = t.income_source_id
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
    GROUP BY to_char(t.occurred_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')
    ORDER BY day ASC
  ) daily_row;

  -- MONTAGEM DO RESULTADO FINAL
  v_result := jsonb_build_object(
    'totals', v_totals,
    'by_source', v_by_source,
    'by_category', v_by_category,
    'by_payment_method', v_by_payment_method,
    'by_account', v_by_account,
    'daily', v_daily
  );

  RETURN v_result;
END;
$$;
