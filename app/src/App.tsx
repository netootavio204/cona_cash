import React, { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

const LoginPage = lazy(() =>
  import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const PendingApprovalPage = lazy(() =>
  import('./features/auth/PendingApprovalPage').then((m) => ({
    default: m.PendingApprovalPage,
  }))
);
const HomePage = lazy(() =>
  import('./features/home/HomePage').then((m) => ({ default: m.HomePage }))
);

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen w-full bg-[#0B0B0D] text-[#F5F5F7] flex flex-col items-center justify-center gap-3 p-4">
    <div className="w-16 h-16 rounded-2xl bg-black border border-[#FF7A1A]/40 p-1.5 flex items-center justify-center shadow-[0_0_24px_rgba(255,122,26,0.2)]">
      <img
        src="/logos/logo_dark.png"
        alt="Cona Cash"
        className="w-full h-full object-contain animate-pulse rounded-xl"
      />
    </div>
    <div className="h-5 w-5 rounded-full border-2 border-[#FF7A1A] border-t-transparent animate-spin" />
    <p className="text-xs text-[#9A9AA6] font-medium">Carregando Cona Cash...</p>
  </div>
);

const AppRouter: React.FC = () => {
  const { sessao, perfil, carregando } = useAuth();

  if (carregando) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      {!sessao ? (
        <LoginPage />
      ) : !perfil || perfil.status !== 'approved' ? (
        <PendingApprovalPage />
      ) : (
        <HomePage />
      )}
    </Suspense>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
