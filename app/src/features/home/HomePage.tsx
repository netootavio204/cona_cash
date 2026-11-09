import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlusCircle,
  MinusCircle,
  ArrowRightLeft,
  Layers,
  ShieldCheck,
  LogOut,
  Landmark,
  Banknote,
  Settings,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  History,
  Target,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  ensureMyDefaults,
  fetchAccountBalances,
  fetchAccounts,
  fetchCategories,
  fetchIncomeSources,
  fetchPaymentMethods,
  fetchTransactions,
  fetchFinancialReport,
} from '../../api/supabase';
import type {
  Account,
  AccountBalance,
  Category,
  IncomeSource,
  PaymentMethod,
  Transaction,
  TransactionKind,
} from '../../types/database';
import {
  formatCentsToBRL,
  formatDateTimeBR,
  getTodaySaoPauloBoundsISO,
  sumEarningsAndExpenses,
} from '../../utils/format';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { BottomNav, type AbaNavegacao } from '../../components/ui/BottomNav';
import { PwaInstallPrompt } from '../../components/ui/PwaInstallPrompt';
import { Sidebar } from '../../components/ui/Sidebar';
import { Snackbar, type SnackbarMensagem } from '../../components/ui/Snackbar';
import { ConfigPage, type SecaoConfig } from '../config/ConfigPage';
import { ReportsPage } from '../reports/ReportsPage';
import { GoalsPage } from '../goals/GoalsPage';
import { GoalProgressBar } from '../../components/ui/GoalProgressBar';
import { calculateGoalProgress } from '../../utils/goalProgress';
import { fetchGoals, ensureMyGoals } from '../../api/supabase';
import type { Goal, GoalProgress } from '../../types/database';
import { MiniBarChart } from '../../components/ui/MiniBarChart';
import { DonutChart } from '../../components/ui/DonutChart';
import type { FinancialReportData } from '../../types/database';
import { TransactionsPage } from '../transactions/TransactionsPage';
import {
  AuditHistoryModal,
  BatchIncomeModal,
  TransactionFormModal,
} from '../transactions/TransactionModals';
import { DailyBatchTwoStagesModals } from '../transactions/DailyBatchTwoStagesModals';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { APP_NAME, APP_VERSION } from '../../config/version';

