-- ============================================================================
-- CONA CASH — MIGRATION 003B: FONTES DE RENDA, APORTES E TAGS RÁPIDAS (v1.1)
-- Versão: v0.3.1 beta — Idempotente e 100% aditiva (sem DROP, sem renomear)
-- ============================================================================

-- 1. Atualizar versão em app_settings
UPDATE public.app_settings
SET schema_version = '003b_income_sources',
    app_version = 'v0.3.1 beta',
    updated_at = now()
WHERE id = 1;

-- 2. Coluna de Tags Rápidas personalizadas no perfil do usuário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS quick_tags text[] NOT NULL
DEFAULT ARRAY['#Filamento', '#MercadoLivre', '#99', '#Gasolina', '#Almoço'];

-- 3. Tabela de Fontes de Renda (income_sources)
CREATE TABLE IF NOT EXISTS public.income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'tag',
  color text NOT NULL DEFAULT '#FF7A1A',
  counts_as_earning boolean NOT NULL DEFAULT true,
  default_payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  default_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_sources_user_id ON public.income_sources(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_income_sources_updated_at'
  ) THEN
    CREATE TRIGGER trg_income_sources_updated_at
      BEFORE UPDATE ON public.income_sources
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 4. Coluna income_source_id na tabela transactions (ON DELETE RESTRICT: só permite excluir fonte sem lançamentos)
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS income_source_id uuid REFERENCES public.income_sources(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_transactions_user_source
  ON public.transactions(user_id, income_source_id);

-- 5. Row Level Security (RLS) para income_sources
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'income_sources' AND policyname = 'income_sources_select_own'
  ) THEN
    CREATE POLICY "income_sources_select_own"
      ON public.income_sources FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'income_sources' AND policyname = 'income_sources_insert_own'
  ) THEN
    CREATE POLICY "income_sources_insert_own"
      ON public.income_sources FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'income_sources' AND policyname = 'income_sources_update_own'
  ) THEN
    CREATE POLICY "income_sources_update_own"
      ON public.income_sources FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'income_sources' AND policyname = 'income_sources_delete_own'
  ) THEN
    CREATE POLICY "income_sources_delete_own"
      ON public.income_sources FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END;
$$;

-- 6. Função para popular Fontes de Renda padrão de um usuário
CREATE OR REPLACE FUNCTION public.seed_user_income_sources(p_user_id uuid)
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
  v_pm_maq uuid;
  v_pm_pix uuid;
  v_pm_online uuid;
  v_pm_dinheiro uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Localiza contas existentes do usuário
  SELECT id INTO v_acc1 FROM public.accounts WHERE user_id = p_user_id AND name ILIKE '%Conta 1%' LIMIT 1;
  SELECT id INTO v_acc2 FROM public.accounts WHERE user_id = p_user_id AND name ILIKE '%Conta 2%' LIMIT 1;
  SELECT id INTO v_acc3 FROM public.accounts WHERE user_id = p_user_id AND name ILIKE '%Conta 3%' LIMIT 1;
  SELECT id INTO v_bolso FROM public.accounts WHERE user_id = p_user_id AND (name ILIKE '%Bolso%' OR type = 'cash') LIMIT 1;

  -- Se não achou por nome, pega qualquer conta como fallback
  IF v_acc1 IS NULL THEN SELECT id INTO v_acc1 FROM public.accounts WHERE user_id = p_user_id LIMIT 1; END IF;
  IF v_acc2 IS NULL THEN v_acc2 := v_acc1; END IF;
  IF v_acc3 IS NULL THEN v_acc3 := v_acc1; END IF;
  IF v_bolso IS NULL THEN v_bolso := v_acc1; END IF;

  -- Localiza formas de pagamento existentes do usuário
  SELECT id INTO v_pm_maq FROM public.payment_methods WHERE user_id = p_user_id AND name ILIKE '%Maquininha%' LIMIT 1;
  SELECT id INTO v_pm_pix FROM public.payment_methods WHERE user_id = p_user_id AND name ILIKE '%Pix%' LIMIT 1;
  SELECT id INTO v_pm_online FROM public.payment_methods WHERE user_id = p_user_id AND name ILIKE '%Online%' LIMIT 1;
  SELECT id INTO v_pm_dinheiro FROM public.payment_methods WHERE user_id = p_user_id AND name ILIKE '%Dinheiro%' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.income_sources WHERE user_id = p_user_id) THEN
    -- 1. Corridas (99)
    INSERT INTO public.income_sources (user_id, name, icon, color, counts_as_earning, default_payment_method_id, default_account_id)
    VALUES (p_user_id, 'Corridas (99)', 'car', '#FF7A1A', true, v_pm_online, v_acc3);

    -- 2. Venda 3D — Mercado Livre
    INSERT INTO public.income_sources (user_id, name, icon, color, counts_as_earning, default_payment_method_id, default_account_id)
    VALUES (p_user_id, 'Venda 3D — Mercado Livre', 'shopping-bag', '#FFC940', true, v_pm_online, v_acc1);

    -- 3. Venda 3D — Presencial
    INSERT INTO public.income_sources (user_id, name, icon, color, counts_as_earning, default_payment_method_id, default_account_id)
    VALUES (p_user_id, 'Venda 3D — Presencial', 'tag', '#38BDF8', true, v_pm_pix, v_acc3);

    -- 4. Venda 3D — Bares e mercados
    INSERT INTO public.income_sources (user_id, name, icon, color, counts_as_earning, default_payment_method_id, default_account_id)
    VALUES (p_user_id, 'Venda 3D — Bares e mercados', 'shopping-bag', '#A855F7', true, v_pm_maq, v_acc2);

    -- 5. Outros ganhos
    INSERT INTO public.income_sources (user_id, name, icon, color, counts_as_earning, default_payment_method_id, default_account_id)
    VALUES (p_user_id, 'Outros ganhos', 'receipt', '#2EE59D', true, v_pm_pix, v_acc3);

    -- 6. Aporte (não conta como ganho no relatório, mas soma no saldo)
    INSERT INTO public.income_sources (user_id, name, icon, color, counts_as_earning, default_payment_method_id, default_account_id)
    VALUES (p_user_id, 'Aporte', 'wallet', '#06B6D4', false, v_pm_dinheiro, v_bolso);
  END IF;
END;
$$;

-- 7. Atualizar seed_user_defaults para incluir também as fontes de renda
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

  -- Contas padrão
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = p_user_id) THEN
    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color)
    VALUES (p_user_id, 'Conta 1', 'bank', 0, '#FF7A1A')
    RETURNING id INTO v_acc1;

    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color)
    VALUES (p_user_id, 'Conta 2', 'bank', 0, '#38BDF8')
    RETURNING id INTO v_acc2;

    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color)
    VALUES (p_user_id, 'Conta 3', 'bank', 0, '#A855F7')
    RETURNING id INTO v_acc3;

    INSERT INTO public.accounts (user_id, name, type, initial_balance_cents, color)
    VALUES (p_user_id, 'Bolso (dinheiro)', 'cash', 0, '#2EE59D')
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

-- 8. Atualizar insert_income_batch para aceitar income_source_id opcional por item
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
  v_source_id uuid;
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
    v_source_id := NULLIF(v_item->>'income_source_id', '')::uuid;
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
      income_source_id,
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
      v_source_id,
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

-- 9. Executar seed de fontes de renda para todos os usuários que já estejam cadastrados
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_user_income_sources(r.id);
  END LOOP;
END;
$$;

