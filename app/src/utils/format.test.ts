import { describe, it, expect } from 'vitest';
import {
  formatCentsToBRL,
  formatCentsToCompactBRL,
  parseDigitsToCents,
  parseFeePercent,
  formatFeePercent,
  calculateFeeAndNetFromPercent,
  sumEarningsAndExpenses,
} from './format';
import { APP_VERSION, SCHEMA_VERSION } from '../config/version';

describe('Formatação de moeda em centavos e taxas (PRD 5, 7.1, Fase 2, Fase 3 e Fase 3B)', () => {
  it('formata valores inteiros em centavos para R$ corretamente', () => {
    expect(formatCentsToBRL(0)).toContain('0,00');
    expect(formatCentsToBRL(1050)).toContain('10,50');
    expect(formatCentsToBRL(123456789)).toContain('1.234.567,89');
  });

  it('abrevia valores grandes no modo compacto para não vazar em cards de 320px', () => {
    expect(formatCentsToCompactBRL(50000)).toContain('500,00');
    expect(formatCentsToCompactBRL(1250000)).toBe('R$ 12,5 mil');
    expect(formatCentsToCompactBRL(150000000)).toBe('R$ 1,5 mi');
  });

  it('converte digitação de máscara monetária para centavos inteiros sem float', () => {
    expect(parseDigitsToCents('R$ 0,00')).toBe(0);
    expect(parseDigitsToCents('R$ 150,75')).toBe(15075);
    expect(parseDigitsToCents('123456')).toBe(123456);
  });

  it('aceita taxas percentuais decimais com vírgula ou ponto (ex: 3,49)', () => {
    expect(parseFeePercent('3,49')).toBe(3.49);
    expect(parseFeePercent('1.99')).toBe(1.99);
    expect(parseFeePercent('0')).toBe(0);
    expect(parseFeePercent('105')).toBeNull();
    expect(parseFeePercent('-1')).toBeNull();
    expect(formatFeePercent(3.49)).toBe('3,49%');
    expect(formatFeePercent(0)).toBe('0%');
  });

  it('calcula bruto - taxa = liquido perfeitamente em centavos', () => {
    const r1 = calculateFeeAndNetFromPercent(10000, 3.49);
    expect(r1.feeCents).toBe(349);
    expect(r1.netCents).toBe(9651);
    expect(r1.feeCents + r1.netCents).toBe(10000);

    const r2 = calculateFeeAndNetFromPercent(5000, 0);
    expect(r2.feeCents).toBe(0);
    expect(r2.netCents).toBe(5000);
  });

  it('separa Aportes (counts_as_earning = false) dos totais de ganho (Fase 3B)', () => {
    const sources = [
      { id: 'src-ml', counts_as_earning: true },
      { id: 'src-aporte', counts_as_earning: false },
    ];
    const txs = [
      { kind: 'income' as const, net_cents: 10000, income_source_id: 'src-ml' },
      { kind: 'income' as const, net_cents: 5000, income_source_id: 'src-aporte' },
      { kind: 'income' as const, net_cents: 3000, income_source_id: null },
      { kind: 'expense' as const, net_cents: 2000, income_source_id: 'src-ml' },
      { kind: 'transfer' as const, net_cents: 4000, income_source_id: null },
    ];

    const res = sumEarningsAndExpenses(txs, sources);
    expect(res.entradasGanhoCents).toBe(13000); // R$ 100 (ML) + R$ 30 (Sem fonte) = R$ 130,00
    expect(res.aportesCents).toBe(5000); // R$ 50,00 (Aporte separado)
    expect(res.saidasCents).toBe(2000); // R$ 20,00 (Transferência ignorada)
  });

  it('mantém versão sincronizada v1.0.0 beta / 005_goals', () => {
    expect(APP_VERSION).toBe('v1.0.0 beta');
    expect(SCHEMA_VERSION).toBe('005_goals');
  });
});
