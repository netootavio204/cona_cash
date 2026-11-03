import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  MinusCircle,
  ArrowRightLeft,
  Layers,
  ShieldCheck,
  LogOut,
  Landmark,
  Banknote,
  Settings,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ensureMyDefaults, fetchAccounts } from '../../api/supabase';
import type { Account } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import { BottomNav, type AbaNavegacao } from '../../components/ui/BottomNav';
import { Snackbar, type SnackbarMensagem } from '../../components/ui/Snackbar';
import { ConfigPage } from '../config/ConfigPage';
import { APP_NAME, APP_VERSION } from '../../config/version';

export const HomePage: React.FC = () => {
  const { perfil, sair } = useAuth();
  const [aba, setAba] = useState<AbaNavegacao>('inicio');
  const [snackbar, setSnackbar] = useState<SnackbarMensagem | null>(null);
  const [contas, setContas] = useState<Account[]>([]);
  const [carregandoContas, setCarregandoContas] = useState(true);

  const isAdmin = perfil?.role === 'admin' && perfil?.status === 'approved';

  const mostrarAviso = useCallback(
    (texto: string, tipo: 'sucesso' | 'erro' | 'info' = 'info') => {
      setSnackbar({
        id: String(Date.now()),
        texto,
        tipo,
      });
    },
    []
  );

  // Proteção caso usuário comum tente acessar rota /admin ou #admin direto
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('/admin') || hash.includes('admin')) {
      if (!isAdmin) {
        window.history.replaceState(null, '', '/');
        mostrarAviso('Acesso negado: área exclusiva para administradores.', 'erro');
      } else {
        setAba('config');
      }
    }
  }, [isAdmin, mostrarAviso]);

  const carregarContas = useCallback(async () => {
    setCarregandoContas(true);
    try {
      await ensureMyDefaults();
      const lista = await fetchAccounts();
      setContas(lista.filter((c) => !c.archived));
    } catch (err) {
      console.error('Erro ao carregar contas no início:', err);
    } finally {
      setCarregandoContas(false);
    }
  }, []);

  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

  const saldoTotalCents = contas.reduce(
    (acc, c) => acc + (c.initial_balance_cents || 0),
    0
  );

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
            {/* Card Principal de Saldo Total */}
            <Card bordaAnimada padding="lg">
              <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9AA6] truncate">
                  Saldo Total nas Contas
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#2EE59D] bg-[#2EE59D]/10 px-2 py-0.5 rounded-full font-semibold shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Sincronizado
                </span>
              </div>

              <ValorMoeda
                centavos={saldoTotalCents}
                tamanho="xl"
                cor={saldoTotalCents >= 0 ? 'padrao' : 'negativo'}
                className="my-1"
              />

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

            {/* Atalhos Rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
              <Botao
                variante="primario"
                icone={<PlusCircle className="w-4 h-4" />}
                texto="+ Entrada"
                onClick={() =>
                  mostrarAviso('Lançamento rápido será ativado na Fase 3!', 'info')
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
                  mostrarAviso('Transferência será ativada na Fase 3!', 'info')
                }
              />
              <Botao
                variante="secundario"
                icone={<Layers className="w-4 h-4 text-[#2EE59D]" />}
                texto="Lote do dia"
                onClick={() =>
                  mostrarAviso('Lote do dia será ativado na Fase 3!', 'info')
                }
              />
            </div>

            {/* Cards de Saldo por Conta */}
            <div className="space-y-2.5 min-w-0">
              <div className="flex items-center justify-between gap-2 px-1 min-w-0">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6] truncate">
                  Suas Contas ({contas.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setAba('config')}
                  className="text-xs text-[#FF7A1A] font-semibold inline-flex items-center gap-1 hover:underline shrink-0"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Gerenciar</span>
                </button>
              </div>

              {carregandoContas ? (
                <Card>
                  <p className="text-xs text-[#9A9AA6]">Carregando contas...</p>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 min-w-0">
                  {contas.map((c) => (
                    <Card
                      key={c.id}
                      padding="sm"
                      onClick={() => setAba('config')}
                    >
                      <div className="flex items-center gap-2 mb-1.5 min-w-0">
                        <span
                          style={{
                            backgroundColor: `${c.color}20`,
                            color: c.color,
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        >
                          {c.type === 'cash' ? (
                            <Banknote className="w-4 h-4" />
                          ) : (
                            <Landmark className="w-4 h-4" />
                          )}
                        </span>
                        <span
                          className="text-xs font-bold text-white truncate min-w-0"
                          title={c.name}
                        >
                          {c.name}
                        </span>
                      </div>

                      <ValorMoeda
                        centavos={c.initial_balance_cents}
                        compacto
                        tamanho="md"
                        cor="padrao"
                      />
                    </Card>
                  ))}
                </div>
              )}
            </div>
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
                Esta área será liberada na respectiva fase do cronograma.
              </p>
            </div>
          </Card>
        )}

        {aba === 'config' && (
          <ConfigPage
            onShowToast={mostrarAviso}
            onAccountsChanged={carregarContas}
          />
        )}

        {/* Rodapé com Versão Visível (Regra 10) */}
        <footer className="text-center py-4">
          <p className="text-xs text-[#9A9AA6]/70 truncate">
            {APP_NAME} • Versão{' '}
            <span className="text-[#FF7A1A] font-semibold">{APP_VERSION}</span>
          </p>
        </footer>
      </main>

      <BottomNav abaAtiva={aba} aoTrocarAba={setAba} />
      <Snackbar mensagem={snackbar} aoFechar={() => setSnackbar(null)} />
    </div>
  );
};
