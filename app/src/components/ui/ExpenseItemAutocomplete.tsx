import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Check, ShoppingBag } from 'lucide-react';
import type { ExpenseItem } from '../../types/database';
import { fetchExpenseItems, getOrCreateExpenseItem } from '../../api/supabase';
import { AppIcon } from './iconLibrary';
import { formatCentsToBRL } from '../../utils/format';

interface ExpenseItemAutocompleteProps {
  value: string; // ID do item ou texto
  selectedItem: ExpenseItem | null;
  onSelectItem: (item: ExpenseItem | null, newName?: string) => void;
  className?: string;
}

export function normalizeItemText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const ExpenseItemAutocomplete: React.FC<ExpenseItemAutocompleteProps> = ({
  value,
  selectedItem,
  onSelectItem,
  className = '',
}) => {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(selectedItem?.name || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega itens uma vez na montagem
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchExpenseItems();
        if (active) setItems(data);
      } catch (err) {
        console.warn('Erro ao carregar itens de saída:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // Sincroniza se o item selecionado mudar externamente
  useEffect(() => {
    if (selectedItem) {
      setInputValue(selectedItem.name);
    }
  }, [selectedItem]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtro inteligente local:
  // 1. Prefixo de palavra (começa com o termo)
  // 2. Trecho em qualquer posição
  // 3. Ordenação por use_count DESC e last_used_at DESC
  // 4. Limite de 6 itens
  const suggestions = useMemo(() => {
    const term = normalizeItemText(inputValue);
    if (!term) {
      return items.slice(0, 6);
    }

    const startsWithMatches: ExpenseItem[] = [];
    const containsMatches: ExpenseItem[] = [];

    for (const it of items) {
      const normName = it.normalized_name || normalizeItemText(it.name);
      const words = normName.split(/\s+/);
      const isWordStart = words.some((w) => w.startsWith(term));

      if (normName.startsWith(term) || isWordStart) {
        startsWithMatches.push(it);
      } else if (normName.includes(term)) {
        containsMatches.push(it);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 6);
  }, [items, inputValue]);

  // Checa se o texto digitado bate exatamente com algum existente
  const exactMatch = useMemo(() => {
    const term = normalizeItemText(inputValue);
    if (!term) return null;
    return items.find((i) => (i.normalized_name || normalizeItemText(i.name)) === term) || null;
  }, [items, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    setHighlightIndex(0);

    if (!val.trim()) {
      onSelectItem(null);
    }
  };

  const handleSelect = (item: ExpenseItem) => {
    setInputValue(item.name);
    onSelectItem(item);
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    onSelectItem(null, formatted);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const totalOptions = suggestions.length + (!exactMatch && inputValue.trim() ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % Math.max(1, totalOptions));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + totalOptions) % Math.max(1, totalOptions));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex < suggestions.length) {
        handleSelect(suggestions[highlightIndex]);
      } else if (!exactMatch && inputValue.trim()) {
        handleCreateNew();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 min-w-0 ${className}`}>
      <label
        htmlFor="expense-item-autocomplete-input"
        className="text-xs sm:text-sm font-medium text-[#F5F5F7] flex items-center justify-between"
      >
        <span>O que foi comprado? (Item)</span>
        <span className="text-[10px] text-[#9A9AA6]">Opcional</span>
      </label>

      <div className="relative">
        <input
          id="expense-item-autocomplete-input"
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Palheiro, Café, Filamento PLA, Óleo..."
          autoComplete="off"
          className="w-full min-h-[46px] px-3.5 pl-10 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/50 focus:border-[#FF7A1A]"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9AA6] pointer-events-none">
          {selectedItem?.icon ? (
            <AppIcon name={selectedItem.icon} className="w-4 h-4 text-[#FF7A1A]" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              onSelectItem(null);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9A9AA6] hover:text-white px-1.5 py-0.5 rounded bg-white/5"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Dropdown de sugestões */}
      {isOpen && (
        <div className="absolute top-[100%] left-0 right-0 mt-1 z-30 bg-[#16161D] border border-[#262630] rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto animate-fade-in">
          {suggestions.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-semibold text-[#9A9AA6] uppercase tracking-wider">
                {inputValue.trim() ? 'Sugestões correspondentes' : 'Mais usados recentemente'}
              </div>
              {suggestions.map((item, idx) => {
                const isHighlighted = idx === highlightIndex;
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs sm:text-sm transition-colors ${
                      isHighlighted
                        ? 'bg-[#FF7A1A]/15 text-[#FF7A1A]'
                        : 'text-[#F5F5F7] hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center shrink-0 text-[#9A9AA6]">
                        <AppIcon name={item.icon} className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium truncate">{item.name}</span>
                      {item.default_amount_cents > 0 && (
                        <span className="text-[11px] text-[#9A9AA6]">
                          ({formatCentsToBRL(item.default_amount_cents)})
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#2EE59D] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Opção de Criar Novo se não houver match exato */}
          {!exactMatch && inputValue.trim().length > 0 && (
            <div className="p-1.5 border-t border-[#262630] bg-[#0B0B0D]">
              <button
                type="button"
                onClick={handleCreateNew}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 rounded-lg text-xs font-semibold text-[#FF7A1A] transition-colors ${
                  highlightIndex === suggestions.length
                    ? 'bg-[#FF7A1A]/20'
                    : 'hover:bg-[#FF7A1A]/10'
                }`}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  Criar item <strong>“{inputValue.trim()}”</strong>
                </span>
              </button>
            </div>
          )}

          {suggestions.length === 0 && !inputValue.trim() && (
            <div className="px-3 py-4 text-center text-xs text-[#9A9AA6]">
              Digite o nome do que você comprou para buscar ou cadastrar.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

