-- ============================================================================
-- CONA CASH — SCHEMA COMPLETO E CONSOLIDADO (v1.0.0 beta)
-- Execute este script no SQL Editor do Supabase para criar ou atualizar todo o banco.
-- Todas as tabelas, índices, triggers, RLS e funções RPC incluídas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTE: 001_base.sql
-- ----------------------------------------------------------------------------
-- ============================================================================
-- CONA CASH — MIGRATION 001: FUNDAÇÃO, LOGIN, PERFIS E CONTROLE DE CADASTRO
-- Versão: v0.1.0 beta
-- Cole este conteúdo no SQL Editor do Supabase e clique em "Run".
-- ============================================================================

-- 1. Extensões úteis
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Função utilitária de atualização automática do campo updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. Tabela de configurações globais do app (apenas 1 linha: id = 1)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signup_open boolean NOT NULL DEFAULT true,
  schema_version text NOT NULL DEFAULT '001_base',
  app_version text NOT NULL DEFAULT 'v0.1.0 beta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (id, signup_open, schema_version, app_version)
VALUES (1, true, '001_base', 'v0.1.0 beta')
ON CONFLICT (id) DO UPDATE
SET schema_version = '001_base',
    app_version = 'v0.1.0 beta',
    updated_at = now();

-- 4. Tabela de perfis de usuários (vinculada a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  sound_enabled boolean NOT NULL DEFAULT true,
  week_starts_on smallint NOT NULL DEFAULT 1 CHECK (week_starts_on IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles( lower(email) );

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Funções auxiliares de segurança (SECURITY DEFINER para evitar recursão em RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'approved'
  );
$$;

-- 6. Proteção de colunas sensíveis em profiles (usuário comum não altera role nem status)
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a chamada vem de usuário autenticado comum (não admin e não SQL Editor / service_role)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o perfil de acesso.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o status de aprovação.';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Acesso negado: o e-mail não pode ser alterado diretamente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- 7. Trigger em auth.users: bloqueia novo cadastro quando signup_open = false
CREATE OR REPLACE FUNCTION public.check_signup_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open boolean;
BEGIN
  SELECT signup_open INTO v_open
  FROM public.app_settings
  WHERE id = 1;

  IF COALESCE(v_open, true) = false THEN
    RAISE EXCEPTION 'CADASTRO_FECHADO: O cadastro de novos usuários está fechado pelo administrador.';
  END IF;

  -- Auto-confirma o e-mail para que o controle de entrada seja feito pela tela de aprovação do Admin
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_check_signup ON auth.users;
CREATE TRIGGER trg_auth_users_check_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_signup_allowed();

-- 8. Trigger em auth.users: cria automaticamente o profile com status = 'pending'
-- (Exceção: o primeiro usuário cadastrado no sistema já nasce como admin aprovado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_is_initial_admin boolean;
BEGIN
  v_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'usuario'), '@', 1)
  );

  -- O primeiro usuário registrado no sistema torna-se o administrador principal
  v_is_initial_admin := NOT EXISTS (SELECT 1 FROM public.profiles);

  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    v_name,
    COALESCE(NEW.email, ''),
    CASE WHEN v_is_initial_admin THEN 'admin' ELSE 'user' END,
    CASE WHEN v_is_initial_admin THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO UPDATE
  SET role = CASE WHEN v_is_initial_admin THEN 'admin' ELSE public.profiles.role END,
      status = CASE WHEN v_is_initial_admin THEN 'approved' ELSE public.profiles.status END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_handle_new_user ON auth.users;
CREATE TRIGGER trg_auth_users_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 9. Ativação de Row Level Security (RLS) e Políticas
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de app_settings:
-- Qualquer pessoa (inclusive antes do login) pode consultar se o cadastro está aberto
DROP POLICY IF EXISTS "app_settings_select_all" ON public.app_settings;
CREATE POLICY "app_settings_select_all"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Apenas admin aprovado pode alterar configurações globais (ex: abrir/fechar cadastro)
DROP POLICY IF EXISTS "app_settings_update_admin" ON public.app_settings;
CREATE POLICY "app_settings_update_admin"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas de profiles:
-- Usuário lê apenas o próprio perfil; admin aprovado lê a lista de perfis para gerenciar aprovação
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Usuário atualiza apenas o próprio perfil (campos protegidos pelo trigger); admin aprovado gerencia perfis
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- 10. Função auxiliar restrita EXCLUSIVAMENTE à service_role para automação de migrations e testes da IDE
CREATE OR REPLACE FUNCTION public.exec_admin_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Acesso negado: função restrita ao service_role.';
  END IF;
  EXECUTE sql_query;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_admin_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_admin_sql(text) TO service_role;



