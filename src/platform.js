import { Capacitor } from '@capacitor/core';

export const isElectron = !!(window.monml && window.monml.platform === 'electron');
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = isNative && Capacitor.getPlatform() === 'android';
export const platform = isElectron ? 'desktop' : isAndroid ? 'android' : 'web';

export async function appVersion() {
  if (isElectron) return window.monml.version();
  if (isNative) { const { App } = await import('@capacitor/app'); return (await App.getInfo()).version; }
  return __APP_VERSION__;
}
