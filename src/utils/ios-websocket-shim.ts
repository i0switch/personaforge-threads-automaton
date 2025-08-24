// iOS/macOS Safari WebSocket shim to prevent SecurityError crashes
// Runs as early as possible to neutralize WebSocket usage on Safari/WebKit

(() => {
  try {
    if (typeof window === 'undefined') return;
    // If WebSocket already stubbed, skip
    if ((window as any).__iosWebSocketShimApplied) return;

    const ua = navigator.userAgent || '';
    const isIpadOS13Plus = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOS13Plus;
    const isWebKit = /AppleWebKit/.test(ua) && !/(CriOS|FxiOS|OPiOS|EdgiOS|mercury)/.test(ua);
    const isSafariDesktop = /Safari\//.test(ua) && !/(Chrome|Chromium|Edg|OPR|CriOS|FxiOS|OPiOS|mercury)/.test(ua) && /Macintosh|Mac OS X/.test(ua);

    if (!((isIOS && isWebKit) || isSafariDesktop)) return;

    const OriginalWebSocket = (window as any).WebSocket;

    // Create a safe no-op WebSocket stub
    class NoopWebSocket {
      url: string = '';
      readyState: number = 3; // CLOSED
      binaryType: string = 'arraybuffer';
      protocol: string = '';
      extensions: string = '';
      onopen: any = null; onmessage: any = null; onerror: any = null; onclose: any = null;
      constructor(url?: string){
        this.url = url || '';
        try { console.warn('[Safari/WebKit] WebSocket disabled via shim for URL:', this.url); } catch {}
        setTimeout(() => {
          try { this.onerror && this.onerror(new Event('error')); } catch {}
          try { this.onclose && this.onclose(new Event('close')); } catch {}
        }, 0);
      }
      addEventListener(){}
      removeEventListener(){}
      dispatchEvent(){ return true; }
      send(){}
      close(){}
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
    }

    (window as any).WebSocket = NoopWebSocket as any;
    (self as any).WebSocket = NoopWebSocket as any;
    (globalThis as any).WebSocket = NoopWebSocket as any;
    (window as any).__iosWebSocketShimApplied = true;
    (window as any).__OriginalWebSocket = OriginalWebSocket;
  } catch {
    try { console.warn('Failed to apply Safari/WebKit WebSocket shim'); } catch {}
  }
})();
