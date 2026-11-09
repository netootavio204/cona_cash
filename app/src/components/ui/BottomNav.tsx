import React from 'react';
import { Home, ArrowUpDown, Receipt, BarChart3, Target, Settings } from 'lucide-react';

export type AbaNavegacao = 'inicio' | 'lancamentos' | 'pagar' | 'relatorios' | 'metas' | 'config';

export interface BottomNavProps {
  abaAtiva: AbaNavegacao;
  aoTrocarAba: (aba: AbaNavegacao) => void;
  badgePagar?: number;
}

const itens: { id: AbaNavegacao; rotulo: string; icone: React.ReactNode }[] = [
  { id: 'inicio', rotulo: 'Início', icone: <Home className="w-5 h-5" /> },
  { id: 'lancamentos', rotulo: 'Lanç.', icone: <ArrowUpDown className="w-5 h-5" /> },
  { id: 'pagar', rotulo: 'Pagar', icone: <Receipt className="w-5 h-5" /> },
  { id: 'relatorios', rotulo: 'Relat.', icone: <BarChart3 className="w-5 h-5" /> },
  { id: 'metas', rotulo: 'Metas', icone: <Target className="w-5 h-5" /> },
  { id: 'config', rotulo: 'Config', icone: <Settings className="w-5 h-5" /> },
];

/**
 * Navegação inferior mobile-first (Início, Lançamentos, Pagar, Relatórios, Metas, Config)
 * Respeita REGRA ANTI-VAZAMENTO (PRD 7.1) até em telas de 320px.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ abaAtiva, aoTrocarAba, badgePagar }) => {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0B0D]/90 backdrop-blur-xl border-t border-[#262630] lg:hidden"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-6 px-1 py-1">
        {itens.map((item) => {
          const ativo = abaAtiva === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => aoTrocarAba(item.id)}
              title={item.rotulo}
              aria-label={item.rotulo}
              aria-current={ativo ? 'page' : undefined}
              className={[
                'min-h-[52px] min-w-0 px-0.5 py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all overflow-hidden relative',
                ativo
                  ? 'text-[#FF7A1A] bg-[#FF7A1A]/10 font-semibold'
                  : 'text-[#9A9AA6] hover:text-[#F5F5F7]',
              ].join(' ')}
            >
              <span className="shrink-0 relative">
                {item.icone}
                {item.id === 'pagar' && (badgePagar ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[16px] h-4 rounded-full bg-[#D62F25] text-white text-[9px] font-black flex items-center justify-center leading-none shadow-sm">
                    {badgePagar}
                  </span>
                )}
              </span>
              <span
                style={{ fontSize: 'clamp(0.58rem, 2vw, 0.72rem)' }}
                className="w-full min-w-0 truncate text-center leading-none"
              >
                {item.rotulo}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

