import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  MinusCircle,
  ArrowRightLeft,
  Layers,
  Search,
  Trash2,
  RotateCcw,
  Pencil,
  History,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
  CheckCheck,
} from 'lucide-react';
import type {
  Account,
  Category,
  IncomeSource,
  PaymentMethod,
  Transaction,
  TransactionKind,
} from '../../types/database';
import {
  bulkAssignIncomeSource,
  fetchTransactions,
  restoreTransaction,
  softDeleteTransaction,
} from '../../api/supabase';
import {
  formatCentsToBRL,
  formatDateTimeBR,
  getTodaySaoPauloBoundsISO,
} from '../../utils/format';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { Modal } from '../../components/ui/Modal';
import { CategoryIcon } from '../../components/ui/CategoryIcon';

type PeriodoFiltro = 'todos' | 'hoje' | '7dias' | '30dias';

export interface TransactionsPageProps {
  contas: Account[];
  fontes: IncomeSource[];
  formas: PaymentMethod[];
  categorias: Category[];
  abrirNovoLancamento: (tipo: TransactionKind) => void;
  abrirLote: () => void;
  abrirEditarLancamento: (tx: Transaction) => void;
  abrirHistoricoLancamento: (tx: Transaction) => void;
  aoAlterarDados: () => void;
  mostrarSnackbarComDesfazer: (
    texto: string,
    aoDesfazer?: () => void
  ) => void;
  refreshTrigger: number;
}

