import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Clock,
  SlidersHorizontal,
  ArrowRight,
  History,
  CreditCard,
} from 'lucide-react';
import {
  DEFAULT_QUICK_TAGS,
  type Account,
  type AuditLogEntry,
  type Category,
  type ExpenseItem,
  type IncomeSource,
  type PaymentMethod,
  type Transaction,
  type TransactionKind,
} from '../../types/database';
import {
  calculateFeeAndNetFromPercent,
  formatCentsToBRL,
  formatDateTimeBR,
  formatFeePercent,
  fromSaoPauloDateTimeLocalToISO,
  toSaoPauloDateTimeLocal,
} from '../../utils/format';
import {
  createIncomeBatch,
  createTransaction,
  fetchTransactionAuditLog,
  getOrCreateExpenseItem,
  updateTransaction,
} from '../../api/supabase';
import { Modal } from '../../components/ui/Modal';
import { Campo } from '../../components/ui/Campo';
import { CampoMoeda } from '../../components/ui/CampoMoeda';
import { Botao } from '../../components/ui/Botao';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { ExpenseItemAutocomplete } from '../../components/ui/ExpenseItemAutocomplete';

// ============================================================================
// 1. MODAL DE LANÇAMENTO INDIVIDUAL (ENTRADA RÁPIDA, SAÍDA, TRANSFERÊNCIA + EDIÇÃO)
// ============================================================================

