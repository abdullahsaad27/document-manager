import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.docexpert.app',
  appName: 'خبير المستندات',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
