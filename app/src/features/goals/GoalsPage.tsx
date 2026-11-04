import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target,
  Plus,
  Trophy,
  Award,
  AlertTriangle,
  Play,
  Pause,
  Pencil,
  Trash2,
  Calendar,
  Sparkles,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import type {
  Goal,
  GoalAchievement,
  GoalPeriod,
  GoalProgress,
  IncomeSource,
  Transaction,
} from '../../types/database';
import {
  deleteGoal,
  createGoal,
  updateGoal,
  fetchGoals,
  fetchGoalAchievements,
  ensureMyGoals,
  recordGoalCelebration,
} from '../../api/supabase';
import { calculateGoalProgress } from '../../utils/goalProgress';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { GoalProgressBar } from '../../components/ui/GoalProgressBar';
import { GoalFormModal } from './GoalFormModal';
import { Confetti } from '../../components/ui/Confetti';
import { playGoalAchievedSound, playExpenseWarningSound } from '../../utils/audio';
import { useAuth } from '../auth/AuthContext';
import { formatCentsToBRL, formatDateTimeBR } from '../../utils/format';

interface GoalsPageProps {
  transactions: Transaction[];
  fontes: IncomeSource[];
  onShowToast: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  onRefreshData?: () => void;
}

export const GoalsPage: React.FC<GoalsPageProps> = ({
  transactions,
  fontes,
  onShowToast,
  onRefreshData,
}) => {
  const { perfil } = useAuth();
  const [metas, setMetas] = useState<Goal[]>([]);
  const [conquistas, setConquistas] = useState<GoalAchievement[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [metaEditando, setMetaEditando] = useState<Goal | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | GoalPeriod>('todos');
  const [mostrarConfete, setMostrarConfete] = useState(false);

  const weekStartsOn = perfil?.week_starts_on ?? 1;
  const somHabilitado = perfil?.sound_enabled ?? true;

  const carregarMetasEConquistas = useCallback(async () => {
    setCarregando(true);
    try {
      await ensureMyGoals();
      const [listaMetas, listaConquistas] = await Promise.all([
        fetchGoals(),
        fetchGoalAchievements(),
      ]);
      setMetas(listaMetas);
      setConquistas(listaConquistas);
    } catch (err) {
      console.error('Erro ao carregar metas:', err);
      onShowToast('Falha ao carregar suas metas.', 'erro');
    } finally {
      setCarregando(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    carregarMetasEConquistas();
  }, [carregarMetasEConquistas]);

  // Calcula o progresso de cada meta
  const progressos: GoalProgress[] = useMemo(() => {
    return metas.map((m) =>
      calculateGoalProgress(m, transactions, fontes, new Date(), weekStartsOn)
    );
  }, [metas, transactions, fontes, weekStartsOn]);

  // Verificar se alguma meta acabou de ser batida para celebrar 1x por período
  useEffect(() => {
    if (carregando || progressos.length === 0) return;

    for (const prog of progressos) {
      if (!prog.goal.active) continue;

      // Meta de ganho ou economia batida
      if (prog.is_achieved && prog.goal.kind !== 'expense_limit') {
        const jaCelebrado =
          Array.isArray(prog.goal.celebrated_periods) &&
          prog.goal.celebrated_periods.includes(prog.period_key);

        if (!jaCelebrado) {
          // Registrar celebração no banco e disparar efeito
          recordGoalCelebration({
            goalId: prog.goal.id,
            periodKey: prog.period_key,
            achievedCents: prog.current_cents,
            targetCents: prog.target_cents,
          }).then((sucesso) => {
            if (sucesso) {
              setMostrarConfete(true);
              playGoalAchievedSound(somHabilitado);
              onShowToast(`🎉 Parabéns! Meta "${prog.goal.title}" batida!`, 'sucesso');
              carregarMetasEConquistas();
            }
          });
          break;
        }
      }

      // Alerta de limite estourado
      if (prog.goal.kind === 'expense_limit' && prog.is_over_limit) {
        // Toca aviso discreto
        playExpenseWarningSound(somHabilitado);
      }
    }
  }, [progressos, carregando, somHabilitado, onShowToast, carregarMetasEConquistas]);

  // Filtra metas pela aba selecionada
  const progressosFiltrados = useMemo(() => {
    if (filtroPeriodo === 'todos') return progressos;
    return progressos.filter((p) => p.goal.period === filtroPeriodo);
  }, [progressos, filtroPeriodo]);

  // Limites estourados para banner de atenção
  const limitesEstourados = useMemo(() => {
    return progressos.filter((p) => p.goal.active && p.goal.kind === 'expense_limit' && p.is_over_limit);
  }, [progressos]);

  const handleSalvarMeta = async (dados: {
    title: string;
    kind: Goal['kind'];
    period: Goal['period'];
    target_cents: number;
    income_source_id: string | null;
    active: boolean;
  }) => {
    if (metaEditando) {
      await updateGoal(metaEditando.id, dados);
      onShowToast('Meta atualizada com sucesso!', 'sucesso');
    } else {
      await createGoal(dados);
      onShowToast('Nova meta criada com sucesso!', 'sucesso');
    }
    await carregarMetasEConquistas();
    onRefreshData?.();
  };

  const handleAlternarAtiva = async (meta: Goal) => {
    try {
      await updateGoal(meta.id, { active: !meta.active });
      onShowToast(meta.active ? 'Meta pausada.' : 'Meta ativada!', 'info');
      await carregarMetasEConquistas();
    } catch {
      onShowToast('Erro ao atualizar status da meta.', 'erro');
    }
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta meta?')) return;
    try {
      await deleteGoal(id);
      onShowToast('Meta excluída.', 'info');
      await carregarMetasEConquistas();
      onRefreshData?.();
    } catch {
      onShowToast('Erro ao excluir meta.', 'erro');
    }
  };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <Confetti active={mostrarConfete} onComplete={() => setMostrarConfete(false)} />

      {/* Banner de Atenção: Limites de Gastos Estourados */}
      {limitesEstourados.length > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FF3B30]/15 border border-[#FF3B30]/40 text-white min-w-0 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-[#FF3B30] shrink-0 mt-0.5" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#FF3B30]">Atenção: Limite de Gastos Excedido!</span>
            <span className="text-xs text-[#F5F5F7]/90">
              Você ultrapassou o teto em{' '}
              {limitesEstourados.map((l) => `"${l.goal.title}" (${formatCentsToBRL(l.current_cents - l.target_cents)} acima)`).join(', ')}.
            </span>
          </div>
        </div>
      )}

      {/* Barra de Ações e Filtro de Período */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
          <div className="grid grid-cols-4 gap-1 bg-[#0B0B0D] p-1 rounded-xl border border-[#262630] min-w-0">
            {[
              { id: 'todos', label: 'Todas' },
              { id: 'daily', label: 'Hoje' },
              { id: 'weekly', label: 'Semana' },
              { id: 'monthly', label: 'Mês' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltroPeriodo(tab.id as typeof filtroPeriodo)}
                className={[
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all truncate',
                  filtroPeriodo === tab.id
                    ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                    : 'text-[#9A9AA6] hover:text-white',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Botao
            variante="primario"
            tamanho="sm"
            icone={<Plus className="w-4 h-4" />}
            texto="Nova Meta"
            onClick={() => {
              setMetaEditando(null);
              setModalAberto(true);
            }}
          />
        </div>
      </Card>

      {/* Lista de Metas */}
      {carregando ? (
        <div className="text-center py-10 text-xs text-[#9A9AA6]">Carregando suas metas...</div>
      ) : progressosFiltrados.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8 space-y-2 min-w-0">
            <Target className="w-10 h-10 text-[#9A9AA6]/40 mx-auto" />
            <h3 className="text-sm font-bold text-white">Nenhuma meta neste filtro</h3>
            <p className="text-xs text-[#9A9AA6] max-w-sm mx-auto">
              Crie uma meta para acompanhar seus ganhos diários, limites de gastos ou metas de economia.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
          {progressosFiltrados.map((prog) => {
            const { goal } = prog;
            return (
              <Card key={goal.id} padding="md" bordaAnimada={prog.is_achieved}>
                <div className="flex flex-col gap-3 min-w-0">
                  {/* Barra de Progresso com Preenchimento Real */}
                  <GoalProgressBar progress={prog} />

                  {/* Ações da Meta */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#262630]/50 text-xs text-[#9A9AA6] min-w-0">
                    <span className="text-[11px] truncate capitalize">
                      Renovação: {goal.period === 'daily' ? 'Diária' : goal.period === 'weekly' ? 'Semanal' : 'Mensal'}
                      {goal.income_source_id && (
                        <span className="text-[#FF7A1A]"> • Fonte Exclusiva</span>
                      )}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAlternarAtiva(goal)}
                        className="p-1.5 rounded-lg text-[#9A9AA6] hover:text-white hover:bg-white/5 transition-colors"
                        title={goal.active ? 'Pausar meta' : 'Ativar meta'}
                      >
                        {goal.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-[#2EE59D]" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMetaEditando(goal);
                          setModalAberto(true);
                        }}
                        className="p-1.5 rounded-lg text-[#9A9AA6] hover:text-white hover:bg-white/5 transition-colors"
                        title="Editar meta"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExcluir(goal.id)}
                        className="p-1.5 rounded-lg text-[#9A9AA6] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
                        title="Excluir meta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Histórico de Conquistas & Medalhas */}
      {conquistas.length > 0 && (
        <Card padding="md">
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-4 h-4 text-[#FFC940] shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6] truncate">
                Quadro de Conquistas & Medalhas
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 min-w-0">
              {conquistas.slice(0, 8).map((c) => {
                const tierColor =
                  c.medal_tier === 'gold'
                    ? 'border-[#FFC940]/40 bg-[#FFC940]/10 text-[#FFC940]'
                    : c.medal_tier === 'silver'
                    ? 'border-[#9A9AA6]/40 bg-[#9A9AA6]/10 text-white'
                    : 'border-[#FF7A1A]/40 bg-[#FF7A1A]/10 text-[#FF7A1A]';

                const tierName =
                  c.medal_tier === 'gold' ? 'Ouro (150%+)' : c.medal_tier === 'silver' ? 'Prata (120%+)' : 'Bronze (100%)';

                return (
                  <div
                    key={c.id}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center gap-1 min-w-0 ${tierColor}`}
                  >
                    <Award className="w-6 h-6 shrink-0" />
                    <span className="text-[11px] font-extrabold truncate">{tierName}</span>
                    <span className="text-[10px] text-[#9A9AA6] truncate">
                      {new Date(c.achieved_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Modal de Criação / Edição */}
      <GoalFormModal
        aberto={modalAberto}
        metaEditando={metaEditando}
        fontes={fontes}
        aoSalvar={handleSalvarMeta}
        aoFechar={() => {
          setModalAberto(false);
          setMetaEditando(null);
        }}
      />
    </div>
  );
};
