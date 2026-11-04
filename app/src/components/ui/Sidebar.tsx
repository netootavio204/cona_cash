import React, { useRef } from 'react';
import {
  Home,
  ArrowUpDown,
  BarChart3,
  Target,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Keyboard,
} from 'lucide-react';
import type { AbaNavegacao } from './BottomNav';
import { APP_NAME, APP_VERSION } from '../../config/version';

export interface SidebarProps {
  abaAtiva: AbaNavegacao;
  aoTrocarAba: (aba: AbaNavegacao) => void;
  aoAbrirAdmin?: () => void;
  recolhida: boolean;
  aoAlternarRecolhida: () => void;
  nomeUsuario: string;
  isAdmin: boolean;
  aoSair: () => void;
}

const itensMenu: {
  id: AbaNavegacao;
  rotulo: string;
  icone: React.ReactNode;
}[] = [
  { id: 'inicio', rotulo: 'Início', icone: <Home className="w-5 h-5" /> },
  {
    id: 'lancamentos',
    rotulo: 'Lançamentos',
    icone: <ArrowUpDown className="w-5 h-5" />,
  },
  {
    id: 'relatorios',
    rotulo: 'Relatórios',
    icone: <BarChart3 className="w-5 h-5" />,
  },
  { id: 'metas', rotulo: 'Metas', icone: <Target className="w-5 h-5" /> },
  {
    id: 'config',
    rotulo: 'Configurações',
    icone: <Settings className="w-5 h-5" />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  abaAtiva,
  aoTrocarAba,
  aoAbrirAdmin,
  recolhida,
  aoAlternarRecolhida,
  nomeUsuario,
  isAdmin,
  aoSair,
}) => {
  const navRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const gerenciarSetasMenu = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const total = navRefs.current.filter(Boolean).length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % total;
      navRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + total) % total;
      navRefs.current[prev]?.focus();
    }
  };

  return (
    <aside
      aria-label="Menu lateral de navegação"
      className={[
        'hidden lg:flex lg:flex-col lg:justify-between lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-[#141418]/95 backdrop-blur-xl border-r border-[#262630] transition-[width] duration-200 z-40 select-none',
        recolhida
          ? 'lg:w-[76px] min-[1920px]:w-[88px]'
          : 'lg:w-[248px] min-[1920px]:w-[288px]',
      ].join(' ')}
    >
      {/* Topo: Logo Cona + Botão Recolher/Expandir */}
      <div className="flex flex-col gap-4 p-3.5 min-w-0">
        <div
          className={[
            'flex items-center gap-2.5 min-w-0',
            recolhida ? 'justify-center' : 'justify-between',
          ].join(' ')}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logos/logo_dark.png"
              alt="Cona Cash"
              className="w-10 h-10 min-[1920px]:w-12 min-[1920px]:h-12 rounded-xl bg-black p-0.5 border border-[#FF7A1A]/40 shrink-0 object-contain shadow-[0_0_15px_rgba(255,122,26,0.2)]"
            />
            {!recolhida && (
              <div className="min-w-0">
                <span className="font-extrabold text-base min-[1920px]:text-lg text-white block truncate">
                  {APP_NAME}
                </span>
                <span className="text-[11px] text-[#9A9AA6] block truncate">
                  Gestão Financeira
                </span>
              </div>
            )}
          </div>

          {!recolhida && (
            <button
              type="button"
              onClick={aoAlternarRecolhida}
              title="Recolher menu lateral"
              aria-label="Recolher menu lateral"
              className="w-8 h-8 rounded-lg bg-[#0B0B0D] border border-[#262630] text-[#9A9AA6] hover:text-white hover:border-[#FF7A1A]/50 flex items-center justify-center shrink-0 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {recolhida && (
          <button
            type="button"
            onClick={aoAlternarRecolhida}
            title="Expandir menu lateral"
            aria-label="Expandir menu lateral"
            className="w-full min-h-[36px] rounded-lg bg-[#0B0B0D] border border-[#262630] text-[#9A9AA6] hover:text-white hover:border-[#FF7A1A]/50 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Itens de Navegação */}
        <nav
          aria-label="Links do menu lateral"
          className="flex flex-col gap-1.5 min-w-0 pt-1"
        >
          {itensMenu.map((item, idx) => {
            const ativo = abaAtiva === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  navRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => aoTrocarAba(item.id)}
                onKeyDown={(e) => gerenciarSetasMenu(e, idx)}
                title={item.rotulo}
                aria-label={item.rotulo}
                aria-current={ativo ? 'page' : undefined}
                className={[
                  'min-h-[46px] min-[1920px]:min-h-[54px] px-3 py-2 rounded-xl flex items-center gap-3 transition-all min-w-0 overflow-hidden border',
                  recolhida ? 'justify-center' : 'justify-start',
                  ativo
                    ? 'bg-gradient-to-r from-[#FF7A1A]/20 to-[#FFC940]/10 border-[#FF7A1A] text-[#FF7A1A] font-bold shadow-[0_0_20px_rgba(255,122,26,0.2)]'
                    : 'bg-transparent border-transparent text-[#9A9AA6] hover:text-white hover:bg-white/5',
                ].join(' ')}
              >
                <span className="shrink-0">{item.icone}</span>
                {!recolhida && (
                  <span className="text-sm min-[1920px]:text-base truncate">
                    {item.rotulo}
                  </span>
                )}
              </button>
            );
          })}

          {isAdmin && aoAbrirAdmin && (
            <button
              ref={(el) => {
                navRefs.current[itensMenu.length] = el;
              }}
              type="button"
              onClick={aoAbrirAdmin}
              onKeyDown={(e) => gerenciarSetasMenu(e, itensMenu.length)}
              title="Painel Admin"
              aria-label="Painel Admin"
              className={[
                'min-h-[44px] min-[1920px]:min-h-[52px] px-3 py-2 rounded-xl flex items-center gap-3 transition-all min-w-0 overflow-hidden border border-dashed border-[#FFC940]/30 text-[#FFC940] hover:bg-[#FFC940]/10 mt-1',
                recolhida ? 'justify-center' : 'justify-start',
              ].join(' ')}
            >
              <Users className="w-5 h-5 shrink-0" />
              {!recolhida && (
                <span className="text-xs min-[1920px]:text-sm font-bold truncate">
                  Painel Admin
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* Rodapé do Menu Lateral: Atalhos + Usuário + Versão + Sair */}
      <div className="p-3.5 border-t border-[#262630] flex flex-col gap-3 min-w-0 bg-[#0B0B0D]/50">
        {!recolhida && (
          <div className="p-2.5 rounded-xl bg-[#141418] border border-[#262630] text-[11px] text-[#9A9AA6] space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-white font-semibold truncate">
              <Keyboard className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" />
              <span className="truncate">Atalhos de Teclado</span>
            </div>
            <p className="truncate">
              <kbd className="px-1 py-0.5 rounded bg-[#0B0B0D] border border-[#262630] text-[#FF7A1A] font-bold">
                N
              </kbd>{' '}
              Entrada •{' '}
              <kbd className="px-1 py-0.5 rounded bg-[#0B0B0D] border border-[#262630] text-[#FF3B30] font-bold">
                S
              </kbd>{' '}
              Saída
            </p>
            <p className="truncate">
              <kbd className="px-1 py-0.5 rounded bg-[#0B0B0D] border border-[#262630] text-[#FFC940] font-bold">
                T
              </kbd>{' '}
              Transferir •{' '}
              <kbd className="px-1 py-0.5 rounded bg-[#0B0B0D] border border-[#262630] text-[#2EE59D] font-bold">
                L
              </kbd>{' '}
              Lote
            </p>
          </div>
        )}

        <div
          className={[
            'flex items-center gap-2.5 min-w-0',
            recolhida ? 'flex-col justify-center' : 'justify-between',
          ].join(' ')}
        >
          {!recolhida && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="text-xs min-[1920px]:text-sm font-bold text-white truncate"
                  title={nomeUsuario}
                >
                  {nomeUsuario}
                </span>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-full bg-[#FF7A1A]/20 text-[#FF7A1A] border border-[#FF7A1A]/40 shrink-0">
                    ADMIN
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#FF7A1A] font-semibold block truncate">
                {APP_VERSION}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={aoSair}
            title="Sair da conta"
            aria-label="Sair da conta"
            className={[
              'min-h-[40px] px-3 rounded-xl bg-[#141418] border border-[#262630] text-xs font-bold text-[#9A9AA6] hover:text-[#FF3B30] hover:border-[#FF3B30]/40 flex items-center justify-center gap-1.5 transition-colors shrink-0',
              recolhida ? 'w-full' : '',
            ].join(' ')}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!recolhida && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