export interface TransactionFormModalProps {
  aberto: boolean;
  aoFechar: () => void;
  userId: string;
  tipoInicial: TransactionKind;
  lancamentoEditando?: Transaction | null;
  contas: Account[];
  fontes: IncomeSource[];
  formas: PaymentMethod[];
  categorias: Category[];
  quickTags?: string[];
  aoAbrirParcelamento?: () => void;
  aoSalvarSucesso: (mensagem: string) => void;
  aoErro: (mensagem: string) => void;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  aberto,
  aoFechar,
  userId,
  tipoInicial,
  lancamentoEditando,
  contas,
  fontes,
  formas,
  categorias,
  quickTags,
  aoAbrirParcelamento,
  aoSalvarSucesso,
  aoErro,
}) => {
  const contasAtivas = contas.filter((c) => !c.archived);
  const fontesAtivas = fontes.filter((src) => !src.archived);
  const formasAtivas = formas.filter((f) => !f.archived);
  const categoriasAtivas = categorias.filter((cat) => !cat.archived);
  const tagsParaExibir =
    quickTags && quickTags.length > 0 ? quickTags : DEFAULT_QUICK_TAGS;

  const [tipo, setTipo] = useState<TransactionKind>(tipoInicial);
  const [brutoCentavos, setBrutoCentavos] = useState(0);
  const [taxaCentavos, setTaxaCentavos] = useState(0);
  const [taxaManual, setTaxaManual] = useState(false);

  const [fonteId, setFonteId] = useState<string>('');
  const [formaId, setFormaId] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [itemGasto, setItemGasto] = useState<ExpenseItem | null>(null);
  const [novoItemNome, setNovoItemNome] = useState<string>('');
  const [contaId, setContaId] = useState<string>('');
  const [contaDestinoId, setContaDestinoId] = useState<string>('');

  const [observacao, setObservacao] = useState('');
  const [escolherDataHora, setEscolherDataHora] = useState(false);
  const [dataHoraLocal, setDataHoraLocal] = useState(toSaoPauloDateTimeLocal());
  const [salvando, setSalvando] = useState(false);

  // Inicializa campos ao abrir o modal
  useEffect(() => {
    if (!aberto) return;

    if (lancamentoEditando) {
      setTipo(lancamentoEditando.kind);
      setBrutoCentavos(lancamentoEditando.gross_cents);
      setTaxaCentavos(lancamentoEditando.fee_cents);
      setTaxaManual(true);
      setFonteId(lancamentoEditando.income_source_id || '');
      setFormaId(lancamentoEditando.payment_method_id || '');
      setCategoriaId(lancamentoEditando.category_id || '');
      setContaId(lancamentoEditando.account_id);
      setContaDestinoId(lancamentoEditando.to_account_id || '');
      setItemGasto(null);
      setNovoItemNome('');
      setObservacao(lancamentoEditando.note || '');
      setEscolherDataHora(true);
      setDataHoraLocal(
        toSaoPauloDateTimeLocal(new Date(lancamentoEditando.occurred_at))
      );
    } else {
      setTipo(tipoInicial);
      setBrutoCentavos(0);
      setTaxaCentavos(0);
      setTaxaManual(false);
      setItemGasto(null);
      setNovoItemNome('');
      setObservacao('');
      setEscolherDataHora(false);
      setDataHoraLocal(toSaoPauloDateTimeLocal());

      const primeiraFonte =
        fontesAtivas.find((s) => s.counts_as_earning) || fontesAtivas[0];
      const fontePadraoId =
        tipoInicial === 'income' ? primeiraFonte?.id || '' : '';
      setFonteId(fontePadraoId);

      const formaSugeridaPelaFonte =
        tipoInicial === 'income' && primeiraFonte?.default_payment_method_id
          ? formasAtivas.find(
              (f) => f.id === primeiraFonte.default_payment_method_id
            )
          : undefined;

      const primeiraForma = formaSugeridaPelaFonte || formasAtivas[0];
      setFormaId(primeiraForma?.id || '');
      setCategoriaId(categoriasAtivas[0]?.id || '');

      const contaSugerida =
        tipoInicial === 'income'
          ? primeiraFonte?.default_account_id ||
            primeiraForma?.default_account_id ||
            contasAtivas[0]?.id ||
            ''
          : contasAtivas[0]?.id || '';
      setContaId(contaSugerida);

      const segundaConta =
        contasAtivas.find((c) => c.id !== contaSugerida)?.id ||
        contasAtivas[1]?.id ||
        '';
      setContaDestinoId(segundaConta);
    }
  }, [aberto, lancamentoEditando, tipoInicial]);

  // Ao selecionar um item de saída: preenche categoria, último valor e conta padrão
  const handleSelecionarItemGasto = (item: ExpenseItem | null, novoNome?: string) => {
    setItemGasto(item);
    setNovoItemNome(novoNome || '');

    if (item) {
      if (item.default_category_id) {
        setCategoriaId(item.default_category_id);
      }
      if (item.default_account_id) {
        setContaId(item.default_account_id);
      }
      if (item.default_amount_cents && item.default_amount_cents > 0) {
        setBrutoCentavos(item.default_amount_cents);
      }
    }
  };

  const selecionarFonteRenda = (src: IncomeSource) => {
    setFonteId(src.id);
    if (tipo === 'income') {
      if (src.default_payment_method_id) {
        const pm = formas.find((f) => f.id === src.default_payment_method_id);
        if (pm) {
          setFormaId(pm.id);
          setTaxaManual(false);
          const { feeCents } = calculateFeeAndNetFromPercent(
            brutoCentavos,
            Number(pm.fee_percent || 0)
          );
          setTaxaCentavos(feeCents);
        }
      }
      if (src.default_account_id) {
        setContaId(src.default_account_id);
      } else if (src.default_payment_method_id) {
        const pm = formas.find((f) => f.id === src.default_payment_method_id);
        if (pm?.default_account_id) {
          setContaId(pm.default_account_id);
        }
      }
    }
  };

  // Recalcula taxa automaticamente quando muda o valor bruto ou a forma de pagamento (se não estiver em ajuste manual)
  useEffect(() => {
    if (tipo !== 'income') {
      setTaxaCentavos(0);
      return;
    }
    if (!taxaManual) {
      const pm = formas.find((f) => f.id === formaId);
      const pct = pm ? Number(pm.fee_percent || 0) : 0;
      const { feeCents } = calculateFeeAndNetFromPercent(brutoCentavos, pct);
      setTaxaCentavos(feeCents);
    }
  }, [brutoCentavos, formaId, tipo, taxaManual, formas]);

  const selecionarFormaPagamento = (pm: PaymentMethod) => {
    setFormaId(pm.id);
    setTaxaManual(false);
    if (pm.default_account_id) {
      setContaId(pm.default_account_id);
    }
    const { feeCents } = calculateFeeAndNetFromPercent(
      brutoCentavos,
      Number(pm.fee_percent || 0)
    );
    setTaxaCentavos(feeCents);
  };

  const adicionarTagObservacao = (tag: string) => {
    setObservacao((atual) => {
      if (atual.includes(tag)) return atual;
      return atual.trim() ? `${atual.trim()} ${tag}` : tag;
    });
  };

  const liquidoCentavos =
    tipo === 'income'
      ? Math.max(0, brutoCentavos - taxaCentavos)
      : brutoCentavos;

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (brutoCentavos <= 0) {
      aoErro('Digite um valor maior que R$ 0,00.');
      return;
    }
    if (!contaId) {
      aoErro('Selecione a conta.');
      return;
    }
    if (tipo === 'transfer') {
      if (!contaDestinoId) {
        aoErro('Selecione a conta de destino.');
        return;
      }
      if (contaId === contaDestinoId) {
        aoErro('A conta de origem e a conta de destino precisam ser diferentes.');
        return;
      }
    }
    if (tipo === 'income' && taxaCentavos > brutoCentavos) {
      aoErro('A taxa não pode ser maior que o valor bruto.');
      return;
    }

    const occurredAtISO = escolherDataHora
      ? fromSaoPauloDateTimeLocalToISO(dataHoraLocal)
      : new Date().toISOString();

    setSalvando(true);
    try {
      // Se for saída e tiver um item novo a ser criado
      let finalItemId = itemGasto?.id || null;
      if (tipo === 'expense' && !finalItemId && novoItemNome.trim()) {
        const created = await getOrCreateExpenseItem({
          name: novoItemNome.trim(),
          category_id: categoriaId || null,
          account_id: contaId || null,
          amount_cents: brutoCentavos,
        });
        if (created?.id) finalItemId = created.id;
      }

      if (lancamentoEditando) {
        await updateTransaction(lancamentoEditando.id, {
          kind: tipo,
          occurred_at: occurredAtISO,
          account_id: contaId,
          to_account_id: tipo === 'transfer' ? contaDestinoId : null,
          payment_method_id: tipo === 'income' ? formaId || null : null,
          category_id: tipo === 'expense' ? categoriaId || null : null,
          expense_item_id: tipo === 'expense' ? finalItemId : null,
          income_source_id: tipo !== 'transfer' ? fonteId || null : null,
          gross_cents: brutoCentavos,
          fee_cents: tipo === 'income' ? taxaCentavos : 0,
          note: observacao,
        });
        aoSalvarSucesso('Lançamento atualizado e registrado no histórico!');
      } else {
        await createTransaction({
          user_id: userId,
          kind: tipo,
          occurred_at: occurredAtISO,
          account_id: contaId,
          to_account_id: tipo === 'transfer' ? contaDestinoId : null,
          payment_method_id: tipo === 'income' ? formaId || null : null,
          category_id: tipo === 'expense' ? categoriaId || null : null,
          expense_item_id: tipo === 'expense' ? finalItemId : null,
          income_source_id: tipo !== 'transfer' ? fonteId || null : null,
          gross_cents: brutoCentavos,
          fee_cents: tipo === 'income' ? taxaCentavos : 0,
          net_cents: liquidoCentavos,
          note: observacao,
        });
        const fonteSelecionada = fontes.find((s) => s.id === fonteId);
        const msg =
          tipo === 'income'
            ? fonteSelecionada && !fonteSelecionada.counts_as_earning
              ? `Aporte de ${formatCentsToBRL(liquidoCentavos)} adicionado ao saldo!`
              : `Entrada de ${formatCentsToBRL(liquidoCentavos)} líquidos salva!`
            : tipo === 'expense'
              ? `Saída de ${formatCentsToBRL(brutoCentavos)} registrada!`
              : `Transferência de ${formatCentsToBRL(brutoCentavos)} realizada!`;
        aoSalvarSucesso(msg);
      }
      aoFechar();
    } catch (err: any) {
      aoErro(err?.message || 'Erro ao salvar lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  const tituloModal = lancamentoEditando
    ? 'Editar Lançamento'
    : tipo === 'income'
      ? 'Nova Entrada Rápida'
      : tipo === 'expense'
        ? 'Nova Saída (Gasto)'
        : 'Transferir entre Contas';

  const formaAtual = formas.find((f) => f.id === formaId);
  const fonteAtual = fontes.find((s) => s.id === fonteId);
  const fontesParaExibir = fontes.filter(
    (s) => !s.archived || s.id === fonteId
  );

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={tituloModal}>
      <form onSubmit={submeter} className="flex flex-col gap-4 min-w-0">
        {/* Seletor de tipo (apenas na criação) */}
        {!lancamentoEditando && (
          <div className="grid grid-cols-3 gap-1.5 bg-[#0B0B0D] p-1 rounded-xl border border-[#262630] min-w-0">
            <button
              type="button"
              onClick={() => setTipo('income')}
              className={[
                'min-h-[38px] px-2 rounded-lg text-xs font-bold transition-all truncate',
                tipo === 'income'
                  ? 'bg-[#2EE59D] text-[#0B0B0D]'
                  : 'text-[#9A9AA6] hover:text-white',
              ].join(' ')}
            >
              + Entrada
            </button>
            <button
              type="button"
              onClick={() => setTipo('expense')}
              className={[
                'min-h-[38px] px-2 rounded-lg text-xs font-bold transition-all truncate',
                tipo === 'expense'
                  ? 'bg-[#FF3B30] text-white'
                  : 'text-[#9A9AA6] hover:text-white',
              ].join(' ')}
            >
              - Saída
            </button>
            <button
              type="button"
              onClick={() => setTipo('transfer')}
              className={[
                'min-h-[38px] px-2 rounded-lg text-xs font-bold transition-all truncate',
                tipo === 'transfer'
                  ? 'bg-[#FFC940] text-[#0B0B0D]'
                  : 'text-[#9A9AA6] hover:text-white',
              ].join(' ')}
            >
              Transferir
            </button>
          </div>
        )}

        {/* 1º CAMPO: VALOR (R$) — Conforme escolha do Octavio na Entrevista */}
        {tipo === 'expense' && !lancamentoEditando && aoAbrirParcelamento && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#FF7A1A]/10 to-[#FFC940]/10 border border-[#FF7A1A]/30 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#FF7A1A]/20 text-[#FF7A1A] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  Compra parcelada?
                </span>
                <span className="text-[10px] text-[#9A9AA6] block truncate">
                  Cartão de crédito ou boleto em até 48x
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                aoFechar();
                aoAbrirParcelamento();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#FF7A1A] text-black text-xs font-bold shrink-0 hover:bg-[#FF8A2A] transition-colors"
            >
              Parcelar
            </button>
          </div>
        )}

        <CampoMoeda
          rotulo={
            tipo === 'income'
              ? '1. Valor Bruto recebido (R$)'
              : tipo === 'expense'
                ? '1. Valor do gasto (R$)'
                : '1. Valor a transferir (R$)'
          }
          centavos={brutoCentavos}
          aoMudarCentavos={setBrutoCentavos}
        />

        {/* 2º CAMPO (SE ENTRADA): FONTE DE RENDA + FORMA DE PAGAMENTO + CÁLCULO DE TAXA */}
        {tipo === 'income' && (
          <>
            {/* 2. Fonte de renda (Fase 3B item 4) */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate">
                2. Fonte de renda (sugere forma e conta)
              </span>
              <div className="grid grid-cols-2 gap-2 min-w-0">
                {fontesParaExibir.map((src) => {
                  const selecionada = fonteId === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => selecionarFonteRenda(src)}
                      className={[
                        'min-h-[44px] px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-left transition-all min-w-0 overflow-hidden',
                        selecionada
                          ? 'bg-[#FF7A1A]/20 border-[#FF7A1A] text-white font-bold'
                          : 'bg-[#0B0B0D] border-[#262630] text-[#9A9AA6] hover:text-white',
                      ].join(' ')}
                    >
                      <span
                        style={{ color: src.color }}
                        className="shrink-0 flex items-center"
                      >
                        <CategoryIcon name={src.icon} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs block truncate">{src.name}</span>
                        {!src.counts_as_earning && (
                          <span className="text-[10px] text-[#06B6D4] font-semibold block truncate">
                            Aporte (não é ganho)
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {fonteAtual && !fonteAtual.counts_as_earning && (
                <div className="px-3 py-1.5 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-[11px] text-[#06B6D4]">
                  <strong>Aporte selecionado:</strong> o valor vai somar no saldo da conta, mas ficará fora dos totais de ganho.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate">
                3. Forma de pagamento (preenche conta e taxa automático)
              </span>
              <div className="grid grid-cols-2 gap-2 min-w-0">
                {formasAtivas.map((pm) => {
                  const selecionada = formaId === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => selecionarFormaPagamento(pm)}
                      className={[
                        'min-h-[46px] px-3 py-2 rounded-xl border text-left transition-all min-w-0 overflow-hidden',
                        selecionada
                          ? 'bg-[#FF7A1A]/20 border-[#FF7A1A] text-white'
                          : 'bg-[#0B0B0D] border-[#262630] text-[#9A9AA6] hover:text-white',
                      ].join(' ')}
                    >
                      <span className="text-xs font-bold block truncate">
                        {pm.name}
                      </span>
                      <span className="text-[10px] text-[#FFC940] block truncate">
                        Taxa: {formatFeePercent(pm.fee_percent)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumo Bruto - Taxa = Líquido + Ajuste manual de taxa */}
            <div className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] space-y-2.5 min-w-0">
              <div className="grid grid-cols-3 gap-2 text-center min-w-0">
                <div className="min-w-0">
                  <span className="text-[10px] text-[#9A9AA6] block truncate">
                    Bruto
                  </span>
                  <ValorMoeda centavos={brutoCentavos} tamanho="sm" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[#9A9AA6] block truncate">
                    Taxa ({formaAtual ? formatFeePercent(formaAtual.fee_percent) : '0%'})
                  </span>
                  <ValorMoeda
                    centavos={taxaCentavos}
                    tamanho="sm"
                    cor="negativo"
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[#2EE59D] font-bold block truncate">
                    Cai Líquido
                  </span>
                  <ValorMoeda
                    centavos={liquidoCentavos}
                    tamanho="sm"
                    cor="positivo"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#262630]/70 min-w-0">
                <button
                  type="button"
                  onClick={() => setTaxaManual((v) => !v)}
                  className="text-[11px] font-semibold text-[#FF7A1A] inline-flex items-center gap-1 hover:underline truncate"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {taxaManual
                      ? 'Voltar para taxa automática (%)'
                      : 'Ajustar taxa (R$) na mão'}
                  </span>
                </button>
              </div>

              {taxaManual && (
                <CampoMoeda
                  rotulo="Taxa descontada em R$ (ajuste manual)"
                  centavos={taxaCentavos}
                  aoMudarCentavos={(novo) =>
                    setTaxaCentavos(Math.min(brutoCentavos, novo))
                  }
                />
              )}
            </div>
          </>
        )}

        {/* 2º CAMPO (SE SAÍDA): ITEM COMPRADO (AUTOCOMPLETE) + CATEGORIA + LIGAR A UMA FONTE */}
        {tipo === 'expense' && (
          <>
            <ExpenseItemAutocomplete
              value={itemGasto?.id || ''}
              selectedItem={itemGasto}
              onSelectItem={handleSelecionarItemGasto}
            />

            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate">
                2. Categoria do gasto
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-0">
                {categoriasAtivas.map((cat) => {
                  const selecionada = categoriaId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoriaId(cat.id)}
                      className={[
                        'min-h-[44px] px-2.5 py-1.5 rounded-xl border flex items-center gap-2 transition-all min-w-0 overflow-hidden',
                        selecionada
                          ? 'bg-[#FF7A1A]/20 border-[#FF7A1A] text-white font-bold'
                          : 'bg-[#0B0B0D] border-[#262630] text-[#9A9AA6] hover:text-white',
                      ].join(' ')}
                    >
                      <span
                        style={{ color: cat.color }}
                        className="shrink-0 flex items-center"
                      >
                        <CategoryIcon name={cat.icon} className="w-4 h-4" />
                      </span>
                      <span className="text-xs truncate">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo opcional: Ligar a uma fonte (Fase 3B item 6) */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label
                htmlFor="select-fonte-gasto"
                className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate"
              >
                Ligar a uma fonte (opcional — para lucro por fonte)
              </label>
              <select
                id="select-fonte-gasto"
                value={fonteId}
                onChange={(e) => setFonteId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/50"
              >
                <option value="">Sem vínculo com fonte específica</option>
                {fontesParaExibir
                  .filter((s) => s.counts_as_earning || s.id === fonteId)
                  .map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.name}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}

        {/* SELEÇÃO DE CONTA (OU ORIGEM -> DESTINO NA TRANSFERÊNCIA) */}
        {tipo !== 'transfer' ? (
          <div className="flex flex-col gap-1.5 min-w-0">
            <label
              htmlFor="select-conta-lancamento"
              className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate"
            >
              {tipo === 'income'
                ? '4. Conta onde o dinheiro caiu'
                : '3. Conta de onde saiu o dinheiro'}
            </label>
            <select
              id="select-conta-lancamento"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="w-full min-h-[48px] px-3.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/50"
            >
              {contasAtivas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label
                htmlFor="select-origem"
                className="text-xs font-medium text-[#F5F5F7] truncate"
              >
                Saiu de (Origem)
              </label>
              <select
                id="select-origem"
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                className="w-full min-h-[48px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm"
              >
                {contasAtivas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label
                htmlFor="select-destino"
                className="text-xs font-medium text-[#2EE59D] truncate"
              >
                Entrou em (Destino)
              </label>
              <select
                id="select-destino"
                value={contaDestinoId}
                onChange={(e) => setContaDestinoId(e.target.value)}
                className="w-full min-h-[48px] px-3 bg-[#0B0B0D] border border-[#2EE59D]/40 rounded-xl text-[#F5F5F7] text-sm"
              >
                {contasAtivas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* OBSERVAÇÃO + TAGS RÁPIDAS EDITÁVEIS */}
        <div className="flex flex-col gap-2 min-w-0">
          <Campo
            rotulo="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: Pedido #120, peça 3D sob encomenda, abastecimento..."
          />

          {tipo !== 'transfer' && (
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {tagsParaExibir.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => adicionarTagObservacao(tag)}
                  className="px-2.5 py-1 rounded-full bg-[#0B0B0D] border border-[#262630] text-[11px] text-[#9A9AA6] hover:text-[#FF7A1A] hover:border-[#FF7A1A]/50 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DATA E HORA (Padrão: Agora, expansível) */}
        <div className="p-2.5 rounded-xl bg-[#0B0B0D]/70 border border-[#262630] min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs text-[#9A9AA6] inline-flex items-center gap-1.5 truncate">
              <Clock className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" />
              <span className="truncate">
                Data/Hora: <strong className="text-white">{escolherDataHora ? 'Personalizada' : 'Agora'}</strong>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setEscolherDataHora((v) => !v)}
              className="text-xs text-[#FF7A1A] font-semibold hover:underline shrink-0"
            >
              {escolherDataHora ? 'Usar "Agora"' : 'Trocar data/hora'}
            </button>
          </div>

          {escolherDataHora && (
            <input
              type="datetime-local"
              value={dataHoraLocal}
              onChange={(e) => setDataHoraLocal(e.target.value)}
              className="mt-2 w-full min-h-[44px] px-3 bg-[#141418] border border-[#262630] rounded-xl text-xs sm:text-sm text-white"
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Botao
            type="button"
            variante="secundario"
            larguraTotal
            texto="Cancelar"
            onClick={aoFechar}
          />
          <Botao
            type="submit"
            variante="primario"
            larguraTotal
            carregando={salvando}
            texto={lancamentoEditando ? 'Salvar Alterações' : 'Confirmar Lançamento'}
          />
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// 2. MODAL DE LANÇAMENTO EM LOTE DO FIM DO DIA (5 LINHAS INICIAIS, TUDO OU NADA)
// ============================================================================

interface LinhaLote {
  id: string;
  grossCents: number;
  incomeSourceId: string;
  paymentMethodId: string;
  accountId: string;
  note: string;
}

export interface BatchIncomeModalProps {
  aberto: boolean;
  aoFechar: () => void;
  contas: Account[];
  fontes: IncomeSource[];
  formas: PaymentMethod[];
  aoSalvarSucesso: (mensagem: string) => void;
  aoErro: (mensagem: string) => void;
}

export const BatchIncomeModal: React.FC<BatchIncomeModalProps> = ({
  aberto,
  aoFechar,
  contas,
  fontes,
  formas,
  aoSalvarSucesso,
  aoErro,
}) => {
  const contasAtivas = contas.filter((c) => !c.archived);
  const fontesAtivas = fontes.filter((src) => !src.archived);
  const formasAtivas = formas.filter((f) => !f.archived);

  const criarLinhaVazia = (idx: number): LinhaLote => {
    const src = fontesAtivas[idx % Math.max(1, fontesAtivas.length)];
    const pmPadrao = src?.default_payment_method_id
      ? formasAtivas.find((f) => f.id === src.default_payment_method_id)
      : formasAtivas[idx % Math.max(1, formasAtivas.length)];
    const pm = pmPadrao || formasAtivas[0];
    return {
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      grossCents: 0,
      incomeSourceId: src?.id || '',
      paymentMethodId: pm?.id || '',
      accountId:
        src?.default_account_id ||
        pm?.default_account_id ||
        contasAtivas[0]?.id ||
        '',
      note: '',
    };
  };

  const [linhas, setLinhas] = useState<LinhaLote[]>([]);
  const [observacaoGeral, setObservacaoGeral] = useState('');
  const [dataHoraLocal, setDataHoraLocal] = useState(toSaoPauloDateTimeLocal());
  const [salvando, setSalvando] = useState(false);

  // Inicia sempre com 5 linhas vazias conforme escolha do Octavio
  useEffect(() => {
    if (aberto) {
      setLinhas([
        criarLinhaVazia(0),
        criarLinhaVazia(1),
        criarLinhaVazia(2),
        criarLinhaVazia(3),
        criarLinhaVazia(4),
      ]);
      setObservacaoGeral('Fechamento do dia');
      setDataHoraLocal(toSaoPauloDateTimeLocal());
    }
  }, [aberto]);

  const atualizarLinha = (id: string, parcial: Partial<LinhaLote>) => {
    setLinhas((atuais) =>
      atuais.map((l) => {
        if (l.id !== id) return l;
        const atualizada = { ...l, ...parcial };
        // Se trocou a fonte de renda, sugere forma e conta padrão da fonte
        if (parcial.incomeSourceId !== undefined) {
          const src = fontesAtivas.find((s) => s.id === parcial.incomeSourceId);
          if (src) {
            if (src.default_payment_method_id) {
              atualizada.paymentMethodId = src.default_payment_method_id;
            }
            if (src.default_account_id) {
              atualizada.accountId = src.default_account_id;
            } else if (src.default_payment_method_id) {
              const pm = formasAtivas.find(
                (f) => f.id === src.default_payment_method_id
              );
              if (pm?.default_account_id) {
                atualizada.accountId = pm.default_account_id;
              }
            }
          }
        }
        // Se trocou a forma de pagamento diretamente, sugere a conta padrão dela
        if (parcial.paymentMethodId) {
          const pm = formasAtivas.find((f) => f.id === parcial.paymentMethodId);
          if (pm?.default_account_id) {
            atualizada.accountId = pm.default_account_id;
          }
        }
        return atualizada;
      })
    );
  };

  const adicionarLinha = () => {
    setLinhas((atuais) => [...atuais, criarLinhaVazia(atuais.length)]);
  };

  const removerLinha = (id: string) => {
    if (linhas.length <= 1) return;
    setLinhas((atuais) => atuais.filter((l) => l.id !== id));
  };

  const calcularLinha = (l: LinhaLote) => {
    const pm = formasAtivas.find((f) => f.id === l.paymentMethodId);
    const pct = pm ? Number(pm.fee_percent || 0) : 0;
    return calculateFeeAndNetFromPercent(l.grossCents, pct);
  };

  const linhasPreenchidas = linhas.filter((l) => l.grossCents > 0);
  const totalBruto = linhasPreenchidas.reduce((acc, l) => acc + l.grossCents, 0);
  const totalLiquido = linhasPreenchidas.reduce(
    (acc, l) => acc + calcularLinha(l).netCents,
    0
  );
  const totalTaxas = totalBruto - totalLiquido;

  const salvarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linhasPreenchidas.length === 0) {
      aoErro('Preencha o valor em pelo menos uma linha do lote.');
      return;
    }

    const itemsPayload = linhasPreenchidas.map((l) => {
      const { feeCents, netCents } = calcularLinha(l);
      return {
        gross_cents: l.grossCents,
        fee_cents: feeCents,
        net_cents: netCents,
        account_id: l.accountId,
        payment_method_id: l.paymentMethodId || null,
        income_source_id: l.incomeSourceId || null,
        note: l.note || observacaoGeral,
      };
    });

    setSalvando(true);
    try {
      await createIncomeBatch({
        occurred_at: fromSaoPauloDateTimeLocalToISO(dataHoraLocal),
        note: observacaoGeral,
        items: itemsPayload,
      });
      aoSalvarSucesso(
        `Lote com ${itemsPayload.length} entradas (${formatCentsToBRL(totalLiquido)} líquidos) salvo com sucesso!`
      );
      aoFechar();
    } catch (err: any) {
      aoErro(err?.message || 'Erro ao salvar lote.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Lote do Fim do Dia (Várias Entradas)"
    >
      <form onSubmit={salvarLote} className="flex flex-col gap-3.5 min-w-0">
        <p className="text-xs text-[#9A9AA6]">
          Lance vários ganhos de uma só vez. Linhas deixadas em R$ 0,00 são ignoradas automaticamente.
        </p>

        <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1 min-w-0">
          {linhas.map((l, idx) => {
            const { feeCents, netCents } = calcularLinha(l);
            return (
              <div
                key={l.id}
                className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] space-y-2 min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-xs font-bold text-[#FF7A1A]">
                    Linha #{idx + 1}
                  </span>
                  {l.grossCents > 0 && (
                    <span className="text-[11px] text-[#2EE59D] font-semibold tabular-nums truncate">
                      Líquido: {formatCentsToBRL(netCents)}
                      {feeCents > 0 ? ` (taxa ${formatCentsToBRL(feeCents)})` : ''}
                    </span>
                  )}
                  {linhas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerLinha(l.id)}
                      className="text-[#9A9AA6] hover:text-[#FF3B30] p-1"
                      aria-label={`Remover linha ${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <CampoMoeda
                  rotulo="Valor Bruto (R$)"
                  centavos={l.grossCents}
                  aoMudarCentavos={(v) => atualizarLinha(l.id, { grossCents: v })}
                />

                <div className="min-w-0">
                  <label className="text-[11px] text-[#9A9AA6] block truncate mb-1">
                    Fonte de renda
                  </label>
                  <select
                    value={l.incomeSourceId}
                    onChange={(e) =>
                      atualizarLinha(l.id, { incomeSourceId: e.target.value })
                    }
                    className="w-full min-h-[40px] px-2.5 bg-[#141418] border border-[#262630] rounded-lg text-xs text-white"
                  >
                    <option value="">Sem fonte definida</option>
                    {fontesAtivas.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name}
                        {!src.counts_as_earning ? ' (Aporte)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 min-w-0">
                  <div className="min-w-0">
                    <label className="text-[11px] text-[#9A9AA6] block truncate mb-1">
                      Forma
                    </label>
                    <select
                      value={l.paymentMethodId}
                      onChange={(e) =>
                        atualizarLinha(l.id, { paymentMethodId: e.target.value })
                      }
                      className="w-full min-h-[40px] px-2.5 bg-[#141418] border border-[#262630] rounded-lg text-xs text-white"
                    >
                      {formasAtivas.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name} ({formatFeePercent(pm.fee_percent)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className="text-[11px] text-[#9A9AA6] block truncate mb-1">
                      Conta destino
                    </label>
                    <select
                      value={l.accountId}
                      onChange={(e) =>
                        atualizarLinha(l.id, { accountId: e.target.value })
                      }
                      className="w-full min-h-[40px] px-2.5 bg-[#141418] border border-[#262630] rounded-lg text-xs text-white"
                    >
                      {contasAtivas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Botao
          type="button"
          variante="secundario"
          tamanho="sm"
          icone={<Plus className="w-4 h-4" />}
          texto="+ Adicionar linha"
          onClick={adicionarLinha}
        />

        <Campo
          rotulo="Observação do lote"
          value={observacaoGeral}
          onChange={(e) => setObservacaoGeral(e.target.value)}
          placeholder="Ex.: Fechamento de terça-feira"
        />

        {/* Resumo Total do Lote */}
        <div className="p-3 rounded-xl bg-[#0B0B0D] border border-[#FF7A1A]/40 flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <span className="text-xs text-[#9A9AA6] block truncate">
              {linhasPreenchidas.length} linha(s) preenchida(s)
            </span>
            {totalTaxas > 0 && (
              <span className="text-[11px] text-[#FFC940] block truncate">
                Bruto: {formatCentsToBRL(totalBruto)} • Taxas:{' '}
                {formatCentsToBRL(totalTaxas)}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#2EE59D] block">
              Total Líquido do Lote
            </span>
            <ValorMoeda centavos={totalLiquido} tamanho="md" cor="positivo" />
          </div>
        </div>

        <div className="flex gap-2">
          <Botao
            type="button"
            variante="secundario"
            larguraTotal
            texto="Cancelar"
            onClick={aoFechar}
          />
          <Botao
            type="submit"
            variante="primario"
            larguraTotal
            carregando={salvando}
            texto="Salvar Lote Tudo de Uma Vez"
          />
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// 3. MODAL DE HISTÓRICO DE AUDITORIA DO LANÇAMENTO (audit_log)
// ============================================================================

export interface AuditHistoryModalProps {
  aberto: boolean;
  aoFechar: () => void;
  lancamento: Transaction | null;
}

const acaoLabelMap: Record<string, { texto: string; cor: string }> = {
  create: { texto: 'Criado', cor: 'text-[#2EE59D] bg-[#2EE59D]/15' },
  update: { texto: 'Editado', cor: 'text-[#FFC940] bg-[#FFC940]/15' },
  delete: { texto: 'Movido para Lixeira', cor: 'text-[#FF3B30] bg-[#FF3B30]/15' },
  restore: { texto: 'Restaurado da Lixeira', cor: 'text-[#38BDF8] bg-[#38BDF8]/15' },
};

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  aberto,
  aoFechar,
  lancamento,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!aberto || !lancamento) return;
    setCarregando(true);
    fetchTransactionAuditLog(lancamento.id)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, [aberto, lancamento]);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Histórico de Alterações (Auditoria)"
    >
      <div className="space-y-3 min-w-0">
        {carregando ? (
          <p className="text-xs text-[#9A9AA6]">Carregando histórico...</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-[#9A9AA6]">
            Nenhum registro de auditoria encontrado.
          </p>
        ) : (
          logs.map((log) => {
            const info = acaoLabelMap[log.action] || {
              texto: log.action,
              cor: 'text-white bg-white/10',
            };
            const antesLiq = log.before?.net_cents;
            const depoisLiq = log.after?.net_cents;

            return (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] space-y-1.5 min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${info.cor}`}
                  >
                    {info.texto}
                  </span>
                  <span className="text-[11px] text-[#9A9AA6] tabular-nums truncate">
                    {formatDateTimeBR(log.at)}
                  </span>
                </div>

                {log.action === 'update' &&
                  antesLiq !== undefined &&
                  depoisLiq !== undefined && (
                    <div className="flex items-center gap-2 text-xs text-[#F5F5F7] pt-1 min-w-0">
                      <span className="text-[#9A9AA6] line-through tabular-nums">
                        {formatCentsToBRL(Number(antesLiq))}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" />
                      <span className="font-bold text-[#2EE59D] tabular-nums">
                        {formatCentsToBRL(Number(depoisLiq))}
                      </span>
                    </div>
                  )}

                {log.after?.note && (
                  <p className="text-xs text-[#9A9AA6] truncate">
                    Obs.: &ldquo;{log.after.note}&rdquo;
                  </p>
                )}
              </div>
            );
          })
        )}

        <Botao
          type="button"
          variante="secundario"
          larguraTotal
          icone={<History className="w-4 h-4" />}
          texto="Fechar Histórico"
          onClick={aoFechar}
        />
      </div>
    </Modal>
  );
};

