import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Receipt,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Undo2,
  Trash2,
  Pencil,
  Plus,
  Filter,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  Account,
  Category,
  IncomeSource,
  InstallmentWithPurchase,
  InstallmentsSummary,
} from '../../types/database';
import {
  fetchInstallments,
  fetchInstallmentsSummary,
  payInstallment,
  unpayInstallment,
  deleteInstallmentPurchase,
  updateInstallmentDueDateOrAmount,
} from '../../api/supabase';
import {
  getDueSummary,
  getInstallmentStatus,
} from '../../utils/installmentsCalc';
import { formatCentsToBRL, formatDateTimeBR } from '../../utils/format';
import { scheduleInstallmentNotifications } from '../../services/notifications';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { Modal } from '../../components/ui/Modal';
import { CampoMoeda } from '../../components/ui/CampoMoeda';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { InstallmentPurchaseModal } from './InstallmentPurchaseModal';
import { useAuth } from '../auth/AuthContext';

export interface PayablesPageProps {
  contas: Account[];
  categorias: Category[];
  fontes: IncomeSource[];
  onShowToast: (texto: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  onRefreshData?: () => void;
}

type TabType = 'overdue' | 'pending' | 'paid';

export const PayablesPage: React.FC<PayablesPageProps> = ({
  contas,
  categorias,
  fontes,
  onShowToast,
  onRefreshData,
}) => {
  const { perfil } = useAuth();
  const [tab, setTab] = useState<TabType>('pending');
  const [installments, setInstallments] = useState<InstallmentWithPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterKind, setFilterKind] = useState<'all' | 'credit_card' | 'boleto'>('all');
  const [searchCardOrStore, setSearchCardOrStore] = useState('');

  // Modais
  const [modalNovaCompra, setModalNovaCompra] = useState(false);

  // Modal de Pagamento de Parcela
  const [modalPagarAberto, setModalPagarAberto] = useState(false);
  const [parcelaPagando, setParcelaPagando] = useState<InstallmentWithPurchase | null>(null);
  const [contaPagamentoId, setContaPagamentoId] = useState(contas[0]?.id || '');
  const [valorPagoCents, setValorPagoCents] = useState(0);
  const [dataPagamentoLocal, setDataPagamentoLocal] = useState(() => new Date().toISOString().slice(0, 10));
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  // Modal de Editar Parcela (data/valor/adiar)
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [parcelaEditando, setParcelaEditando] = useState<InstallmentWithPurchase | null>(null);
  const [novaDataVencimento, setNovaDataVencimento] = useState('');
  const [novoValorParcelaCents, setNovoValorParcelaCents] = useState(0);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Expansão de detalhes da compra
  const [comprasExpandidas, setComprasExpandidas] = useState<Record<string, boolean>>({});

  const hojeStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const carregarParcelas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInstallments();
      setInstallments(data);

