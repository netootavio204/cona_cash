import { describe, it, expect } from 'vitest';
import {
  formatCentsToBRL,
  formatCentsToCompactBRL,
  parseDigitsToCents,
  parseFeePercent,
  formatFeePercent,
} from './format';

describe('Formatação de moeda em centavos e taxas (PRD 5, 7.1 e Fase 2)', () => {
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
});
