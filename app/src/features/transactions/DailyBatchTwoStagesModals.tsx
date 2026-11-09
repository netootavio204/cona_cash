import React, { useEffect, useState } from 'react';
import { Botao } from '../../components/ui/Botao';
import { Campo } from '../../components/ui/Campo';
import { CampoMoeda } from '../../components/ui/CampoMoeda';
import { Modal } from '../../components/ui/Modal';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import {
  formatCentsToBRL,
  toSaoPauloDateOnly,
  calculateFeeAndNetFromPercent,
} from '../../utils/format';
import {
  createDailyBatchTwoStages,
  distributeBatchLine,
  undistributePart,
  fetchDailyBatches,
} from '../../api/supabase';
import type {
  Account,
  DailyBatch,
  DailyBatchLine,
  IncomeSource,
  PaymentMethod,
} from '../../types/database';

interface LinhaNovoLote {
  id: string;
  grossCents: number;
  incomeSourceId: string;
  note: string;
}

export interface DailyBatchModalsProps {
  aberto: boolean;
  aoFechar: () => void;
  contas: Account[];
  fontes: IncomeSource[];
  formas: PaymentMethod[];
  modoInicial?: 'novo' | 'distribuir';
  loteIdParaDistribuir?: string | null;
  aoSucesso: (mensagem: string) => void;
  aoErro: (mensagem: string) => void;
  aoRecarregarDados: () => void;
}