const PAGE_SIZE = 50;

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  contas,
  fontes,
  formas,
  categorias,
  abrirNovoLancamento,
  abrirLote,
  abrirEditarLancamento,
  abrirHistoricoLancamento,
  aoAlterarDados,
  mostrarSnackbarComDesfazer,
  refreshTrigger,
}) => {
  const [lancamentos, setLancamentos] = useState<Transaction[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [modoLixeira, setModoLixeira] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<TransactionKind | 'all'>('all');
  const [filtroContaId, setFiltroContaId] = useState('');
  const [filtroFonteId, setFiltroFonteId] = useState('');
  const [filtroCategoriaId, setFiltroCategoriaId] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoFiltro>('todos');
  const [buscaTexto, setBuscaTexto] = useState('');

  // Modal de edição em massa para "Sem fonte"
  const [modalMassaAberto, setModalMassaAberto] = useState(false);
  const [fonteMassaId, setFonteMassaId] = useState('');
  const [salvandoMassa, setSalvandoMassa] = useState(false);

  // Modal de confirmação de exclusão
  const [txParaExcluir, setTxParaExcluir] = useState<Transaction | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const calcularIntervaloPeriodo = (
    p: PeriodoFiltro
  ): { startDateISO?: string; endDateISO?: string } => {
    if (p === 'todos') return {};
    const { startISO, endISO } = getTodaySaoPauloBoundsISO();
    if (p === 'hoje') {
      return { startDateISO: startISO, endDateISO: endISO };
    }
    const dias = p === '7dias' ? 7 : 30;
    const inicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    return { startDateISO: inicio, endDateISO: endISO };
  };

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const { startDateISO, endDateISO } = calcularIntervaloPeriodo(filtroPeriodo);
      const res = await fetchTransactions({
        page: pagina,
        pageSize: PAGE_SIZE,
        kind: filtroTipo,
        accountId: filtroContaId || undefined,
        categoryId: filtroCategoriaId || undefined,
        incomeSourceId: filtroFonteId || undefined,
        startDateISO,
        endDateISO,
        search: buscaTexto,
        onlyTrash: modoLixeira,
      });
      setLancamentos(res.data);
      setTotalRegistros(res.count);
    } catch (err) {
      console.error('Erro ao buscar lançamentos:', err);
    } finally {
      setCarregando(false);
    }
  }, [
    pagina,
    filtroTipo,
    filtroContaId,
    filtroFonteId,
    filtroCategoriaId,
    filtroPeriodo,
    buscaTexto,
    modoLixeira,
    refreshTrigger,
  ]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  const confirmarExclusao = async () => {
    if (!txParaExcluir) return;
    const idExcluido = txParaExcluir.id;
    setExcluindo(true);
    try {
      await softDeleteTransaction(idExcluido);
      setTxParaExcluir(null);
      await carregarLista();
      aoAlterarDados();

      // Mostra snackbar de 6 segundos com botão "Desfazer" (PRD 4.5)
      mostrarSnackbarComDesfazer(
        'Lançamento movido para a Lixeira.',
        async () => {
          await restoreTransaction(idExcluido);
          await carregarLista();
          aoAlterarDados();
        }
      );
    } finally {
      setExcluindo(false);
    }
  };

  const restaurarDaLixeira = async (tx: Transaction) => {
    await restoreTransaction(tx.id);
    await carregarLista();
    aoAlterarDados();
    mostrarSnackbarComDesfazer('Lançamento restaurado com sucesso!');
  };

  const nomeConta = (id: string | null) =>
    contas.find((c) => c.id === id)?.name || 'Conta';
  const nomeForma = (id: string | null) =>
    formas.find((f) => f.id === id)?.name || 'Entrada';
  const dadosCategoria = (id: string | null) =>
    categorias.find((cat) => cat.id === id);
  const dadosFonte = (id: string | null) =>
    fontes.find((src) => src.id === id);

  const entradasSemFonte = lancamentos.filter(
    (tx) => tx.kind === 'income' && !tx.income_source_id && !tx.deleted_at
  );
  const fontesAtivas = fontes.filter((s) => !s.archived);

  const abrirModalMassa = () => {
    setFonteMassaId(fontesAtivas[0]?.id || '');
    setModalMassaAberto(true);
  };

  const aplicarFonteEmMassa = async () => {
    if (!fonteMassaId || entradasSemFonte.length === 0) return;
    setSalvandoMassa(true);
    try {
      const ids = entradasSemFonte.map((t) => t.id);
      const qtd = await bulkAssignIncomeSource(ids, fonteMassaId);
      setModalMassaAberto(false);
      await carregarLista();
      aoAlterarDados();
      const nomeSrc = dadosFonte(fonteMassaId)?.name || 'Fonte';
      mostrarSnackbarComDesfazer(
        `${qtd} entrada(s) sem fonte atribuída(s) para "${nomeSrc}"!`
      );
    } finally {
      setSalvandoMassa(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Barra de Ações Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
        <Botao
          variante="primario"
          tamanho="sm"
          icone={<PlusCircle className="w-4 h-4" />}
          texto="+ Entrada"
          onClick={() => abrirNovoLancamento('income')}
        />
        <Botao
          variante="secundario"
          tamanho="sm"
          icone={<MinusCircle className="w-4 h-4 text-[#FF3B30]" />}
          texto="+ Saída"
          onClick={() => abrirNovoLancamento('expense')}
        />
        <Botao
          variante="secundario"
          tamanho="sm"
          icone={<ArrowRightLeft className="w-4 h-4 text-[#FFC940]" />}
          texto="Transferir"
          onClick={() => abrirNovoLancamento('transfer')}
        />
        <Botao
          variante="secundario"
          tamanho="sm"
          icone={<Layers className="w-4 h-4 text-[#2EE59D]" />}
          texto="Lote do dia"
          onClick={abrirLote}
        />
      </div>

      {/* Filtros e Busca na Observação */}
      <Card padding="md">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              {modoLixeira
                ? `Lixeira (${totalRegistros})`
                : `Lançamentos (${totalRegistros})`}
            </h2>

            <Botao
              variante={modoLixeira ? 'primario' : 'fantasma'}
              tamanho="sm"
              icone={<Trash2 className="w-4 h-4" />}
              texto={modoLixeira ? 'Voltar aos Ativos' : 'Ver Lixeira'}
              onClick={() => {
                setModoLixeira((v) => !v);
                setPagina(1);
              }}
            />
          </div>

          {/* Campo de busca por texto nas observações */}
          <div className="relative flex items-center min-w-0">
            <Search className="w-4 h-4 text-[#9A9AA6] absolute left-3.5 pointer-events-none" />
            <input
              type="search"
              value={buscaTexto}
              onChange={(e) => {
                setBuscaTexto(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar nas observações ou #tags..."
              className="w-full min-h-[44px] pl-10 pr-3.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs sm:text-sm text-white placeholder-[#9A9AA6]/60 focus:outline-none focus:border-[#FF7A1A]"
            />
          </div>

          {/* Chips de Tipo + Fonte + Conta + Categoria + Período */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-0">
            <select
              value={filtroTipo}
              onChange={(e) => {
                setFiltroTipo(e.target.value as any);
                setPagina(1);
              }}
              className="min-h-[40px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
            >
              <option value="all">Todos os tipos</option>
              <option value="income">Só Entradas</option>
              <option value="expense">Só Saídas</option>
              <option value="transfer">Só Transferências</option>
            </select>

            <select
              value={filtroFonteId}
              onChange={(e) => {
                setFiltroFonteId(e.target.value);
                setPagina(1);
              }}
              aria-label="Filtrar por fonte de renda"
              className="min-h-[40px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
            >
              <option value="">Todas as fontes</option>
              <option value="__none__">Sem fonte (antigos)</option>
              {fontes.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.name}
                  {!src.counts_as_earning ? ' (Aporte)' : ''}
                  {src.archived ? ' [Arq.]' : ''}
                </option>
              ))}
            </select>

            <select
              value={filtroContaId}
              onChange={(e) => {
                setFiltroContaId(e.target.value);
                setPagina(1);
              }}
              className="min-h-[40px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
            >
              <option value="">Todas as contas</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={filtroCategoriaId}
              onChange={(e) => {
                setFiltroCategoriaId(e.target.value);
                setPagina(1);
              }}
              className="min-h-[40px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
            >
              <option value="">Todas categorias</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={filtroPeriodo}
              onChange={(e) => {
                setFiltroPeriodo(e.target.value as PeriodoFiltro);
                setPagina(1);
              }}
              className="col-span-2 sm:col-span-1 min-h-[40px] px-2.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs text-white"
            >
              <option value="todos">Todo o período</option>
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="30dias">Últimos 30 dias</option>
            </select>
          </div>

          {/* Aviso de edição em massa quando houver entradas "Sem fonte" */}
          {!modoLixeira && entradasSemFonte.length > 0 && (
            <div className="p-2.5 rounded-xl bg-[#FF7A1A]/10 border border-[#FF7A1A]/30 flex flex-wrap items-center justify-between gap-2 min-w-0">
              <span className="text-xs text-[#F5F5F7] inline-flex items-center gap-1.5 min-w-0">
                <Briefcase className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" />
                <span className="truncate">
                  Há <strong>{entradasSemFonte.length}</strong> entrada(s) antiga(s) marcada(s) como <strong>&ldquo;Sem fonte&rdquo;</strong>.
                </span>
              </span>
              <Botao
                type="button"
                variante="secundario"
                tamanho="sm"
                icone={<CheckCheck className="w-3.5 h-3.5 text-[#FF7A1A]" />}
                texto="Definir fonte em massa"
                onClick={abrirModalMassa}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Lista de Lançamentos */}
      {carregando ? (
        <Card>
          <p className="text-xs text-[#9A9AA6]">Carregando lançamentos...</p>
        </Card>
      ) : lancamentos.length === 0 ? (
        <Card>
          <p className="text-xs sm:text-sm text-[#9A9AA6] text-center py-4">
            {modoLixeira
              ? 'Sua lixeira está vazia.'
              : 'Nenhum lançamento encontrado para os filtros selecionados.'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5 min-w-0">
          {lancamentos.map((tx) => {
            const cat = dadosCategoria(tx.category_id);
            const src = dadosFonte(tx.income_source_id);
            const isAporte = tx.kind === 'income' && src && !src.counts_as_earning;
            const tituloPrincipal =
              tx.kind === 'income'
                ? nomeForma(tx.payment_method_id)
                : tx.kind === 'expense'
                  ? cat?.name || 'Saída'
                  : 'Transferência';

            const subtituloConta =
              tx.kind === 'transfer'
                ? `${nomeConta(tx.account_id)} → ${nomeConta(tx.to_account_id)}`
                : nomeConta(tx.account_id);

            return (
              <Card key={tx.id} padding="sm">
                <div className="flex flex-col gap-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={[
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                          isAporte
                            ? 'bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#06B6D4]'
                            : tx.kind === 'income'
                              ? 'bg-[#2EE59D]/15 border-[#2EE59D]/40 text-[#2EE59D]'
                              : tx.kind === 'expense'
                                ? 'bg-[#FF3B30]/15 border-[#FF3B30]/40 text-[#FF3B30]'
                                : 'bg-[#FFC940]/15 border-[#FFC940]/40 text-[#FFC940]',
                        ].join(' ')}
                      >
                        {tx.kind === 'income' ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : tx.kind === 'expense' ? (
                          cat ? (
                            <CategoryIcon name={cat.icon} className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )
                        ) : (
                          <ArrowRightLeft className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span
                            className="text-xs sm:text-sm font-bold text-white truncate"
                            title={tituloPrincipal}
                          >
                            {tituloPrincipal}
                          </span>

                          {src ? (
                            <span
                              style={{
                                backgroundColor: `${src.color}20`,
                                borderColor: `${src.color}55`,
                                color: src.color,
                              }}
                              className="text-[10px] px-2 py-0.5 rounded-full border font-bold inline-flex items-center gap-1 max-w-[170px] truncate shrink-0"
                              title={src.name}
                            >
                              <span className="truncate">{src.name}</span>
                            </span>
                          ) : tx.kind === 'income' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#9A9AA6] font-semibold shrink-0">
                              Sem fonte
                            </span>
                          ) : null}

                          {isAporte && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 font-extrabold shrink-0">
                              APORTE
                            </span>
                          )}

                          {tx.batch_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF7A1A]/20 text-[#FF7A1A] font-bold shrink-0">
                              LOTE
                            </span>
                          )}
                        </div>
                        <p
                          className="text-xs text-[#9A9AA6] truncate"
                          title={subtituloConta}
                        >
                          {subtituloConta} • {formatDateTimeBR(tx.occurred_at)}
                        </p>
                        {tx.note && (
                          <p
                            className="text-xs text-[#F5F5F7]/90 truncate mt-0.5"
                            title={tx.note}
                          >
                            {tx.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <ValorMoeda
                        centavos={tx.net_cents}
                        tamanho="md"
                        cor={
                          tx.kind === 'income'
                            ? 'positivo'
                            : tx.kind === 'expense'
                              ? 'negativo'
                              : 'destaque'
                        }
                      />
                      {tx.kind === 'income' && tx.fee_cents > 0 && (
                        <span className="text-[10px] text-[#9A9AA6] block tabular-nums">
                          Bruto {formatCentsToBRL(tx.gross_cents)} (−
                          {formatCentsToBRL(tx.fee_cents)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações do lançamento */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#262630]/60">
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      icone={<History className="w-3.5 h-3.5" />}
                      texto="Histórico"
                      onClick={() => abrirHistoricoLancamento(tx)}
                    />
                    {!modoLixeira ? (
                      <>
                        <Botao
                          variante="secundario"
                          tamanho="sm"
                          icone={<Pencil className="w-3.5 h-3.5" />}
                          texto="Editar"
                          onClick={() => abrirEditarLancamento(tx)}
                        />
                        <Botao
                          variante="perigo"
                          tamanho="sm"
                          icone={<Trash2 className="w-3.5 h-3.5" />}
                          texto="Excluir"
                          onClick={() => setTxParaExcluir(tx)}
                        />
                      </>
                    ) : (
                      <Botao
                        variante="sucesso"
                        tamanho="sm"
                        icone={<RotateCcw className="w-3.5 h-3.5" />}
                        texto="Restaurar"
                        onClick={() => restaurarDaLixeira(tx)}
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Paginação (50 por página) */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <Botao
            variante="secundario"
            tamanho="sm"
            disabled={pagina <= 1}
            icone={<ChevronLeft className="w-4 h-4" />}
            texto="Anterior"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          />
          <span className="text-xs text-[#9A9AA6] font-medium">
            Página {pagina} de {totalPaginas}
          </span>
          <Botao
            variante="secundario"
            tamanho="sm"
            disabled={pagina >= totalPaginas}
            icone={<ChevronRight className="w-4 h-4" />}
            texto="Próxima"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          />
        </div>
      )}

      {/* Modal de edição em massa para atribuir fonte aos lançamentos "Sem fonte" */}
      <Modal
        aberto={modalMassaAberto}
        aoFechar={() => setModalMassaAberto(false)}
        titulo="Definir Fonte em Massa"
      >
        <div className="space-y-4 min-w-0">
          <p className="text-xs sm:text-sm text-[#9A9AA6] leading-relaxed">
            Escolha qual fonte de renda deseja aplicar às{' '}
            <strong className="text-white">{entradasSemFonte.length}</strong>{' '}
            entrada(s) listada(s) que estão como &ldquo;Sem fonte&rdquo;:
          </p>

          <select
            value={fonteMassaId}
            onChange={(e) => setFonteMassaId(e.target.value)}
            className="w-full min-h-[46px] px-3.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-sm text-white"
          >
            {fontesAtivas.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name}
                {!src.counts_as_earning ? ' (Aporte)' : ''}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalMassaAberto(false)}
            />
            <Botao
              type="button"
              variante="primario"
              larguraTotal
              carregando={salvandoMassa}
              texto="Aplicar a Todas"
              onClick={aplicarFonteEmMassa}
            />
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação antes de excluir (PRD 4.5) */}
      <Modal
        aberto={Boolean(txParaExcluir)}
        aoFechar={() => setTxParaExcluir(null)}
        titulo="Mover lançamento para a Lixeira?"
      >
        <div className="space-y-4 min-w-0">
          <p className="text-xs sm:text-sm text-[#9A9AA6] leading-relaxed">
            O lançamento sairá imediatamente dos seus saldos e relatórios, mas ficará guardado na Lixeira caso queira restaurar depois.
          </p>
          <div className="flex gap-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setTxParaExcluir(null)}
            />
            <Botao
              type="button"
              variante="perigo"
              larguraTotal
              carregando={excluindo}
              texto="Sim, mover para Lixeira"
              onClick={confirmarExclusao}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