-- ----------------------------------------------------------------------------
-- PARTE: 002_config.sql
-- ----------------------------------------------------------------------------
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



-- ----------------------------------------------------------------------------
-- PARTE: 003_transactions.sql
-- ----------------------------------------------------------------------------
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



-- ----------------------------------------------------------------------------
-- PARTE: 003b_income_sources.sql
-- ----------------------------------------------------------------------------
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



-- ----------------------------------------------------------------------------
-- PARTE: 004_reports.sql
-- ----------------------------------------------------------------------------
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



-- ----------------------------------------------------------------------------
-- PARTE: 005_goals.sql
-- ----------------------------------------------------------------------------
-- ==============================================================================
-- CONA CASH — MIGRATION 005_GOALS.SQL (Fase 5 — Metas, Conquistas e Sons)
-- Totalmente aditiva e idempotente (IF NOT EXISTS)
-- ==============================================================================

-- 1. Tabela de Metas
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('earning', 'expense_limit', 'saving')),
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  target_cents bigint not null check (target_cents > 0),
  income_source_id uuid references public.income_sources(id) on delete set null,
  active boolean not null default true,
  celebrated_periods jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de consulta rápida
create index if not exists idx_goals_user on public.goals(user_id, active, archived);
create index if not exists idx_goals_source on public.goals(income_source_id);

-- 2. Tabela de Histórico de Metas Conquistadas / Medalhas
create table if not exists public.goal_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  period_key text not null,
  medal_tier text not null check (medal_tier in ('bronze', 'silver', 'gold')),
  achieved_cents bigint not null,
  target_cents bigint not null,
  achieved_at timestamptz not null default now(),
  constraint uq_goal_achievement unique (user_id, goal_id, period_key)
);

create index if not exists idx_goal_achievements_user on public.goal_achievements(user_id, achieved_at desc);

-- 3. Habilitação de RLS
alter table public.goals enable row level security;
alter table public.goal_achievements enable row level security;

-- Policies para goals
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'goals' and policyname = 'goals_isolation_all'
  ) then
    create policy goals_isolation_all on public.goals
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Policies para goal_achievements
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'goal_achievements' and policyname = 'goal_achievements_isolation_all'
  ) then
    create policy goal_achievements_isolation_all on public.goal_achievements
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 4. Função para registrar celebração de meta batida (dispara 1x por período)
create or replace function public.record_goal_celebration(
  p_goal_id uuid,
  p_period_key text,
  p_achieved_cents bigint,
  p_target_cents bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_already boolean;
  v_tier text;
  v_ratio numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Verifica se este período já foi celebrado
  select (celebrated_periods ? p_period_key) into v_already
  from public.goals
  where id = p_goal_id and user_id = v_user_id;

  if v_already is true then
    return false;
  end if;

  -- Determina a medalha
  if p_target_cents > 0 then
    v_ratio := (p_achieved_cents::numeric / p_target_cents::numeric);
  else
    v_ratio := 1.0;
  end if;

  if v_ratio >= 1.5 then
    v_tier := 'gold';
  elsif v_ratio >= 1.2 then
    v_tier := 'silver';
  else
    v_tier := 'bronze';
  end if;

  -- Atualiza o array jsonb na meta
  update public.goals
  set
    celebrated_periods = celebrated_periods || to_jsonb(p_period_key),
    updated_at = now()
  where id = p_goal_id and user_id = v_user_id;

  -- Insere no histórico de medalhas (ignora conflito se já existir)
  insert into public.goal_achievements (
    user_id,
    goal_id,
    period_key,
    medal_tier,
    achieved_cents,
    target_cents,
    achieved_at
  )
  values (
    v_user_id,
    p_goal_id,
    p_period_key,
    v_tier,
    p_achieved_cents,
    p_target_cents,
    now()
  )
  on conflict (user_id, goal_id, period_key) do nothing;

  return true;
end;
$$;

-- 5. Seed inicial de metas gerais caso o usuário não tenha nenhuma
create or replace function public.ensure_my_goals()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  select count(*) into v_count
  from public.goals
  where user_id = v_user_id and archived = false;

  if v_count = 0 then
    insert into public.goals (user_id, title, kind, period, target_cents, income_source_id)
    values
      (v_user_id, 'Meta de Ganho Diário', 'earning', 'daily', 15000, null),
      (v_user_id, 'Limite de Gastos Semanal', 'expense_limit', 'weekly', 35000, null),
      (v_user_id, 'Economia Mensal', 'saving', 'monthly', 100000, null);
  end if;
end;
$$;

-- Permissões
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.goal_achievements to authenticated;
grant execute on function public.record_goal_celebration(uuid, text, bigint, bigint) to authenticated;
grant execute on function public.ensure_my_goals() to authenticated;



