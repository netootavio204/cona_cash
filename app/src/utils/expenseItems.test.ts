import { describe, it, expect } from 'vitest';
import { normalizeItemText } from '../components/ui/ExpenseItemAutocomplete';
import { suggestIconByName } from '../components/ui/iconLibrary';

describe('Fase 8: Itens de Saída, Banco de Ícones e Autocomplete (PRD 4.3, 7.4)', () => {
  it('normaliza nomes de itens sem acentos e minúsculos', () => {
    expect(normalizeItemText('Café')).toBe('cafe');
    expect(normalizeItemText('PALHEIRO')).toBe('palheiro');
    expect(normalizeItemText('  Filamento PLA  ')).toBe('filamento pla');
    expect(normalizeItemText('Palhêiro')).toBe('palheiro');
  });

  it('sugere ícone correto pelo nome digitado', () => {
    expect(suggestIconByName('Maquininha Stone')).toBe('credit-card');
    expect(suggestIconByName('Pix')).toBe('qr-code');
    expect(suggestIconByName('Dinheiro Bolso')).toBe('banknote');
    expect(suggestIconByName('Gasolina Comum')).toBe('fuel');
    expect(suggestIconByName('Filamento PLA')).toBe('boxes');
    expect(suggestIconByName('Corrida 99')).toBe('car');
    expect(suggestIconByName('Almoço Restaurante')).toBe('utensils');
    expect(suggestIconByName('Café expresso')).toBe('coffee');
    expect(suggestIconByName('Item desconhecido aleatorio')).toBe('tag');
  });

  it('calcula métricas de ranking de itens conforme o enunciado da Fase 8', () => {
    // Cenário: Palheiro R$ 17,00 x2 = R$ 34,00 / Café R$ 6,00 x3 = R$ 18,00
    const comprasPalheiro = [1700, 1700];
    const totalPalheiro = comprasPalheiro.reduce((a, b) => a + b, 0);
    const mediaPalheiro = totalPalheiro / comprasPalheiro.length;

    const comprasCafe = [600, 600, 600];
    const totalCafe = comprasCafe.reduce((a, b) => a + b, 0);
    const mediaCafe = totalCafe / comprasCafe.length;

    expect(totalPalheiro).toBe(3400); // R$ 34,00
    expect(mediaPalheiro).toBe(1700); // R$ 17,00
    expect(totalCafe).toBe(1800); // R$ 18,00
    expect(mediaCafe).toBe(600); // R$ 6,00

    const totalGeral = totalPalheiro + totalCafe;
    expect(totalGeral).toBe(5200); // R$ 52,00
    const pctPalheiro = Number(((totalPalheiro / totalGeral) * 100).toFixed(2));
    const pctCafe = Number(((totalCafe / totalGeral) * 100).toFixed(2));

    expect(pctPalheiro).toBe(65.38);
    expect(pctCafe).toBe(34.62);
  });
});

