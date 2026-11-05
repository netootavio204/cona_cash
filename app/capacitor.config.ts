import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.conacash.app',
  appName: 'CONA CASH',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0B0B0D',
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
