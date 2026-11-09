import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  ShoppingBag,
  TrendingDown,
  Clock,
  Landmark,
  Tags,
} from 'lucide-react';
import type { ExpenseItemDetailReport } from '../../types/database';
import { fetchExpenseItemDetail } from '../../api/supabase';
import { formatCentsToBRL, formatDateTimeBR } from '../../utils/format';
import { AppIcon } from './iconLibrary';
import { Modal } from './Modal';
import { Card } from './Card';
import { ValorMoeda } from './ValorMoeda';

interface ExpenseItemDetailModalProps {
  aberto: boolean;
  aoFechar: () => void;
  itemId: string | null;
  startDateISO?: string;
  endDateISO?: string;
}

export const ExpenseItemDetailModal: React.FC<ExpenseItemDetailModalProps> = ({
  aberto,
  aoFechar,
  itemId,
  startDateISO,
  endDateISO,
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ExpenseItemDetailReport | null>(null);

  useEffect(() => {
    if (!aberto || !itemId) {
      setDetail(null);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchExpenseItemDetail(itemId, startDateISO, endDateISO);
        if (active) setDetail(data);
      } catch (err) {
        console.warn('Erro ao carregar detalhe do item:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [aberto, itemId, startDateISO, endDateISO]);

  if (!aberto) return null;

  const item = detail?.item;
  const totals = detail?.totals;
  const monthly = detail?.monthly_history || [];
  const purchases = detail?.recent_transactions || [];

  const maxMonthCents = Math.max(...monthly.map((m) => m.total_cents), 1);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={item ? `Detalhes: ${item.name}` : 'Detalhes do Item'}
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#9A9AA6]">
            Carregando histórico do item...
          </div>
        ) : !detail ? (
          <div className="py-8 text-center text-xs text-[#FF3B30]">
            Não foi possível carregar as informações deste item.
          </div>
        ) : (
          <>
            {/* Header com Ícone e KPIs principais */}
            <div className="p-3.5 rounded-2xl bg-[#0B0B0D] border border-[#262630] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#FF7A1A]/15 text-[#FF7A1A] border border-[#FF7A1A]/30 flex items-center justify-center shrink-0">
                  <AppIcon name={item?.icon} className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-white truncate">{item?.name}</h4>
                  <p className="text-xs text-[#9A9AA6]">
                    Usado {item?.use_count || 0} vez(es) no total
                  </p>
                </div>
              </div>
            </div>

            {/* Grid de Totais no Período */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-[#0B0B0D] border border-[#262630] text-center">
                <span className="text-[10px] text-[#9A9AA6] block truncate">Total no Período</span>
                <ValorMoeda centavos={totals?.total_cents || 0} tamanho="sm" cor="negativo" />
              </div>
              <div className="p-2.5 rounded-xl bg-[#0B0B0D] border border-[#262630] text-center">
                <span className="text-[10px] text-[#9A9AA6] block truncate">Nº de Compras</span>
                <span className="text-sm font-bold text-white block">
                  {totals?.count || 0}x
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0B0B0D] border border-[#262630] text-center">
                <span className="text-[10px] text-[#9A9AA6] block truncate">Valor Médio</span>
                <ValorMoeda centavos={totals?.average_cents || 0} tamanho="sm" />
              </div>
            </div>

            {/* Histórico dos Últimos 6 Meses em Barras */}
            <div className="p-3 rounded-2xl bg-[#0B0B0D] border border-[#262630]">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Histórico nos Últimos 6 Meses
              </h5>

              {monthly.length === 0 ? (
                <p className="text-xs text-[#9A9AA6] py-3 text-center">
                  Sem compras registradas nos últimos meses.
                </p>
              ) : (
                <div className="space-y-2 pt-1">
                  {monthly.map((m) => {
                    const pct = Math.round((m.total_cents / maxMonthCents) * 100);
                    return (
                      <div key={m.month} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#9A9AA6] font-medium">{m.month}</span>
                          <span className="text-white font-bold">
                            {formatCentsToBRL(m.total_cents)}{' '}
                            <span className="text-[#9A9AA6] font-normal">({m.count}x)</span>
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#1B1B22] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#FF7A1A] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lista das Compras Mais Recentes */}
            <div className="p-3 rounded-2xl bg-[#0B0B0D] border border-[#262630]">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Compras Recentes
              </h5>

              {purchases.length === 0 ? (
                <p className="text-xs text-[#9A9AA6] py-3 text-center">
                  Nenhuma compra individual encontrada.
                </p>
              ) : (
                <div className="divide-y divide-[#262630]/60 max-h-48 overflow-y-auto pr-1">
                  {purchases.map((p) => (
                    <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#9A9AA6]">
                          <Clock className="w-3 h-3" />
                          <span>{formatDateTimeBR(p.occurred_at)}</span>
                          <span>•</span>
                          <span>{p.account_name}</span>
                        </div>
                        {p.note && (
                          <p className="text-[11px] text-white/90 truncate mt-0.5">{p.note}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <ValorMoeda centavos={p.gross_cents} tamanho="sm" cor="negativo" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

