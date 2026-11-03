import { describe, it, expect } from 'vitest';
import { formatCentsToBRL, formatCentsToCompactBRL } from './format';

describe('Formatação de moeda em centavos (PRD 5 e 7.1)', () => {
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
});
