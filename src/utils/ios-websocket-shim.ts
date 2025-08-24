// iOS WebKit WebSocket shim to prevent SecurityError crashes
// Runs as early as possible to neutralize WebSocket usage on iOS Safari

import { isIOSWebKit } from './platform';

(() => {
  if (typeof window === 'undefined') return;

  try {
    if (!isIOSWebKit()) return;

    // If WebSocket already stubbed, skip
    if ((window as any).__iosWebSocketShimApplied) return;

    const OriginalWebSocket = (window as any).WebSocket;

    // Create a safe no-op WebSocket stub
    class NoopWebSocket {
      public onopen: ((ev: Event) => any) | null = null;
      public onmessage: ((ev: MessageEvent) => any) | null = null;
      public onerror: ((ev: Event) => any) | null = null;
      public onclose: ((ev: CloseEvent) => any) | null = null;
      public readyState: number = 3; // CLOSED
      public url: string;

      constructor(url?: string) {
        this.url = url || '';
        // Informational log to help diagnostics
        try { console.warn('[iOS WebKit] WebSocket is disabled via shim for URL:', this.url); } catch { }
        // Async notify error/close so callers don't hang waiting for open
        setTimeout(() => {
          try { this.onerror && this.onerror(new Event('error')); } catch { }
          try { this.onclose && this.onclose(new CloseEvent('close')); } catch { }
        }, 0);
      }

      addEventListener(_type: string, _listener: any) { }
      removeEventListener(_type: string, _listener: any) { }
      dispatchEvent(_event: Event) { return true; }
      send(_data?: any) { }
      close() { }
    }

    // Apply the shim broadly
    (window as any).WebSocket = NoopWebSocket as any;
    (self as any).WebSocket = NoopWebSocket as any;
    (globalThis as any).WebSocket = NoopWebSocket as any;
    (window as any).__iosWebSocketShimApplied = true;

    // Keep a reference in case we need to restore for debugging
    (window as any).__OriginalWebSocket = OriginalWebSocket;
  } catch (e) {
    // Never throw from shim
    try { console.warn('Failed to apply iOS WebSocket shim:', e); } catch { }
  }
})();
