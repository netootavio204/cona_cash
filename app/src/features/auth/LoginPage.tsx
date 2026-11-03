import React, { useState, useEffect } from 'react';
import { Mail, Lock, User as UserIcon, KeyRound, ShieldAlert, ArrowLeft } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from './AuthContext';
import { Card } from '../../components/ui/Card';
import { Campo } from '../../components/ui/Campo';
import { Botao } from '../../components/ui/Botao';
import { Snackbar, type SnackbarMensagem } from '../../components/ui/Snackbar';
import { APP_NAME, APP_VERSION } from '../../config/version';

type ModoTela = 'login' | 'cadastro' | 'recuperar';

const INITIAL_ADMIN_EMAIL = 'netootavio204@gmail.com';

export const LoginPage: React.FC = () => {
  const { configApp, recarregarPerfilEConfig } = useAuth();
  const [modo, setModo] = useState<ModoTela>('login');

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarMensagem | null>(null);

  const cadastroAberto = configApp.signup_open;

  useEffect(() => {
    if (!cadastroAberto && modo === 'cadastro') {
      setModo('login');
    }
  }, [cadastroAberto, modo]);

  const mostrarAviso = (texto: string, tipo: 'sucesso' | 'erro' | 'info' = 'info') => {
    setSnackbar({
      id: String(Date.now()),
      texto,
      tipo,
    });
  };

  const traduzirErroAuth = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('cadastro_fechado') || lower.includes('fechado pelo administrador')) {
      return 'O cadastro de novos usuários está fechado pelo administrador.';
    }
    if (lower.includes('invalid login credentials')) {
      return 'E-mail ou senha incorretos (ou conta ainda não criada na aba "Criar conta").';
    }
    if (lower.includes('user already registered')) {
      return 'Este e-mail já está cadastrado. Use a aba "Entrar" ou recupere sua senha.';
    }
    if (lower.includes('password should be at least')) {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Confirme seu e-mail antes de entrar ou peça aprovação ao administrador.';
    }
    return msg;
  };

  const normalizarSenhaSupabase = (raw: string): string => {
    // O Supabase Auth exige no mínimo 6 caracteres internamente.
    // Completamos de forma determinística caso o usuário prefira uma senha curta (ex: 4 ou 5 caracteres).
    if (raw.length > 0 && raw.length < 6) {
      return `${raw}_cona6`;
    }
    return raw;
  };

  const aoSubmeter = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpo = email.trim().toLowerCase();
    const senhaFinal = normalizarSenhaSupabase(senha);

    if (!emailLimpo) {
      mostrarAviso('Informe seu e-mail.', 'erro');
      return;
    }

    setEnviando(true);
    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailLimpo,
          password: senhaFinal,
        });

        // Se for o primeiro acesso do e-mail Admin (netootavio204@gmail.com) direto na aba Entrar,
        // cria automaticamente a conta Admin com a senha informada e já entra!
        if (error && emailLimpo === INITIAL_ADMIN_EMAIL) {
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: emailLimpo,
            password: senhaFinal,
            options: {
              data: { name: 'Octavio' },
            },
          });

          if (!signUpErr && signUpData.session) {
            await recarregarPerfilEConfig();
            return;
          }
        }

        if (error) throw error;
        await recarregarPerfilEConfig();
      } else if (modo === 'cadastro') {
        await recarregarPerfilEConfig();
        if (!configApp.signup_open) {
          setModo('login');
          throw new Error('CADASTRO_FECHADO: O cadastro de novos usuários está fechado.');
        }

        const { data, error } = await supabase.auth.signUp({
          email: emailLimpo,
          password: senhaFinal,
          options: {
            data: {
              name: nome.trim() || (emailLimpo === INITIAL_ADMIN_EMAIL ? 'Octavio' : emailLimpo.split('@')[0]),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          await recarregarPerfilEConfig();
          if (emailLimpo !== INITIAL_ADMIN_EMAIL) {
            mostrarAviso(
              'Cadastro criado! Sua conta aguarda aprovação do administrador.',
              'sucesso'
            );
          }
        } else {
          mostrarAviso(
            'Cadastro registrado! Faça login para acompanhar a aprovação.',
            'sucesso'
          );
          setModo('login');
        }
      } else if (modo === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        mostrarAviso(
          'Enviamos um link de recuperação de senha para o seu e-mail!',
          'sucesso'
        );
        setModo('login');
      }
    } catch (err: any) {
      mostrarAviso(
        traduzirErroAuth(err?.message || 'Erro ao processar solicitação.'),
        'erro'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0B0D] text-[#F5F5F7] flex flex-col justify-between px-3 py-6 sm:px-6 relative overflow-hidden">
      {/* Brilho ambiental de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full bg-[#FF7A1A]/15 blur-[110px]"
      />

      <div className="w-full max-w-md mx-auto my-auto z-10 flex flex-col gap-5 min-w-0">
        {/* Cabeçalho com Logo Oficial da Cona (Versão Dark com texto "Con" Branco de alto contraste) */}
        <div className="flex flex-col items-center text-center gap-2.5 min-w-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-black border border-[#FF7A1A]/40 p-1.5 shadow-[0_0_35px_rgba(255,122,26,0.28)] flex items-center justify-center overflow-hidden">
            <img
              src="/logos/logo_dark.png"
              alt="Logo Cona Cash"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
          <h1
            style={{ fontSize: 'clamp(1.35rem, 5vw, 1.75rem)' }}
            className="font-extrabold tracking-tight text-white truncate max-w-full"
          >
            Cona <span className="text-[#FF7A1A]">Cash</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#9A9AA6] max-w-xs leading-relaxed">
            Controle rápido e inteligente do que entra, do que sai e das suas metas.
          </p>
        </div>

        {/* Card Principal com Borda Animada */}
        <Card bordaAnimada padding="lg">
          {modo !== 'recuperar' ? (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B0B0D] rounded-xl border border-[#262630] mb-5 min-w-0">
              <button
                type="button"
                onClick={() => setModo('login')}
                className={[
                  'min-h-[42px] px-2 rounded-lg text-xs sm:text-sm font-bold transition-all truncate min-w-0',
                  modo === 'login'
                    ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                    : 'text-[#9A9AA6] hover:text-white',
                ].join(' ')}
              >
                Entrar
              </button>

              {cadastroAberto ? (
                <button
                  type="button"
                  onClick={() => setModo('cadastro')}
                  className={[
                    'min-h-[42px] px-2 rounded-lg text-xs sm:text-sm font-bold transition-all truncate min-w-0',
                    modo === 'cadastro'
                      ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                      : 'text-[#9A9AA6] hover:text-white',
                  ].join(' ')}
                >
                  Criar conta
                </button>
              ) : (
                <div
                  title="Novos cadastros estão desativados pelo administrador"
                  className="min-h-[42px] px-2 rounded-lg text-[11px] font-medium text-[#9A9AA6]/60 flex items-center justify-center gap-1 truncate min-w-0 select-none"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-[#FFC940] shrink-0" />
                  <span className="truncate">Cadastro fechado</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4 min-w-0">
              <button
                type="button"
                onClick={() => setModo('login')}
                className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-[#9A9AA6] hover:text-white"
                aria-label="Voltar para o login"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white truncate">
                  Recuperar senha
                </h2>
                <p className="text-xs text-[#9A9AA6] truncate">
                  Enviaremos um link para o seu e-mail
                </p>
              </div>
            </div>
          )}

          <form onSubmit={aoSubmeter} className="flex flex-col gap-4 min-w-0">
            {modo === 'cadastro' && cadastroAberto && (
              <Campo
                rotulo="Como quer ser chamado?"
                placeholder="Ex.: Octavio"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                icone={<UserIcon className="w-4 h-4" />}
                autoComplete="name"
                required
              />
            )}

            <Campo
              rotulo="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icone={<Mail className="w-4 h-4" />}
              autoComplete="email"
              required
            />

            {modo !== 'recuperar' && (
              <Campo
                rotulo="Senha"
                type="password"
                placeholder="Mínimo de 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                icone={<Lock className="w-4 h-4" />}
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                dica="A senha precisa ter pelo menos 6 caracteres"
                required
              />
            )}

            {modo === 'login' && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => setModo('recuperar')}
                  className="text-xs font-medium text-[#FF7A1A] hover:underline py-1 truncate"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <Botao
              type="submit"
              variante="primario"
              tamanho="lg"
              larguraTotal
              carregando={enviando}
              icone={modo === 'recuperar' ? <KeyRound className="w-4 h-4" /> : undefined}
              texto={
                modo === 'login'
                  ? 'Entrar no Cona Cash'
                  : modo === 'cadastro'
                    ? 'Solicitar meu cadastro'
                    : 'Enviar link de recuperação'
              }
            />
          </form>

          {modo === 'cadastro' && cadastroAberto && (
            <p className="mt-3 text-[11px] text-center text-[#9A9AA6] leading-relaxed">
              Por segurança, todo novo cadastro passa pela aprovação do administrador antes de liberar o acesso.
            </p>
          )}
        </Card>
      </div>

      {/* Rodapé com versão visível (Regra 10) */}
      <footer className="w-full text-center pt-6 z-10">
        <p className="text-xs text-[#9A9AA6]/80 truncate">
          {APP_NAME} • <span className="text-[#FF7A1A] font-semibold">{APP_VERSION}</span>
        </p>
      </footer>

      <Snackbar mensagem={snackbar} aoFechar={() => setSnackbar(null)} />
    </div>
  );
};
