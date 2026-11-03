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
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  ensureMyDefaults,
  fetchAccountBalances,
  fetchAccounts,
  fetchCategories,
  fetchPaymentMethods,
  fetchTransactions,
} from '../../api/supabase';
import type {
  Account,
  AccountBalance,
  Category,
  PaymentMethod,
  Transaction,
  TransactionKind,
} from '../../types/database';
import {
  formatDateTimeBR,
  getTodaySaoPauloBoundsISO,
} from '../../utils/format';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { BottomNav, type AbaNavegacao } from '../../components/ui/BottomNav';
import { Snackbar, type SnackbarMensagem } from '../../components/ui/Snackbar';
import { ConfigPage } from '../config/ConfigPage';
import { TransactionsPage } from '../transactions/TransactionsPage';
import {
  AuditHistoryModal,
  BatchIncomeModal,
  TransactionFormModal,
} from '../transactions/TransactionModals';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { APP_NAME, APP_VERSION } from '../../config/version';

export const HomePage: React.FC = () => {
  const { perfil, usuario, sair } = useAuth();
  const [aba, setAba] = useState<AbaNavegacao>('inicio');
  const [snackbar, setSnackbar] = useState<SnackbarMensagem | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);

  const [saldosContas, setSaldosContas] = useState<AccountBalance[]>([]);
  const [contas, setContas] = useState<Account[]>([]);
  const [formas, setFormas] = useState<PaymentMethod[]>([]);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [ultimosLancamentos, setUltimosLancamentos] = useState<Transaction[]>([]);
  const [resumoHoje, setResumoHoje] = useState({
    entradasLiquidasCents: 0,
    saidasCents: 0,
  });
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modais de Lançamento / Lote / Histórico
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [tipoNovoLancamento, setTipoNovoLancamento] =
    useState<TransactionKind>('income');
  const [lancamentoEditando, setLancamentoEditando] =
    useState<Transaction | null>(null);
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
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

      const [balances, accs, pms, cats, recentTx, todayTx] = await Promise.all([
        fetchAccountBalances(),
        fetchAccounts(),
        fetchPaymentMethods(),
        fetchCategories(),
        fetchTransactions({ page: 1, pageSize: 10 }),
        fetchTransactions({
          page: 1,
          pageSize: 500,
          startDateISO: startISO,
          endDateISO: endISO,
        }),
      ]);

      setSaldosContas(balances.filter((b) => !b.archived));
      setContas(accs);
      setFormas(pms);
      setCategorias(cats);
      setUltimosLancamentos(recentTx.data);

      // Cálculo de hoje (Transferências NÃO contam como entrada nem saída — PRD 4.4)
      let entradasHoje = 0;
      let saidasHoje = 0;
      for (const tx of todayTx.data) {
        if (tx.kind === 'income') entradasHoje += tx.net_cents;
        else if (tx.kind === 'expense') saidasHoje += tx.net_cents;
      }
      setResumoHoje({
        entradasLiquidasCents: entradasHoje,
        saidasCents: saidasHoje,
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

  const abrirNovoLancamento = (tipo: TransactionKind) => {
    setLancamentoEditando(null);
    setTipoNovoLancamento(tipo);
    setModalLancamentoAberto(true);
  };

  const abrirEditarLancamento = (tx: Transaction) => {
    setLancamentoEditando(tx);
    setTipoNovoLancamento(tx.kind);
    setModalLancamentoAberto(true);
  };

  const saldoTotalCents = saldosContas.reduce(
    (acc, b) => acc + (b.current_balance_cents || 0),
    0
  );
  const resultadoHojeCents =
    resumoHoje.entradasLiquidasCents - resumoHoje.saidasCents;

  const nomeConta = (id: string | null) =>
    contas.find((c) => c.id === id)?.name || 'Conta';
  const nomeForma = (id: string | null) =>
    formas.find((f) => f.id === id)?.name || 'Entrada';
  const dadosCategoria = (id: string | null) =>
    categorias.find((cat) => cat.id === id);

  return (
    <div className="min-h-screen w-full bg-[#0B0B0D] text-[#F5F5F7] pb-24">
      {/* Barra Superior */}
      <header className="sticky top-0 z-30 bg-[#0B0B0D]/85 backdrop-blur-xl border-b border-[#262630] px-3 sm:px-6 py-3">
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

      {/* Conteúdo Principal */}
      <main className="max-w-2xl mx-auto px-3 sm:px-6 pt-4 flex flex-col gap-4 min-w-0">
        {aba === 'inicio' && (
          <>
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

            {/* Atalhos Rápidos (4 botões grandes do PRD 4.7) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
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
                onClick={() => setModalLoteAberto(true)}
              />
            </div>

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

            {/* Últimos 10 Lançamentos (PRD 4.7) */}
            <div className="space-y-2.5 min-w-0">
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
                                tx.kind === 'income'
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
                              <p
                                className="text-xs sm:text-sm font-bold text-white truncate"
                                title={titulo}
                              >
                                {titulo}
                              </p>
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
          </>
        )}

        {aba === 'lancamentos' && (
          <TransactionsPage
            contas={contas}
            formas={formas}
            categorias={categorias}
            abrirNovoLancamento={abrirNovoLancamento}
            abrirLote={() => setModalLoteAberto(true)}
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

        {(aba === 'relatorios' || aba === 'metas') && (
          <Card bordaAnimada padding="lg">
            <div className="text-center py-6 space-y-2 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {aba === 'relatorios' && 'Relatórios e PDF (Fase 4)'}
                {aba === 'metas' && 'Metas e Conquistas (Fase 5)'}
              </h2>
              <p className="text-xs sm:text-sm text-[#9A9AA6] max-w-md mx-auto">
                Esta área será liberada na próxima fase do cronograma.
              </p>
            </div>
          </Card>
        )}

        {aba === 'config' && (
          <ConfigPage
            onShowToast={(t, tipo) => mostrarAviso(t, tipo)}
            onAccountsChanged={carregarDadosGerais}
          />
        )}

        {/* Rodapé com Versão Visível (Regra 10) */}
        <footer className="text-center py-4">
          <p className="text-xs text-[#9A9AA6]/70 truncate">
            {APP_NAME} • Versão{' '}
            <span className="text-[#FF7A1A] font-semibold">{APP_VERSION}</span>
          </p>
        </footer>
      </main>

      {/* Botão Flutuante de Ação Rápida (FASE 3 item 8) */}
      {(aba === 'inicio' || aba === 'lancamentos') && (
        <button
          type="button"
          onClick={() => abrirNovoLancamento('income')}
          title="Lançamento Rápido"
          aria-label="Lançamento Rápido"
          className="fixed bottom-20 right-4 sm:right-6 z-30 w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-gradient-to-r from-[#FF7A1A] to-[#FF9500] text-[#0B0B0D] shadow-[0_0_25px_rgba(255,122,26,0.5)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
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
            formas={formas}
            categorias={categorias}
            aoSalvarSucesso={(msg) => {
              mostrarAviso(msg, 'sucesso');
              carregarDadosGerais();
            }}
            aoErro={(msg) => mostrarAviso(msg, 'erro')}
          />

          <BatchIncomeModal
            aberto={modalLoteAberto}
            aoFechar={() => setModalLoteAberto(false)}
            contas={contas}
            formas={formas}
            aoSalvarSucesso={(msg) => {
              mostrarAviso(msg, 'sucesso');
              carregarDadosGerais();
            }}
            aoErro={(msg) => mostrarAviso(msg, 'erro')}
          />

          <AuditHistoryModal
            aberto={Boolean(lancamentoHistorico)}
            aoFechar={() => setLancamentoHistorico(null)}
            lancamento={lancamentoHistorico}
          />
        </>
      )}

      <BottomNav abaAtiva={aba} aoTrocarAba={setAba} />
      <Snackbar mensagem={snackbar} aoFechar={() => setSnackbar(null)} />
    </div>
  );
};
