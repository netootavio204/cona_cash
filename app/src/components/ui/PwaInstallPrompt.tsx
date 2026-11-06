import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Botao } from './Botao';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Se não tiver sido dispensado nas últimas 24h
      const dismissed = localStorage.getItem('cona_pwa_dismissed');
      if (!dismissed || Date.now() - Number(dismissed) > 86400000) {
        setVisivel(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Se já estiver instalado em modo standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setVisivel(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisivel(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisivel(false);
    localStorage.setItem('cona_pwa_dismissed', String(Date.now()));
  };

  if (!visivel || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-40 p-3.5 rounded-2xl bg-[#141418] border border-[#FF7A1A]/40 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 min-w-0 cona-glow-border animate-in fade-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#FF7A1A]/15 text-[#FF7A1A] flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">Instalar no Celular</p>
          <p className="text-[11px] text-[#9A9AA6] truncate">Abra em tela cheia direto da tela inicial</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Botao
          tamanho="sm"
          variante="primario"
          icone={<Download className="w-3.5 h-3.5" />}
          texto="Instalar"
          onClick={handleInstall}
        />
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg text-[#9A9AA6] hover:text-white"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

