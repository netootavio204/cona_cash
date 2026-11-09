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
 * Gera string "YYYY-MM-DD" no fuso America/Sao_Paulo para <input type="date" />
 */
export function toSaoPauloDateOnly(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
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

/**
 * Soma os ganhos líquidos e saídas de uma lista de lançamentos,
 * excluindo Transferências e excluindo Aportes (fontes com counts_as_earning = false).
 */
export function sumEarningsAndExpenses(
  transactions: {
    kind: 'income' | 'expense' | 'transfer';
    net_cents: number;
    income_source_id?: string | null;
  }[],
  sources: { id: string; counts_as_earning: boolean }[]
): { entradasGanhoCents: number; aportesCents: number; saidasCents: number } {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  let entradasGanhoCents = 0;
  let aportesCents = 0;
  let saidasCents = 0;

  for (const tx of transactions) {
    if (tx.kind === 'income') {
      const src = tx.income_source_id
        ? sourceMap.get(tx.income_source_id)
        : undefined;
      if (src && src.counts_as_earning === false) {
        aportesCents += tx.net_cents;
      } else {
        entradasGanhoCents += tx.net_cents;
      }
    } else if (tx.kind === 'expense') {
      saidasCents += tx.net_cents;
    }
  }

  return { entradasGanhoCents, aportesCents, saidasCents };
}

/**
 * Retorna os limites ISO UTC de semana, mes ou dia em America/Sao_Paulo
 */

/**
 * Retorna os limites ISO UTC de semana, mês ou dia em America/Sao_Paulo
 */
export function getPeriodSaoPauloBoundsISO(
  tipo: 'dia' | 'semana' | 'mes',
  refDate: Date = new Date(),
  weekStartsOn: 0 | 1 = 1
): {
  startISO: string;
  endISO: string;
  label: string;
  prevStartISO: string;
  prevEndISO: string;
} {
  const datePart = toSaoPauloDateTimeLocal(refDate).slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  if (tipo === 'dia') {
    const startISO = new Date(datePart + 'T00:00:00.000-03:00').toISOString();
    const endISO = new Date(datePart + 'T23:59:59.999-03:00').toISOString();
    const prevDate = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
    const pPart = toSaoPauloDateTimeLocal(prevDate).slice(0, 10);
    return {
      startISO,
      endISO,
      label: d.toString().padStart(2, '0') + '/' + m.toString().padStart(2, '0') + '/' + y,
      prevStartISO: new Date(pPart + 'T00:00:00.000-03:00').toISOString(),
      prevEndISO: new Date(pPart + 'T23:59:59.999-03:00').toISOString(),
    };
  }

  if (tipo === 'semana') {
    const dayOfWeek = cur.getUTCDay(); // 0 = Domingo, 1 = Segunda...
    const diff = weekStartsOn === 1 ? (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) : -dayOfWeek;
    const startDay = new Date(cur.getTime() + diff * 24 * 60 * 60 * 1000);
    const endDay = new Date(startDay.getTime() + 6 * 24 * 60 * 60 * 1000);
    const sPart = toSaoPauloDateTimeLocal(startDay).slice(0, 10);
    const ePart = toSaoPauloDateTimeLocal(endDay).slice(0, 10);
    const prevStart = new Date(startDay.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(endDay.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      startISO: new Date(sPart + 'T00:00:00.000-03:00').toISOString(),
      endISO: new Date(ePart + 'T23:59:59.999-03:00').toISOString(),
      label: 'Semana ' + sPart.slice(8, 10) + '/' + sPart.slice(5, 7) + ' a ' + ePart.slice(8, 10) + '/' + ePart.slice(5, 7),
      prevStartISO: new Date(toSaoPauloDateTimeLocal(prevStart).slice(0, 10) + 'T00:00:00.000-03:00').toISOString(),
      prevEndISO: new Date(toSaoPauloDateTimeLocal(prevEnd).slice(0, 10) + 'T23:59:59.999-03:00').toISOString(),
    };
  }

  // mes
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const sPart = y + '-' + m.toString().padStart(2, '0') + '-01';
  const ePart = y + '-' + m.toString().padStart(2, '0') + '-' + lastDay.toString().padStart(2, '0');
  const prevMonthRef = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
  const pmY = prevMonthRef.getUTCFullYear();
  const pmM = prevMonthRef.getUTCMonth() + 1;
  const pmLast = new Date(Date.UTC(pmY, pmM, 0)).getUTCDate();
  const pmSPart = pmY + '-' + pmM.toString().padStart(2, '0') + '-01';
  const pmEPart = pmY + '-' + pmM.toString().padStart(2, '0') + '-' + pmLast.toString().padStart(2, '0');
  const mesesNome = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return {
    startISO: new Date(sPart + 'T00:00:00.000-03:00').toISOString(),
    endISO: new Date(ePart + 'T23:59:59.999-03:00').toISOString(),
    label: mesesNome[m - 1] + ' de ' + y,
    prevStartISO: new Date(pmSPart + 'T00:00:00.000-03:00').toISOString(),
    prevEndISO: new Date(pmEPart + 'T23:59:59.999-03:00').toISOString(),
  };
}
