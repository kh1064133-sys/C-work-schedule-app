import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.schedule.app',
  appName: '일정매출관리',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
