-- ============================================================================
-- CONA CASH — MIGRATION 002: CONTAS, FORMAS DE PAGAMENTO, CATEGORIAS E PADRÕES
-- Versão: v0.2.0 beta
-- ============================================================================

-- 1. Atualizar versão do schema em app_settings
UPDATE public.app_settings
SET schema_version = '002_config',
    app_version = 'v0.2.0 beta',
    updated_at = now()
WHERE id = 1;

-- 2. Tabela de Contas (accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'bank' CHECK (type IN ('bank', 'cash')),
  initial_balance_cents bigint NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#FF7A1A',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Tabela de Formas de Pagamento (payment_methods)
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  fee_percent numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (fee_percent >= 0 AND fee_percent <= 100),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);

DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Tabela de Categorias de Saída (categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'tag',
  color text NOT NULL DEFAULT '#FF7A1A',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Ativar Row Level Security (RLS) nas 3 tabelas
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Políticas de accounts (usuário acessa exclusivamente as próprias contas)
DROP POLICY IF EXISTS "accounts_select_own" ON public.accounts;
CREATE POLICY "accounts_select_own"
  ON public.accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "accounts_insert_own" ON public.accounts;
CREATE POLICY "accounts_insert_own"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "accounts_update_own" ON public.accounts;
CREATE POLICY "accounts_update_own"
  ON public.accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "accounts_delete_own" ON public.accounts;
CREATE POLICY "accounts_delete_own"
  ON public.accounts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Políticas de payment_methods (usuário acessa exclusivamente as próprias formas)
DROP POLICY IF EXISTS "payment_methods_select_own" ON public.payment_methods;
CREATE POLICY "payment_methods_select_own"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "payment_methods_insert_own" ON public.payment_methods;
CREATE POLICY "payment_methods_insert_own"
  ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "payment_methods_update_own" ON public.payment_methods;
CREATE POLICY "payment_methods_update_own"
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "payment_methods_delete_own" ON public.payment_methods;
CREATE POLICY "payment_methods_delete_own"
  ON public.payment_methods FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Políticas de categories (usuário acessa exclusivamente as próprias categorias)
DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
CREATE POLICY "categories_select_own"
  ON public.categories FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
CREATE POLICY "categories_insert_own"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
CREATE POLICY "categories_update_own"
  ON public.categories FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;
CREATE POLICY "categories_delete_own"
  ON public.categories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6. Função para popular automaticamente Contas, Formas e Categorias padrão do usuário
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

  -- Se o usuário ainda não tem contas, cria as 4 padrão e vincula as 4 formas de pagamento
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

  -- Se o usuário ainda não tem categorias, cria as 6 padrão
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
END;
$$;

-- 7. Trigger em public.profiles: ao aprovar ou criar perfil aprovado, popula os padrões
CREATE OR REPLACE FUNCTION public.trg_fn_seed_on_profile_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    PERFORM public.seed_user_defaults(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_seed_defaults ON public.profiles;
CREATE TRIGGER trg_profiles_seed_defaults
  AFTER INSERT OR UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_seed_on_profile_approved();

-- 8. RPC para garantir que o usuário logado aprovado tenha os padrões criados
CREATE OR REPLACE FUNCTION public.ensure_my_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_approved() THEN
    PERFORM public.seed_user_defaults(auth.uid());
  END IF;
END;
$$;

-- 9. Popular padrões para todos os usuários que já estejam aprovados no banco
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE status = 'approved' LOOP
    PERFORM public.seed_user_defaults(r.id);
  END LOOP;
END;
$$;
