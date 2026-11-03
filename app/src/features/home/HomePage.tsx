import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  MinusCircle,
  ArrowRightLeft,
  Layers,
  ShieldCheck,
  LogOut,
  Users,
  Lock,
  Unlock,
  CheckCircle2,
  Ban,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  fetchAllProfilesAdmin,
  updateSignupOpenAdmin,
  updateUserStatusAdmin,
} from '../../api/supabase';
import type { Profile, UserStatus } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { BottomNav, type AbaNavegacao } from '../../components/ui/BottomNav';
import { Modal } from '../../components/ui/Modal';
import { Snackbar, type SnackbarMensagem } from '../../components/ui/Snackbar';
import { APP_NAME, APP_VERSION } from '../../config/version';

export const HomePage: React.FC = () => {
  const { perfil, configApp, recarregarPerfilEConfig, sair } = useAuth();
  const [aba, setAba] = useState<AbaNavegacao>('inicio');
  const [snackbar, setSnackbar] = useState<SnackbarMensagem | null>(null);
  const [modalDemoAberto, setModalDemoAberto] = useState(false);

  // Estado do Painel Admin (para já aprovar/bloquear usuários e abrir/fechar cadastro)
  const [usuariosAdmin, setUsuariosAdmin] = useState<Profile[]>([]);
  const [carregandoAdmin, setCarregandoAdmin] = useState(false);
  const [alterandoCadastro, setAlterandoCadastro] = useState(false);

  const isAdmin = perfil?.role === 'admin' && perfil?.status === 'approved';

  const mostrarAviso = (texto: string, tipo: 'sucesso' | 'erro' | 'info' = 'info') => {
    setSnackbar({
      id: String(Date.now()),
      texto,
      tipo,
    });
  };

  const carregarListaUsuarios = useCallback(async () => {
    if (!isAdmin) return;
    setCarregandoAdmin(true);
    try {
      const lista = await fetchAllProfilesAdmin();
      setUsuariosAdmin(lista);
    } catch (err: any) {
      console.error('Erro ao listar usuários:', err);
    } finally {
      setCarregandoAdmin(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (aba === 'config' && isAdmin) {
      carregarListaUsuarios();
    }
  }, [aba, isAdmin, carregarListaUsuarios]);

  const alternarCadastroAberto = async () => {
    if (!isAdmin) return;
    const novoValor = !configApp.signup_open;
    setAlterandoCadastro(true);
    try {
      await updateSignupOpenAdmin(novoValor);
      await recarregarPerfilEConfig();
      mostrarAviso(
        novoValor
          ? 'Cadastro de novos usuários ABERTO.'
          : 'Cadastro de novos usuários FECHADO no app e no banco.',
        'sucesso'
      );
    } catch (err: any) {
      mostrarAviso(err?.message || 'Erro ao alterar configuração de cadastro.', 'erro');
    } finally {
      setAlterandoCadastro(false);
    }
  };

  const alterarStatusUsuario = async (u: Profile, novoStatus: UserStatus) => {
    try {
      await updateUserStatusAdmin(u.id, novoStatus);
      await carregarListaUsuarios();
      mostrarAviso(`Status de ${u.name || u.email} atualizado para ${novoStatus}.`, 'sucesso');
    } catch (err: any) {
      mostrarAviso(err?.message || 'Não foi possível alterar o status.', 'erro');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0B0D] text-[#F5F5F7] pb-24">
      {/* Barra Superior */}
      <header className="sticky top-0 z-30 bg-[#0B0B0D]/85 backdrop-blur-xl border-b border-[#262630] px-3 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logos/logo_transparente.png"
              alt="Cona Cash"
              className="w-9 h-9 rounded-xl bg-[#141418] p-1 border border-[#262630] shrink-0 object-contain"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-extrabold text-sm sm:text-base text-white truncate">
                  {APP_NAME}
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FF7A1A]/20 text-[#FF7A1A] border border-[#FF7A1A]/40 shrink-0">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9A9AA6] truncate">
                Olá, {perfil?.name || 'Octavio'}
              </p>
            </div>
          </div>

          <Botao
            variante="secundario"
            tamanho="sm"
            onClick={sair}
            icone={<LogOut className="w-4 h-4" />}
            texto="Sair"
          />
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-2xl mx-auto px-3 sm:px-6 pt-4 flex flex-col gap-4 min-w-0">
        {aba === 'inicio' && (
          <>
            {/* Card Principal de Saldo (Borda com brilho animado) */}
            <Card bordaAnimada padding="lg">
              <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9AA6] truncate">
                  Saldo Total nas Contas
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#2EE59D] bg-[#2EE59D]/10 px-2 py-0.5 rounded-full font-semibold shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Protegido
                </span>
              </div>

              <ValorMoeda centavos={0} tamanho="xl" cor="padrao" className="my-1" />

              <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-[#262630]/80 min-w-0">
                <div className="min-w-0">
                  <span className="text-[11px] text-[#9A9AA6] block truncate">
                    Entradas hoje
                  </span>
                  <ValorMoeda centavos={0} tamanho="sm" cor="positivo" compacto />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-[#9A9AA6] block truncate">
                    Saídas hoje
                  </span>
                  <ValorMoeda centavos={0} tamanho="sm" cor="negativo" compacto />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-[#9A9AA6] block truncate">
                    Resultado
                  </span>
                  <ValorMoeda centavos={0} tamanho="sm" cor="destaque" compacto />
                </div>
              </div>
            </Card>

            {/* Atalhos Rápidos (4 botões grandes do PRD 4.7) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
              <Botao
                variante="primario"
                icone={<PlusCircle className="w-4 h-4" />}
                texto="+ Entrada"
                onClick={() =>
                  mostrarAviso('Lançamento rápido de entrada será ativado na Fase 3!', 'info')
                }
              />
              <Botao
                variante="secundario"
                icone={<MinusCircle className="w-4 h-4 text-[#FF3B30]" />}
                texto="+ Saída"
                onClick={() =>
                  mostrarAviso('Lançamento de saída será ativado na Fase 3!', 'info')
                }
              />
              <Botao
                variante="secundario"
                icone={<ArrowRightLeft className="w-4 h-4 text-[#FFC940]" />}
                texto="Transferir"
                onClick={() =>
                  mostrarAviso('Transferência entre contas será ativada na Fase 3!', 'info')
                }
              />
              <Botao
                variante="secundario"
                icone={<Layers className="w-4 h-4 text-[#2EE59D]" />}
                texto="Lote do dia"
                onClick={() =>
                  mostrarAviso('Lançamento em lote será ativado na Fase 3!', 'info')
                }
              />
            </div>

            {/* Estado Inicial da Fase 1 */}
            <Card padding="md">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FF7A1A]/15 border border-[#FF7A1A]/30 flex items-center justify-center text-[#FF7A1A] shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm sm:text-base font-bold text-white truncate">
                    Fundação e Design System prontos!
                  </h2>
                  <p className="text-xs text-[#9A9AA6] mt-1 leading-relaxed">
                    Login, aprovação de cadastro, segurança RLS no Supabase e componentes anti-vazamento estão ativos. Na próxima fase (Fase 2), vamos configurar suas Contas, Taxas da Maquininha e Categorias.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      icone={<Sparkles className="w-4 h-4 text-[#FF7A1A]" />}
                      texto="Testar Design System e Anti-Vazamento (320px)"
                      onClick={() => setModalDemoAberto(true)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}

        {(aba === 'lancamentos' || aba === 'relatorios' || aba === 'metas') && (
          <Card bordaAnimada padding="lg">
            <div className="text-center py-6 space-y-2 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {aba === 'lancamentos' && 'Lançamentos (Fase 3)'}
                {aba === 'relatorios' && 'Relatórios e PDF (Fase 4)'}
                {aba === 'metas' && 'Metas e Conquistas (Fase 5)'}
              </h2>
              <p className="text-xs sm:text-sm text-[#9A9AA6] max-w-md mx-auto">
                Esta área já está reservada na navegação e será liberada na respectiva fase do cronograma.
              </p>
            </div>
          </Card>
        )}

        {aba === 'config' && (
          <div className="flex flex-col gap-4 min-w-0">
            <Card padding="md">
              <h2 className="text-base font-bold text-white truncate mb-2">
                Meu Perfil
              </h2>
              <div className="text-xs sm:text-sm text-[#9A9AA6] space-y-1 min-w-0">
                <p className="truncate">
                  <strong className="text-white">Nome:</strong> {perfil?.name}
                </p>
                <p className="truncate">
                  <strong className="text-white">E-mail:</strong> {perfil?.email}
                </p>
                <p className="truncate">
                  <strong className="text-white">Nível:</strong>{' '}
                  {isAdmin ? 'Administrador' : 'Usuário'} ({perfil?.status})
                </p>
              </div>
            </Card>

            {isAdmin && (
              <Card bordaAnimada padding="md">
                <div className="flex flex-col gap-3 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-5 h-5 text-[#FF7A1A] shrink-0" />
                      <h2 className="text-sm sm:text-base font-bold text-white truncate">
                        Painel do Administrador
                      </h2>
                    </div>
                  </div>

                  {/* Controle de Cadastro Aberto / Fechado */}
                  <div className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        Cadastro de novos usuários:{' '}
                        <span
                          className={
                            configApp.signup_open ? 'text-[#2EE59D]' : 'text-[#FF3B30]'
                          }
                        >
                          {configApp.signup_open ? 'ABERTO' : 'FECHADO'}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#9A9AA6]">
                        Quando fechado, o link some da tela de login e o banco recusa novos cadastros.
                      </p>
                    </div>

                    <Botao
                      variante={configApp.signup_open ? 'perigo' : 'sucesso'}
                      tamanho="sm"
                      carregando={alterandoCadastro}
                      onClick={alternarCadastroAberto}
                      icone={
                        configApp.signup_open ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <Unlock className="w-4 h-4" />
                        )
                      }
                      texto={
                        configApp.signup_open ? 'Fechar cadastro' : 'Abrir cadastro'
                      }
                    />
                  </div>

                  {/* Lista de Usuários */}
                  <div className="space-y-2 min-w-0">
                    <p className="text-xs font-semibold text-[#9A9AA6] uppercase tracking-wider">
                      Usuários cadastrados ({usuariosAdmin.length})
                    </p>

                    {carregandoAdmin ? (
                      <p className="text-xs text-[#9A9AA6]">Carregando usuários...</p>
                    ) : (
                      usuariosAdmin.map((u) => (
                        <div
                          key={u.id}
                          className="p-3 rounded-xl bg-[#0B0B0D]/80 border border-[#262630] flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0"
                        >
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-white truncate">
                              {u.name || 'Sem nome'}{' '}
                              {u.role === 'admin' && (
                                <span className="text-[10px] text-[#FF7A1A] font-extrabold ml-1">
                                  [ADMIN]
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[#9A9AA6] truncate">{u.email}</p>
                            <span
                              className={[
                                'inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                                u.status === 'approved'
                                  ? 'bg-[#2EE59D]/15 text-[#2EE59D]'
                                  : u.status === 'pending'
                                    ? 'bg-[#FFC940]/15 text-[#FFC940]'
                                    : 'bg-[#FF3B30]/15 text-[#FF3B30]',
                              ].join(' ')}
                            >
                              {u.status === 'approved'
                                ? 'Aprovado'
                                : u.status === 'pending'
                                  ? 'Pendente'
                                  : 'Bloqueado'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {u.status !== 'approved' && (
                              <Botao
                                variante="sucesso"
                                tamanho="sm"
                                icone={<CheckCircle2 className="w-3.5 h-3.5" />}
                                texto="Aprovar"
                                onClick={() => alterarStatusUsuario(u, 'approved')}
                              />
                            )}
                            {u.status !== 'blocked' && u.id !== perfil?.id && (
                              <Botao
                                variante="perigo"
                                tamanho="sm"
                                icone={<Ban className="w-3.5 h-3.5" />}
                                texto="Bloquear"
                                onClick={() => alterarStatusUsuario(u, 'blocked')}
                              />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Rodapé com Versão Visível (Regra 10) */}
        <footer className="text-center py-4">
          <p className="text-xs text-[#9A9AA6]/70 truncate">
            {APP_NAME} • Versão <span className="text-[#FF7A1A] font-semibold">{APP_VERSION}</span>
          </p>
        </footer>
      </main>

      {/* Modal de Demonstração do Design System e Regra Anti-Vazamento (PRD 7.1) */}
      <Modal
        aberto={modalDemoAberto}
        aoFechar={() => setModalDemoAberto(false)}
        titulo="Teste Anti-Vazamento (PRD 7.1)"
      >
        <div className="space-y-4 min-w-0">
          <p className="text-xs text-[#9A9AA6]">
            Botões com textos extremamente longos e valores altos se ajustam com{' '}
            <code>clamp()</code> e reticências sem estourar telas de 320px:
          </p>

          <Botao
            variante="primario"
            larguraTotal
            texto="Botão com texto extremamente longo para validar a regra anti-vazamento em 320px"
          />

          <div className="grid grid-cols-2 gap-2 min-w-0">
            <Card padding="sm">
              <span className="text-[11px] text-[#9A9AA6] block truncate">
                Card compacto (toque no valor)
              </span>
              <ValorMoeda centavos={123456789} compacto tamanho="md" cor="positivo" />
            </Card>
            <Card padding="sm">
              <span className="text-[11px] text-[#9A9AA6] block truncate">
                Valor completo ajustável
              </span>
              <ValorMoeda centavos={123456789} tamanho="md" cor="destaque" />
            </Card>
          </div>
        </div>
      </Modal>

      <BottomNav abaAtiva={aba} aoTrocarAba={setAba} />
      <Snackbar mensagem={snackbar} aoFechar={() => setSnackbar(null)} />
    </div>
  );
};
