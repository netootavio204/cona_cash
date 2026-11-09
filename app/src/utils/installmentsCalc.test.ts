import { describe, it, expect } from 'vitest';
import {
  divideInstallments,
  calculateNextMonthlyDueDate,
  getInstallmentStatus,
  getDueSummary,
} from './installmentsCalc';

describe('Fase 9: Cálculo de Parcelamento, Vencimentos e Alertas (PRD 4.3B e Enunciado)', () => {
  it('divide R$ 1.000,00 em 3x a partir de 31/01/2027 com resto na 1ª parcela e fim de mês', () => {
    // Cenário oficial do enunciado:
    // 333,34 (31/01) + 333,33 (28/02) + 333,33 (31/03) = 1.000,00
    const parcelas = divideInstallments(100000, 3, '2027-01-31');

    expect(parcelas).toHaveLength(3);
    expect(parcelas[0]).toEqual({
      number: 1,
      dueDate: '2027-01-31',
      amountCents: 33334,
    });
    expect(parcelas[1]).toEqual({
      number: 2,
      dueDate: '2027-02-28',
      amountCents: 33333,
    });
    expect(parcelas[2]).toEqual({
      number: 3,
      dueDate: '2027-03-31',
      amountCents: 33333,
    });

    const soma = parcelas.reduce((acc, p) => acc + p.amountCents, 0);
    expect(soma).toBe(100000);
  });

  it('divide R$ 10,00 em 3x -> 3,34 + 3,33 + 3,33', () => {
    const parcelas = divideInstallments(1000, 3, '2027-05-10');
    expect(parcelas[0].amountCents).toBe(334);
    expect(parcelas[1].amountCents).toBe(333);
    expect(parcelas[2].amountCents).toBe(333);
    expect(parcelas.reduce((a, b) => a + b.amountCents, 0)).toBe(1000);
  });

  it('calcula 4x a partir de 31/01/2027 -> 31/01, 28/02, 31/03, 30/04', () => {
    const p1 = calculateNextMonthlyDueDate('2027-01-31', 1);
    const p2 = calculateNextMonthlyDueDate('2027-01-31', 2);
    const p3 = calculateNextMonthlyDueDate('2027-01-31', 3);
    const p4 = calculateNextMonthlyDueDate('2027-01-31', 4);

    expect(p1).toBe('2027-01-31');
    expect(p2).toBe('2027-02-28');
    expect(p3).toBe('2027-03-31');
    expect(p4).toBe('2027-04-30');
  });

  it('calcula ano bissexto corretamente (fevereiro de 2028 tem 29 dias)', () => {
    const pFev2028 = calculateNextMonthlyDueDate('2028-01-31', 2);
    expect(pFev2028).toBe('2028-02-29');
  });

  it('classifica status de parcela com hoje simulado em 05/03/2027', () => {
    const hoje = '2027-03-05';

    // 28/02/2027 -> atrasada
    expect(getInstallmentStatus({ status: 'pending', due_date: '2027-02-28' }, hoje)).toBe('overdue');

    // 05/03/2027 -> vence hoje
    expect(getInstallmentStatus({ status: 'pending', due_date: '2027-03-05' }, hoje)).toBe('due_today');

    // 31/03/2027 -> pendente / a vencer
    expect(getInstallmentStatus({ status: 'pending', due_date: '2027-03-31' }, hoje)).toBe('pending');

    // Parcela já paga
    expect(getInstallmentStatus({ status: 'paid', due_date: '2027-02-28' }, hoje)).toBe('paid');
  });

  it('calcula resumo de alertas de vencimento corretamente', () => {
    const hoje = '2027-03-05';
    const lista: any[] = [
      { id: '1', status: 'pending', due_date: '2027-02-28', amount_cents: 33334 }, // atrasada
      { id: '2', status: 'pending', due_date: '2027-03-05', amount_cents: 15000 }, // vence hoje
      { id: '3', status: 'pending', due_date: '2027-03-10', amount_cents: 20000 }, // prox 7 dias (05 + 5 dias)
      { id: '4', status: 'pending', due_date: '2027-03-31', amount_cents: 33333 }, // prox mes
      { id: '5', status: 'paid', due_date: '2027-02-15', amount_cents: 50000 }, // paga (ignora)
    ];

    const summary = getDueSummary(lista, hoje);

    expect(summary.overdueCount).toBe(1);
    expect(summary.overdueCents).toBe(33334);

    expect(summary.dueTodayCount).toBe(1);
    expect(summary.dueTodayCents).toBe(15000);

    // Próximos 7 dias: 05/03 (15000) + 10/03 (20000) = 35000
    expect(summary.next7DaysCount).toBe(2);
    expect(summary.next7DaysCents).toBe(35000);

    // Total no mês de março (03): 15000 + 20000 + 33333 = 68333
    expect(summary.monthTotalCents).toBe(68333);
  });
});

