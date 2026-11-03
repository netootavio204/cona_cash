import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  fetchAppSettings,
  fetchMyProfile,
} from '../../api/supabase';
import type { AppSettings, Profile } from '../../types/database';

interface AuthContextValue {
  sessao: Session | null;
  usuario: User | null;
  perfil: Profile | null;
  configApp: AppSettings;
  carregando: boolean;
  recarregarPerfilEConfig: () => Promise<void>;
  sair: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  id: 1,
  signup_open: true,
  schema_version: '001_base',
  app_version: 'v0.1.0 beta',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextValue>({
  sessao: null,
  usuario: null,
  perfil: null,
  configApp: defaultSettings,
  carregando: true,
  recarregarPerfilEConfig: async () => {},
  sair: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [configApp, setConfigApp] = useState<AppSettings>(defaultSettings);
  const [carregando, setCarregando] = useState<boolean>(true);

  const carregarDadosUsuario = useCallback(async (user: User | null) => {
    try {
      const settings = await fetchAppSettings();
      setConfigApp(settings);

      if (!user) {
        setPerfil(null);
        return;
      }

      const prof = await fetchMyProfile(user.id);
      if (prof) {
        setPerfil(prof);
      } else {
        // Caso a migration ainda não tenha criado a linha ou esteja aguardando trigger
        setPerfil({
          id: user.id,
          name: (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'Usuário',
          email: user.email || '',
          role: 'user',
          status: 'pending',
          sound_enabled: true,
          week_starts_on: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[Cona Cash] Erro ao carregar perfil/configurações:', err);
    }
  }, []);

  const recarregarPerfilEConfig = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSessao(session);
    setUsuario(session?.user ?? null);
    await carregarDadosUsuario(session?.user ?? null);
  }, [carregarDadosUsuario]);

  useEffect(() => {
    let ativo = true;

    async function inicializar() {
      setCarregando(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!ativo) return;
        setSessao(session);
        setUsuario(session?.user ?? null);
        await carregarDadosUsuario(session?.user ?? null);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    inicializar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!ativo) return;
      setSessao(newSession);
      setUsuario(newSession?.user ?? null);
      carregarDadosUsuario(newSession?.user ?? null);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, [carregarDadosUsuario]);

  const sair = async () => {
    await supabase.auth.signOut();
    setSessao(null);
    setUsuario(null);
    setPerfil(null);
  };

  return (
    <AuthContext.Provider
      value={{
        sessao,
        usuario,
        perfil,
        configApp,
        carregando,
        recarregarPerfilEConfig,
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
