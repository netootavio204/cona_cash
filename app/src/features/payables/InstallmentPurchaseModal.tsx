import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Receipt,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Sliders,
  DollarSign,
  Plus,
} from 'lucide-react';
import type {
  Account,
  Category,
  ExpenseItem,
  IncomeSource,
  InstallmentPurchaseKind,
} from '../../types/database';
import { createInstallmentPurchase } from '../../api/supabase';
import {
  divideInstallments,
  type CalculatedInstallmentItem,
} from '../../utils/installmentsCalc';
import { formatCentsToBRL } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';
import { Campo } from '../../components/ui/Campo';
import { CampoMoeda } from '../../components/ui/CampoMoeda';
import { Botao } from '../../components/ui/Botao';
import { ExpenseItemAutocomplete } from '../../components/ui/ExpenseItemAutocomplete';
import { ValorMoeda } from '../../components/ui/ValorMoeda';

export interface InstallmentPurchaseModalProps {
  aberto: boolean;
  aoFechar: () => void;
  contas: Account[];
  categorias: Category[];
  fontes: IncomeSource[];
  aoSucesso?: (mensagem: string) => void;
  aoSalvarSucesso?: (mensagem: string) => void;
  aoErro: (mensagem: string) => void;
}

export const InstallmentPurchaseModal: React.FC<InstallmentPurchaseModalProps> = ({
  aberto,
  aoFechar,
  contas,
  categorias,
  fontes,
  aoSucesso,
  aoSalvarSucesso,
  aoErro,
}) => {
  const [kind, setKind] = useState<InstallmentPurchaseKind>('credit_card');
  const [titulo, setTitulo] = useState('');
  const [itemGasto, setItemGasto] = useState<ExpenseItem | null>(null);
  const [novoItemNome, setNovoItemNome] = useState('');
  const [totalCents, setTotalCents] = useState(0);
  const [parcelasCount, setParcelasCount] = useState(3);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(() => {
    // Padrão: 30 dias à frente
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [cardName, setCardName] = useState('');
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id || '');
  const [fonteId, setFonteId] = useState('');
  const [observacao, setObservacao] = useState('');

  // Parcelas calculadas / editáveis no preview
  const [parcelasEditadas, setParcelasEditadas] = useState<CalculatedInstallmentItem[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Recalcula parcelas padrão ao mudar valor total, contagem ou primeira data
  useEffect(() => {
    if (totalCents > 0 && parcelasCount > 0 && primeiroVencimento) {
      const geradas = divideInstallments(totalCents, parcelasCount, primeiroVencimento);
      setParcelasEditadas(geradas);
    } else {
      setParcelasEditadas([]);
    }
  }, [totalCents, parcelasCount, primeiroVencimento]);

  const somaParcelas = useMemo(() => {
    return parcelasEditadas.reduce((acc, p) => acc + p.amountCents, 0);
  }, [parcelasEditadas]);

  const diferencaJurosAjuste = somaParcelas - totalCents;

  const handleSelectItemGasto = (item: ExpenseItem | null, newName?: string) => {
    setItemGasto(item);
    setNovoItemNome(newName || '');
    if (item) {
      setTitulo(item.name);
      if (item.default_category_id) setCategoriaId(item.default_category_id);
      if (item.default_amount_cents > 0 && totalCents === 0) {
        setTotalCents(item.default_amount_cents);
      }
    } else if (newName) {
      setTitulo(newName);
    }
  };

  const handleMudarValorParcela = (idx: number, novoValor: number) => {
    setParcelasEditadas((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], amountCents: novoValor };
      return copy;
    });
  };

  const handleMudarDataParcela = (idx: number, novaData: string) => {
    setParcelasEditadas((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], dueDate: novaData };
      return copy;
    });
  };

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      aoErro('Digite o título ou selecione o item da compra.');
      return;
    }
    if (totalCents <= 0) {
      aoErro('O valor total da compra deve ser maior que R$ 0,00.');
      return;
    }
    if (parcelasCount < 1 || parcelasCount > 48) {
      aoErro('O número de parcelas deve ser entre 1 e 48.');
      return;
    }
    if (!primeiroVencimento) {
      aoErro('Informe a data de vencimento da 1ª parcela.');
      return;
    }

    setSalvando(true);
    try {
      await createInstallmentPurchase({
        kind,
        title: titulo.trim(),
        total_cents: somaParcelas > 0 ? somaParcelas : totalCents,
        installments_count: parcelasCount,
        first_due_date: primeiroVencimento,
        expense_item_id: itemGasto?.id || null,
        category_id: categoriaId || null,
        income_source_id: fonteId || null,
        card_name: cardName.trim() || null,
        note: observacao.trim() || null,
        installments_override: parcelasEditadas.map((p) => ({
          number: p.number,
          due_date: p.dueDate,
          amount_cents: p.amountCents,
        })),
      });

      const callbackSucesso = aoSalvarSucesso || aoSucesso;
      callbackSucesso?.(`Compra parcelada em ${parcelasCount}x cadastrada em Contas a Pagar!`);
      aoFechar();
    } catch (err: any) {
      aoErro(err?.message || 'Erro ao salvar compra parcelada.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Nova Compra Parcelada">
      <form noValidate onSubmit={submeter} className="flex flex-col gap-4 min-w-0 max-h-[80vh] overflow-y-auto pr-1">
        {/* Seletor de Tipo: Cartão de Crédito ou Boleto Parcelado */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0B0B0D] border border-[#262630]">
          <button
            type="button"
            onClick={() => setKind('credit_card')}
            className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              kind === 'credit_card'
                ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Cartão de Crédito</span>
          </button>
          <button
            type="button"
            onClick={() => setKind('boleto')}
            className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              kind === 'boleto'
                ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                : 'text-[#9A9AA6] hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Boleto Parcelado</span>
          </button>
        </div>

        {/* Item com Autocomplete */}
        <ExpenseItemAutocomplete
          value={itemGasto?.id || ''}
          selectedItem={itemGasto}
          onSelectItem={handleSelectItemGasto}
        />

        {!itemGasto && (
          <Campo
            rotulo="Título da compra / Produto"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Smartphone, Fone de ouvido, Manutenção..."
          />
        )}

        {/* Cartão / Loja */}
        <Campo
          rotulo={kind === 'credit_card' ? 'Qual cartão? (opcional)' : 'Loja / Fornecedor (opcional)'}
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder={kind === 'credit_card' ? 'Ex.: Nubank, Inter, Visa Infinite...' : 'Ex.: Mercado Livre, Shopee, Enel...'}
        />

        {/* Valor Total e Nº de Parcelas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CampoMoeda
            rotulo="Valor total da compra"
            centavos={totalCents}
            aoMudarCentavos={setTotalCents}
          />

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Nº de parcelas (1x a 48x)
            </label>
            <select
              value={parcelasCount}
              onChange={(e) => setParcelasCount(parseInt(e.target.value, 10))}
              className="w-full min-h-[46px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-white text-sm"
            >
              {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x de {totalCents > 0 ? formatCentsToBRL(Math.floor(totalCents / n)) : 'R$ 0,00'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Vencimento da 1ª parcela */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
            Vencimento da 1ª parcela
          </label>
          <input
            type="date"
            value={primeiroVencimento}
            onChange={(e) => setPrimeiroVencimento(e.target.value)}
            className="w-full min-h-[46px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-white text-sm"
            required
          />
        </div>

        {/* Categoria e Fonte Opcional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Categoria do gasto
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full min-h-[46px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-white text-xs sm:text-sm"
            >
              {categorias.filter((c) => !c.archived).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Ligar a uma fonte (opcional)
            </label>
            <select
              value={fonteId}
              onChange={(e) => setFonteId(e.target.value)}
              className="w-full min-h-[46px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-white text-xs sm:text-sm"
            >
              <option value="">Sem vínculo com fonte</option>
              {fontes.filter((s) => s.counts_as_earning && !s.archived).map((src) => (
                <option key={src.id} value={src.id}>
                  {src.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PRÉ-VISUALIZAÇÃO DAS PARCELAS EDITÁVEIS */}
        {parcelasEditadas.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#0B0B0D] border border-[#262630] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider">
                Conferir e Ajustar Parcelas ({parcelasEditadas.length}x)
              </span>
              <span className="text-[#9A9AA6]">
                Soma: <strong>{formatCentsToBRL(somaParcelas)}</strong>
              </span>
            </div>

            {diferencaJurosAjuste !== 0 && (
              <div className="p-2 rounded-lg bg-[#FFC940]/15 border border-[#FFC940]/40 text-xs text-[#FFC940] flex items-center justify-between">
                <span>Diferença (juros/ajuste):</span>
                <strong>{formatCentsToBRL(diferencaJurosAjuste)}</strong>
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 divide-y divide-[#262630]/60">
              {parcelasEditadas.map((p, idx) => (
                <div key={p.number} className="pt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#FF7A1A] w-12 shrink-0">
                    {p.number}/{parcelasEditadas.length}
                  </span>
                  <input
                    type="date"
                    value={p.dueDate}
                    onChange={(e) => handleMudarDataParcela(idx, e.target.value)}
                    className="px-2 py-1 rounded bg-[#141418] border border-[#262630] text-white text-xs w-32 shrink-0"
                  />
                  <div className="w-32 shrink-0">
                    <CampoMoeda
                      rotulo=""
                      centavos={p.amountCents}
                      aoMudarCentavos={(v) => handleMudarValorParcela(idx, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Campo
          rotulo="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: Comprado na Black Friday com desconto"
        />

        <div className="flex gap-2 pt-2">
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
            texto="Salvar Compra Parcelada"
          />
        </div>
      </form>
    </Modal>
  );
};
