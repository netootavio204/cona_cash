export type UserRole = 'user' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'blocked';
export type AccountType = 'bank' | 'cash';
export type TransactionKind = 'income' | 'expense' | 'transfer';
export type AuditAction = 'create' | 'update' | 'delete' | 'restore';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  sound_enabled: boolean;
  week_starts_on: 0 | 1;
  quick_tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  signup_open: boolean;
  schema_version: string;
  app_version: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance_cents: number;
  color: string;
  archived: boolean;
  is_system?: boolean;
  system_kind?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  account_color: string;
  archived: boolean;
  is_system?: boolean;
  system_kind?: string | null;
  initial_balance_cents: number;
  income_net_cents: number;
  expense_cents: number;
  transfer_in_cents: number;
  transfer_out_cents: number;
  current_balance_cents: number;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  name: string;
  default_account_id: string | null;
  fee_percent: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryIconName =
  | 'fuel'
  | 'utensils'
  | 'cog'
  | 'wrench'
  | 'droplets'
  | 'receipt'
  | 'car'
  | 'shopping-bag'
  | 'smartphone'
  | 'wallet'
  | 'heart'
  | 'home'
  | 'tag';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: CategoryIconName;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncomeSource {
  id: string;
  user_id: string;
  name: string;
  icon: CategoryIconName;
  color: string;
  counts_as_earning: boolean;
  default_payment_method_id: string | null;
  default_account_id: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  kind: TransactionKind;
  occurred_at: string;
  account_id: string;
  to_account_id: string | null;
  payment_method_id: string | null;
  category_id: string | null;
  income_source_id: string | null;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  note: string;
  batch_id: string | null;
  parent_id?: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyBatchStatus = 'pending' | 'partial' | 'distributed';

export interface DailyBatchPart {
  id: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  payment_method_id: string;
  payment_method_name: string;
  account_id: string;
  account_name: string;
  account_color: string;
  note: string | null;
  created_at: string;
}

export interface DailyBatchLine {
  id: string;
  occurred_at: string;
  gross_cents: number;
  note: string | null;
  source: {
    id: string;
    name: string;
    color: string;
    icon: string;
  } | null;
  distributed_cents: number;
  remaining_cents: number;
  status: DailyBatchStatus;
  parts: DailyBatchPart[];
}

export interface DailyBatch {
  batch_id: string;
  work_date: string;
  batch_note: string | null;
  created_at: string;
  updated_at: string;
  total_gross_cents: number;
  total_distributed_cents: number;
  total_remaining_cents: number;
  status: DailyBatchStatus;
  lines: DailyBatchLine[];
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  at: string;
}

export const PALETA_CORES = [
  { nome: 'Laranja Cona', valor: '#FF7A1A' },
  { nome: 'Azul Neon', valor: '#38BDF8' },
  { nome: 'Roxo Digital', valor: '#A855F7' },
  { nome: 'Verde Meta', valor: '#2EE59D' },
  { nome: 'Amarelo Ouro', valor: '#FFC940' },
  { nome: 'Vermelho Vivo', valor: '#FF3B30' },
  { nome: 'Rosa Choque', valor: '#F43F5E' },
  { nome: 'Ciano', valor: '#06B6D4' },
];

export const DEFAULT_QUICK_TAGS = [
  '#Filamento',
  '#MercadoLivre',
  '#99',
  '#Gasolina',
  '#Almoço',
];

export const SUGESTOES_CATEGORIAS_3D: {
  name: string;
  icon: CategoryIconName;
  color: string;
}[] = [
  { name: 'Filamento', icon: 'cog', color: '#FF7A1A' },
  { name: 'Manutenção da impressora', icon: 'wrench', color: '#A855F7' },
  { name: 'Embalagem', icon: 'shopping-bag', color: '#38BDF8' },
  { name: 'Frete', icon: 'car', color: '#2EE59D' },
  { name: 'Taxas de marketplace', icon: 'receipt', color: '#FFC940' },
];

export interface FinancialReportTotals {
  gross_earnings_cents: number;
  fees_cents: number;
  net_earnings_cents: number;
  expenses_cents: number;
  contributions_cents: number;
  net_result_cents: number;
  transaction_count: number;
}

export interface FinancialReportSourceItem {
  source_id: string;
  source_name: string;
  source_color: string;
  source_icon: CategoryIconName | string;
  counts_as_earning: boolean;
  earnings_net_cents: number;
  direct_expenses_cents: number;
  profit_cents: number;
  count: number;
}

export interface FinancialReportCategoryItem {
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: CategoryIconName;
  total_cents: number;
  count: number;
}

export interface FinancialReportPaymentMethodItem {
  payment_method_id: string;
  payment_method_name: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  count: number;
}

export interface FinancialReportAccountItem {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  account_color: string;
  in_cents: number;
  out_cents: number;
}

export interface FinancialReportDailyItem {
  day: string; // YYYY-MM-DD
  earnings_net_cents: number;
  expenses_cents: number;
  contributions_cents: number;
}

export interface FinancialReportData {
  totals: FinancialReportTotals;
  by_source: FinancialReportSourceItem[];
  by_category: FinancialReportCategoryItem[];
  by_payment_method: FinancialReportPaymentMethodItem[];
  by_account: FinancialReportAccountItem[];
  daily: FinancialReportDailyItem[];
}

export const TAGS_RAPIDAS_ENTRADA = DEFAULT_QUICK_TAGS;
export const TAGS_RAPIDAS_SAIDA = DEFAULT_QUICK_TAGS;


// ==============================================================================
// METAS E CONQUISTAS (Fase 5)
// ==============================================================================
export type GoalKind = 'earning' | 'expense_limit' | 'saving';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  kind: GoalKind;
  period: GoalPeriod;
  target_cents: number;
  income_source_id?: string | null;
  active: boolean;
  celebrated_periods: string[];
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalAchievement {
  id: string;
  user_id: string;
  goal_id: string;
  period_key: string;
  medal_tier: 'bronze' | 'silver' | 'gold';
  achieved_cents: number;
  target_cents: number;
  achieved_at: string;
}

export interface GoalProgress {
  goal: Goal;
  current_cents: number;
  target_cents: number;
  percentage: number;
  remaining_cents: number;
  is_achieved: boolean;
  is_over_limit: boolean;
  period_key: string;
  status: 'ok' | 'warning' | 'danger' | 'achieved';
}
