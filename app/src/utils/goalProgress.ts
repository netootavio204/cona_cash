import type {
  Goal,
  GoalProgress,
  IncomeSource,
  Transaction,
} from '../types/database';
import { getPeriodSaoPauloBoundsISO } from './format';

export function getGoalPeriodKey(
  period: 'daily' | 'weekly' | 'monthly',
  date: Date = new Date(),
  weekStartsOn: 0 | 1 = 1
): string {
  const bounds = getPeriodSaoPauloBoundsISO(
    period === 'daily' ? 'dia' : period === 'weekly' ? 'semana' : 'mes',
    date,
    weekStartsOn
  );
  // Usa a data de início em formato YYYY-MM-DD para formar a chave única do período
  const startDay = bounds.startISO.slice(0, 10);
  if (period === 'daily') return startDay;
  if (period === 'monthly') return startDay.slice(0, 7);
  return `${startDay}_W`;
}

export function calculateGoalProgress(
  goal: Goal,
  transactions: Transaction[],
  incomeSources: IncomeSource[],
  referenceDate: Date = new Date(),
  weekStartsOn: 0 | 1 = 1
): GoalProgress {
  const periodType =
    goal.period === 'daily' ? 'dia' : goal.period === 'weekly' ? 'semana' : 'mes';
  const bounds = getPeriodSaoPauloBoundsISO(periodType, referenceDate, weekStartsOn);
  const periodKey = getGoalPeriodKey(goal.period, referenceDate, weekStartsOn);

  const startMs = new Date(bounds.startISO).getTime();
  const endMs = new Date(bounds.endISO).getTime();

  // Mapa de fontes para checar se conta como ganho
  const sourceMap = new Map<string, IncomeSource>();
  incomeSources.forEach((s) => sourceMap.set(s.id, s));

  // Transações ativas no período
  const periodTxs = transactions.filter((tx) => {
    if (tx.deleted_at) return false;
    const txMs = new Date(tx.occurred_at).getTime();
    return txMs >= startMs && txMs <= endMs;
  });

  let currentCents = 0;

  if (goal.kind === 'earning') {
    for (const tx of periodTxs) {
      if (tx.kind !== 'income') continue;

      // Se a meta for específica por fonte, filtra estritamente
      if (goal.income_source_id) {
        if (tx.income_source_id !== goal.income_source_id) continue;
      }

      // Regra 14: Ganho ≠ Aporte. Se tiver fonte e counts_as_earning for false, ignora!
      if (tx.income_source_id) {
        const src = sourceMap.get(tx.income_source_id);
        if (src && !src.counts_as_earning) {
          continue;
        }
      }

      currentCents += tx.net_cents || 0;
    }

    const percentage =
      goal.target_cents > 0 ? Math.round((currentCents / goal.target_cents) * 100) : 0;
    const isAchieved = currentCents >= goal.target_cents;
    const remainingCents = Math.max(0, goal.target_cents - currentCents);

    return {
      goal,
      current_cents: currentCents,
      target_cents: goal.target_cents,
      percentage,
      remaining_cents: remainingCents,
      is_achieved: isAchieved,
      is_over_limit: false,
      period_key: periodKey,
      status: isAchieved ? 'achieved' : 'ok',
    };
  }

  if (goal.kind === 'expense_limit') {
    for (const tx of periodTxs) {
      if (tx.kind !== 'expense') continue;
      currentCents += tx.net_cents || 0;
    }

    const percentage =
      goal.target_cents > 0 ? Math.round((currentCents / goal.target_cents) * 100) : 0;
    const isOverLimit = currentCents > goal.target_cents;
    const remainingCents = Math.max(0, goal.target_cents - currentCents);

    let status: GoalProgress['status'] = 'ok';
    if (isOverLimit) {
      status = 'danger';
    } else if (percentage >= 80) {
      status = 'warning';
    }

    return {
      goal,
      current_cents: currentCents,
      target_cents: goal.target_cents,
      percentage,
      remaining_cents: remainingCents,
      is_achieved: false,
      is_over_limit: isOverLimit,
      period_key: periodKey,
      status,
    };
  }

  // goal.kind === 'saving'
  let totalEarnings = 0;
  let totalExpenses = 0;

  for (const tx of periodTxs) {
    if (tx.kind === 'income') {
      if (tx.income_source_id) {
        const src = sourceMap.get(tx.income_source_id);
        if (src && !src.counts_as_earning) continue;
      }
      totalEarnings += tx.net_cents || 0;
    } else if (tx.kind === 'expense') {
      totalExpenses += tx.net_cents || 0;
    }
  }

  // Economia líquida nunca exibe valor negativo
  currentCents = Math.max(0, totalEarnings - totalExpenses);
  const percentage =
    goal.target_cents > 0 ? Math.round((currentCents / goal.target_cents) * 100) : 0;
  const isAchieved = currentCents >= goal.target_cents;
  const remainingCents = Math.max(0, goal.target_cents - currentCents);

  return {
    goal,
    current_cents: currentCents,
    target_cents: goal.target_cents,
    percentage,
    remaining_cents: remainingCents,
    is_achieved: isAchieved,
    is_over_limit: false,
    period_key: periodKey,
    status: isAchieved ? 'achieved' : 'ok',
  };
}
