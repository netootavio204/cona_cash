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
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  account_color: string;
  archived: boolean;
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

export interface Transaction {
  id: string;
  user_id: string;
  kind: TransactionKind;
  occurred_at: string;
  account_id: string;
  to_account_id: string | null;
  payment_method_id: string | null;
  category_id: string | null;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  note: string;
  batch_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
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

export const TAGS_RAPIDAS_ENTRADA = [
  '#Uber',
  '#99',
  '#Particular',
  '#Gorjeta',
  '#PixDireto',
];

export const TAGS_RAPIDAS_SAIDA = [
  '#Gasolina',
  '#Etanol',
  '#GNV',
  '#Almoço',
  '#Manutenção',
  '#Lavagem',
];
