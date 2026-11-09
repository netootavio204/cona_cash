import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import {
  ICON_LIBRARY,
  ICON_GROUPS,
  AppIcon,
  normalizeSearch,
  type IconDefinition,
} from './iconLibrary';

interface IconPickerProps {
  value: string | null | undefined;
  onChange: (iconId: string) => void;
  label?: string;
  className?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  label = 'Ícone',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('todos');

  const selectedIcon = value || 'tag';

  const filteredIcons = useMemo(() => {
    const term = normalizeSearch(searchTerm);

    return ICON_LIBRARY.filter((item) => {
      if (activeGroup !== 'todos' && item.group !== activeGroup) {
        return false;
      }
      if (!term) return true;

      const matchLabel = normalizeSearch(item.label).includes(term);
      const matchKeywords = item.keywords.some((kw) => normalizeSearch(kw).includes(term));
      return matchLabel || matchKeywords;
    });
  }, [searchTerm, activeGroup]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-medium text-cinza-claro">{label}</label>}

      {/* Botão de disparo */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-laranja/40 hover:bg-white/10 transition-all text-left w-full focus:outline-none focus:ring-2 focus:ring-laranja/50"
      >
        <div className="w-8 h-8 rounded-lg bg-laranja/10 text-laranja border border-laranja/20 flex items-center justify-center shrink-0">
          <AppIcon name={selectedIcon} className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-cinza-claro/70">Ícone selecionado</div>
          <div className="text-sm font-semibold text-branco truncate">
            {ICON_LIBRARY.find((i) => i.id === selectedIcon)?.label || selectedIcon}
          </div>
        </div>
        <span className="text-xs text-laranja font-medium px-2 py-0.5 rounded bg-laranja/10 border border-laranja/20">
          Trocar
        </span>
      </button>

      {/* Modal / Dialog de Seleção */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg bg-grafite border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-branco">Selecione um Ícone</h3>
                <p className="text-xs text-cinza-claro">
                  Escolha um ícone para personalizar este item
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-cinza-claro hover:text-branco flex items-center justify-center transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Busca */}
            <div className="p-3 border-b border-white/10 bg-white/[0.02]">
              <div className="relative">
                <Search className="w-4 h-4 text-cinza-claro absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou categoria (ex: gasolina, pix, cafe)..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-branco placeholder-cinza-claro/50 focus:outline-none focus:ring-2 focus:ring-laranja/50 focus:border-laranja"
                  autoFocus
                />
              </div>

              {/* Filtro de Grupos */}
              <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar mt-1">
                <button
                  type="button"
                  onClick={() => setActiveGroup('todos')}
                  className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-all ${
                    activeGroup === 'todos'
                      ? 'bg-laranja text-white font-medium shadow-sm'
                      : 'bg-white/5 text-cinza-claro hover:bg-white/10'
                  }`}
                >
                  Todos ({ICON_LIBRARY.length})
                </button>
                {ICON_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveGroup(g.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-all ${
                      activeGroup === g.id
                        ? 'bg-laranja text-white font-medium shadow-sm'
                        : 'bg-white/5 text-cinza-claro hover:bg-white/10'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Ícones */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {filteredIcons.length === 0 ? (
                <div className="py-12 text-center text-xs text-cinza-claro">
                  Nenhum ícone encontrado para "{searchTerm}".
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                  {filteredIcons.map((item) => {
                    const isSelected = item.id === selectedIcon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onChange(item.id);
                          setIsOpen(false);
                        }}
                        className={`group p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                          isSelected
                            ? 'bg-laranja/15 border-laranja text-laranja ring-1 ring-laranja/50'
                            : 'bg-white/5 border-white/5 text-cinza-claro hover:text-branco hover:bg-white/10 hover:border-white/15'
                        }`}
                        title={item.label}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${
                            isSelected
                              ? 'bg-laranja text-white shadow-md'
                              : 'bg-white/5 text-cinza-claro group-hover:text-branco'
                          }`}
                        >
                          <AppIcon name={item.id} className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] mt-1.5 font-medium truncate w-full text-center">
                          {item.label.split('/')[0].trim()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rodapé informativo */}
            <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-cinza-claro">
              <span>{filteredIcons.length} ícones disponíveis</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-branco text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