      // Reagenda notificações locais para o APK Android
      scheduleInstallmentNotifications(
        data,
        perfil?.due_alerts_enabled ?? true,
        perfil?.due_alert_time ?? '09:00',
        perfil?.due_alert_days_before ?? 1
      );
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao carregar parcelas.', 'erro');
    } finally {
      setLoading(false);
    }
  }, [onShowToast, perfil]);

  useEffect(() => {
    carregarParcelas();
  }, [carregarParcelas]);

  // Resumo de Contas a Pagar
  const summary = useMemo(() => {
    return getDueSummary(installments, hojeStr);
  }, [installments, hojeStr]);

  // Filtra parcelas por aba e opções
  const parcelasFiltradas = useMemo(() => {
    return installments.filter((item) => {
      // Filtro de tipo
      if (filterKind !== 'all' && item.purchase?.kind !== filterKind) return false;

      // Filtro de texto (cartão ou loja ou título)
      if (searchCardOrStore.trim()) {
        const termo = searchCardOrStore.toLowerCase();
        const bateTitulo = item.purchase?.title.toLowerCase().includes(termo);
        const bateCard = item.purchase?.card_name?.toLowerCase().includes(termo);
        if (!bateTitulo && !bateCard) return false;
      }

      const st = getInstallmentStatus(item, hojeStr);
      if (tab === 'overdue') return st === 'overdue';
      if (tab === 'paid') return st === 'paid';
      return st === 'pending' || st === 'due_today';
    });
  }, [installments, tab, filterKind, searchCardOrStore, hojeStr]);

  // Agrupa parcelas por Mês de Vencimento (YYYY-MM)
  const gruposPorMes = useMemo(() => {
    const grupos: Record<string, { label: string; items: InstallmentWithPurchase[]; totalCents: number }> = {};

    for (const inst of parcelasFiltradas) {
      const monthKey = inst.due_date.slice(0, 7); // YYYY-MM
      if (!grupos[monthKey]) {
        const [ano, mes] = monthKey.split('-');
        const dataObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, 1);
        const label = dataObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        grupos[monthKey] = {
          label: label.charAt(0).toUpperCase() + label.slice(1),
          items: [],
          totalCents: 0,
        };
      }
      grupos[monthKey].items.push(inst);
      grupos[monthKey].totalCents += inst.amount_cents;
    }

    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [parcelasFiltradas]);

  // Abertura do modal de pagamento
  const abrirModalPagar = (inst: InstallmentWithPurchase) => {
    setParcelaPagando(inst);
    setContaPagamentoId(contas[0]?.id || '');
    setValorPagoCents(inst.amount_cents);
    setDataPagamentoLocal(new Date().toISOString().slice(0, 10));
    setModalPagarAberto(true);
  };

  const confirmarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelaPagando || !contaPagamentoId) return;

    setProcessandoPagamento(true);
    try {
      const paidAtISO = new Date(`${dataPagamentoLocal}T12:00:00-03:00`).toISOString();
      await payInstallment({
        installmentId: parcelaPagando.id,
        accountId: contaPagamentoId,
        paidAtISO,
        paidAmountCents: valorPagoCents,
      });

      onShowToast(`Parcela paga com sucesso! Saída de ${formatCentsToBRL(valorPagoCents)} registrada na conta.`, 'sucesso');
      setModalPagarAberto(false);
      await carregarParcelas();
      onRefreshData?.();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao registrar pagamento.', 'erro');
    } finally {
      setProcessandoPagamento(false);
    }
  };

  // Desfazer pagamento
  const handleDesfazerPagamento = async (inst: InstallmentWithPurchase) => {
    try {
      await unpayInstallment(inst.id);
      onShowToast('Pagamento desfeito! A parcela voltou para pendente e a saída foi cancelada.', 'info');
      await carregarParcelas();
      onRefreshData?.();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao desfazer pagamento.', 'erro');
    }
  };

  // Abrir modal de edição de parcela (adiar/valor)
  const abrirModalEditar = (inst: InstallmentWithPurchase) => {
    setParcelaEditando(inst);
    setNovaDataVencimento(inst.due_date);
    setNovoValorParcelaCents(inst.amount_cents);
    setModalEditarAberto(true);
  };

  const confirmarEdicaoParcela = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelaEditando) return;

    setSalvandoEdicao(true);
    try {
      await updateInstallmentDueDateOrAmount(parcelaEditando.id, {
        due_date: novaDataVencimento,
        amount_cents: novoValorParcelaCents,
      });

      onShowToast('Vencimento/valor da parcela atualizado com sucesso!', 'sucesso');
      setModalEditarAberto(false);
      await carregarParcelas();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao editar parcela.', 'erro');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Excluir compra (remove parcelas pendentes)
  const handleExcluirCompra = async (purchaseId: string, title: string) => {
    const confirmou = window.confirm(
      `Deseja realmente excluir a compra "${title}"?\n\nAs parcelas pendentes serão removidas. As parcelas já pagas continuarão registradas como saídas normais.`
    );
    if (!confirmou) return;

    try {
      await deleteInstallmentPurchase(purchaseId);
      onShowToast(`Compra "${title}" excluída.`, 'info');
      await carregarParcelas();
      onRefreshData?.();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao excluir compra.', 'erro');
    }
  };

  const alternarExpansaoCompra = (purchaseId: string) => {
    setComprasExpandidas((prev) => ({ ...prev, [purchaseId]: !prev[purchaseId] }));
  };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Faixa Vermelha de Atraso Crítico */}
      {summary.overdueCount > 0 && (
        <div className="p-3 sm:p-4 rounded-2xl bg-[#D62F25]/15 border border-[#D62F25]/40 flex items-center justify-between gap-3 shadow-lg shadow-[#D62F25]/10 animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#D62F25] text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white truncate">
                {summary.overdueCount} {summary.overdueCount === 1 ? 'conta atrasada' : 'contas atrasadas'}
              </h4>
              <p className="text-xs text-[#F5F5F7]/80 truncate">
                Total pendente em atraso: <strong>{formatCentsToBRL(summary.overdueCents)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab('overdue')}
            className="px-3 py-1.5 rounded-xl bg-[#D62F25] text-white text-xs font-bold shrink-0 hover:bg-[#D62F25]/90 transition-colors"
          >
            Ver Atrasadas
          </button>
        </div>
      )}

      {/* Cards de Resumo KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
        <div className="p-3 rounded-2xl bg-[#141418] border border-[#262630] text-center">
          <span className="text-[10px] sm:text-xs text-[#D62F25] font-bold uppercase tracking-wider block truncate">
            Atrasadas
          </span>
          <span className="text-base sm:text-lg font-black text-white tabular-nums block">
            {formatCentsToBRL(summary.overdueCents)}
          </span>
          <span className="text-[10px] text-[#9A9AA6] block">{summary.overdueCount} parcela(s)</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#141418] border border-[#262630] text-center">
          <span className="text-[10px] sm:text-xs text-[#FFC940] font-bold uppercase tracking-wider block truncate">
            Vencem Hoje
          </span>
          <span className="text-base sm:text-lg font-black text-white tabular-nums block">
            {formatCentsToBRL(summary.dueTodayCents)}
          </span>
          <span className="text-[10px] text-[#9A9AA6] block">{summary.dueTodayCount} parcela(s)</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#141418] border border-[#262630] text-center">
          <span className="text-[10px] sm:text-xs text-[#06B6D4] font-bold uppercase tracking-wider block truncate">
            Próximos 7 Dias
          </span>
          <span className="text-base sm:text-lg font-black text-white tabular-nums block">
            {formatCentsToBRL(summary.next7DaysCents)}
          </span>
          <span className="text-[10px] text-[#9A9AA6] block">{summary.next7DaysCount} parcela(s)</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#141418] border border-[#262630] text-center">
          <span className="text-[10px] sm:text-xs text-[#FF7A1A] font-bold uppercase tracking-wider block truncate">
            Total do Mês
          </span>
          <span className="text-base sm:text-lg font-black text-white tabular-nums block">
            {formatCentsToBRL(summary.monthTotalCents)}
          </span>
          <span className="text-[10px] text-[#9A9AA6] block">a vencer no mês</span>
        </div>
      </div>

      {/* Barra de Ações: Abas + Botão de Nova Compra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#141418] border border-[#262630] shrink-0">
          <button
            type="button"
            onClick={() => setTab('overdue')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'overdue'
                ? 'bg-[#D62F25] text-white shadow'
                : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            <span>Atrasadas</span>
            {summary.overdueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] text-white">
                {summary.overdueCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'pending'
                ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            <span>A Vencer</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('paid')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'paid'
                ? 'bg-[#0F9D6B] text-white shadow'
                : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            <span>Pagas</span>
          </button>
        </div>

        <Botao
          variante="primario"
          icone={<Plus className="w-4 h-4" />}
          texto="+ Nova Compra Parcelada"
          onClick={() => setModalNovaCompra(true)}
        />
      </div>

      {/* Filtros rápidos: Cartão vs Boleto e Busca */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between p-2.5 rounded-2xl bg-[#141418] border border-[#262630] min-w-0">
        <div className="flex gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterKind('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterKind === 'all' ? 'bg-white/15 text-white' : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFilterKind('credit_card')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterKind === 'credit_card' ? 'bg-white/15 text-white' : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            Cartão
          </button>
          <button
            type="button"
            onClick={() => setFilterKind('boleto')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterKind === 'boleto' ? 'bg-white/15 text-white' : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            Boleto
          </button>
        </div>

        <input
          type="text"
          value={searchCardOrStore}
          onChange={(e) => setSearchCardOrStore(e.target.value)}
          placeholder="Buscar por produto, cartão ou loja..."
          className="w-full sm:w-64 px-3 py-1.5 text-xs rounded-xl bg-[#0B0B0D] border border-[#262630] text-white placeholder-[#9A9AA6]/50 focus:outline-none focus:ring-1 focus:ring-[#FF7A1A]"
        />
      </div>

      {/* Lista Agrupada por Mês */}
      {loading ? (
        <Card>
          <p className="text-xs text-[#9A9AA6] py-6 text-center">Carregando contas a pagar...</p>
        </Card>
      ) : gruposPorMes.length === 0 ? (
        <Card>
          <p className="text-xs text-[#9A9AA6] py-8 text-center">
            {tab === 'overdue'
              ? 'Tudo em dia! Nenhuma conta atrasada no momento.'
              : tab === 'paid'
                ? 'Nenhuma parcela paga encontrada nos filtros selecionados.'
                : 'Nenhuma parcela a vencer encontrada.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {gruposPorMes.map(([monthKey, grupo]) => (
            <div key={monthKey} className="space-y-2">
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#FF7A1A]" />
                  {grupo.label}
                </span>
                <span className="text-[#9A9AA6]">
                  Total do Mês: <strong className="text-white">{formatCentsToBRL(grupo.totalCents)}</strong>
                </span>
              </div>

              <div className="space-y-2">
                {grupo.items.map((inst) => {
                  const statusCalc = getInstallmentStatus(inst, hojeStr);
                  const isOverdue = statusCalc === 'overdue';
                  const isDueToday = statusCalc === 'due_today';
                  const isPaid = statusCalc === 'paid';
                  const [ano, mes, dia] = inst.due_date.split('-');

                  return (
                    <Card key={inst.id} padding="sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                        {/* Identificação */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isPaid
                                ? 'bg-[#0F9D6B]/15 text-[#0F9D6B] border-[#0F9D6B]/30'
                                : isOverdue
                                  ? 'bg-[#D62F25]/15 text-[#D62F25] border-[#D62F25]/40 animate-pulse'
                                  : isDueToday
                                    ? 'bg-[#FFC940]/15 text-[#FFC940] border-[#FFC940]/40'
                                    : 'bg-white/5 text-white border-white/10'
                            }`}
                          >
                            {inst.purchase?.kind === 'credit_card' ? (
                              <CreditCard className="w-5 h-5" />
                            ) : (
                              <Receipt className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white truncate">
                                {inst.purchase?.title || 'Compra Parcelada'}
                              </h4>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white shrink-0">
                                {inst.number}/{inst.purchase?.installments_count || 1}
                              </span>
                            </div>

                            <p className="text-xs text-[#9A9AA6] truncate">
                              Vence: <strong>{dia}/{mes}/{ano}</strong>
                              {inst.purchase?.card_name && ` • ${inst.purchase.card_name}`}
                              {isOverdue && (
                                <span className="text-[#D62F25] font-bold ml-1.5">Atrasada!</span>
                              )}
                              {isDueToday && (
                                <span className="text-[#FFC940] font-bold ml-1.5">Vence Hoje!</span>
                              )}
                              {isPaid && (
                                <span className="text-[#0F9D6B] font-bold ml-1.5">Paga</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Valor e Ações */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#262630]/60">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-[#9A9AA6] block">
                              {isPaid ? 'Valor Pago' : 'Valor da Parcela'}
                            </span>
                            <ValorMoeda
                              centavos={isPaid && inst.paid_amount_cents ? inst.paid_amount_cents : inst.amount_cents}
                              tamanho="md"
                              cor={isPaid ? 'padrao' : isOverdue ? 'negativo' : 'destaque'}
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!isPaid ? (
                              <>
                                <Botao
                                  variante="primario"
                                  tamanho="sm"
                                  icone={<DollarSign className="w-3.5 h-3.5" />}
                                  texto="Pagar"
                                  onClick={() => abrirModalPagar(inst)}
                                />
                                <Botao
                                  variante="secundario"
                                  tamanho="sm"
                                  icone={<Pencil className="w-3.5 h-3.5" />}
                                  texto=""
                                  aria-label="Editar ou Adiar"
                                  onClick={() => abrirModalEditar(inst)}
                                />
                              </>
                            ) : (
                              <Botao
                                variante="fantasma"
                                tamanho="sm"
                                icone={<Undo2 className="w-3.5 h-3.5 text-[#FFC940]" />}
                                texto="Desfazer"
                                onClick={() => handleDesfazerPagamento(inst)}
                              />
                            )}

                            {inst.purchase && (
                              <button
                                type="button"
                                onClick={() => alternarExpansaoCompra(inst.purchase!.id)}
                                title="Ver todas as parcelas desta compra"
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs"
                              >
                                {comprasExpandidas[inst.purchase.id] ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visão Expandida de Todas as Parcelas daquela Compra */}
                      {inst.purchase && comprasExpandidas[inst.purchase.id] && (
                        <div className="mt-3 pt-3 border-t border-[#262630] space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">
                              Progresso da Compra: {inst.purchase.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleExcluirCompra(inst.purchase!.id, inst.purchase!.title)}
                              className="text-[11px] text-[#D62F25] hover:underline inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Excluir Compra</span>
                            </button>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            {installments
                              .filter((sub) => sub.purchase_id === inst.purchase_id)
                              .sort((a, b) => a.number - b.number)
                              .map((sub) => {
                                const subPaid = sub.status === 'paid';
                                return (
                                  <div
                                    key={sub.id}
                                    className="p-2 rounded-lg bg-[#0B0B0D] flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-[#FF7A1A]">
                                        #{sub.number}
                                      </span>
                                      <span className="text-[#9A9AA6]">
                                        Venc: {sub.due_date.split('-').reverse().join('/')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-white tabular-nums">
                                        {formatCentsToBRL(sub.amount_cents)}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          subPaid
                                            ? 'bg-[#0F9D6B]/20 text-[#0F9D6B]'
                                            : 'bg-white/10 text-white'
                                        }`}
                                      >
                                        {subPaid ? 'Paga' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE PAGAMENTO DE PARCELA */}
      <Modal
        aberto={modalPagarAberto}
        aoFechar={() => setModalPagarAberto(false)}
        titulo="Confirmar Pagamento de Parcela"
      >
        <form onSubmit={confirmarPagamento} className="flex flex-col gap-4 min-w-0">
          <div className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] space-y-1">
            <h4 className="text-sm font-bold text-white">
              {parcelaPagando?.purchase?.title}
            </h4>
            <p className="text-xs text-[#9A9AA6]">
              Parcela {parcelaPagando?.number} de {parcelaPagando?.purchase?.installments_count} • Vencimento: {parcelaPagando?.due_date.split('-').reverse().join('/')}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Conta de onde saiu o dinheiro
            </label>
            <select
              value={contaPagamentoId}
              onChange={(e) => setContaPagamentoId(e.target.value)}
              className="w-full min-h-[46px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-white text-sm"
              required
            >
              {contas.filter((c) => !c.archived).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Data do pagamento
            </label>
            <input
              type="date"
              value={dataPagamentoLocal}
              onChange={(e) => setDataPagamentoLocal(e.target.value)}
              className="w-full min-h-[46px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-white text-sm"
              required
            >
            </input>
          </div>

          <CampoMoeda
            rotulo="Valor efetivamente pago em R$ (pode ajustar por juros/desconto)"
            centavos={valorPagoCents}
            aoMudarCentavos={setValorPagoCents}
          />

          <div className="flex gap-2 pt-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalPagarAberto(false)}
            />
            <Botao
              type="submit"
              variante="primario"
              larguraTotal
              carregando={processandoPagamento}
              texto="Confirmar Pagamento"
            />
          </div>
        </form>
      </Modal>

      {/* MODAL DE EDITAR OU ADIAR PARCELA */}
      <Modal
        aberto={modalEditarAberto}
        aoFechar={() => setModalEditarAberto(false)}
        titulo="Editar Vencimento ou Valor da Parcela"
      >
        <form onSubmit={confirmarEdicaoParcela} className="flex flex-col gap-4 min-w-0">
          <div className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] space-y-1">
            <h4 className="text-sm font-bold text-white">
              {parcelaEditando?.purchase?.title}
            </h4>
            <p className="text-xs text-[#9A9AA6]">
              Parcela {parcelaEditando?.number} de {parcelaEditando?.purchase?.installments_count}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Nova data de vencimento (Adiar)
            </label>
            <input
              type="date"
              value={novaDataVencimento}
              onChange={(e) => setNovaDataVencimento(e.target.value)}
              className="w-full min-h-[46px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-white text-sm"
              required
            />
          </div>

          <CampoMoeda
            rotulo="Novo valor da parcela em R$"
            centavos={novoValorParcelaCents}
            aoMudarCentavos={setNovoValorParcelaCents}
          />

          <div className="flex gap-2 pt-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalEditarAberto(false)}
            />
            <Botao
              type="submit"
              variante="primario"
              larguraTotal
              carregando={salvandoEdicao}
              texto="Salvar Alterações"
            />
          </div>
        </form>
      </Modal>

      {/* MODAL DE CADASTRO DE NOVA COMPRA */}
      <InstallmentPurchaseModal
        aberto={modalNovaCompra}
        aoFechar={() => setModalNovaCompra(false)}
        contas={contas}
        categorias={categorias}
        fontes={fontes}
        aoSucesso={(msg) => {
          onShowToast(msg, 'sucesso');
          carregarParcelas();
          onRefreshData?.();
        }}
        aoErro={(msg) => onShowToast(msg, 'erro')}
      />
    </div>
  );
};

