import { createClient } from '@supabase/supabase-js';
import {
  SUGESTOES_CATEGORIAS_3D,
  type Account,
  type AccountBalance,
  type AccountType,
  type AppSettings,
  type AuditLogEntry,
  type Category,
  type CategoryIconName,
  type IncomeSource,
  type PaymentMethod,
  type Profile,
  type Transaction,
  type TransactionKind,
  type UserStatus,
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

export function normalizarSenhaSupabase(raw: string): string {
  if (raw.length > 0 && raw.length < 6) {
    return `${raw}_cona6`;
  }
  return raw;
}

export async function updateMyPassword(novaSenhaBruta: string): Promise<void> {
  const password = normalizarSenhaSupabase(novaSenhaBruta);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

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
      schema_version: '003b_income_sources',
      app_version: 'v0.3.2 beta',
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

  if (error) throw error;
  return (data as Profile) || null;
}

export async function updateMyPreferences(
  userId: string,
  updates: {
    name?: string;
    sound_enabled?: boolean;
    week_starts_on?: 0 | 1;
    quick_tags?: string[];
  }
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

export async function ensureMyDefaults(): Promise<void> {
  await supabase.rpc('ensure_my_defaults');
}

// ============================================================================
// CONTAS E SALDOS POR CONTA (accounts & get_account_balances)
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

export async function fetchAccountBalances(): Promise<AccountBalance[]> {
  const { data, error } = await supabase.rpc('get_account_balances');
  if (error) throw error;
  return (data || []).map((row: any) => ({
    account_id: row.account_id,
    account_name: row.account_name,
    account_type: row.account_type as AccountType,
    account_color: row.account_color,
    archived: Boolean(row.archived),
    initial_balance_cents: Number(row.initial_balance_cents ?? 0),
    income_net_cents: Number(row.income_net_cents ?? 0),
    expense_cents: Number(row.expense_cents ?? 0),
    transfer_in_cents: Number(row.transfer_in_cents ?? 0),
    transfer_out_cents: Number(row.transfer_out_cents ?? 0),
    current_balance_cents: Number(row.current_balance_cents ?? 0),
  }));
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

export async function addSuggested3DCategories(
  userId: string,
  existingCategories: Category[]
): Promise<number> {
  const nomesExistentes = new Set(
    existingCategories.map((c) => c.name.trim().toLowerCase())
  );
  const paraInserir = SUGESTOES_CATEGORIAS_3D.filter(
    (sug) => !nomesExistentes.has(sug.name.trim().toLowerCase())
  ).map((sug) => ({
    user_id: userId,
    name: sug.name,
    icon: sug.icon,
    color: sug.color,
  }));

  if (paraInserir.length === 0) {
    return 0;
  }

  const { error } = await supabase.from('categories').insert(paraInserir);
  if (error) throw error;
  return paraInserir.length;
}

// ============================================================================
// FONTES DE RENDA E APORTES (income_sources — Fase 3B)
// ============================================================================

export async function fetchIncomeSources(): Promise<IncomeSource[]> {
  const { data, error } = await supabase
    .from('income_sources')
    .select('*')
    .order('archived', { ascending: true })
    .order('counts_as_earning', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    counts_as_earning: Boolean(row.counts_as_earning ?? true),
    archived: Boolean(row.archived ?? false),
  })) as IncomeSource[];
}

export async function createIncomeSource(payload: {
  user_id: string;
  name: string;
  icon: CategoryIconName;
  color: string;
  counts_as_earning: boolean;
  default_payment_method_id: string | null;
  default_account_id: string | null;
}): Promise<IncomeSource> {
  const { data, error } = await supabase
    .from('income_sources')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      icon: payload.icon,
      color: payload.color,
      counts_as_earning: payload.counts_as_earning,
      default_payment_method_id: payload.default_payment_method_id || null,
      default_account_id: payload.default_account_id || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as IncomeSource;
}

export async function updateIncomeSource(
  id: string,
  updates: Partial<{
    name: string;
    icon: CategoryIconName;
    color: string;
    counts_as_earning: boolean;
    default_payment_method_id: string | null;
    default_account_id: string | null;
    archived: boolean;
  }>
): Promise<IncomeSource> {
  const cleanUpdates: Record<string, any> = { ...updates };
  if (typeof cleanUpdates.name === 'string') {
    cleanUpdates.name = cleanUpdates.name.trim();
  }

  const { data, error } = await supabase
    .from('income_sources')
    .update(cleanUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as IncomeSource;
}

export async function deleteIncomeSource(id: string): Promise<void> {
  const { error } = await supabase.from('income_sources').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// LANÇAMENTOS, LOTE DO DIA, LIXEIRA E AUDITORIA (Fase 3 + Fase 3B)
// ============================================================================

function normalizeTransaction(row: any): Transaction {
  return {
    ...row,
    income_source_id: row.income_source_id ?? null,
    gross_cents: Number(row.gross_cents ?? 0),
    fee_cents: Number(row.fee_cents ?? 0),
    net_cents: Number(row.net_cents ?? 0),
  };
}

export interface FetchTransactionsFilter {
  page?: number;
  pageSize?: number;
  kind?: TransactionKind | 'all';
  accountId?: string;
  categoryId?: string;
  incomeSourceId?: string; // '__none__' filtra "Sem fonte" (income_source_id IS NULL)
  startDateISO?: string;
  endDateISO?: string;
  search?: string;
  onlyTrash?: boolean;
}

export async function fetchTransactions(
  filter: FetchTransactionsFilter = {}
): Promise<{ data: Transaction[]; count: number }> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = filter.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' });

  if (filter.onlyTrash) {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  if (filter.kind && filter.kind !== 'all') {
    query = query.eq('kind', filter.kind);
  }

  if (filter.accountId) {
    query = query.or(
      `account_id.eq.${filter.accountId},to_account_id.eq.${filter.accountId}`
    );
  }

  if (filter.categoryId) {
    query = query.eq('category_id', filter.categoryId);
  }

  if (filter.incomeSourceId === '__none__') {
    query = query.is('income_source_id', null);
  } else if (filter.incomeSourceId) {
    query = query.eq('income_source_id', filter.incomeSourceId);
  }

  if (filter.startDateISO) {
    query = query.gte('occurred_at', filter.startDateISO);
  }

  if (filter.endDateISO) {
    query = query.lte('occurred_at', filter.endDateISO);
  }

  if (filter.search && filter.search.trim()) {
    query = query.ilike('note', `%${filter.search.trim()}%`);
  }

  const { data, error, count } = await query
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    data: (data || []).map(normalizeTransaction),
    count: count ?? 0,
  };
}

export async function createTransaction(payload: {
  user_id: string;
  kind: TransactionKind;
  occurred_at: string;
  account_id: string;
  to_account_id?: string | null;
  payment_method_id?: string | null;
  category_id?: string | null;
  income_source_id?: string | null;
  gross_cents: number;
  fee_cents?: number;
  net_cents: number;
  note?: string;
}): Promise<Transaction> {
  const gross = Math.round(payload.gross_cents);
  const fee = payload.kind === 'income' ? Math.round(payload.fee_cents ?? 0) : 0;
  const net = payload.kind === 'income' ? gross - fee : gross;

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: payload.user_id,
      kind: payload.kind,
      occurred_at: payload.occurred_at,
      account_id: payload.account_id,
      to_account_id: payload.kind === 'transfer' ? payload.to_account_id : null,
      payment_method_id:
        payload.kind === 'income' ? payload.payment_method_id || null : null,
      category_id:
        payload.kind === 'expense' ? payload.category_id || null : null,
      income_source_id:
        payload.kind !== 'transfer' ? payload.income_source_id || null : null,
      gross_cents: gross,
      fee_cents: fee,
      net_cents: net,
      note: (payload.note || '').trim(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeTransaction(data);
}

export async function createIncomeBatch(payload: {
  occurred_at: string;
  note: string;
  items: {
    gross_cents: number;
    fee_cents: number;
    net_cents: number;
    account_id: string;
    payment_method_id: string | null;
    income_source_id?: string | null;
    note?: string;
  }[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('insert_income_batch', {
    p_occurred_at: payload.occurred_at,
    p_note: payload.note.trim(),
    p_items: payload.items,
  });

  if (error) throw error;
  return data as string;
}

export async function updateTransaction(
  id: string,
  payload: {
    kind: TransactionKind;
    occurred_at: string;
    account_id: string;
    to_account_id?: string | null;
    payment_method_id?: string | null;
    category_id?: string | null;
    income_source_id?: string | null;
    gross_cents: number;
    fee_cents?: number;
    note?: string;
  }
): Promise<Transaction> {
  const gross = Math.round(payload.gross_cents);
  const fee = payload.kind === 'income' ? Math.round(payload.fee_cents ?? 0) : 0;
  const net = payload.kind === 'income' ? gross - fee : gross;

  const { data, error } = await supabase
    .from('transactions')
    .update({
      kind: payload.kind,
      occurred_at: payload.occurred_at,
      account_id: payload.account_id,
      to_account_id: payload.kind === 'transfer' ? payload.to_account_id : null,
      payment_method_id:
        payload.kind === 'income' ? payload.payment_method_id || null : null,
      category_id:
        payload.kind === 'expense' ? payload.category_id || null : null,
      income_source_id:
        payload.kind !== 'transfer' ? payload.income_source_id || null : null,
      gross_cents: gross,
      fee_cents: fee,
      net_cents: net,
      note: (payload.note || '').trim(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeTransaction(data);
}

export async function bulkAssignIncomeSource(
  transactionIds: string[],
  incomeSourceId: string
): Promise<number> {
  if (transactionIds.length === 0) return 0;
  const { error } = await supabase
    .from('transactions')
    .update({ income_source_id: incomeSourceId })
    .in('id', transactionIds);

  if (error) throw error;
  return transactionIds.length;
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function restoreTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchTransactionAuditLog(
  recordId: string
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('table_name', 'transactions')
    .eq('record_id', recordId)
    .order('at', { ascending: false });

  if (error) throw error;
  return (data || []) as AuditLogEntry[];
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
