
export const isIOSWebKit = (): boolean => {
  const ua = navigator.userAgent;
  const isIpadOS13Plus = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOS13Plus;
  const isWebKit = /AppleWebKit/.test(ua) || /WebKit/.test(ua);
  // Treat all iOS WebKit browsers (Safari, Chrome iOS, etc.) as restricted
  return isIOS && isWebKit;
};
