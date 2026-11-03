/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cona: {
          bg: '#0B0B0D',
          surface: '#141418',
          card: '#18181E',
          border: '#262630',
          orange: '#FF7A1A',
          yellow: '#FFC940',
          red: '#FF3B30',
          green: '#2EE59D',
          text: '#F5F5F7',
          muted: '#9A9AA6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
