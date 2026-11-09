import React, { useRef } from 'react';
import { formatCentsToBRL, parseDigitsToCents } from '../../utils/format';

export interface CampoMoedaProps {
  rotulo: string;
  centavos: number;
  aoMudarCentavos: (novosCentavos: number) => void;
  dica?: string;
  erro?: string;
  disabled?: boolean;
}

/**
 * Campo com máscara de moeda R$ trabalhando 100% em centavos (inteiro).
 * O prefixo "R$" fica fora do <input> para que o valor interno contenha apenas números e vírgula,
 * garantindo abertura exclusiva do teclado numérico no Android (type="tel" + inputMode="numeric")
 * e zero bloqueio de validação HTML5 no submit.
 */
export const CampoMoeda: React.FC<CampoMoedaProps> = ({
  rotulo,
  centavos,
  aoMudarCentavos,
  dica,
  erro,
  disabled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const valorFormatado = formatCentsToBRL(centavos);
  // Remove o prefixo "R$" e espaços para deixar apenas números, ponto e vírgula (ex.: "0,00" ou "9,30")
  const valorApenasNumeros = valorFormatado.replace(/^R\$\s?/, '').trim();
  const id = `campo-moeda-${rotulo.toLowerCase().replace(/\s+/g, '-')}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novosCentavos = parseDigitsToCents(e.target.value);
    aoMudarCentavos(novosCentavos);
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-1.5">
      {rotulo && (
        <label
          htmlFor={id}
          title={rotulo}
          className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate min-w-0"
        >
          {rotulo}
        </label>
      )}

      <div
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus();
          }
        }}
        className={[
          'campo-moeda-box w-full min-w-0 min-h-[48px] px-3.5 bg-[#0B0B0D]/90 border rounded-xl text-[#F5F5F7] font-bold tabular-nums text-base transition-colors flex items-center gap-1.5 focus-within:ring-2 focus-within:ring-[#FF7A1A]/50 focus-within:border-[#FF7A1A] overflow-hidden cursor-text',
          erro ? 'border-[#FF3B30]' : 'border-[#262630]',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <span className="text-[#9A9AA6] font-bold select-none shrink-0">R$</span>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          value={valorApenasNumeros}
          onChange={handleChange}
          onFocus={(e) => {
            const len = e.currentTarget.value.length;
            try {
              e.currentTarget.setSelectionRange(len, len);
            } catch {
              // Ignora se o navegador não suportar setSelectionRange em type=tel
            }
          }}
          disabled={disabled}
          className="campo-moeda-input w-full min-w-0 bg-transparent border-0 p-0 text-[#F5F5F7] font-bold tabular-nums text-base focus:outline-none focus:ring-0 overflow-hidden text-ellipsis"
        />
      </div>

      {erro && <p className="text-xs text-[#FF3B30] font-medium">{erro}</p>}
      {!erro && dica && (
        <p className="text-xs text-[#9A9AA6] truncate" title={dica}>
          {dica}
        </p>
      )}
    </div>
  );
};
