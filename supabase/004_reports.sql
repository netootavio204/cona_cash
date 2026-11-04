-- ============================================================================
-- MIGRATION 004: Relatórios e Análise por Fonte de Renda (Fase 4 - v1.1)
-- Totalmente ADITIVA (idempotente, sem DROP, sem renomear colunas)
-- ============================================================================

-- Função RPC: get_financial_report
-- Retorna os dados agregados para relatórios e dashboards por período:
-- 1. Totais consolidados (Bruto, Taxas, Líquido de Ganhos, Saídas, Aportes, Resultado)
-- 2. Quebra por Fonte de Renda (com Ganhos e Custos Diretos vinculados para Lucro Líquido Real)
-- 3. Quebra por Categoria de Saída
-- 4. Quebra por Forma de Pagamento
-- 5. Quebra por Conta Bancária/Caixa
-- 6. Evolução Diária (para gráficos de barras)
CREATE OR REPLACE FUNCTION public.get_financial_report(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_income_source_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- 1. TOTAIS CONSOLIDADOS
  SELECT jsonb_build_object(
    'gross_earnings_cents', COALESCE(SUM(CASE WHEN t.kind = 'income' AND (s.counts_as_earning IS NULL OR s.counts_as_earning = true) THEN t.gross_cents ELSE 0 END), 0),
    'fees_cents', COALESCE(SUM(CASE WHEN t.kind = 'income' AND (s.counts_as_earning IS NULL OR s.counts_as_earning = true) THEN t.fee_cents ELSE 0 END), 0),
    'net_earnings_cents', COALESCE(SUM(CASE WHEN t.kind = 'income' AND (s.counts_as_earning IS NULL OR s.counts_as_earning = true) THEN t.net_cents ELSE 0 END), 0),
    'expenses_cents', COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.net_cents ELSE 0 END), 0),
    'contributions_cents', COALESCE(SUM(CASE WHEN t.kind = 'income' AND s.counts_as_earning = false THEN t.net_cents ELSE 0 END), 0),
    'net_result_cents', (
      COALESCE(SUM(CASE WHEN t.kind = 'income' AND (s.counts_as_earning IS NULL OR s.counts_as_earning = true) THEN t.net_cents ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.net_cents ELSE 0 END), 0)
    ),
    'transaction_count', COUNT(t.id)
  )
  INTO v_totals
  FROM public.transactions t
  LEFT JOIN public.income_sources s ON s.id = t.income_source_id
  WHERE t.user_id = v_user_id
    AND t.deleted_at IS NULL
    AND t.occurred_at >= p_start_date
    AND t.occurred_at <= p_end_date
    AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id);

  -- 2. QUEBRA POR FONTE DE RENDA E LUCRO POR FONTE
  -- Ganhos líquidos da fonte menos saídas vinculadas a ela
  SELECT COALESCE(jsonb_agg(source_row), '[]'::jsonb)
  INTO v_by_source
  FROM (
    SELECT 
      COALESCE(s.id::text, 'none') as source_id,
      COALESCE(s.name, 'Sem fonte definida') as source_name,
      COALESCE(s.color, '#9A9AA6') as source_color,
      COALESCE(s.icon, 'briefcase') as source_icon,
      COALESCE(s.counts_as_earning, true) as counts_as_earning,
      COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.net_cents ELSE 0 END), 0) as earnings_net_cents,
      COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.net_cents ELSE 0 END), 0) as direct_expenses_cents,
      (
        COALESCE(SUM(CASE WHEN t.kind = 'income' AND (s.counts_as_earning IS NULL OR s.counts_as_earning = true) THEN t.net_cents ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.net_cents ELSE 0 END), 0)
      ) as profit_cents,
      COUNT(t.id) as count
    FROM public.transactions t
    LEFT JOIN public.income_sources s ON s.id = t.income_source_id
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
      AND (t.kind = 'income' OR (t.kind = 'expense' AND t.income_source_id IS NOT NULL))
    GROUP BY s.id, s.name, s.color, s.icon, s.counts_as_earning
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

  -- 4. QUEBRA POR FORMA DE PAGAMENTO (Entradas)
  SELECT COALESCE(jsonb_agg(pm_row), '[]'::jsonb)
  INTO v_by_payment_method
  FROM (
    SELECT 
      pm.id as payment_method_id,
      pm.name as payment_method_name,
      COALESCE(SUM(t.gross_cents), 0) as gross_cents,
      COALESCE(SUM(t.fee_cents), 0) as fee_cents,
      COALESCE(SUM(t.net_cents), 0) as net_cents,
      COUNT(t.id) as count
    FROM public.transactions t
    JOIN public.payment_methods pm ON pm.id = t.payment_method_id
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
      AND t.kind = 'income'
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
    GROUP BY pm.id, pm.name
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
      COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.net_cents ELSE 0 END), 0) as in_cents,
      COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.net_cents ELSE 0 END), 0) as out_cents
    FROM public.accounts a
    LEFT JOIN public.transactions t ON t.account_id = a.id 
      AND t.user_id = v_user_id 
      AND t.deleted_at IS NULL
      AND t.occurred_at >= p_start_date
      AND t.occurred_at <= p_end_date
      AND (p_income_source_id IS NULL OR t.income_source_id = p_income_source_id)
    WHERE a.user_id = v_user_id
      AND a.archived = false
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

-- Permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION public.get_financial_report(timestamptz, timestamptz, uuid) TO authenticated;

