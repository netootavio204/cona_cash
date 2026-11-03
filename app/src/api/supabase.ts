import { createClient } from '@supabase/supabase-js';
import type {
  Account,
  AccountType,
  AppSettings,
  Category,
  CategoryIconName,
  PaymentMethod,
  Profile,
  UserStatus,
} from '../types/database';

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
      schema_version: '002_config',
      app_version: 'v0.2.0 beta',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as AppSettings;
}

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

export async function updateMyPreferences(
  userId: string,
  updates: { name?: string; sound_enabled?: boolean; week_starts_on?: 0 | 1 }
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Profile;
}

/**
 * Garante que o usuário aprovado já tenha as Contas, Formas de Pagamento e Categorias padrão criadas.
 */
export async function ensureMyDefaults(): Promise<void> {
  await supabase.rpc('ensure_my_defaults');
}

// ============================================================================
// CONTAS (accounts)
// ============================================================================

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('archived', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    initial_balance_cents: Number(a.initial_balance_cents ?? 0),
  })) as Account[];
}

export async function createAccount(payload: {
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance_cents: number;
  color: string;
}): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      type: payload.type,
      initial_balance_cents: Math.round(payload.initial_balance_cents),
      color: payload.color,
    })
    .select('*')
    .single();

  if (error) throw error;
  return {
    ...(data as any),
    initial_balance_cents: Number(data.initial_balance_cents ?? 0),
  } as Account;
}

export async function updateAccount(
  id: string,
  updates: Partial<{
    name: string;
    type: AccountType;
    initial_balance_cents: number;
    color: string;
    archived: boolean;
  }>
): Promise<Account> {
  const cleanUpdates: Record<string, any> = { ...updates };
  if (typeof cleanUpdates.name === 'string') {
    cleanUpdates.name = cleanUpdates.name.trim();
  }
  if (typeof cleanUpdates.initial_balance_cents === 'number') {
    cleanUpdates.initial_balance_cents = Math.round(cleanUpdates.initial_balance_cents);
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(cleanUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return {
    ...(data as any),
    initial_balance_cents: Number(data.initial_balance_cents ?? 0),
  } as Account;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// FORMAS DE PAGAMENTO (payment_methods)
// ============================================================================

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('archived', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((pm: any) => ({
    ...pm,
    fee_percent: Number(pm.fee_percent ?? 0),
  })) as PaymentMethod[];
}

export async function createPaymentMethod(payload: {
  user_id: string;
  name: string;
  default_account_id: string | null;
  fee_percent: number;
}): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      default_account_id: payload.default_account_id || null,
      fee_percent: Math.round(payload.fee_percent * 100) / 100,
    })
    .select('*')
    .single();

  if (error) throw error;
  return {
    ...(data as any),
    fee_percent: Number(data.fee_percent ?? 0),
  } as PaymentMethod;
}

export async function updatePaymentMethod(
  id: string,
  updates: Partial<{
    name: string;
    default_account_id: string | null;
    fee_percent: number;
    archived: boolean;
  }>
): Promise<PaymentMethod> {
  const cleanUpdates: Record<string, any> = { ...updates };
  if (typeof cleanUpdates.name === 'string') {
    cleanUpdates.name = cleanUpdates.name.trim();
  }
  if (typeof cleanUpdates.fee_percent === 'number') {
    cleanUpdates.fee_percent = Math.round(cleanUpdates.fee_percent * 100) / 100;
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .update(cleanUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return {
    ...(data as any),
    fee_percent: Number(data.fee_percent ?? 0),
  } as PaymentMethod;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const { error } = await supabase.from('payment_methods').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// CATEGORIAS DE SAÍDA (categories)
// ============================================================================

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('archived', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Category[];
}

export async function createCategory(payload: {
  user_id: string;
  name: string;
  icon: CategoryIconName;
  color: string;
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      icon: payload.icon,
      color: payload.color,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  updates: Partial<{
    name: string;
    icon: CategoryIconName;
    color: string;
    archived: boolean;
  }>
): Promise<Category> {
  const cleanUpdates: Record<string, any> = { ...updates };
  if (typeof cleanUpdates.name === 'string') {
    cleanUpdates.name = cleanUpdates.name.trim();
  }

  const { data, error } = await supabase
    .from('categories')
    .update(cleanUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// ADMINISTRAÇÃO DE USUÁRIOS E CADASTRO (exclusivo Admin)
// ============================================================================

export async function fetchAllProfilesAdmin(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as Profile[]) || [];
}

export async function updateUserStatusAdmin(
  userId: string,
  status: UserStatus
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId);

  if (error) throw error;
}

export async function updateSignupOpenAdmin(signupOpen: boolean): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({ signup_open: signupOpen })
    .eq('id', 1);

  if (error) throw error;
}
