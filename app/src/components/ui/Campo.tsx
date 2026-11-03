import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface CampoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
  dica?: string;
  icone?: React.ReactNode;
}

/**
 * Componente <Campo> com alvo de toque >= 48px, suporte a exibir/ocultar senha e REGRA ANTI-VAZAMENTO.
 */
export const Campo: React.FC<CampoProps> = ({
  rotulo,
  erro,
  dica,
  icone,
  type = 'text',
  className = '',
  id,
  ...rest
}) => {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (mostrarSenha ? 'text' : 'password') : type;
  const fieldId = id || `campo-${rotulo.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="w-full min-w-0 flex flex-col gap-1.5">
      <label
        htmlFor={fieldId}
        title={rotulo}
        className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate min-w-0"
      >
        {rotulo}
      </label>

      <div className="relative flex items-center min-w-0 w-full">
        {icone && (
          <span className="absolute left-3.5 text-[#9A9AA6] pointer-events-none shrink-0">
            {icone}
          </span>
        )}

        <input
          id={fieldId}
          type={inputType}
          className={[
            'w-full min-w-0 min-h-[48px] bg-[#0B0B0D]/90 border rounded-xl text-[#F5F5F7] placeholder-[#9A9AA6]/60 text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/50 focus:border-[#FF7A1A] overflow-hidden text-ellipsis',
            icone ? 'pl-10' : 'pl-3.5',
            isPassword ? 'pr-11' : 'pr-3.5',
            erro ? 'border-[#FF3B30]' : 'border-[#262630]',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#9A9AA6] hover:text-[#F5F5F7] transition-colors"
          >
            {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {erro && (
        <p className="text-xs text-[#FF3B30] font-medium leading-snug break-words">
          {erro}
        </p>
      )}
      {!erro && dica && (
        <p className="text-xs text-[#9A9AA6] leading-snug truncate" title={dica}>
          {dica}
        </p>
      )}
    </div>
  );
};

