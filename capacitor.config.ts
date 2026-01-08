import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenote.app',
  appName: 'Zenote',
  webDir: 'dist',
  android: {
    backgroundColor: '#1a1f1a', // Dark theme background (Midnight theme)
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Set true for debugging
  },
  server: {
    // Uncomment for live reload during development:
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1f1a',
      showSpinner: false,
      launchAutoHide: true,
    },
  },
};

export default config;
