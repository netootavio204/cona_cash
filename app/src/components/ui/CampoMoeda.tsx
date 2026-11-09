import React from 'react';
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
 * Ao digitar números, formata automaticamente como R$ 0,00 sem risco de erro de ponto flutuante.
 */
export const CampoMoeda: React.FC<CampoMoedaProps> = ({
  rotulo,
  centavos,
  aoMudarCentavos,
  dica,
  erro,
  disabled,
}) => {
  const valorFormatado = formatCentsToBRL(centavos);
  const id = `campo-moeda-${rotulo.toLowerCase().replace(/\s+/g, '-')}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novosCentavos = parseDigitsToCents(e.target.value);
    aoMudarCentavos(novosCentavos);
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-1.5">
      <label
        htmlFor={id}
        title={rotulo}
        className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate min-w-0"
      >
        {rotulo}
      </label>

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        value={valorFormatado}
        onChange={handleChange}
        disabled={disabled}
        className={[
          'w-full min-w-0 min-h-[48px] px-3.5 bg-[#0B0B0D]/90 border rounded-xl text-[#F5F5F7] font-bold tabular-nums text-base transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/50 focus:border-[#FF7A1A] overflow-hidden text-ellipsis',
          erro ? 'border-[#FF3B30]' : 'border-[#262630]',
        ].join(' ')}
      />

      {erro && <p className="text-xs text-[#FF3B30] font-medium">{erro}</p>}
      {!erro && dica && (
        <p className="text-xs text-[#9A9AA6] truncate" title={dica}>
          {dica}
        </p>
      )}
    </div>
  );
};