export const HomePage: React.FC = () => {
  const { perfil, usuario, sair } = useAuth();
  const [aba, setAba] = useState<AbaNavegacao>('inicio');
  const [secaoConfigForcada, setSecaoConfigForcada] =
    useState<SecaoConfig | null>(null);
  const [sidebarRecolhida, setSidebarRecolhida] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('cona_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [snackbar, setSnackbar] = useState<SnackbarMensagem | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);

  const alternarSidebarRecolhida = () => {
    setSidebarRecolhida((atual) => {
      const novo = !atual;
      try {
        window.localStorage.setItem('cona_sidebar_collapsed', String(novo));
      } catch {
        // Ignora erro de localStorage
      }
      return novo;
    });
  };

  const [saldosContas, setSaldosContas] = useState<AccountBalance[]>([]);
  const [contas, setContas] = useState<Account[]>([]);
  const [fontes, setFontes] = useState<IncomeSource[]>([]);
  const [formas, setFormas] = useState<PaymentMethod[]>([]);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [ultimosLancamentos, setUltimosLancamentos] = useState<Transaction[]>([]);
  const [resumoHoje, setResumoHoje] = useState({
    entradasLiquidasCents: 0,
    saidasCents: 0,
  });
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [relatorio7Dias, setRelatorio7Dias] = useState<FinancialReportData | null>(null);
  const [metas, setMetas] = useState<Goal[]>([]);
  const [todasTransacoes, setTodasTransacoes] = useState<Transaction[]>([]);

  // Modais de Lançamento / Lote / Histórico
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [tipoNovoLancamento, setTipoNovoLancamento] =
    useState<TransactionKind>('income');
  const [lancamentoEditando, setLancamentoEditando] =
    useState<Transaction | null>(null);
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [modoLote, setModoLote] = useState<'novo' | 'distribuir'>('novo');
  const [lancamentoHistorico, setLancamentoHistorico] =
    useState<Transaction | null>(null);

  const isAdmin = perfil?.role === 'admin' && perfil?.status === 'approved';

  const mostrarAviso = useCallback(
    (
      texto: string,
      tipo: 'sucesso' | 'erro' | 'info' = 'info',
      acaoTexto?: string,
      aoClicarAcao?: () => void
    ) => {
      if (snackbarTimerRef.current) {
        window.clearTimeout(snackbarTimerRef.current);
      }
      setSnackbar({
        id: String(Date.now()),
        texto,
        tipo,
        acaoTexto,
        aoClicarAcao: aoClicarAcao
          ? () => {
              aoClicarAcao();
              setSnackbar(null);
            }
          : undefined,
      });
      snackbarTimerRef.current = window.setTimeout(() => {
        setSnackbar(null);
      }, 6000);
    },
    []
  );

  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('/admin') || hash.includes('admin')) {
      if (!isAdmin) {
        window.history.replaceState(null, '', '/');
        mostrarAviso('Acesso negado: área exclusiva para administradores.', 'erro');
      } else {
        setAba('config');
      }
    }
  }, [isAdmin, mostrarAviso]);

  const carregarDadosGerais = useCallback(async () => {
    setCarregandoDados(true);
    try {
      await ensureMyDefaults();
      const { startISO, endISO } = getTodaySaoPauloBoundsISO();

      const agora = new Date();
      const seteDiasAtras = new Date(agora.getTime() - 6 * 24 * 60 * 60 * 1000);
      const start7 = seteDiasAtras.toISOString().slice(0, 10);
      const end7 = agora.toISOString().slice(0, 10);

      await ensureMyGoals().catch(() => {});
      const [balances, accs, srcs, pms, cats, recentTx, todayTx, rep7, userGoals, allTx] =
        await Promise.all([
          fetchAccountBalances(),
          fetchAccounts(),
          fetchIncomeSources(),
          fetchPaymentMethods(),
          fetchCategories(),
          fetchTransactions({ page: 1, pageSize: 10 }),
          fetchTransactions({
            page: 1,
            pageSize: 500,
            startDateISO: startISO,
            endDateISO: endISO,
          }),
          fetchFinancialReport({ startDateISO: start7, endDateISO: end7 }).catch(() => null),
          fetchGoals().catch(() => []),
          fetchTransactions({ page: 1, pageSize: 1000 }).catch(() => ({ data: [] })),
        ]);

      setMetas(userGoals);
      setTodasTransacoes(allTx.data);

      if (rep7) {
        setRelatorio7Dias(rep7);
      }

      setSaldosContas(balances.filter((b) => !b.archived));
      setContas(accs);
      setFontes(srcs);
      setFormas(pms);
      setCategorias(cats);
      setUltimosLancamentos(recentTx.data);

      // Cálculo de hoje (Transferências e Aportes NÃO contam nos totais de ganho — PRD 3 & 4.4)
      const { entradasGanhoCents, saidasCents } = sumEarningsAndExpenses(
        todayTx.data,
        srcs
      );
      setResumoHoje({
        entradasLiquidasCents: entradasGanhoCents,
        saidasCents,
      });
      setRefreshTrigger((n) => n + 1);
    } catch (err) {
      console.error('Erro ao carregar dados gerais:', err);
    } finally {
      setCarregandoDados(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosGerais();
  }, [carregarDadosGerais]);

  const abrirNovoLancamento = useCallback((tipo: TransactionKind) => {
    setLancamentoEditando(null);
    setTipoNovoLancamento(tipo);
    setModalLancamentoAberto(true);
  }, []);

  const abrirEditarLancamento = (tx: Transaction) => {
    setLancamentoEditando(tx);
    setTipoNovoLancamento(tx.kind);
    setModalLancamentoAberto(true);
  };

  // Atalhos de teclado no desktop (N = Nova Entrada, S = Nova Saída, T = Transferir, L = Lote do dia)
  useEffect(() => {
    const aoPressionarTecla = (e: KeyboardEvent) => {
      if (window.innerWidth < 1024) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (
        modalLancamentoAberto ||
        modalLoteAberto ||
        Boolean(lancamentoHistorico)
      ) {
        return;
      }
      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName.toUpperCase();
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          el.isContentEditable
        ) {
          return;
        }
      }

      const k = e.key.toLowerCase();
      if (k === 'n') {
        e.preventDefault();
        abrirNovoLancamento('income');
      } else if (k === 's') {
        e.preventDefault();
        abrirNovoLancamento('expense');
      } else if (k === 't') {
        e.preventDefault();
        abrirNovoLancamento('transfer');
      } else if (k === 'l') {
        e.preventDefault();
        setModoLote('novo');
        setModalLoteAberto(true);
      }
    };
    window.addEventListener('keydown', aoPressionarTecla);
    return () => window.removeEventListener('keydown', aoPressionarTecla);
  }, [
    abrirNovoLancamento,
    modalLancamentoAberto,
    modalLoteAberto,
    lancamentoHistorico,
  ]);

  const saldoTotalCents = saldosContas.reduce(
    (acc, b) => acc + (b.current_balance_cents || 0),
    0
  );
  const contaADistribuir = saldosContas.find(
    (b) =>
      (b.is_system && b.system_kind === 'pending') ||
      b.account_name.toLowerCase().includes('distribuir')
  );
  const saldoADistribuirCents = contaADistribuir
    ? contaADistribuir.current_balance_cents
    : 0;
  const resultadoHojeCents =
    resumoHoje.entradasLiquidasCents - resumoHoje.saidasCents;

  const nomeConta = (id: string | null) =>
    contas.find((c) => c.id === id)?.name || 'Conta';
  const nomeForma = (id: string | null) =>
    formas.find((f) => f.id === id)?.name || 'Entrada';
  const dadosCategoria = (id: string | null) =>
    categorias.find((cat) => cat.id === id);
  const dadosFonte = (id: string | null) =>
    fontes.find((src) => src.id === id);

  const infoPaginaAtual: Record<
    AbaNavegacao,
    { titulo: string; subtitulo: string }
  > = {
    inicio: {
      titulo: 'Início',
      subtitulo: 'Visão geral das contas, ganhos de hoje e últimos lançamentos',
    },
    lancamentos: {
      titulo: 'Lançamentos',
      subtitulo: 'Histórico completo, filtros por fonte e auditoria',
    },
    relatorios: {
      titulo: 'Relatórios',
      subtitulo: 'Análises detalhadas por fonte de renda e exportação em PDF',
    },
    metas: {
      titulo: 'Metas',
      subtitulo: 'Acompanhamento de objetivos diários, semanais e mensais',
    },
    config: {
      titulo: 'Configurações',
      subtitulo: 'Contas, fontes de renda, formas de pagamento, categorias e painel admin',
    },
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0B0D] text-[#F5F5F7] pb-24 lg:pb-0 lg:flex">
      {/* Sidebar Lateral (apenas Desktop/TV >= 1024 px) */}
      <Sidebar
        abaAtiva={aba}
        aoTrocarAba={setAba}
        aoAbrirAdmin={() => {
          setSecaoConfigForcada('admin');
          setAba('config');
        }}
        recolhida={sidebarRecolhida}
        aoAlternarRecolhida={alternarSidebarRecolhida}
        nomeUsuario={perfil?.name || 'Octavio'}
        isAdmin={Boolean(isAdmin)}
        aoSair={sair}
      />

      <div
        className={[
          'contents lg:flex-1 lg:min-w-0 lg:flex lg:flex-col transition-[margin-left] duration-200',
          sidebarRecolhida
            ? 'lg:ml-[76px] min-[1920px]:ml-[88px]'
            : 'lg:ml-[248px] min-[1920px]:ml-[288px]',
        ].join(' ')}
      >
        {/* Barra Superior Mobile/Tablet (< 1024 px) — 100% INTACTA */}
        <header className="sticky top-0 z-30 bg-[#0B0B0D]/85 backdrop-blur-xl border-b border-[#262630] px-3 sm:px-6 py-3 lg:hidden">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logos/logo_dark.png"
                alt="Cona Cash"
                className="w-10 h-10 rounded-xl bg-black p-0.5 border border-[#FF7A1A]/40 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-extrabold text-sm sm:text-base text-white truncate">
                    {APP_NAME}
                  </span>
                  {isAdmin && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FF7A1A]/20 text-[#FF7A1A] border border-[#FF7A1A]/40 shrink-0">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9A9AA6] truncate">
                  Olá, {perfil?.name || 'Octavio'}
                </p>
              </div>
            </div>

            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={sair}
              icone={<LogOut className="w-4 h-4" />}
              texto="Sair"
            />
          </div>
        </header>

        {/* Barra Superior Desktop/TV (>= 1024 px) com título e ações rápidas */}
        <header className="hidden lg:flex sticky top-0 z-30 bg-[#0B0B0D]/90 backdrop-blur-xl border-b border-[#262630] px-8 py-4 items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-white truncate">
              {infoPaginaAtual[aba].titulo}
            </h1>
            <p className="text-xs text-[#9A9AA6] truncate">
              {infoPaginaAtual[aba].subtitulo}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="px-3.5 py-1.5 rounded-xl bg-[#141418] border border-[#262630] flex items-center gap-2 mr-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA6]">
                Saldo Total:
              </span>
              <ValorMoeda
                centavos={saldoTotalCents}
                tamanho="sm"
                cor={saldoTotalCents >= 0 ? 'positivo' : 'negativo'}
              />
            </div>

            <Botao
              variante="primario"
              tamanho="sm"
              icone={<PlusCircle className="w-4 h-4" />}
              texto="+ Entrada (N)"
              onClick={() => abrirNovoLancamento('income')}
            />
            <Botao
              variante="secundario"
              tamanho="sm"
              icone={<MinusCircle className="w-4 h-4 text-[#FF3B30]" />}
              texto="+ Saída (S)"
              onClick={() => abrirNovoLancamento('expense')}
            />
            <Botao
              variante="secundario"
              tamanho="sm"
              icone={<ArrowRightLeft className="w-4 h-4 text-[#FFC940]" />}
              texto="Transferir (T)"
              onClick={() => abrirNovoLancamento('transfer')}
            />
            <Botao
              variante="secundario"
              tamanho="sm"
              icone={<Layers className="w-4 h-4 text-[#2EE59D]" />}
              texto="Lote do dia (L)"
              onClick={() => {
                setModoLote('novo');
                setModalLoteAberto(true);
              }}
            />
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="max-w-2xl mx-auto px-3 sm:px-6 pt-4 flex flex-col gap-4 min-w-0 lg:max-w-[1440px] lg:w-full lg:px-8 lg:pt-6 lg:pb-8 lg:gap-6">
          {aba === 'inicio' && (
            <div className="contents lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
              <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6 lg:min-w-0">
                {/* Card Principal de Saldo Total + Resumo de Hoje */}
                <Card bordaAnimada padding="lg">
                  <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9AA6] truncate">
                      Saldo Total nas Contas
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#2EE59D] bg-[#2EE59D]/10 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Em tempo real
                    </span>
                  </div>

                  <ValorMoeda
                    centavos={saldoTotalCents}
                    tamanho="xl"
                    cor={saldoTotalCents >= 0 ? 'padrao' : 'negativo'}
                    className="my-1"
                  />

                  <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-[#262630]/80 min-w-0">
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#9A9AA6] block truncate">
                        Entradas hoje
                      </span>
                      <ValorMoeda
                        centavos={resumoHoje.entradasLiquidasCents}
                        tamanho="sm"
                        cor="positivo"
                        compacto
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#9A9AA6] block truncate">
                        Saídas hoje
                      </span>
                      <ValorMoeda
                        centavos={resumoHoje.saidasCents}
                        tamanho="sm"
                        cor="negativo"
                        compacto
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#9A9AA6] block truncate">
                        Resultado hoje
                      </span>
                      <ValorMoeda
                        centavos={resultadoHojeCents}
                        tamanho="sm"
                        cor={resultadoHojeCents >= 0 ? 'destaque' : 'negativo'}
                        compacto
                      />
                    </div>
                  </div>
                </Card>

                {/* Card em destaque de valor A Distribuir (Fase 7 - PRD 4.2B e 4.7) */}
                {saldoADistribuirCents > 0 && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#FFC940]/15 via-[#FF7A1A]/10 to-[#141419] border border-[#FFC940]/40 flex items-center justify-between gap-3 shadow-lg shadow-[#FFC940]/5 animate-fadeIn">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FFC940]/20 text-[#FFC940] flex items-center justify-center shrink-0 border border-[#FFC940]/40">
                        <Layers className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] sm:text-xs font-bold text-[#FFC940] uppercase tracking-wider block">
                          A Distribuir
                        </span>
                        <span className="text-lg sm:text-xl font-black text-[#F5F5F7] tabular-nums truncate block">
                          {formatCentsToBRL(saldoADistribuirCents)}
                        </span>
                        <span className="text-[11px] text-[#9A9AA6] truncate block">
                          Receitas aguardando destino nas contas
                        </span>
                      </div>
                    </div>
                    <Botao
                      variante="primario"
                      tamanho="sm"
                      texto="Distribuir"
                      onClick={() => {
                        setModoLote('distribuir');
                        setModalLoteAberto(true);
                      }}
                      className="shrink-0"
                    />
                  </div>
                )}

                {/* Atalhos Rápidos (4 botões grandes do PRD 4.7) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 min-w-0">
                  <Botao
                    variante="primario"
                    icone={<PlusCircle className="w-4 h-4" />}
                    texto="+ Entrada"
                    onClick={() => abrirNovoLancamento('income')}
                  />
                  <Botao
                    variante="secundario"
                    icone={<MinusCircle className="w-4 h-4 text-[#FF3B30]" />}
                    texto="+ Saída"
                    onClick={() => abrirNovoLancamento('expense')}
                  />
                  <Botao
                    variante="secundario"
                    icone={<ArrowRightLeft className="w-4 h-4 text-[#FFC940]" />}
                    texto="Transferir"
                    onClick={() => abrirNovoLancamento('transfer')}
                  />
                  <Botao
                    variante="secundario"
                    icone={<Layers className="w-4 h-4 text-[#2EE59D]" />}
                    texto="Lote do dia"
                    onClick={() => {
                      setModoLote('novo');
                      setModalLoteAberto(true);
                    }}
                  />
                </div>

                {/* BLOCOS DA FASE 4: GANHOS POR DIA & LUCRO POR FONTE */}
                {relatorio7Dias && (
                  <div className="space-y-4 min-w-0">
                    {/* Gráfico de Evolução 7 Dias */}
                    <Card padding="md">
                      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6] truncate">
                          Ganhos nos Últimos 7 Dias
                        </h3>
                        <span className="text-[10px] text-[#2EE59D] font-bold">
                          R$ {(relatorio7Dias.totals.net_earnings_cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <MiniBarChart
                        data={relatorio7Dias.daily.map((d) => ({
                          label: d.day.slice(8, 10) + '/' + d.day.slice(5, 7),
                          valueCents: d.earnings_net_cents,
                          secondaryCents: d.expenses_cents,
                        }))}
                        height={110}
                      />
                    </Card>

                    {/* Resumo e Lucro por Fonte */}
                    {relatorio7Dias.by_source.length > 0 && (
                      <Card padding="md">
                        <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6] truncate">
                            Lucro por Fonte (7 dias)
                          </h3>
                          <button
                            type="button"
                            onClick={() => setAba('relatorios')}
                            className="text-xs text-[#FF7A1A] font-semibold hover:underline"
                          >
                            Ver detalhes
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-0">
                          {relatorio7Dias.by_source.slice(0, 4).map((s) => (
                            <div
                              key={s.source_id}
                              className="flex items-center justify-between gap-2 py-1 border-b border-[#262630]/40 last:border-0 min-w-0"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  style={{ backgroundColor: s.source_color }}
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                />
                                <span className="text-xs text-white truncate max-w-[130px]">
                                  {s.source_name}
                                </span>
                              </div>
                              <span
                                className={[
                                  'text-xs font-bold tabular-nums shrink-0',
                                  s.profit_cents >= 0 ? 'text-[#2EE59D]' : 'text-[#FF3B30]',
                                ].join(' ')}
                              >
                                R$ {(s.profit_cents / 100).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* BLOCO DA FASE 5: METAS EM DESTAQUE NO DASHBOARD */}
                {metas.filter((m) => m.active).length > 0 && (
                  <Card padding="md">
                    <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Target className="w-4 h-4 text-[#FF7A1A] shrink-0" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6] truncate">
                          Metas em Andamento
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAba('metas')}
                        className="text-xs text-[#FF7A1A] font-semibold hover:underline"
                      >
                        Ver todas
                      </button>
                    </div>
                    <div className="flex flex-col gap-3 min-w-0">
                      {metas
                        .filter((m) => m.active)
                        .slice(0, 2)
                        .map((meta) => {
                          const prog = calculateGoalProgress(
                            meta,
                            todasTransacoes,
                            fontes,
                            new Date(),
                            perfil?.week_starts_on ?? 1
                          );
                          return <GoalProgressBar key={meta.id} progress={prog} compact />;
                        })}
                    </div>
                  </Card>
                )}

                {/* Cards de Saldo por Conta */}
                <div className="space-y-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 px-1 min-w-0">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6] truncate">
                      Saldo por Conta ({saldosContas.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setAba('config')}
                      className="text-xs text-[#FF7A1A] font-semibold inline-flex items-center gap-1 hover:underline shrink-0"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Gerenciar</span>
                    </button>
                  </div>

                  {carregandoDados ? (
                    <Card>
                      <p className="text-xs text-[#9A9AA6]">Calculando saldos...</p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 min-w-0">
                      {saldosContas.map((b) => (
                        <Card
                          key={b.account_id}
                          padding="sm"
                          onClick={() => setAba('lancamentos')}
                        >
                          <div className="flex items-center gap-2 mb-1.5 min-w-0">
                            <span
                              style={{
                                backgroundColor: `${b.account_color}20`,
                                color: b.account_color,
                              }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            >
                              {b.account_type === 'cash' ? (
                                <Banknote className="w-4 h-4" />
                              ) : (
                                <Landmark className="w-4 h-4" />
                              )}
                            </span>
                            <span
                              className="text-xs font-bold text-white truncate min-w-0"
                              title={b.account_name}
                            >
                              {b.account_name}
                            </span>
                          </div>

                          <ValorMoeda
                            centavos={b.current_balance_cents}
                            compacto
                            tamanho="md"
                            cor={b.current_balance_cents >= 0 ? 'padrao' : 'negativo'}
                          />
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Últimos 10 Lançamentos (PRD 4.7) */}
              <div className="space-y-2.5 min-w-0 lg:col-span-7">
                <div className="flex items-center justify-between gap-2 px-1 min-w-0">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6] truncate">
                    Últimos Lançamentos
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAba('lancamentos')}
                    className="text-xs text-[#FF7A1A] font-semibold hover:underline shrink-0"
                  >
                    Ver todos ({ultimosLancamentos.length})
                  </button>
                </div>

                {ultimosLancamentos.length === 0 ? (
                  <Card>
                    <p className="text-xs text-[#9A9AA6] text-center py-3">
                      Ainda não há lançamentos. Toque em <strong>+ Entrada</strong> ou{' '}
                      <strong>+ Saída</strong> acima para começar!
                    </p>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-2 min-w-0">
                    {ultimosLancamentos.map((tx) => {
                      const cat = dadosCategoria(tx.category_id);
                      const src = dadosFonte(tx.income_source_id);
                      const isAporte =
                        tx.kind === 'income' && src && !src.counts_as_earning;
                      const titulo =
                        tx.kind === 'income'
                          ? nomeForma(tx.payment_method_id)
                          : tx.kind === 'expense'
                            ? cat?.name || 'Saída'
                            : `${nomeConta(tx.account_id)} → ${nomeConta(tx.to_account_id)}`;

                      return (
                        <Card key={tx.id} padding="sm">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={[
                                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                  isAporte
                                    ? 'bg-[#06B6D4]/15 text-[#06B6D4]'
                                    : tx.kind === 'income'
                                      ? 'bg-[#2EE59D]/15 text-[#2EE59D]'
                                      : tx.kind === 'expense'
                                        ? 'bg-[#FF3B30]/15 text-[#FF3B30]'
                                        : 'bg-[#FFC940]/15 text-[#FFC940]',
                                ].join(' ')}
                              >
                                {tx.kind === 'income' ? (
                                  <ArrowDownLeft className="w-4 h-4" />
                                ) : tx.kind === 'expense' ? (
                                  cat ? (
                                    <CategoryIcon
                                      name={cat.icon}
                                      className="w-4 h-4"
                                    />
                                  ) : (
                                    <ArrowUpRight className="w-4 h-4" />
                                  )
                                ) : (
                                  <ArrowRightLeft className="w-4 h-4" />
                                )}
                              </span>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  <p
                                    className="text-xs sm:text-sm font-bold text-white truncate"
                                    title={titulo}
                                  >
                                    {titulo}
                                  </p>
                                  {src ? (
                                    <span
                                      style={{
                                        backgroundColor: `${src.color}20`,
                                        borderColor: `${src.color}55`,
                                        color: src.color,
                                      }}
                                      className="text-[10px] px-1.5 py-0.5 rounded-full border font-bold max-w-[140px] truncate shrink-0"
                                      title={src.name}
                                    >
                                      {src.name}
                                    </span>
                                  ) : tx.kind === 'income' ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[#9A9AA6] font-semibold shrink-0">
                                      Sem fonte
                                    </span>
                                  ) : null}
                                  {isAporte && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#06B6D4]/20 text-[#06B6D4] font-bold shrink-0">
                                      APORTE
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#9A9AA6] truncate">
                                  {tx.kind !== 'transfer' && `${nomeConta(tx.account_id)} • `}
                                  {formatDateTimeBR(tx.occurred_at)}
                                  {tx.note ? ` • ${tx.note}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <ValorMoeda
                                centavos={tx.net_cents}
                                tamanho="sm"
                                cor={
                                  tx.kind === 'income'
                                    ? 'positivo'
                                    : tx.kind === 'expense'
                                      ? 'negativo'
                                      : 'destaque'
                                }
                              />
                              <button
                                type="button"
                                onClick={() => abrirEditarLancamento(tx)}
                                title="Editar lançamento"
                                className="p-1.5 text-[#9A9AA6] hover:text-white"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setLancamentoHistorico(tx)}
                                title="Ver histórico de auditoria"
                                className="p-1.5 text-[#9A9AA6] hover:text-[#FF7A1A]"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {aba === 'lancamentos' && (
            <TransactionsPage
              contas={contas}
              fontes={fontes}
              formas={formas}
              categorias={categorias}
              abrirNovoLancamento={abrirNovoLancamento}
              abrirLote={() => {
                setModoLote('novo');
                setModalLoteAberto(true);
              }}
              abrirEditarLancamento={abrirEditarLancamento}
              abrirHistoricoLancamento={(tx) => setLancamentoHistorico(tx)}
              aoAlterarDados={carregarDadosGerais}
              mostrarSnackbarComDesfazer={(texto, aoDesfazer) =>
                mostrarAviso(
                  texto,
                  'info',
                  aoDesfazer ? 'Desfazer' : undefined,
                  aoDesfazer
                )
              }
              refreshTrigger={refreshTrigger}
            />
          )}

          {aba === 'relatorios' && (
            <ReportsPage />
          )}

          {aba === 'metas' && (
            <GoalsPage
              transactions={todasTransacoes}
              fontes={fontes}
              onShowToast={mostrarAviso}
              onRefreshData={carregarDadosGerais}
            />
          )}

          {aba === 'config' && (
            <ConfigPage
              onShowToast={mostrarAviso}
              onAccountsChanged={carregarDadosGerais}
              secaoForcada={secaoConfigForcada}
              aoConsumirSecaoForcada={() => setSecaoConfigForcada(null)}
            />
          )}

          {/* Rodapé com Versão Visível (Regra 10) */}
          <footer className="text-center py-4 lg:hidden">
            <p className="text-xs text-[#9A9AA6]/70 truncate">
              {APP_NAME} • Versão{' '}
              <span className="text-[#FF7A1A] font-semibold">{APP_VERSION}</span>
            </p>
          </footer>
        </main>
      </div>

      {/* Botão Flutuante de Ação Rápida (FASE 3 item 8 — Mobile/Tablet; no Desktop os botões estão fixos na barra superior) */}
      {(aba === 'inicio' || aba === 'lancamentos') && (
        <button
          type="button"
          onClick={() => abrirNovoLancamento('income')}
          title="Lançamento Rápido"
          aria-label="Lançamento Rápido"
          className="fixed bottom-20 right-4 sm:right-6 z-30 w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-gradient-to-r from-[#FF7A1A] to-[#FF9500] text-[#0B0B0D] shadow-[0_0_25px_rgba(255,122,26,0.5)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform lg:hidden"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Modais de Lançamento, Lote e Histórico */}
      {usuario && (
        <>
          <TransactionFormModal
            aberto={modalLancamentoAberto}
            aoFechar={() => setModalLancamentoAberto(false)}
            userId={usuario.id}
            tipoInicial={tipoNovoLancamento}
            lancamentoEditando={lancamentoEditando}
            contas={contas}
            fontes={fontes}
            formas={formas}
            categorias={categorias}
            quickTags={perfil?.quick_tags}
            aoSalvarSucesso={(msg) => {
              mostrarAviso(msg, 'sucesso');
              carregarDadosGerais();
            }}
            aoErro={(msg) => mostrarAviso(msg, 'erro')}
          />

          <DailyBatchTwoStagesModals
            aberto={modalLoteAberto}
            aoFechar={() => setModalLoteAberto(false)}
            contas={contas}
            fontes={fontes}
            formas={formas}
            modoInicial={modoLote}
            aoSucesso={(msg) => {
              mostrarAviso(msg, 'sucesso');
              carregarDadosGerais();
            }}
            aoErro={(msg) => mostrarAviso(msg, 'erro')}
            aoRecarregarDados={carregarDadosGerais}
          />

          <AuditHistoryModal
            aberto={Boolean(lancamentoHistorico)}
            aoFechar={() => setLancamentoHistorico(null)}
            lancamento={lancamentoHistorico}
          />
        </>
      )}

      <PwaInstallPrompt />
      <BottomNav abaAtiva={aba} aoTrocarAba={setAba} />
      <Snackbar mensagem={snackbar} aoFechar={() => setSnackbar(null)} />
    </div>
  );
};
