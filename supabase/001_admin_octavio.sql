-- ============================================================================
-- CONA CASH — TORNAR O OCTAVIO ADMIN APROVADO
-- Cole este conteúdo no SQL Editor do Supabase após criar sua conta na tela de Cadastro
-- (Substitua o e-mail abaixo caso tenha usado outro e-mail no cadastro)
-- ============================================================================

UPDATE public.profiles
SET role = 'admin',
    status = 'approved',
    updated_at = now()
WHERE lower(email) = lower('netootavio204@gmail.com');

-- Confirma também o e-mail no Supabase Auth (caso a confirmação de e-mail esteja ativa no projeto)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE lower(email) = lower('netootavio204@gmail.com');
