import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Calendar,
} from 'lucide-react';
import type {
  FinancialReportData,
  IncomeSource,
  Transaction,
  ExpenseItemReportRow,
} from '../../types/database';
import {
  fetchFinancialReport,
  fetchIncomeSources,
  fetchTransactions,
  fetchExpensesByItemReport,
} from '../../api/supabase';
import {
  formatCentsToBRL,
  getPeriodSaoPauloBoundsISO,
} from '../../utils/format';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { MiniBarChart } from '../../components/ui/MiniBarChart';
import { DonutChart } from '../../components/ui/DonutChart';
import { AppIcon } from '../../components/ui/iconLibrary';
import { ExpenseItemDetailModal } from '../../components/ui/ExpenseItemDetailModal';
import { exportReportToPDF } from '../../utils/exportPdf';
import { useAuth } from '../auth/AuthContext';

type TipoPeriodo = 'dia' | 'semana' | 'mes' | 'personalizado';

export const ReportsPage: React.FC = () => {
  const { perfil } = useAuth();
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('mes');
  const [dataRef, setDataRef] = useState<Date>(new Date());
  const [fonteFiltroId, setFonteFiltroId] = useState<string>('');
  const [fontes, setFontes] = useState<IncomeSource[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);

  // Intervalo personalizado
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [relatorioAtual, setRelatorioAtual] = useState<FinancialReportData | null>(null);
  const [relatorioAnterior, setRelatorioAnterior] = useState<FinancialReportData | null>(null);
  const [itensRelatorio, setItensRelatorio] = useState<ExpenseItemReportRow[]>([]);
  const [totalItensCentavos, setTotalItensCentavos] = useState(0);
  const [itemSelecionadoDetalhe, setItemSelecionadoDetalhe] = useState<string | null>(null);
  const [itemFiltroTexto, setItemFiltroTexto] = useState('');
  const [datasBounds, setDatasBounds] = useState<{ startISO: string; endISO: string }>({ startISO: '', endISO: '' });
  const [periodoLabel, setPeriodoLabel] = useState('');

  const weekStartsOn = perfil?.week_starts_on ?? 1;

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const listaFontes = await fetchIncomeSources();
      setFontes(listaFontes);

      let startISO = '';
      let endISO = '';
      let pStartISO = '';
      let pEndISO = '';
      let label = '';

      if (tipoPeriodo === 'personalizado') {
        startISO = new Date(`${customStart}T00:00:00.000-03:00`).toISOString();
        endISO = new Date(`${customEnd}T23:59:59.999-03:00`).toISOString();
        label = `De ${customStart.split('-').reverse().join('/')} a ${customEnd.split('-').reverse().join('/')}`;
      } else {
        const bounds = getPeriodSaoPauloBoundsISO(tipoPeriodo, dataRef, weekStartsOn);
        startISO = bounds.startISO;
        endISO = bounds.endISO;
        pStartISO = bounds.prevStartISO;
        pEndISO = bounds.prevEndISO;
        label = bounds.label;
      }

      setPeriodoLabel(label);
      setDatasBounds({ startISO, endISO });

      const [curReport, prevReport, itemReportData] = await Promise.all([
        fetchFinancialReport({
          startDateISO: startISO,
          endDateISO: endISO,
          incomeSourceId: fonteFiltroId || undefined,
        }),
        pStartISO
          ? fetchFinancialReport({
              startDateISO: pStartISO,
              endDateISO: pEndISO,
              incomeSourceId: fonteFiltroId || undefined,
            })
          : Promise.resolve(null),
        fetchExpensesByItemReport(startISO, endISO).catch((err) => {
          console.warn('Erro ao carregar ranking de itens:', err);
          return { total_expenses_cents: 0, items: [] };
        }),
      ]);

      setRelatorioAtual(curReport);
      setRelatorioAnterior(prevReport);
      setItensRelatorio(itemReportData.items || []);
      setTotalItensCentavos(itemReportData.total_expenses_cents || 0);
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setCarregando(false);
    }
  }, [tipoPeriodo, dataRef, fonteFiltroId, customStart, customEnd, weekStartsOn]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const navegarPeriodo = (direcao: -1 | 1) => {
    setDataRef((prev) => {
      const next = new Date(prev);
      if (tipoPeriodo === 'dia') {
        next.setDate(next.getDate() + direcao);
      } else if (tipoPeriodo === 'semana') {
        next.setDate(next.getDate() + direcao * 7);
      } else if (tipoPeriodo === 'mes') {
        next.setMonth(next.getMonth() + direcao);
      }
      return next;
    });
  };

  const handleExportarPDF = async () => {
    if (!relatorioAtual) return;
    setExportando(true);
    try {
      let startISO = '';
      let endISO = '';
      if (tipoPeriodo === 'personalizado') {
        startISO = new Date(`${customStart}T00:00:00.000-03:00`).toISOString();
        endISO = new Date(`${customEnd}T23:59:59.999-03:00`).toISOString();
      } else {
        const bounds = getPeriodSaoPauloBoundsISO(tipoPeriodo, dataRef, weekStartsOn);
        startISO = bounds.startISO;
        endISO = bounds.endISO;
      }

      const txs = await fetchTransactions({
        startDateISO: startISO,
        endDateISO: endISO,
        incomeSourceId: fonteFiltroId || undefined,
        pageSize: 1000,
      });

      const fonteNome = fontes.find((f) => f.id === fonteFiltroId)?.name;

      await exportReportToPDF({
        periodoLabel,
        dataInicioBR: new Date(startISO).toLocaleDateString('pt-BR'),
        dataFimBR: new Date(endISO).toLocaleDateString('pt-BR'),
        report: relatorioAtual,
        transacoes: txs.data,
        nomeUsuario: perfil?.name || 'Octavio',
        fonteSelecionadaNome: fonteNome,
        topItens: itensRelatorio,
      });
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
    } finally {
      setExportando(false);
    }
  };

  const totals = relatorioAtual?.totals;
  const prevTotals = relatorioAnterior?.totals;

  // Cálculo de variação vs período anterior
  const diffGanhosPct =
    prevTotals && prevTotals.net_earnings_cents > 0
      ? Math.round(
          ((totals!.net_earnings_cents - prevTotals.net_earnings_cents) /
            prevTotals.net_earnings_cents) *
            100
        )
      : null;

  // Preparar dados para o MiniBarChart diário
  const barData = (relatorioAtual?.daily || []).map((d) => ({
    label: d.day.slice(8, 10) + '/' + d.day.slice(5, 7),
    valueCents: d.earnings_net_cents,
    secondaryCents: d.expenses_cents,
  }));

  // Preparar dados para DonutChart de Categorias
  const donutCatItems = (relatorioAtual?.by_category || []).map((c) => ({
    id: c.category_id,
    name: c.category_name,
    cents: c.total_cents,
    color: c.category_color,
  }));

  // Preparar dados para DonutChart de Fontes
  const donutSourceItems = (relatorioAtual?.by_source || [])
    .filter((s) => s.counts_as_earning && s.earnings_net_cents > 0)
    .map((s) => ({
      id: s.source_id,
      name: s.source_name,
      cents: s.earnings_net_cents,
      color: s.source_color,
    }));

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Controles de Período e Filtros */}
      <Card padding="md">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            {/* Seletor de Tipo de Período */}
            <div className="grid grid-cols-4 gap-1 bg-[#0B0B0D] p-1 rounded-xl border border-[#262630] min-w-0">
              {[
                { id: 'dia', rotulo: 'Dia' },
                { id: 'semana', rotulo: 'Semana' },
                { id: 'mes', rotulo: 'Mês' },
                { id: 'personalizado', rotulo: 'Personalizado' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTipoPeriodo(p.id as TipoPeriodo)}
                  className={[
                    'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all truncate',
                    tipoPeriodo === p.id
                      ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                      : 'text-[#9A9AA6] hover:text-white',
                  ].join(' ')}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>

            {/* Botão de Exportar PDF */}
            <Botao
              variante="primario"
              tamanho="sm"
              carregando={exportando}
              icone={<Download className="w-4 h-4" />}
              texto="Exportar PDF"
              onClick={handleExportarPDF}
            />
          </div>

          {/* Navegação de Data ou Seletor Personalizado */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#262630]/60 min-w-0">
            {tipoPeriodo !== 'personalizado' ? (
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => navegarPeriodo(-1)}
                  className="p-1.5 rounded-lg text-[#9A9AA6] hover:text-white hover:bg-white/5"
                  title="Período anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-4 h-4 text-[#FF7A1A] shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {periodoLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navegarPeriodo(1)}
                  className="p-1.5 rounded-lg text-[#9A9AA6] hover:text-white hover:bg-white/5"
                  title="Próximo período"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="min-h-[38px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
                />
                <span className="text-xs text-[#9A9AA6]">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="min-h-[38px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
                />
              </div>
            )}

            {/* Filtro por Fonte de Renda */}
            <div className="w-full sm:w-auto min-w-[200px]">
              <select
                value={fonteFiltroId}
                onChange={(e) => setFonteFiltroId(e.target.value)}
                aria-label="Filtrar relatório por fonte"
                className="w-full min-h-[38px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
              >
                <option value="">Todas as Fontes de Renda</option>
                {fontes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {!f.counts_as_earning ? '(Aporte)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {carregando ? (
        <Card>
          <p className="text-xs text-[#9A9AA6] py-6 text-center">
            Processando cálculos e relatórios...
          </p>
        </Card>
      ) : totals ? (
        <div className="flex flex-col gap-4 min-w-0">
          {/* CARDS DE TOTAIS / KPIS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
            {/* Ganhos Líquidos */}
            <Card padding="sm">
              <span className="text-[11px] text-[#9A9AA6] block truncate">
                Ganhos Líquidos
              </span>
              <ValorMoeda
                centavos={totals.net_earnings_cents}
                tamanho="md"
                cor="positivo"
              />
              {diffGanhosPct !== null && (
                <div className="flex items-center gap-1 mt-1 text-[10px]">
                  {diffGanhosPct >= 0 ? (
                    <span className="text-[#2EE59D] flex items-center">
                      <TrendingUp className="w-3 h-3 mr-0.5" /> +{diffGanhosPct}%
                    </span>
                  ) : (
                    <span className="text-[#FF3B30] flex items-center">
                      <TrendingDown className="w-3 h-3 mr-0.5" /> {diffGanhosPct}%
                    </span>
                  )}
                  <span className="text-[#9A9AA6]/70 truncate">vs anterior</span>
                </div>
              )}
            </Card>

            {/* Total Saídas */}
            <Card padding="sm">
              <span className="text-[11px] text-[#9A9AA6] block truncate">
                Total de Saídas
              </span>
              <ValorMoeda
                centavos={totals.expenses_cents}
                tamanho="md"
                cor="negativo"
              />
              <span className="text-[10px] text-[#9A9AA6] block mt-1">
                Taxas: {formatCentsToBRL(totals.fees_cents)}
              </span>
            </Card>

            {/* Resultado Líquido */}
            <Card padding="sm">
              <span className="text-[11px] text-[#9A9AA6] block truncate">
                Resultado Líquido
              </span>
              <ValorMoeda
                centavos={totals.net_result_cents}
                tamanho="md"
                cor={totals.net_result_cents >= 0 ? 'destaque' : 'negativo'}
              />
              <span className="text-[10px] text-[#9A9AA6] block mt-1">
                Ganhos − Saídas
              </span>
            </Card>

            {/* Aportes (À Parte) */}
            <Card padding="sm">
              <span className="text-[11px] text-[#9A9AA6] block truncate">
                Aportes (À parte)
              </span>
              <ValorMoeda
                centavos={totals.contributions_cents}
                tamanho="md"
                cor="padrao"
              />
              <span className="text-[10px] text-[#06B6D4] block mt-1 font-semibold">
                Não infla ganhos
              </span>
            </Card>
          </div>

          {/* DESEMPENHO E LUCRO REAL POR FONTE DE RENDA */}
          <Card padding="md">
            <div className="flex flex-col gap-3 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-4 h-4 text-[#FF7A1A]" />
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
                    Lucro Real por Fonte de Renda
                  </h3>
                </div>
                <span className="text-[11px] text-[#9A9AA6]">
                  Ganhos Líq. − Custos Diretos
                </span>
              </div>

              {relatorioAtual?.by_source.length === 0 ? (
                <p className="text-xs text-[#9A9AA6] py-2">
                  Nenhum lançamento vinculado a fontes de renda neste período.
                </p>
              ) : (
                <div className="flex flex-col gap-2 min-w-0">
                  {relatorioAtual?.by_source.map((src) => {
                    const isAporte = !src.counts_as_earning;
                    return (
                      <div
                        key={src.source_id}
                        className="p-2.5 rounded-xl bg-[#0B0B0D] border border-[#262630] flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            style={{
                              backgroundColor: `${src.source_color}20`,
                              borderColor: `${src.source_color}55`,
                              color: src.source_color,
                            }}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 font-bold"
                          >
                            <Briefcase className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs sm:text-sm font-bold text-white truncate">
                                {src.source_name}
                              </span>
                              {isAporte && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-[#06B6D4]/20 text-[#06B6D4] font-bold">
                                  APORTE
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#9A9AA6]">
                              {src.count} lançamento(s) • Custos:{' '}
                              {formatCentsToBRL(src.direct_expenses_cents)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-[#9A9AA6] block">
                            Lucro Líquido
                          </span>
                          <ValorMoeda
                            centavos={src.profit_cents}
                            tamanho="sm"
                            cor={src.profit_cents >= 0 ? 'positivo' : 'negativo'}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* RANKING: GASTOS POR ITEM (NOVO v1.2 — PARTE D) */}
          <Card padding="md">
            <div className="space-y-3 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
                    Gastos por Item Comprado
                  </h3>
                  <p className="text-xs text-[#9A9AA6] truncate">
                    Ranking de compras do período ({itensRelatorio.length} itens)
                  </p>
                </div>

                {/* Filtro por nome do item */}
                <div className="w-full sm:w-60">
                  <input
                    type="text"
                    value={itemFiltroTexto}
                    onChange={(e) => setItemFiltroTexto(e.target.value)}
                    placeholder="Filtrar por item..."
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-[#0B0B0D] border border-[#262630] text-white placeholder-[#9A9AA6]/50 focus:outline-none focus:ring-1 focus:ring-[#FF7A1A]"
                  />
                </div>
              </div>

              {itensRelatorio.length === 0 ? (
                <p className="text-xs text-[#9A9AA6] py-4 text-center">
                  Nenhum gasto por item registrado neste período.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {itensRelatorio
                    .filter((it) =>
                      itemFiltroTexto
                        ? it.item_name.toLowerCase().includes(itemFiltroTexto.toLowerCase())
                        : true
                    )
                    .map((item, index) => (
                      <button
                        key={item.item_id || `item-null-${index}`}
                        type="button"
                        onClick={() => item.item_id && setItemSelecionadoDetalhe(item.item_id)}
                        className="w-full p-2.5 rounded-xl bg-[#0B0B0D] border border-[#262630] flex items-center justify-between gap-3 text-left hover:border-[#FF7A1A]/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-[#9A9AA6] w-5 text-center shrink-0">
                            #{index + 1}
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center shrink-0 group-hover:text-[#FF7A1A]">
                            <AppIcon name={item.item_icon} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">
                              {item.item_name}
                            </span>
                            <span className="text-[10px] text-[#9A9AA6] block truncate">
                              {item.count} compra(s) • Média: {formatCentsToBRL(item.average_cents)}
                              {item.category_name ? ` • ${item.category_name}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <ValorMoeda
                            centavos={item.total_cents}
                            tamanho="sm"
                            cor="negativo"
                          />
                          <span className="text-[10px] text-[#FFC940] font-medium block">
                            {item.percentage}%
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </Card>

          {/* GRÁFICOS: EVOLUÇÃO DIÁRIA + DISTRIBUIÇÃO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
            {/* Gráfico de Barras Diário */}
            <div className="lg:col-span-7">
              <Card padding="md">
                <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
                    Evolução no Período
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] text-[#9A9AA6]">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-[#FF7A1A]" /> Ganhos
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-[#FF3B30]" /> Saídas
                    </span>
                  </div>
                </div>
                <MiniBarChart data={barData} height={150} />
              </Card>
            </div>

            {/* Gráfico de Rosca: Gastos por Categoria */}
            <div className="lg:col-span-5">
              <Card padding="md">
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider mb-2 truncate">
                  Despesas por Categoria
                </h3>
                <DonutChart
                  items={donutCatItems}
                  size={150}
                  strokeWidth={20}
                  centerText={formatCentsToBRL(totals.expenses_cents)}
                  centerSubtext="Total de Saídas"
                />
                <div className="flex flex-wrap gap-2 justify-center mt-3 pt-2 border-t border-[#262630]/60">
                  {donutCatItems.slice(0, 4).map((c) => (
                    <span
                      key={c.id}
                      className="text-[10px] text-[#9A9AA6] inline-flex items-center gap-1"
                    >
                      <span
                        style={{ backgroundColor: c.color }}
                        className="w-2 h-2 rounded-full"
                      />
                      <span className="truncate max-w-[90px]">{c.name}</span>
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Detalhe do Item de Saída */}
      <ExpenseItemDetailModal
        aberto={!!itemSelecionadoDetalhe}
        aoFechar={() => setItemSelecionadoDetalhe(null)}
        itemId={itemSelecionadoDetalhe}
        startDateISO={datasBounds.startISO}
        endDateISO={datasBounds.endISO}
      />
    </div>
  );
};

