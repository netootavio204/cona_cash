import { createClient } from '@supabase/supabase-js';
import type { AppSettings, Profile, UserStatus } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Cona Cash] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas. Verifique o arquivo .env.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Busca as configurações globais do aplicativo (ex: se o cadastro está aberto).
 */
export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    return {
      id: 1,
      signup_open: true,
      schema_version: '001_base',
      app_version: 'v0.1.0 beta',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as AppSettings;
}

/**
 * Busca o perfil do usuário logado na tabela public.profiles.
 */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Profile) || null;
}

/**
 * Lista todos os perfis de usuários (exclusivo para Admin via RLS).
 */
export async function fetchAllProfilesAdmin(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as Profile[]) || [];
}

/**
 * Atualiza o status de um usuário (pending | approved | blocked) — exclusivo para Admin.
 */
export async function updateUserStatusAdmin(
  userId: string,
  status: UserStatus
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Liga ou desliga o cadastro de novos usuários no banco — exclusivo para Admin.
 */
export async function updateSignupOpenAdmin(signupOpen: boolean): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({ signup_open: signupOpen })
    .eq('id', 1);

  if (error) {
    throw error;
  }
}
