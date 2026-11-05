import type {
  Account,
  Category,
  IncomeSource,
  PaymentMethod,
  Transaction,
  Goal,
} from '../types/database';
import { formatDateTimeBR } from './format';

export interface UserBackupData {
  exported_at: string;
  app_version: string;
  user_email: string;
  accounts: Account[];
  payment_methods: PaymentMethod[];
  categories: Category[];
  income_sources: IncomeSource[];
  goals: Goal[];
  transactions: Transaction[];
}

export function downloadJSON(filename: string, data: object): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csvContent =
    '\uFEFF' + // BOM UTF-8 para Excel abrir perfeitamente com acentos em pt-BR
    [
      headers.join(';'),
      ...rows.map((row) =>
        row
          .map((val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(';')
      ),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