export const DailyBatchTwoStagesModals: React.FC<DailyBatchModalsProps> = ({
  aberto,
  aoFechar,
  contas,
  fontes,
  formas,
  modoInicial = 'novo',
  loteIdParaDistribuir = null,
  aoSucesso,
  aoErro,
  aoRecarregarDados,
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'lista' | 'distribuir'>(modoInicial);
  const [dataLote, setDataLote] = useState(toSaoPauloDateOnly());
  const [observacaoLote, setObservacaoLote] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [lotes, setLotes] = useState<DailyBatch[]>([]);
  const [carregandoLotes, setCarregandoLotes] = useState(false);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState<string | null>(loteIdParaDistribuir);

  const contasAtivas = contas.filter((c) => !c.archived && !c.is_system);
  const fontesAtivas = fontes.filter((s) => !s.archived);
  const formasAtivas = formas.filter((f) => !f.archived);

  // Linhas do novo lote bruto
  const criarLinhaVazia = (idx: number): LinhaNovoLote => ({
    id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    grossCents: 0,
    incomeSourceId: fontesAtivas[idx % Math.max(1, fontesAtivas.length)]?.id || '',
    note: '',
  });

  const [linhasNovoLote, setLinhasNovoLote] = useState<LinhaNovoLote[]>([]);

  // Carrega lotes do banco
  const carregarLotes = async () => {
    setCarregandoLotes(true);
    try {
      const dados = await fetchDailyBatches();
      setLotes(dados);
      if (loteIdParaDistribuir) {
        setLoteSelecionadoId(loteIdParaDistribuir);
      } else if (dados.length > 0 && !loteSelecionadoId) {
        const primeiroPendente = dados.find((l) => l.status !== 'distributed') || dados[0];
        setLoteSelecionadoId(primeiroPendente.batch_id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar lotes:', err);
    } finally {
      setCarregandoLotes(false);
    }
  };

  useEffect(() => {
    if (aberto) {
      setAbaAtiva(modoInicial);
      setDataLote(toSaoPauloDateOnly());
      setObservacaoLote('Fechamento do dia');
      setLinhasNovoLote([
        criarLinhaVazia(0),
        criarLinhaVazia(1),
        criarLinhaVazia(2),
        criarLinhaVazia(3),
        criarLinhaVazia(4),
      ]);
      carregarLotes();
    }
  }, [aberto, modoInicial, loteIdParaDistribuir]);

  // Atualização das linhas do novo lote
  const atualizarLinha = (id: string, parcial: Partial<LinhaNovoLote>) => {
    setLinhasNovoLote((atuais) =>
      atuais.map((l) => (l.id === id ? { ...l, ...parcial } : l))
    );
  };

  const adicionarLinha = () => {
    setLinhasNovoLote((atuais) => [...atuais, criarLinhaVazia(atuais.length)]);
  };

  const removerLinha = (id: string) => {
    if (linhasNovoLote.length <= 1) return;
    setLinhasNovoLote((atuais) => atuais.filter((l) => l.id !== id));
  };

  const linhasPreenchidas = linhasNovoLote.filter((l) => l.grossCents > 0);
  const totalBrutoNovoLote = linhasPreenchidas.reduce((acc, l) => acc + l.grossCents, 0);

  // Submissão do Novo Lote Bruto (Etapa 1)
  const salvarNovoLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linhasPreenchidas.length === 0) {
      aoErro('Preencha o valor em pelo menos uma linha do lote.');
      return;
    }

    setSalvando(true);
    try {
      const batchId = await createDailyBatchTwoStages({
        work_date: dataLote,
        note: observacaoLote,
        lines: linhasPreenchidas.map((l) => ({
          gross_cents: l.grossCents,
          income_source_id: l.incomeSourceId || null,
          note: l.note || observacaoLote,
        })),
      });

      aoSucesso(
        `Lote bruto de ${formatCentsToBRL(totalBrutoNovoLote)} registrado com sucesso! O valor está em "A distribuir".`
      );
      aoRecarregarDados();
      await carregarLotes();
      setLoteSelecionadoId(batchId);
      setAbaAtiva('distribuir');
    } catch (err: any) {
      aoErro(err?.message || 'Erro ao salvar novo lote.');
    } finally {
      setSalvando(false);
    }
  };

  // Estados da Etapa 2 (Distribuição de uma linha)
  const loteAtual = lotes.find((l) => l.batch_id === loteSelecionadoId) || null;
  const [linhaEmDistribuicao, setLinhaEmDistribuicao] = useState<DailyBatchLine | null>(null);
  const [formaDistId, setFormaDistId] = useState<string>('');
  const [contaDistId, setContaDistId] = useState<string>('');
  const [valorDistCents, setValorDistCents] = useState<number>(0);
  const [taxaDistPercent, setTaxaDistPercent] = useState<string>('0');
  const [taxaDistManualCents, setTaxaDistManualCents] = useState<number | null>(null);
  const [obsParte, setObsParte] = useState<string>('');
  const [distribuindo, setDistribuindo] = useState(false);

  // Ao selecionar linha para distribuir
  const iniciarDistribuicaoLinha = (linha: DailyBatchLine) => {
    setLinhaEmDistribuicao(linha);
    const primeiraForma = formasAtivas[0];
    setFormaDistId(primeiraForma?.id || '');
    setContaDistId(primeiraForma?.default_account_id || contasAtivas[0]?.id || '');
    setTaxaDistPercent(String(primeiraForma?.fee_percent || 0));
    setTaxaDistManualCents(null);
    setValorDistCents(linha.remaining_cents);
    setObsParte('');
  };

  const trocarFormaPagamentoDist = (pmId: string) => {
    setFormaDistId(pmId);
    const pm = formasAtivas.find((f) => f.id === pmId);
    if (pm) {
      setTaxaDistPercent(String(pm.fee_percent || 0));
      setTaxaDistManualCents(null);
      if (pm.default_account_id) {
        setContaDistId(pm.default_account_id);
      }
    }
  };

  // Cálculo da taxa e líquido da parte
  const pctNumerico = parseFloat(taxaDistPercent.replace(',', '.')) || 0;
  const taxaCalculadaCents =
    taxaDistManualCents !== null
      ? taxaDistManualCents
      : calculateFeeAndNetFromPercent(valorDistCents, pctNumerico).feeCents;
  const liquidoCalculadoCents = Math.max(0, valorDistCents - taxaCalculadaCents);

  // Confirmar distribuição da parte
  const submeterParte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linhaEmDistribuicao) return;

    if (valorDistCents <= 0) {
      aoErro('Informe um valor maior que zero para distribuir.');
      return;
    }

    if (valorDistCents > linhaEmDistribuicao.remaining_cents) {
      aoErro(
        `O valor (${formatCentsToBRL(valorDistCents)}) não pode ultrapassar o restante a distribuir (${formatCentsToBRL(linhaEmDistribuicao.remaining_cents)}).`
      );
      return;
    }

    if (!contaDistId) {
      aoErro('Selecione uma conta de destino válida.');
      return;
    }

    setDistribuindo(true);
    try {
      await distributeBatchLine({
        line_id: linhaEmDistribuicao.id,
        parts: [
          {
            payment_method_id: formaDistId,
            account_id: contaDistId,
            gross_cents: valorDistCents,
            fee_cents: taxaCalculadaCents,
            net_cents: liquidoCalculadoCents,
            note: obsParte,
          },
        ],
      });

      aoSucesso(`Parte de ${formatCentsToBRL(valorDistCents)} distribuída com sucesso!`);
      aoRecarregarDados();
      await carregarLotes();
      setLinhaEmDistribuicao(null);
    } catch (err: any) {
      aoErro(err?.message || 'Erro ao distribuir parte.');
    } finally {
      setDistribuindo(false);
    }
  };

  // Desfazer uma parte já distribuída
  const desfazerParte = async (partId: string) => {
    if (!confirm('Deseja desfazer esta parte? O valor voltará para a conta "A distribuir".')) {
      return;
    }
    try {
      await undistributePart(partId);
      aoSucesso('Parte desfeita com sucesso! O valor retornou para "A distribuir".');
      aoRecarregarDados();
      await carregarLotes();
    } catch (err: any) {
      aoErro(err?.message || 'Erro ao desfazer parte.');
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Lote do Dia — Cona Cash"
    >
      <div className="flex flex-col gap-4 min-w-0">
        {/* Seletor de Abas */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#141419] rounded-xl border border-[#262630]">
          <button
            type="button"
            onClick={() => {
              setAbaAtiva('novo');
              setLinhaEmDistribuicao(null);
            }}
            className={[
              'py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all text-center truncate',
              abaAtiva === 'novo'
                ? 'bg-[#FF7A1A] text-white shadow-lg shadow-[#FF7A1A]/20'
                : 'text-[#9A9AA6] hover:text-[#F5F5F7]',
            ].join(' ')}
          >
            1. Registrar Bruto
          </button>
          <button
            type="button"
            onClick={() => {
              setAbaAtiva('distribuir');
              setLinhaEmDistribuicao(null);
            }}
            className={[
              'py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all text-center truncate flex items-center justify-center gap-1.5',
              abaAtiva === 'distribuir'
                ? 'bg-[#FF7A1A] text-white shadow-lg shadow-[#FF7A1A]/20'
                : 'text-[#9A9AA6] hover:text-[#F5F5F7]',
            ].join(' ')}
          >
            <span>2. Distribuir</span>
            {lotes.some((l) => l.status !== 'distributed') && (
              <span className="w-2 h-2 rounded-full bg-[#FFC940] animate-pulse" />
            )}
          </button>
        </div>

        {/* =================================================================== */}
        {/* ABA 1: REGISTRAR BRUTO (ETAPA 1) */}
        {/* =================================================================== */}
        {abaAtiva === 'novo' && (
          <form onSubmit={salvarNovoLote} className="flex flex-col gap-4 min-w-0">
            <div className="p-3 bg-[#FFC940]/10 border border-[#FFC940]/30 rounded-xl text-xs text-[#FFC940] flex items-start gap-2">
              <span className="font-bold text-sm">💡</span>
              <div>
                <strong>Etapa 1:</strong> Lance apenas o valor bruto e a fonte de cada ganho. O dinheiro entrará em <strong>"A distribuir"</strong> e você poderá separar maquininha, dinheiro, Pix e taxas depois com calma!
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo
                rotulo="Data do Lote"
                type="date"
                value={dataLote}
                onChange={(e) => setDataLote(e.target.value)}
                required
              />
              <Campo
                rotulo="Observação do Lote"
                type="text"
                value={observacaoLote}
                onChange={(e) => setObservacaoLote(e.target.value)}
                placeholder="Ex: Fechamento de hoje"
              />
            </div>

            {/* Linhas do Lote */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F5F5F7] uppercase tracking-wider">
                  Linhas de Receita ({linhasNovoLote.length})
                </span>
                <button
                  type="button"
                  onClick={adicionarLinha}
                  className="text-xs text-[#FF7A1A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  + Adicionar Linha
                </button>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {linhasNovoLote.map((linha, idx) => {
                  const fonteSelecionada = fontesAtivas.find((s) => s.id === linha.incomeSourceId);
                  return (
                    <div
                      key={linha.id}
                      className="p-3 rounded-xl bg-[#141419]/90 border border-[#262630] flex flex-col gap-2 relative transition-colors hover:border-[#3E3E4E]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#9A9AA6]">
                          Linha #{idx + 1}
                        </span>
                        {linhasNovoLote.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerLinha(linha.id)}
                            className="text-xs text-[#FF3B30] hover:underline p-1"
                            title="Remover linha"
                          >
                            ✕ Remover
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <CampoMoeda
                          rotulo="Valor Bruto"
                          centavos={linha.grossCents}
                          aoMudarCentavos={(cents) => atualizarLinha(linha.id, { grossCents: cents })}
                        />

                        <div className="flex flex-col gap-1 min-w-0">
                          <label className="text-xs font-medium text-[#F5F5F7] truncate">
                            Fonte de Renda
                          </label>
                          <div className="flex items-center gap-2">
                            <select
                              value={linha.incomeSourceId}
                              onChange={(e) => atualizarLinha(linha.id, { incomeSourceId: e.target.value })}
                              className="w-full min-h-[48px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm focus:outline-none focus:border-[#FF7A1A]"
                            >
                              <option value="">Sem fonte definida</option>
                              {fontesAtivas.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                            {fonteSelecionada && (
                              <div
                                className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border"
                                style={{
                                  backgroundColor: `${fonteSelecionada.color}20`,
                                  borderColor: fonteSelecionada.color,
                                  color: fonteSelecionada.color,
                                }}
                              >
                                <CategoryIcon name={fonteSelecionada.icon} className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Observação da linha (opcional)"
                        value={linha.note}
                        onChange={(e) => atualizarLinha(linha.id, { note: e.target.value })}
                        className="w-full text-xs px-3 py-2 bg-[#0B0B0D]/60 border border-[#262630] rounded-lg text-[#F5F5F7] placeholder-[#6E6E82] focus:outline-none focus:border-[#FF7A1A]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totalizador Fixo */}
            <div className="p-3.5 bg-gradient-to-r from-[#FF7A1A]/10 to-[#FFC940]/10 border border-[#FF7A1A]/30 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-[#9A9AA6] block">Total Bruto do Lote</span>
                <span className="text-xl sm:text-2xl font-black text-[#F5F5F7] tabular-nums">
                  {formatCentsToBRL(totalBrutoNovoLote)}
                </span>
              </div>
              <span className="text-xs text-[#FFC940] bg-[#FFC940]/20 px-2.5 py-1 rounded-full font-bold">
                {linhasPreenchidas.length} {linhasPreenchidas.length === 1 ? 'linha' : 'linhas'}
              </span>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Botao type="button" variante="secundario" texto="Cancelar" onClick={aoFechar} />
              <Botao
                type="submit"
                variante="primario"
                texto={salvando ? 'Salvando...' : 'Salvar Lote (A Distribuir)'}
                disabled={salvando || totalBrutoNovoLote <= 0}
              />
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* ABA 2: DISTRIBUIR (ETAPA 2) */}
        {/* =================================================================== */}
        {abaAtiva === 'distribuir' && (
          <div className="flex flex-col gap-4 min-w-0">
            {/* Seletor do Lote Atual */}
            {carregandoLotes ? (
              <div className="text-center py-6 text-sm text-[#9A9AA6]">Carregando lotes...</div>
            ) : lotes.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#9A9AA6] flex flex-col items-center gap-3">
                <span>Nenhum lote registrado ainda.</span>
                <Botao
                  type="button"
                  variante="primario"
                  texto="Criar Meu Primeiro Lote"
                  onClick={() => setAbaAtiva('novo')}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#9A9AA6] uppercase">
                    Selecione o Lote do Dia
                  </label>
                  <select
                    value={loteSelecionadoId || ''}
                    onChange={(e) => {
                      setLoteSelecionadoId(e.target.value);
                      setLinhaEmDistribuicao(null);
                    }}
                    className="w-full min-h-[44px] px-3 bg-[#141419] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm font-bold focus:outline-none focus:border-[#FF7A1A]"
                  >
                    {lotes.map((l) => (
                      <option key={l.batch_id} value={l.batch_id}>
                        {l.work_date} — Bruto: {formatCentsToBRL(l.total_gross_cents)} [
                        {l.status === 'distributed'
                          ? '✅ 100% Distribuído'
                          : l.status === 'partial'
                          ? `⚠️ Falta ${formatCentsToBRL(l.total_remaining_cents)}`
                          : `⏳ A Distribuir: ${formatCentsToBRL(l.total_remaining_cents)}`}
                        ]
                      </option>
                    ))}
                  </select>
                </div>

                {loteAtual && (
                  <div className="flex flex-col gap-3 min-w-0">
                    {/* Resumo do Lote Selecionado */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-[#141419] rounded-xl border border-[#262630] text-center">
                      <div>
                        <span className="text-[10px] text-[#9A9AA6] block uppercase">Total Bruto</span>
                        <span className="text-sm sm:text-base font-bold text-[#F5F5F7] tabular-nums">
                          {formatCentsToBRL(loteAtual.total_gross_cents)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#2EE59D] block uppercase">Distribuído</span>
                        <span className="text-sm sm:text-base font-bold text-[#2EE59D] tabular-nums">
                          {formatCentsToBRL(loteAtual.total_distributed_cents)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#FFC940] block uppercase">A Distribuir</span>
                        <span className="text-sm sm:text-base font-bold text-[#FFC940] tabular-nums">
                          {formatCentsToBRL(loteAtual.total_remaining_cents)}
                        </span>
                      </div>
                    </div>

                    {/* Formulário de Distribuição de Linha (quando aberta) */}
                    {linhaEmDistribuicao ? (
                      <form
                        onSubmit={submeterParte}
                        className="p-4 rounded-xl bg-[#141419] border-2 border-[#FF7A1A] flex flex-col gap-3.5 shadow-xl shadow-[#FF7A1A]/10 animate-fadeIn"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-[#262630] pb-2">
                          <div>
                            <span className="text-xs font-bold text-[#FF7A1A] block">
                              Distribuindo Linha: {linhaEmDistribuicao.source?.name || 'Sem fonte'}
                            </span>
                            <span className="text-xs text-[#9A9AA6]">
                              Restante: <strong>{formatCentsToBRL(linhaEmDistribuicao.remaining_cents)}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLinhaEmDistribuicao(null)}
                            className="text-xs text-[#9A9AA6] hover:text-[#F5F5F7] p-1"
                          >
                            ✕ Cancelar
                          </button>
                        </div>

                        {/* Atalhos rápidos "Tudo em" */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-[#9A9AA6] font-bold">Atalhos:</span>
                          <button
                            type="button"
                            onClick={() => setValorDistCents(linhaEmDistribuicao.remaining_cents)}
                            className="px-2 py-1 text-xs bg-[#FF7A1A]/20 hover:bg-[#FF7A1A]/30 text-[#FF7A1A] font-bold rounded-lg transition-colors"
                          >
                            Usar Restante ({formatCentsToBRL(linhaEmDistribuicao.remaining_cents)})
                          </button>
                          {formasAtivas.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                trocarFormaPagamentoDist(f.id);
                                setValorDistCents(linhaEmDistribuicao.remaining_cents);
                              }}
                              className="px-2 py-1 text-xs bg-[#262630] hover:bg-[#323242] text-[#F5F5F7] rounded-lg transition-colors"
                            >
                              Tudo em {f.name}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <CampoMoeda
                            rotulo="Valor Bruto da Parte"
                            centavos={valorDistCents}
                            aoMudarCentavos={setValorDistCents}
                          />

                          <div className="flex flex-col gap-1 min-w-0">
                            <label className="text-xs font-medium text-[#F5F5F7] truncate">
                              Forma de Pagamento
                            </label>
                            <select
                              value={formaDistId}
                              onChange={(e) => trocarFormaPagamentoDist(e.target.value)}
                              className="w-full min-h-[48px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm focus:outline-none focus:border-[#FF7A1A]"
                            >
                              {formasAtivas.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name} {f.fee_percent > 0 ? `(${f.fee_percent}%)` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <label className="text-xs font-medium text-[#F5F5F7] truncate">
                              Conta de Destino
                            </label>
                            <select
                              value={contaDistId}
                              onChange={(e) => setContaDistId(e.target.value)}
                              className="w-full min-h-[48px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm focus:outline-none focus:border-[#FF7A1A]"
                            >
                              {contasAtivas.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1 min-w-0">
                            <label className="text-xs font-medium text-[#F5F5F7] truncate">
                              Taxa % (Calculada automática)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={taxaDistPercent}
                              onChange={(e) => {
                                setTaxaDistPercent(e.target.value);
                                setTaxaDistManualCents(null);
                              }}
                              className="w-full min-h-[48px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm tabular-nums focus:outline-none focus:border-[#FF7A1A]"
                            />
                          </div>
                        </div>

                        {/* Detalhe da Taxa e Líquido */}
                        <div className="p-3 bg-[#0B0B0D] rounded-xl border border-[#262630] flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[#9A9AA6] block">Taxa Descontada:</span>
                            <span className="text-[#FF3B30] font-bold tabular-nums">
                              - {formatCentsToBRL(taxaCalculadaCents)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[#9A9AA6] block">Entra na Conta:</span>
                            <span className="text-[#2EE59D] font-bold text-sm tabular-nums">
                              {formatCentsToBRL(liquidoCalculadoCents)}
                            </span>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Observação da parte (opcional)"
                          value={obsParte}
                          onChange={(e) => setObsParte(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-[#0B0B0D] border border-[#262630] rounded-lg text-[#F5F5F7] focus:outline-none focus:border-[#FF7A1A]"
                        />

                        <div className="flex gap-2 justify-end">
                          <Botao
                            type="button"
                            variante="secundario"
                            texto="Voltar"
                            onClick={() => setLinhaEmDistribuicao(null)}
                          />
                          <Botao
                            type="submit"
                            variante="primario"
                            texto={distribuindo ? 'Distribuindo...' : 'Confirmar Parte'}
                            disabled={
                              distribuindo ||
                              valorDistCents <= 0 ||
                              valorDistCents > linhaEmDistribuicao.remaining_cents
                            }
                          />
                        </div>
                      </form>
                    ) : null}

                    {/* Lista das Linhas do Lote */}
                    <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {loteAtual.lines.map((linha) => (
                        <div
                          key={linha.id}
                          className="p-3.5 rounded-xl bg-[#141419] border border-[#262630] flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {linha.source && (
                                <div
                                  className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center border"
                                  style={{
                                    backgroundColor: `${linha.source.color}20`,
                                    borderColor: linha.source.color,
                                    color: linha.source.color,
                                  }}
                                >
                                  <CategoryIcon name={linha.source.icon} className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="text-sm font-bold text-[#F5F5F7] truncate block">
                                  {linha.source?.name || 'Sem fonte'}
                                </span>
                                <span className="text-xs text-[#9A9AA6]">
                                  Bruto: <strong>{formatCentsToBRL(linha.gross_cents)}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {linha.remaining_cents > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => iniciarDistribuicaoLinha(linha)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FF7A1A] hover:bg-[#FF8F3D] text-white transition-colors shadow-sm"
                                >
                                  Distribuir ({formatCentsToBRL(linha.remaining_cents)})
                                </button>
                              ) : (
                                <span className="text-xs px-2.5 py-1 rounded-full bg-[#2EE59D]/20 text-[#2EE59D] font-bold">
                                  ✅ 100% Distribuído
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Partes Já Distribuídas desta Linha */}
                          {linha.parts && linha.parts.length > 0 && (
                            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#262630]/60">
                              <span className="text-[10px] text-[#9A9AA6] uppercase font-bold">
                                Partes distribuídas:
                              </span>
                              {linha.parts.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#0B0B0D]/80 border border-[#262630]/60"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-[#F5F5F7]">
                                      {p.payment_method_name} → {p.account_name}
                                    </span>
                                    <span className="text-[11px] text-[#9A9AA6] block">
                                      Bruto: {formatCentsToBRL(p.gross_cents)} | Taxa: -{formatCentsToBRL(p.fee_cents)} | Líquido: {formatCentsToBRL(p.net_cents)}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => desfazerParte(p.id)}
                                    className="text-[11px] text-[#FF3B30] hover:underline p-1 ml-2 shrink-0"
                                    title="Desfazer esta parte"
                                  >
                                    Desfazer
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end pt-2 border-t border-[#262630]">
              <Botao type="button" variante="secundario" texto="Fechar" onClick={aoFechar} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
