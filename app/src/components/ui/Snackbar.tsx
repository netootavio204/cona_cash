import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type SnackbarTipo = 'sucesso' | 'erro' | 'info';

export interface SnackbarMensagem {
  id: string;
  texto: string;
  tipo?: SnackbarTipo;
  acaoTexto?: string;
  aoClicarAcao?: () => void;
}

export interface SnackbarProps {
  mensagem: SnackbarMensagem | null;
  aoFechar: () => void;
}

export const Snackbar: React.FC<SnackbarProps> = ({ mensagem, aoFechar }) => {
  const iconeMap = {
    sucesso: <CheckCircle2 className="w-5 h-5 text-[#2EE59D] shrink-0" />,
    erro: <AlertTriangle className="w-5 h-5 text-[#FF3B30] shrink-0" />,
    info: <Info className="w-5 h-5 text-[#FF7A1A] shrink-0" />,
  };

  return (
    <AnimatePresence>
      {mensagem && (
        <motion.div
          key={mensagem.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50"
        >
          <div className="bg-[#18181E]/95 backdrop-blur-xl border border-[#262630] rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 min-w-0 overflow-hidden">
            {iconeMap[mensagem.tipo || 'info']}
            <p
              className="text-xs sm:text-sm text-[#F5F5F7] font-medium flex-1 min-w-0 line-clamp-2"
              title={mensagem.texto}
            >
              {mensagem.texto}
            </p>
            {mensagem.acaoTexto && mensagem.aoClicarAcao && (
              <button
                type="button"
                onClick={mensagem.aoClicarAcao}
                className="px-3 py-1.5 min-h-[38px] rounded-lg bg-[#FF7A1A]/20 text-[#FF7A1A] font-bold text-xs shrink-0 hover:bg-[#FF7A1A]/30 transition-colors"
              >
                {mensagem.acaoTexto}
              </button>
            )}
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar aviso"
              className="p-1.5 text-[#9A9AA6] hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
