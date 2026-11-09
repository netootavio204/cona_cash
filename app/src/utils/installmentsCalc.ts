/**
 * Módulo de cálculo matemático de parcelamento, datas e status (Fase 9 — PRD 4.3B)
 * Funções puras e determinísticas com suporte a injeção da data "hoje"
 */

import type { InstallmentWithPurchase, InstallmentComputedStatus } from '../types/database';

export interface CalculatedInstallmentItem {
  number: number;
  dueDate: string; // YYYY-MM-DD
  amountCents: number;
}

/**
 * Calcula a data de vencimento da parcela N preservando o dia original
 * e ajustando para o último dia do mês quando necessário (ex: 31/01 -> 28/02 -> 31/03)
 */
export function calculateNextMonthlyDueDate(firstDueDateStr: string, installmentNumber: number): string {
  if (installmentNumber <= 1) return firstDueDateStr;

  const [yearStr, monthStr, dayStr] = firstDueDateStr.split('-');
  const baseYear = parseInt(yearStr, 10);
  const baseMonth = parseInt(monthStr, 10); // 1-12
  const originalDay = parseInt(dayStr, 10);

  // Calcula o mês alvo
  const totalMonths = baseMonth - 1 + (installmentNumber - 1);
  const targetYear = baseYear + Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  // Número de dias no targetMonth do targetYear
  // Ano bissexto: fevereiro tem 29 dias se (ano % 4 == 0 && ano % 100 != 0) || (ano % 400 == 0)
  const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
  const daysInMonth = [
    31,
    isLeap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][targetMonth - 1];

  const actualDay = Math.min(originalDay, daysInMonth);

  const mm = String(targetMonth).padStart(2, '0');
  const dd = String(actualDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Divide o valor total pelo número de parcelas, colocando a sobra de centavos
 * na PRIMEIRA parcela (garantindo que soma(parcelas) === total).
 */
export function divideInstallments(
  totalCents: number,
  installmentsCount: number,
  firstDueDateStr: string
): CalculatedInstallmentItem[] {
  if (installmentsCount < 1) return [];

  const baseAmount = Math.floor(totalCents / installmentsCount);
  const remainder = totalCents % installmentsCount;

  const result: CalculatedInstallmentItem[] = [];

  for (let i = 1; i <= installmentsCount; i++) {
    const amount = baseAmount + (i === 1 ? remainder : 0);
    const dueDate = calculateNextMonthlyDueDate(firstDueDateStr, i);
    result.push({
      number: i,
      dueDate,
      amountCents: amount,
    });
  }

  return result;
}

/**
 * Determina o status calculado de uma parcela (paid, overdue, due_today, pending)
 */
export function getInstallmentStatus(
  installment: { status: string; due_date: string },
  todayStr: string
): InstallmentComputedStatus {
  if (installment.status === 'paid') return 'paid';
  if (installment.due_date < todayStr) return 'overdue';
  if (installment.due_date === todayStr) return 'due_today';
  return 'pending';
}

/**
 * Gera o resumo consolidado de parcelas e alertas
 */
export function getDueSummary(
  installments: InstallmentWithPurchase[],
  todayStr: string
) {
  let overdueCents = 0;
  let overdueCount = 0;
  let dueTodayCents = 0;
  let dueTodayCount = 0;
  let next7DaysCents = 0;
  let next7DaysCount = 0;

  // Limite de 7 dias à frente
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayDate = new Date(y, m - 1, d);
  const next7Date = new Date(y, m - 1, d + 7);
  const next7Str = `${next7Date.getFullYear()}-${String(next7Date.getMonth() + 1).padStart(2, '0')}-${String(next7Date.getDate()).padStart(2, '0')}`;

  const currentMonthKey = todayStr.slice(0, 7); // YYYY-MM
  let monthTotalCents = 0;

  for (const inst of installments) {
    if (inst.status === 'paid') continue;

    const st = getInstallmentStatus(inst, todayStr);
    if (st === 'overdue') {
      overdueCents += inst.amount_cents;
      overdueCount++;
    } else if (st === 'due_today') {
      dueTodayCents += inst.amount_cents;
      dueTodayCount++;
    }

    if (inst.due_date >= todayStr && inst.due_date <= next7Str) {
      next7DaysCents += inst.amount_cents;
      next7DaysCount++;
    }

    if (inst.due_date.slice(0, 7) === currentMonthKey) {
      monthTotalCents += inst.amount_cents;
    }
  }

  return {
    overdueCents,
    overdueCount,
    dueTodayCents,
    dueTodayCount,
    next7DaysCents,
    next7DaysCount,
    monthTotalCents,
  };
}

