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
 */
export function parseDigitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
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

/**
 * Calcula taxa (em centavos) e valor líquido (em centavos) a partir do valor bruto e da taxa %.
 * Garante sempre: grossCents - feeCents = netCents.
 */
export function calculateFeeAndNetFromPercent(
  grossCents: number,
  feePercent: number
): { feeCents: number; netCents: number } {
  const safeGross = Math.max(0, Math.round(Number(grossCents) || 0));
  const safePct = Math.min(100, Math.max(0, Number(feePercent) || 0));
  const feeCents = Math.min(safeGross, Math.round((safeGross * safePct) / 100));
  const netCents = safeGross - feeCents;
  return { feeCents, netCents };
}

/**
 * Formata data/hora ISO para exibição em America/Sao_Paulo (ex: "03/11/2026, 14:30")
 */
export function formatDateTimeBR(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Gera string "YYYY-MM-DDTHH:mm" no fuso America/Sao_Paulo para <input type="datetime-local" />
 */
export function toSaoPauloDateTimeLocal(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

/**
 * Converte valor de <input type="datetime-local" /> (considerado em America/Sao_Paulo -03:00) para ISO UTC
 */
export function fromSaoPauloDateTimeLocalToISO(localStr: string): string {
  if (!localStr) return new Date().toISOString();
  // Se não tiver fuso explícito, assume -03:00 (America/Sao_Paulo)
  const withOffset =
    localStr.length === 16 ? `${localStr}:00-03:00` : `${localStr}-03:00`;
  const parsed = new Date(withOffset);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

/**
 * Retorna o início e o fim do dia de hoje no fuso America/Sao_Paulo em ISO UTC
 */
export function getTodaySaoPauloBoundsISO(now: Date = new Date()): {
  startISO: string;
  endISO: string;
} {
  const datePart = toSaoPauloDateTimeLocal(now).slice(0, 10);
  const startISO = new Date(`${datePart}T00:00:00.000-03:00`).toISOString();
  const endISO = new Date(`${datePart}T23:59:59.999-03:00`).toISOString();
  return { startISO, endISO };
}
