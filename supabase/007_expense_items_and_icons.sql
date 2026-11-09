-- ============================================================================
-- FASE 8: MIGRATION 007 — Itens de Saída, Banco de Ícones e Relatórios por Item (v1.3.0)
-- Totalmente aditiva, idempotente e segura para dados existentes.
-- ============================================================================

-- 1. Função pura e determinística para normalização de nomes de itens (minúsculo, sem acentos, sem espaços extras)
CREATE OR REPLACE FUNCTION public.normalize_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    translate(
      trim(COALESCE(p_text, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
    )
  );
$$;

-- 2. Tabela de Itens de Saída (expense_items)
CREATE TABLE IF NOT EXISTS public.expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  icon text,
  default_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  default_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  default_amount_cents bigint NOT NULL DEFAULT 0,
  use_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_expense_items_user_normalized UNIQUE (user_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_expense_items_user_lookup
  ON public.expense_items(user_id, archived, use_count DESC, last_used_at DESC);

DROP TRIGGER IF EXISTS trg_expense_items_updated_at ON public.expense_items;
CREATE TRIGGER trg_expense_items_updated_at
  BEFORE UPDATE ON public.expense_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_items_select_own" ON public.expense_items;
CREATE POLICY "expense_items_select_own"
  ON public.expense_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "expense_items_insert_own" ON public.expense_items;
CREATE POLICY "expense_items_insert_own"
  ON public.expense_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "expense_items_update_own" ON public.expense_items;
CREATE POLICY "expense_items_update_own"
  ON public.expense_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "expense_items_delete_own" ON public.expense_items;
CREATE POLICY "expense_items_delete_own"
  ON public.expense_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. Campos adicionais de ícones nas tabelas existentes (aditivo)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS icon text;

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS icon text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS expense_item_id uuid REFERENCES public.expense_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_item_date
  ON public.transactions(user_id, expense_item_id, occurred_at DESC);

-- 4. RPC: Obter ou criar item de saída de forma atômica
CREATE OR REPLACE FUNCTION public.get_or_create_expense_item(
  p_name text,
  p_category_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL,
  p_amount_cents bigint DEFAULT NULL,
  p_icon text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_trimmed text;
  v_norm text;
  v_item RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_trimmed := trim(COALESCE(p_name, ''));
  IF v_trimmed = '' THEN
    RETURN NULL;
  END IF;

  -- Formata primeira letra maiúscula
  v_trimmed := upper(substring(v_trimmed from 1 for 1)) || substring(v_trimmed from 2);
  v_norm := public.normalize_text(v_trimmed);

  -- Busca se já existe pelo nome normalizado
  SELECT * INTO v_item
  FROM public.expense_items
  WHERE user_id = v_user_id
    AND normalized_name = v_norm
  LIMIT 1;

  IF FOUND THEN
    -- Atualiza último valor e conta padrão caso informados
    UPDATE public.expense_items
    SET
      default_category_id = COALESCE(p_category_id, default_category_id),
      default_account_id = COALESCE(p_account_id, default_account_id),
      default_amount_cents = COALESCE(p_amount_cents, default_amount_cents),
      use_count = use_count + 1,
      last_used_at = now(),
      archived = false
    WHERE id = v_item.id
    RETURNING * INTO v_item;

    RETURN to_jsonb(v_item);
  END IF;

  -- Se não existe, cria novo item
  INSERT INTO public.expense_items (
    user_id,
    name,
    normalized_name,
    icon,
    default_category_id,
    default_account_id,
    default_amount_cents,
    use_count,
    last_used_at,
    archived
  ) VALUES (
    v_user_id,
    v_trimmed,
    v_norm,
    p_icon,
    p_category_id,
    p_account_id,
    COALESCE(p_amount_cents, 0),
    1,
    now(),
    false
  )
  RETURNING * INTO v_item;

  RETURN to_jsonb(v_item);
END;
$$;

-- 5. RPC: Mesclar dois itens de saída duplicados
CREATE OR REPLACE FUNCTION public.merge_expense_items(
  p_target_item_id uuid,
  p_source_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target RECORD;
  v_source RECORD;
  v_moved_count int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_target_item_id = p_source_item_id THEN
    RAISE EXCEPTION 'O item de destino deve ser diferente do item de origem.';
  END IF;

  SELECT * INTO v_target FROM public.expense_items WHERE id = p_target_item_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de destino não encontrado.';
  END IF;

  SELECT * INTO v_source FROM public.expense_items WHERE id = p_source_item_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de origem não encontrado.';
  END IF;

  -- Move as transações para o item alvo
  UPDATE public.transactions
  SET expense_item_id = p_target_item_id
  WHERE user_id = v_user_id
    AND expense_item_id = p_source_item_id;

  GET DIAGNOSTICS v_moved_count = ROW_COUNT;

  -- Atualiza métricas do item alvo
  UPDATE public.expense_items
  SET
    use_count = use_count + v_source.use_count,
    last_used_at = GREATEST(last_used_at, v_source.last_used_at)
  WHERE id = p_target_item_id;

  -- Arquiva o item de origem
  UPDATE public.expense_items
  SET archived = true
  WHERE id = p_source_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'target_id', p_target_item_id,
    'source_id', p_source_item_id,
    'transactions_moved', v_moved_count
  );
END;
$$;

-- 6. RPC: Relatório de gastos por item no período
CREATE OR REPLACE FUNCTION public.report_expenses_by_item(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total_expenses bigint := 0;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Total geral de saídas no período
  SELECT COALESCE(SUM(net_cents), 0)::bigint
  INTO v_total_expenses
  FROM public.transactions
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
    AND kind = 'expense'
    AND occurred_at >= p_start_date
    AND occurred_at <= p_end_date;

  SELECT jsonb_build_object(
    'total_expenses_cents', v_total_expenses,
    'items', COALESCE(jsonb_agg(item_row ORDER BY item_row.total_cents DESC), '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT
      ei.id AS item_id,
      COALESCE(ei.name, 'Sem item') AS item_name,
      ei.icon AS item_icon,
      c.id AS category_id,
      c.name AS category_name,
      c.color AS category_color,
      COALESCE(SUM(t.net_cents), 0)::bigint AS total_cents,
      COUNT(t.id)::int AS count,
      (COALESCE(SUM(t.net_cents), 0) / GREATEST(1, COUNT(t.id)))::bigint AS avg_cents,
      ROUND(
        CASE
          WHEN v_total_expenses > 0 THEN (COALESCE(SUM(t.net_cents), 0)::numeric / v_total_expenses::numeric) * 100
          ELSE 0
        END,
        2
      ) AS percent_of_total
    FROM public.transactions t
    LEFT JOIN public.expense_items ei ON ei.id = t.expense_item_id
    LEFT JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
      AND t.kind = 'expense'
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
    GROUP BY ei.id, ei.name, ei.icon, c.id, c.name, c.color
  ) item_row;

  RETURN v_result;
END;
$$;

-- 7. RPC: Detalhe histórico de um item específico
CREATE OR REPLACE FUNCTION public.report_item_detail(
  p_item_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item RECORD;
  v_monthly jsonb;
  v_purchases jsonb;
  v_total_period bigint := 0;
  v_count_period int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_item
  FROM public.expense_items
  WHERE id = p_item_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado.';
  END IF;

  -- Totais do período
  SELECT
    COALESCE(SUM(net_cents), 0)::bigint,
    COUNT(id)::int
  INTO v_total_period, v_count_period
  FROM public.transactions
  WHERE user_id = v_user_id
    AND expense_item_id = p_item_id
    AND deleted_at IS NULL
    AND kind = 'expense'
    AND (p_start_date IS NULL OR occurred_at >= p_start_date)
    AND (p_end_date IS NULL OR occurred_at <= p_end_date);

  -- Histórico dos últimos 6 meses (em barras)
  SELECT COALESCE(jsonb_agg(m_row ORDER BY m_row.month_key ASC), '[]'::jsonb)
  INTO v_monthly
  FROM (
    SELECT
      to_char(t.occurred_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month_key,
      to_char(t.occurred_at AT TIME ZONE 'America/Sao_Paulo', 'TMMon/YY') AS month_label,
      COALESCE(SUM(t.net_cents), 0)::bigint AS total_cents,
      COUNT(t.id)::int AS count
    FROM public.transactions t
    WHERE t.user_id = v_user_id
      AND t.expense_item_id = p_item_id
      AND t.deleted_at IS NULL
      AND t.kind = 'expense'
      AND t.occurred_at >= (now() - interval '6 months')
    GROUP BY
      to_char(t.occurred_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
      to_char(t.occurred_at AT TIME ZONE 'America/Sao_Paulo', 'TMMon/YY')
  ) m_row;

  -- Lista das compras mais recentes
  SELECT COALESCE(jsonb_agg(p_row ORDER BY p_row.occurred_at DESC), '[]'::jsonb)
  INTO v_purchases
  FROM (
    SELECT
      t.id,
      t.occurred_at,
      t.net_cents,
      t.note,
      a.id AS account_id,
      a.name AS account_name,
      c.id AS category_id,
      c.name AS category_name
    FROM public.transactions t
    LEFT JOIN public.accounts a ON a.id = t.account_id
    LEFT JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_user_id
      AND t.expense_item_id = p_item_id
      AND t.deleted_at IS NULL
      AND t.kind = 'expense'
    ORDER BY t.occurred_at DESC
    LIMIT 30
  ) p_row;

  RETURN jsonb_build_object(
    'item', to_jsonb(v_item),
    'period_total_cents', v_total_period,
    'period_count', v_count_period,
    'period_avg_cents', (v_total_period / GREATEST(1, v_count_period))::bigint,
    'monthly_history', v_monthly,
    'recent_purchases', v_purchases
  );
END;
$$;

