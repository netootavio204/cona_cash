import React from 'react';
import type { GoalProgress } from '../../types/database';
import { formatCentsToBRL } from '../../utils/format';
import { Award, AlertTriangle, CheckCircle2, TrendingUp, ShieldAlert, Sparkles } from 'lucide-react';

interface GoalProgressBarProps {
  progress: GoalProgress;
  compact?: boolean;
}

export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({ progress, compact = false }) => {
  const { goal, current_cents, target_cents, percentage, remaining_cents, is_achieved, is_over_limit, status } = progress;

  // Cor e estilo da barra
  let barColor = 'from-[#FF7A1A] to-[#FFC940]';
  let badgeColor = 'bg-[#FF7A1A]/10 text-[#FF7A1A] border-[#FF7A1A]/30';
  let badgeText = `${percentage}%`;

  if (goal.kind === 'expense_limit') {
    if (is_over_limit) {
      barColor = 'from-[#FF3B30] to-[#E02424]';
      badgeColor = 'bg-[#FF3B30]/15 text-[#FF3B30] border-[#FF3B30]/40';
      badgeText = `Estourou (${percentage}%)`;
    } else if (status === 'warning') {
      barColor = 'from-[#FFC940] to-[#FF9800]';
      badgeColor = 'bg-[#FFC940]/15 text-[#FFC940] border-[#FFC940]/40';
      badgeText = `Atenção (${percentage}%)`;
    } else {
      barColor = 'from-[#2EE59D] to-[#10B981]';
      badgeColor = 'bg-[#2EE59D]/10 text-[#2EE59D] border-[#2EE59D]/30';
      badgeText = `${percentage}%`;
    }
  } else if (is_achieved) {
    barColor = 'from-[#2EE59D] to-[#10B981]';
    badgeColor = 'bg-[#2EE59D]/15 text-[#2EE59D] border-[#2EE59D]/40';
    badgeText = 'Batida! 🎉';
  }

  const fillWidth = Math.min(100, Math.max(0, percentage));

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Cabeçalho do Card da Barra */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {goal.kind === 'earning' && <TrendingUp className="w-4 h-4 text-[#2EE59D] shrink-0" />}
          {goal.kind === 'expense_limit' && <ShieldAlert className="w-4 h-4 text-[#FFC940] shrink-0" />}
          {goal.kind === 'saving' && <Sparkles className="w-4 h-4 text-[#38BDF8] shrink-0" />}
          <span className="text-sm font-bold text-white truncate">{goal.title}</span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeColor}`}>
          {badgeText}
        </span>
      </div>

      {/* Barra de Progresso Visual */}
      <div className="relative w-full h-3 bg-[#1B1B22] rounded-full overflow-hidden border border-[#262630]/60">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>

      {/* Valores e Texto de Ajuda */}
      <div className="flex items-center justify-between text-xs text-[#9A9AA6] min-w-0 gap-2">
        <span className="font-semibold text-white truncate">
          {formatCentsToBRL(current_cents)}
          <span className="text-[#9A9AA6] font-normal"> / {formatCentsToBRL(target_cents)}</span>
        </span>

        <span className="text-[11px] truncate text-right font-medium">
          {goal.kind === 'expense_limit' ? (
            is_over_limit ? (
              <span className="text-[#FF3B30] font-bold">
                Excedido em {formatCentsToBRL(current_cents - target_cents)}
              </span>
            ) : (
              <span>Resta {formatCentsToBRL(remaining_cents)} de teto</span>
            )
          ) : is_achieved ? (
            <span className="text-[#2EE59D] font-bold flex items-center gap-1 justify-end">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conquistada!
            </span>
          ) : (
            <span>Faltam {formatCentsToBRL(remaining_cents)}</span>
          )}
        </span>
      </div>
    </div>
  );
};
