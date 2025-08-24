// Simple debug overlay to show last captured error details without relying on React rendering
(function(){
  try{
    if (typeof window === 'undefined') return;
    var params = new URLSearchParams(location.search);
    if (params.get('debug') !== '1') return;

    var overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#111;color:#ffb4b4;font:12px/1.4 monospace;padding:8px;max-height:40vh;overflow:auto;white-space:pre-wrap;word-break:break-word;';
    overlay.textContent = '[Debug Overlay] waiting for error...';
    document.addEventListener('DOMContentLoaded', function(){
      document.body.appendChild(overlay);
    });

    function render(info){
      try{
        var lines = [];
        lines.push('[Debug Overlay] Error captured at ' + new Date().toISOString());
        if (info) {
          if (info.error) lines.push('message: ' + info.error);
          if (info.stack) lines.push('stack: ' + info.stack);
          if (info.componentStack) lines.push('componentStack: ' + info.componentStack);
          if (info.hostname) lines.push('host: ' + info.hostname);
          if (info.url) lines.push('url: ' + info.url);
          if (info.userAgent) lines.push('ua: ' + info.userAgent);
        } else {
          lines.push('no info yet');
        }
        overlay.textContent = lines.join('\n');
      }catch(e){/* ignore */}
    }

    // Poll for __lastErrorInfo populated by ErrorBoundary
    setInterval(function(){
      try{
        var info = (window).__lastErrorInfo;
        if (info) render(info);
      }catch(e){}
    }, 500);

    // Also capture global errors/unhandled rejections
    window.addEventListener('error', function(ev){
      try{
        var info = (window).__lastErrorInfo || {};
        info.error = (ev.error && ev.error.message) || ev.message || 'window.error';
        info.stack = (ev.error && ev.error.stack) || '';
        (window).__lastErrorInfo = info;
        render(info);
      }catch(e){}
    });

    window.addEventListener('unhandledrejection', function(ev){
      try{
        var info = (window).__lastErrorInfo || {};
        var reason = ev.reason || {};
        info.error = reason.message || String(reason);
        info.stack = reason.stack || '';
        (window).__lastErrorInfo = info;
        render(info);
      }catch(e){}
    });
  }catch(e){/* ignore */}
})();
