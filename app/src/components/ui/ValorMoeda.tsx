import React, { useState } from 'react';
import { formatCentsToBRL, formatCentsToCompactBRL } from '../../utils/format';

export interface ValorMoedaProps {
  centavos: number;
  compacto?: boolean;
  tamanho?: 'sm' | 'md' | 'lg' | 'xl';
  cor?: 'padrao' | 'positivo' | 'negativo' | 'destaque';
  className?: string;
}

const corClasses = {
  padrao: 'text-[#F5F5F7]',
  positivo: 'text-[#2EE59D]',
  negativo: 'text-[#FF3B30]',
  destaque: 'text-[#FF7A1A]',
};

const clampSizes = {
  sm: 'clamp(0.8rem, 2.8vw, 0.95rem)',
  md: 'clamp(0.95rem, 3.5vw, 1.15rem)',
  lg: 'clamp(1.15rem, 4.5vw, 1.5rem)',
  xl: 'clamp(1.4rem, 6vw, 2.1rem)',
};

/**
 * Exibe valores em R$ com números tabulares, fonte adaptável (clamp)
 * e abreviação opcional em cards pequenos (revelando o valor completo ao tocar — PRD 7.1).
 */
export const ValorMoeda: React.FC<ValorMoedaProps> = ({
  centavos,
  compacto = false,
  tamanho = 'md',
  cor = 'padrao',
  className = '',
}) => {
  const [mostrarCompleto, setMostrarCompleto] = useState(false);
  const textoCompleto = formatCentsToBRL(centavos);
  const textoCompacto = formatCentsToCompactBRL(centavos);
  const usaCompacto = compacto && !mostrarCompleto && textoCompacto !== textoCompleto;

  return (
    <span
      onClick={
        compacto
          ? (e) => {
              e.stopPropagation();
              setMostrarCompleto((v) => !v);
            }
          : undefined
      }
      title={textoCompleto}
      style={{ fontSize: clampSizes[tamanho] }}
      className={[
        'tabular-nums font-bold block min-w-0 truncate leading-tight',
        corClasses[cor],
        compacto ? 'cursor-pointer decoration-dotted hover:underline' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {usaCompacto ? textoCompacto : textoCompleto}
    </span>
  );
};

