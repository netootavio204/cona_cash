import { describe, it, expect } from 'vitest';
import { calculateGoalProgress } from './goalProgress';
import type { Goal, IncomeSource, Transaction } from '../types/database';

function mockSource(dados: Partial<IncomeSource> & { id: string; name: string }): IncomeSource {
  return {
    user_id: 'user-1',
    color: '#FF7A1A',
    icon: 'car',
    default_payment_method_id: null,
    default_account_id: null,
    counts_as_earning: true,
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...dados,
  };
}

function mockTx(dados: Partial<Transaction> & { id: string; kind: Transaction['kind']; gross_cents: number; net_cents: number }): Transaction {
  return {
    user_id: 'user-1',
    occurred_at: '2026-11-04T12:00:00.000-03:00',
    account_id: 'acc-1',
    to_account_id: null,
    payment_method_id: null,
    category_id: null,
    income_source_id: null,
    fee_cents: 0,
    note: '',
    batch_id: null,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...dados,
  };
}

describe('Cálculo de Progresso de Metas (Fase 5 — PRD 4.6)', () => {
  const fontes: IncomeSource[] = [
    mockSource({ id: 'src-venda-3d', name: 'Venda 3D', counts_as_earning: true }),
    mockSource({ id: 'src-uber', name: 'Uber', counts_as_earning: true }),
    mockSource({ id: 'src-aporte', name: 'Aporte Pessoal', counts_as_earning: false }),
  ];

  const refDate = new Date('2026-11-04T12:00:00.000-03:00');

  const metaGanhoDiario: Goal = {
    id: 'goal-1',
    user_id: 'user-1',
    title: 'Ganho Diário',
    kind: 'earning',
    period: 'daily',
    target_cents: 20000, // R$ 200,00
    income_source_id: null,
    active: true,
    celebrated_periods: [],
    archived: false,
    created_at: '',
    updated_at: '',
  };

  it('calcula 0% para meta sem lançamentos', () => {
    const prog = calculateGoalProgress(metaGanhoDiario, [], fontes, refDate);
    expect(prog.percentage).toBe(0);
    expect(prog.current_cents).toBe(0);
    expect(prog.remaining_cents).toBe(20000);
    expect(prog.is_achieved).toBe(false);
    expect(prog.status).toBe('ok');
  });

  it('calcula 50% e faltam R$ 100 ao lançar R$ 100 de ganho', () => {
    const txs: Transaction[] = [
      mockTx({
        id: 'tx-1',
        kind: 'income',
        gross_cents: 10000,
        net_cents: 10000,
        occurred_at: '2026-11-04T10:00:00.000-03:00',
        income_source_id: 'src-venda-3d',
      }),
    ];

    const prog = calculateGoalProgress(metaGanhoDiario, txs, fontes, refDate);
    expect(prog.percentage).toBe(50);
    expect(prog.current_cents).toBe(10000);
    expect(prog.remaining_cents).toBe(10000);
    expect(prog.is_achieved).toBe(false);
  });

  it('Regra 14: Lançar Aporte NÃO mexe na meta de ganho; lançar Venda 3D mexe', () => {
    const txs: Transaction[] = [
      mockTx({
        id: 'tx-aporte',
        kind: 'income',
        gross_cents: 50000,
        net_cents: 50000,
        occurred_at: '2026-11-04T09:00:00.000-03:00',
        income_source_id: 'src-aporte', // counts_as_earning = false
      }),
      mockTx({
        id: 'tx-venda',
        kind: 'income',
        gross_cents: 10000,
        net_cents: 10000,
        occurred_at: '2026-11-04T10:00:00.000-03:00',
        income_source_id: 'src-venda-3d', // counts_as_earning = true
      }),
    ];

    const prog = calculateGoalProgress(metaGanhoDiario, txs, fontes, refDate);
    // Somente os R$ 100 da venda 3D devem contar (R$ 500 de aporte ignorados)
    expect(prog.current_cents).toBe(10000);
    expect(prog.percentage).toBe(50);
  });

  it('Meta vinculada a fonte específica ignora entradas de outras fontes', () => {
    const metaVenda3D: Goal = {
      ...metaGanhoDiario,
      id: 'goal-3d',
      title: 'Meta Venda 3D',
      income_source_id: 'src-venda-3d',
    };

    const txs: Transaction[] = [
      mockTx({
        id: 'tx-uber',
        kind: 'income',
        gross_cents: 8000,
        net_cents: 8000,
        occurred_at: '2026-11-04T11:00:00.000-03:00',
        income_source_id: 'src-uber',
      }),
      mockTx({
        id: 'tx-venda',
        kind: 'income',
        gross_cents: 25000,
        net_cents: 25000,
        occurred_at: '2026-11-04T14:00:00.000-03:00',
        income_source_id: 'src-venda-3d',
      }),
    ];

    const prog = calculateGoalProgress(metaVenda3D, txs, fontes, refDate);
    // Deve contar exclusivamente os R$ 250 da venda 3D
    expect(prog.current_cents).toBe(25000);
    expect(prog.percentage).toBe(125);
    expect(prog.is_achieved).toBe(true);
    expect(prog.status).toBe('achieved');
    expect(prog.remaining_cents).toBe(0);
  });

  it('Limite de gastos muda para ok (<80%), warning (>=80%) e danger (>100%)', () => {
    const metaGasto: Goal = {
      id: 'goal-gasto',
      user_id: 'user-1',
      title: 'Limite Semanal',
      kind: 'expense_limit',
      period: 'weekly',
      target_cents: 10000, // R$ 100,00
      income_source_id: null,
      active: true,
      celebrated_periods: [],
      archived: false,
      created_at: '',
      updated_at: '',
    };

    // 1. Gasto de R$ 70 -> 70% -> ok
    const tx70 = mockTx({
      id: 'tx-e1',
      kind: 'expense',
      gross_cents: 7000,
      net_cents: 7000,
      occurred_at: '2026-11-04T10:00:00.000-03:00',
    });
    expect(calculateGoalProgress(metaGasto, [tx70], fontes, refDate).status).toBe('ok');

    // 2. Gasto adicional de R$ 15 (total R$ 85) -> 85% -> warning
    const tx15 = mockTx({
      id: 'tx-e2',
      kind: 'expense',
      gross_cents: 1500,
      net_cents: 1500,
      occurred_at: '2026-11-04T11:00:00.000-03:00',
    });
    expect(calculateGoalProgress(metaGasto, [tx70, tx15], fontes, refDate).status).toBe('warning');

    // 3. Gasto adicional de R$ 20 (total R$ 105) -> 105% -> danger e is_over_limit
    const tx20 = mockTx({
      id: 'tx-e3',
      kind: 'expense',
      gross_cents: 2000,
      net_cents: 2000,
      occurred_at: '2026-11-04T12:00:00.000-03:00',
    });
    const progOver = calculateGoalProgress(metaGasto, [tx70, tx15, tx20], fontes, refDate);
    expect(progOver.status).toBe('danger');
    expect(progOver.is_over_limit).toBe(true);
    expect(progOver.percentage).toBe(105);
  });

  it('Meta de economia líquida nunca exibe valor negativo quando despesas superam ganhos', () => {
    const metaEconomia: Goal = {
      id: 'goal-eco',
      user_id: 'user-1',
      title: 'Economia Mensal',
      kind: 'saving',
      period: 'monthly',
      target_cents: 50000,
      income_source_id: null,
      active: true,
      celebrated_periods: [],
      archived: false,
      created_at: '',
      updated_at: '',
    };

    // R$ 100 de ganho e R$ 150 de gasto -> resultado -50, mas economia exibe 0
    const txs: Transaction[] = [
      mockTx({
        id: 'tx-in',
        kind: 'income',
        gross_cents: 10000,
        net_cents: 10000,
        occurred_at: '2026-11-04T10:00:00.000-03:00',
      }),
      mockTx({
        id: 'tx-out',
        kind: 'expense',
        gross_cents: 15000,
        net_cents: 15000,
        occurred_at: '2026-11-04T11:00:00.000-03:00',
      }),
    ];

    const prog = calculateGoalProgress(metaEconomia, txs, fontes, refDate);
    expect(prog.current_cents).toBe(0);
    expect(prog.percentage).toBe(0);
    expect(prog.is_achieved).toBe(false);
  });

  it('Ignora lançamentos fora do período atual (virada de período)', () => {
    // Lançamento de ontem não entra na meta diária de hoje
    const txOntem = mockTx({
      id: 'tx-ontem',
      kind: 'income',
      gross_cents: 20000,
      net_cents: 20000,
      occurred_at: '2026-11-03T10:00:00.000-03:00',
    });

    const prog = calculateGoalProgress(metaGanhoDiario, [txOntem], fontes, refDate);
    expect(prog.current_cents).toBe(0);
    expect(prog.percentage).toBe(0);
  });
});
