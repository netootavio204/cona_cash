import React from 'react';
import { Home, ArrowUpDown, BarChart3, Target, Settings } from 'lucide-react';

export type AbaNavegacao = 'inicio' | 'lancamentos' | 'relatorios' | 'metas' | 'config';

export interface BottomNavProps {
  abaAtiva: AbaNavegacao;
  aoTrocarAba: (aba: AbaNavegacao) => void;
}

const itens: { id: AbaNavegacao; rotulo: string; icone: React.ReactNode }[] = [
  { id: 'inicio', rotulo: 'Início', icone: <Home className="w-5 h-5" /> },
  { id: 'lancamentos', rotulo: 'Lançamentos', icone: <ArrowUpDown className="w-5 h-5" /> },
  { id: 'relatorios', rotulo: 'Relatórios', icone: <BarChart3 className="w-5 h-5" /> },
  { id: 'metas', rotulo: 'Metas', icone: <Target className="w-5 h-5" /> },
  { id: 'config', rotulo: 'Config', icone: <Settings className="w-5 h-5" /> },
];

/**
 * Navegação inferior mobile-first (Início, Lançamentos, Relatórios, Metas, Config)
 * Respeita REGRA ANTI-VAZAMENTO (PRD 7.1) até em telas de 320px.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ abaAtiva, aoTrocarAba }) => {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0B0D]/90 backdrop-blur-xl border-t border-[#262630]"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-5 px-1 py-1">
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
                'min-h-[52px] min-w-0 px-1 py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all overflow-hidden',
                ativo
                  ? 'text-[#FF7A1A] bg-[#FF7A1A]/10 font-semibold'
                  : 'text-[#9A9AA6] hover:text-[#F5F5F7]',
              ].join(' ')}
            >
              <span className="shrink-0">{item.icone}</span>
              <span
                style={{ fontSize: 'clamp(0.62rem, 2.3vw, 0.75rem)' }}
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
