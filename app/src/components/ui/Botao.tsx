import React from 'react';
import { motion } from 'framer-motion';

export type BotaoVariante = 'primario' | 'secundario' | 'perigo' | 'sucesso' | 'fantasma';
export type BotaoTamanho = 'sm' | 'md' | 'lg';

export interface BotaoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: BotaoVariante;
  tamanho?: BotaoTamanho;
  icone?: React.ReactNode;
  carregando?: boolean;
  larguraTotal?: boolean;
  texto?: string;
}

const varianteClasses: Record<BotaoVariante, string> = {
  primario:
    'bg-gradient-to-r from-[#FF7A1A] to-[#FF9500] text-[#0B0B0D] font-bold shadow-[0_0_20px_rgba(255,122,26,0.3)] hover:brightness-110 border border-[#FFC940]/30',
  secundario:
    'bg-[#18181E] text-[#F5F5F7] font-semibold border border-[#262630] hover:border-[#FF7A1A]/50 hover:bg-[#1E1E26]',
  perigo:
    'bg-[#FF3B30]/15 text-[#FF3B30] font-semibold border border-[#FF3B30]/40 hover:bg-[#FF3B30]/25',
  sucesso:
    'bg-[#2EE59D]/15 text-[#2EE59D] font-semibold border border-[#2EE59D]/40 hover:bg-[#2EE59D]/25',
  fantasma:
    'bg-transparent text-[#9A9AA6] font-medium hover:text-[#F5F5F7] hover:bg-white/5 border border-transparent',
};

const tamanhoClasses: Record<BotaoTamanho, string> = {
  sm: 'min-h-[44px] px-3 py-2 rounded-xl',
  md: 'min-h-[48px] px-4 py-2.5 rounded-xl',
  lg: 'min-h-[52px] px-5 py-3 rounded-2xl',
};

/**
 * Componente único <Botao> com REGRA ANTI-VAZAMENTO (PRD 7.1):
 * - min-w-0, max-w-full, overflow-hidden
 * - Fonte que encolhe automaticamente com clamp() conforme o comprimento do texto
 * - Se ainda não couber na tela (ex: 320px), corta com reticências ("…") e exibe texto completo em title/aria-label
 */
export const Botao: React.FC<BotaoProps> = ({
  variante = 'primario',
  tamanho = 'md',
  icone,
  carregando = false,
  larguraTotal = false,
  texto,
  children,
  className = '',
  disabled,
  title,
  ...rest
}) => {
  const labelString =
    texto ?? (typeof children === 'string' ? children : undefined);

  // Calcula clamp dinâmico caso o texto seja longo (REGRA ANTI-VAZAMENTO PRD 7.1)
  const isLongText = (labelString?.length ?? 0) > 22;
  const isVeryLongText = (labelString?.length ?? 0) > 34;

  const fontSizeStyle: React.CSSProperties = {
    fontSize: isVeryLongText
      ? 'clamp(0.72rem, 2.5vw, 0.85rem)'
      : isLongText
        ? 'clamp(0.78rem, 2.8vw, 0.92rem)'
        : tamanho === 'lg'
          ? 'clamp(0.88rem, 3.2vw, 1rem)'
          : 'clamp(0.82rem, 3vw, 0.95rem)',
  };

  return (
    <motion.button
      whileTap={disabled || carregando ? undefined : { scale: 0.98 }}
      disabled={disabled || carregando}
      title={title ?? labelString}
      aria-label={rest['aria-label'] ?? labelString}
      style={fontSizeStyle}
      className={[
        'inline-flex items-center justify-center gap-2 min-w-0 max-w-full overflow-hidden transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/60 disabled:opacity-50 disabled:cursor-not-allowed',
        varianteClasses[variante],
        tamanhoClasses[tamanho],
        larguraTotal ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(rest as any)}
    >
      {carregando ? (
        <span
          className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      ) : (
        icone && <span className="shrink-0 flex items-center">{icone}</span>
      )}
      <span className="min-w-0 truncate block leading-tight">
        {texto ?? children}
      </span>
    </motion.button>
  );
};

