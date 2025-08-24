
export const isIOSWebKit = (): boolean => {
  const ua = navigator.userAgent;
  const isIpadOS13Plus = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOS13Plus;
  const isWebKit = /AppleWebKit/.test(ua) || /WebKit/.test(ua);
  return isIOS && isWebKit;
};

export const isSafariDesktop = (): boolean => {
  const ua = navigator.userAgent;
  const isSafari = /Safari\//.test(ua) && !/(Chrome|Chromium|Edg|OPR|CriOS|FxiOS|OPiOS|mercury)/.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua);
  return isSafari && isMac;
};

export const isWebSocketRestricted = (): boolean => {
  // Treat iOS WebKit and Desktop Safari as restricted (CSP often blocks wss)
  return isIOSWebKit() || isSafariDesktop();
};
