const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Converte centavos (inteiro) para string em Reais (ex: 123456 -> "R$ 1.234,56")
 */
export function formatCentsToBRL(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  return brlFormatter.format(safeCents / 100);
}

/**
 * Versão compacta para cards pequenos quando o valor é grande (PRD 7.1)
 * Ex: 125000 (R$ 1.250,00) -> "R$ 1,25 mil"
 * Ex: 150000000 (R$ 1.500.000,00) -> "R$ 1,5 mi"
 */
export function formatCentsToCompactBRL(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const reais = safeCents / 100;
  const abs = Math.abs(reais);
  const sign = reais < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${sign}R$ ${val} mi`;
  }

  if (abs >= 10_000) {
    const val = (abs / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `${sign}R$ ${val} mil`;
  }

  return formatCentsToBRL(safeCents);
}
