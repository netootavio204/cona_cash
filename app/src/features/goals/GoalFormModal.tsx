import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import type { Goal, GoalKind, GoalPeriod, IncomeSource } from '../../types/database';
import { Modal } from '../../components/ui/Modal';
import { Campo } from '../../components/ui/Campo';
import { CampoMoeda } from '../../components/ui/CampoMoeda';
import { Botao } from '../../components/ui/Botao';

interface GoalFormModalProps {
  aberto: boolean;
  metaEditando: Goal | null;
  fontes: IncomeSource[];
  aoSalvar: (dados: {
    title: string;
    kind: GoalKind;
    period: GoalPeriod;
    target_cents: number;
    income_source_id: string | null;
    active: boolean;
  }) => Promise<void>;
  aoFechar: () => void;
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  aberto,
  metaEditando,
  fontes,
  aoSalvar,
  aoFechar,
}) => {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<GoalKind>('earning');
  const [periodo, setPeriodo] = useState<GoalPeriod>('daily');
  const [valorCentavos, setValorCentavos] = useState(15000); // R$ 150,00
  const [fonteId, setFonteId] = useState<string>('');
  const [ativa, setAtiva] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (metaEditando) {
      setTitulo(metaEditando.title);
      setTipo(metaEditando.kind);
      setPeriodo(metaEditando.period);
      setValorCentavos(metaEditando.target_cents);
      setFonteId(metaEditando.income_source_id || '');
      setAtiva(metaEditando.active);
    } else {
      setTitulo('');
      setTipo('earning');
      setPeriodo('daily');
      setValorCentavos(15000);
      setFonteId('');
      setAtiva(true);
    }
    setErro(null);
  }, [metaEditando, aberto]);

  const fontesDisponiveis = fontes.filter((f) => !f.archived && f.counts_as_earning);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const tituloLimpo = titulo.trim();
    if (!tituloLimpo) {
      setErro('Informe um título para a meta.');
      return;
    }

    if (!valorCentavos || valorCentavos <= 0) {
      setErro('O valor alvo precisa ser maior que zero.');
      return;
    }

    setSalvando(true);
    try {
      await aoSalvar({
        title: tituloLimpo,
        kind: tipo,
        period: periodo,
        target_cents: valorCentavos,
        income_source_id: tipo === 'earning' && fonteId ? fonteId : null,
        active: ativa,
      });
      aoFechar();
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
      setErro(err instanceof Error ? err.message : 'Falha ao salvar meta.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={metaEditando ? 'Editar Meta' : 'Nova Meta'}
    >
      <form noValidate onSubmit={submeter} className="flex flex-col gap-4 min-w-0">
        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Tipo de Meta */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-xs font-semibold text-[#9A9AA6]">Tipo de Meta</label>
          <div className="grid grid-cols-3 gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setTipo('earning')}
              className={[
                'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all min-w-0',
                tipo === 'earning'
                  ? 'bg-[#FF7A1A]/10 border-[#FF7A1A] text-white shadow-sm'
                  : 'bg-[#141419] border-[#262630] text-[#9A9AA6] hover:text-white',
              ].join(' ')}
            >
              <TrendingUp className="w-4 h-4 mb-1 text-[#2EE59D]" />
              <span className="text-xs font-bold truncate">Ganho</span>
            </button>

            <button
              type="button"
              onClick={() => setTipo('expense_limit')}
              className={[
                'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all min-w-0',
                tipo === 'expense_limit'
                  ? 'bg-[#FF7A1A]/10 border-[#FF7A1A] text-white shadow-sm'
                  : 'bg-[#141419] border-[#262630] text-[#9A9AA6] hover:text-white',
              ].join(' ')}
            >
              <ShieldAlert className="w-4 h-4 mb-1 text-[#FFC940]" />
              <span className="text-xs font-bold truncate">Limite Gasto</span>
            </button>

            <button
              type="button"
              onClick={() => setTipo('saving')}
              className={[
                'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all min-w-0',
                tipo === 'saving'
                  ? 'bg-[#FF7A1A]/10 border-[#FF7A1A] text-white shadow-sm'
                  : 'bg-[#141419] border-[#262630] text-[#9A9AA6] hover:text-white',
              ].join(' ')}
            >
              <Sparkles className="w-4 h-4 mb-1 text-[#38BDF8]" />
              <span className="text-xs font-bold truncate">Economia</span>
            </button>
          </div>
        </div>

        {/* Período */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-xs font-semibold text-[#9A9AA6]">Período de Renovação</label>
          <div className="grid grid-cols-3 gap-2 min-w-0">
            {(['daily', 'weekly', 'monthly'] as GoalPeriod[]).map((p) => {
              const label = p === 'daily' ? 'Diário' : p === 'weekly' ? 'Semanal' : 'Mensal';
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  className={[
                    'p-2 rounded-xl border text-xs font-bold transition-all truncate',
                    periodo === p
                      ? 'bg-[#FF7A1A] text-[#0B0B0D] border-[#FF7A1A]'
                      : 'bg-[#141419] border-[#262630] text-[#9A9AA6] hover:text-white',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Título da Meta */}
        <Campo
          rotulo="Título da Meta"
          placeholder="Ex: Meta Diária de Ganho, Teto Semanal..."
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
        />

        {/* Valor Alvo (Moeda) */}
        <CampoMoeda
          rotulo="Valor Alvo (R$)"
          centavos={valorCentavos}
          aoMudarCentavos={setValorCentavos}
        />

        {/* Fonte de Renda (Exclusivo se tipo for Ganho) */}
        {tipo === 'earning' && (
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs font-semibold text-[#9A9AA6]">
              Fonte de Renda (Opcional)
            </label>
            <select
              value={fonteId}
              onChange={(e) => setFonteId(e.target.value)}
              className="w-full bg-[#141419] border border-[#262630] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF7A1A] transition-colors"
            >
              <option value="">Todas as fontes de ganho (Geral)</option>
              {fontesDisponiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Ativa / Pausada */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#141419] border border-[#262630]">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white">Meta Ativa</span>
            <span className="text-[11px] text-[#9A9AA6]">
              Acompanhar progresso no painel principal
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAtiva(!ativa)}
            className={[
              'w-11 h-6 rounded-full transition-colors relative focus:outline-none',
              ativa ? 'bg-[#2EE59D]' : 'bg-[#262630]',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                ativa ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>

        {/* Ações do Modal */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262630]">
          <Botao
            type="button"
            variante="fantasma"
            texto="Cancelar"
            onClick={aoFechar}
            disabled={salvando}
          />
          <Botao
            type="submit"
            variante="primario"
            texto={metaEditando ? 'Salvar Alterações' : 'Criar Meta'}
            carregando={salvando}
          />
        </div>
      </form>
    </Modal>
  );
};
