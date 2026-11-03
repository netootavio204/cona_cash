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
-- (Exceção: o e-mail oficial do admin inicial netootavio204@gmail.com já nasce como admin aprovado)
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

  v_is_initial_admin := (lower(COALESCE(NEW.email, '')) = 'netootavio204@gmail.com');

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

