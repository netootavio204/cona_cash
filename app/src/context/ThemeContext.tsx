import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light' | 'auto';
export type ActiveTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: ActiveTheme;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  setTheme: (t: ActiveTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  themePreference: 'dark',
  setThemePreference: () => {},
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cona_cash_theme_pref') as ThemePreference;
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
      const legacy = localStorage.getItem('cona_cash_theme') as ActiveTheme;
      if (legacy === 'light' || legacy === 'dark') return legacy;
    }
    return 'dark'; // Padrão oficial Cona Cash
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('dark');

  const applyThemeToDOM = (resolvedTheme: ActiveTheme) => {
    setActiveTheme(resolvedTheme);
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
      if (resolvedTheme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    }
  };

  const resolveEffectiveTheme = (pref: ThemePreference): ActiveTheme => {
    if (pref === 'auto') {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
      return 'dark';
    }
    return pref;
  };

  const setThemePreference = (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cona_cash_theme_pref', pref);
      localStorage.setItem('cona_cash_theme', pref);
    }
    applyThemeToDOM(resolveEffectiveTheme(pref));
  };

  const setTheme = (newTheme: ActiveTheme) => {
    setThemePreference(newTheme);
  };

  const toggleTheme = () => {
    const next = activeTheme === 'dark' ? 'light' : 'dark';
    setThemePreference(next);
  };

  useEffect(() => {
    applyThemeToDOM(resolveEffectiveTheme(themePreference));

    // Listener para caso esteja em modo 'auto' e o sistema mude
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleChange = () => {
        if (themePreference === 'auto') {
          applyThemeToDOM(mediaQuery.matches ? 'light' : 'dark');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themePreference]);

  return (
    <ThemeContext.Provider
      value={{
        theme: activeTheme,
        themePreference,
        setThemePreference,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
