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
  const safeCents = Number.isFinite(Number(cents)) ? Math.round(Number(cents)) : 0;
  return brlFormatter.format(safeCents / 100);
}

/**
 * Versão compacta para cards pequenos quando o valor é grande (PRD 7.1)
 * Ex: 1250000 (R$ 12.500,00) -> "R$ 12,5 mil"
 * Ex: 150000000 (R$ 1.500.000,00) -> "R$ 1,5 mi"
 */
export function formatCentsToCompactBRL(cents: number): string {
  const safeCents = Number.isFinite(Number(cents)) ? Math.round(Number(cents)) : 0;
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

/**
 * Máscara estilo caixa eletrônico/banco para campos de moeda R$:
 * Extrai apenas os dígitos e interpreta como centavos inteiros.
 * Ex: "1250" -> 1250 (R$ 12,50). Nunca usa float!
 */
export function parseDigitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  // Limite seguro de 12 dígitos (R$ 9.999.999.999,99)
  const clipped = digits.slice(0, 12);
  return parseInt(clipped, 10) || 0;
}

/**
 * Converte string de taxa % (ex: "3,49" ou "3.49") em número com até 2 casas decimais (0 a 100)
 */
export function parseFeePercent(raw: string): number | null {
  const cleaned = raw.trim().replace('%', '').replace(',', '.');
  if (cleaned === '') return 0;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

/**
 * Formata taxa percentual no padrão pt-BR (ex: 3.49 -> "3,49%")
 */
export function formatFeePercent(fee: number): string {
  const safe = Number.isFinite(Number(fee)) ? Number(fee) : 0;
  return `${safe.toLocaleString('pt-BR', {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}%`;
}
