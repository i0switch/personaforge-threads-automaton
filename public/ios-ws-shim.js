// Early WebSocket shim for iOS WebKit (executed before module scripts)
(function(){
  try {
    if (typeof window === 'undefined') return;
    if (window.__iosWebSocketShimApplied) return;

    var ua = navigator.userAgent || '';
    var isIpadOS13Plus = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
    var isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOS13Plus;
    var isWebKit = /AppleWebKit/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|mercury/.test(ua);
    var isSafariDesktop = /Safari\//.test(ua) && !/(Chrome|Chromium|Edg|OPR|CriOS|FxiOS|OPiOS|mercury)/.test(ua) && /Macintosh|Mac OS X/.test(ua);
    // Always apply shim to avoid CSP-triggered WebSocket errors on any browser
    

    var OriginalWebSocket = window.WebSocket;

    function NoopWebSocket(url){
      this.url = url || '';
      this.readyState = 3; // CLOSED
      this.binaryType = 'arraybuffer';
      this.protocol = '';
      this.extensions = '';
      this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null;
      try { console.warn('[iOS WebKit] WebSocket disabled via early shim for URL:', this.url); } catch(e){}
      setTimeout(() => {
        try { this.onerror && this.onerror(new Event('error')); } catch(e){}
        try { this.onclose && this.onclose(new Event('close')); } catch(e){}
      }, 0);
    }
    NoopWebSocket.prototype.addEventListener = function(){};
    NoopWebSocket.prototype.removeEventListener = function(){};
    NoopWebSocket.prototype.dispatchEvent = function(){ return true; };
    NoopWebSocket.prototype.send = function(){};
    NoopWebSocket.prototype.close = function(){};

    // Static readyState constants for compatibility
    NoopWebSocket.CONNECTING = 0;
    NoopWebSocket.OPEN = 1;
    NoopWebSocket.CLOSING = 2;
    NoopWebSocket.CLOSED = 3;

    window.WebSocket = NoopWebSocket;
    try { self.WebSocket = NoopWebSocket; } catch(e){}
    try { globalThis.WebSocket = NoopWebSocket; } catch(e){}
    window.__iosWebSocketShimApplied = true;
    window.__OriginalWebSocket = OriginalWebSocket;
  } catch(e) {
    try { console.warn('Early iOS WebSocket shim failed:', e); } catch(_){}}
})();
