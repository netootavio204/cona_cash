import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  aberto,
  aoFechar,
  titulo,
  children,
}) => {
  return (
    <AnimatePresence>
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md min-w-0 bg-[#141418] border border-[#262630] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-[#262630] min-w-0">
              <h2
                className="text-base sm:text-lg font-bold text-[#F5F5F7] truncate min-w-0"
                title={titulo}
              >
                {titulo}
              </h2>
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar modal"
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#9A9AA6] hover:text-[#F5F5F7] hover:bg-white/5 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto min-w-0">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
