import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pixelopolis.townbuilder',
  appName: 'Pixelopolis',
  webDir: 'dist',
  backgroundColor: '#120c24',
  android: {
    // Android 15 dibuja bajo la barra de estado: Capacitor deja los márgenes correctos.
    adjustMarginsForEdgeToEdge: 'force',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#ff4f9a',
    },
  },
};

export default config;
