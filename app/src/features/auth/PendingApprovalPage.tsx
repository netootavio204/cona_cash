import React, { useState } from 'react';
import { Clock, ShieldX, RefreshCw, LogOut, Terminal } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { APP_NAME, APP_VERSION } from '../../config/version';

export const PendingApprovalPage: React.FC = () => {
  const { perfil, usuario, recarregarPerfilEConfig, sair } = useAuth();
  const [verificando, setVerificando] = useState(false);
  const [mostrarSqlAdmin, setMostrarSqlAdmin] = useState(false);

  const bloqueado = perfil?.status === 'blocked';
  const emailAtual = perfil?.email || usuario?.email || 'seu-email@dominio.com';

  const verificarAgora = async () => {
    setVerificando(true);
    try {
      await recarregarPerfilEConfig();
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0B0D] text-[#F5F5F7] flex flex-col justify-between px-3 py-6 sm:px-6">
      <div className="w-full max-w-md mx-auto my-auto flex flex-col gap-4 min-w-0">
        <Card bordaAnimada padding="lg">
          <div className="flex flex-col items-center text-center gap-3 min-w-0">
            <div
              className={[
                'w-16 h-16 rounded-2xl flex items-center justify-center border',
                bloqueado
                  ? 'bg-[#FF3B30]/15 border-[#FF3B30]/40 text-[#FF3B30]'
                  : 'bg-[#FFC940]/15 border-[#FFC940]/40 text-[#FFC940]',
              ].join(' ')}
            >
              {bloqueado ? (
                <ShieldX className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8" />
              )}
            </div>

            <h1
              style={{ fontSize: 'clamp(1.15rem, 4.5vw, 1.4rem)' }}
              className="font-extrabold text-white truncate max-w-full"
            >
              {bloqueado ? 'Acesso Bloqueado' : 'Aguardando Aprovação'}
            </h1>

            <p className="text-xs sm:text-sm text-[#9A9AA6] leading-relaxed">
              {bloqueado
                ? 'Sua conta foi bloqueada pelo administrador. Entre em contato caso precise reativar seu acesso.'
                : 'Seu cadastro foi recebido com sucesso! Para sua segurança, o administrador precisa aprovar sua conta antes do primeiro acesso.'}
            </p>

            <div className="w-full bg-[#0B0B0D] border border-[#262630] rounded-xl p-3 text-left min-w-0">
              <p className="text-[11px] text-[#9A9AA6] uppercase tracking-wider font-semibold">
                Conta conectada
              </p>
              <p className="text-sm font-bold text-white truncate mt-0.5" title={emailAtual}>
                {emailAtual}
              </p>
              <p className="text-xs text-[#FFC940] mt-1 font-medium">
                Status: {bloqueado ? 'Bloqueado' : 'Pendente de aprovação'}
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5 mt-2 min-w-0">
              <Botao
                variante="primario"
                larguraTotal
                carregando={verificando}
                onClick={verificarAgora}
                icone={<RefreshCw className="w-4 h-4" />}
                texto="Verificar se já fui aprovado"
              />

              <Botao
                variante="secundario"
                larguraTotal
                onClick={sair}
                icone={<LogOut className="w-4 h-4" />}
                texto="Sair desta conta"
              />
            </div>

            {/* Atalho útil para o primeiro acesso do Octavio */}
            <div className="w-full pt-3 border-t border-[#262630]/80 mt-2 text-left min-w-0">
              <button
                type="button"
                onClick={() => setMostrarSqlAdmin((v) => !v)}
                className="w-full flex items-center justify-between text-xs text-[#9A9AA6] hover:text-white py-1 min-w-0"
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Terminal className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" />
                  <span className="truncate">Primeiro acesso do Admin? Ver SQL</span>
                </span>
                <span className="text-[#FF7A1A] font-semibold shrink-0 ml-2">
                  {mostrarSqlAdmin ? 'Ocultar' : 'Mostrar'}
                </span>
              </button>

              {mostrarSqlAdmin && (
                <div className="mt-2 p-2.5 rounded-xl bg-[#0B0B0D] border border-[#262630] text-[11px] text-[#9A9AA6] space-y-1.5 overflow-x-auto">
                  <p className="text-[#F5F5F7] font-medium">
                    Cole no SQL Editor do Supabase para aprovar esta conta como Admin:
                  </p>
                  <pre className="text-[#2EE59D] font-mono text-[10px] whitespace-pre-wrap break-all select-all">
{`UPDATE public.profiles
SET role = 'admin', status = 'approved'
WHERE lower(email) = lower('${emailAtual}');`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <footer className="w-full text-center pt-4">
        <p className="text-xs text-[#9A9AA6]/80 truncate">
          {APP_NAME} • <span className="text-[#FF7A1A] font-semibold">{APP_VERSION}</span>
        </p>
      </footer>
    </div>
  );
};

