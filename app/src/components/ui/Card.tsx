import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  bordaAnimada?: boolean;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingClasses = {
  sm: 'p-3.5',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

/**
 * Componente <Card> futurista com vidro fosco (backdrop-blur) e borda com brilho animado opcional.
 * Segue a REGRA ANTI-VAZAMENTO (PRD 7.1): min-w-0, max-w-full, overflow-hidden.
 */
export const Card: React.FC<CardProps> = ({
  children,
  bordaAnimada = false,
  className = '',
  padding = 'md',
  onClick,
}) => {
  if (bordaAnimada) {
    return (
      <div
        onClick={onClick}
        className={[
          'cona-glow-border p-[1.5px] rounded-2xl min-w-0 max-w-full overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.45)]',
          onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={[
            'bg-[#141418]/95 backdrop-blur-xl rounded-[15px] h-full w-full min-w-0 overflow-hidden',
            paddingClasses[padding],
          ].join(' ')}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={[
        'bg-[#141418]/85 backdrop-blur-xl border border-[#262630] rounded-2xl min-w-0 max-w-full overflow-hidden shadow-[0_6px_24px_rgba(0,0,0,0.35)]',
        paddingClasses[padding],
        onClick
          ? 'cursor-pointer hover:border-[#FF7A1A]/40 active:scale-[0.99] transition-all'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
};

