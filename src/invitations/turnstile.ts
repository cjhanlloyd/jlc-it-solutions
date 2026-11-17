// The Turnstile hook, kept apart from kit.tsx so the guest page can use it without kit's icons and form helpers.
import React from 'react';

// Cloudflare Turnstile, same pattern as src/components/InquiryForm.tsx. On localhost, use Cloudflare's always-pass test key.
const TURNSTILE_SITE_KEY = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAF6Se95DZhEd5led';

let turnstileScript: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  return (turnstileScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => resolve();
    script.onerror = () => { turnstileScript = null; reject(new Error('Turnstile failed to load')); };
    document.head.appendChild(script);
  }));
}

// Returns the widget's ref callback, the current token, a load error and a reset (call it after a failed submit).
export function useTurnstile() {
  const [token, setToken] = React.useState('');
  const [error, setError] = React.useState('');
  const widgetId = React.useRef<string | null>(null);
  const ref = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    let unmounted = false;
    loadTurnstile().then(() => {
      if (unmounted) return;
      widgetId.current = (window as any).turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => { setToken(t); setError(''); },
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    }).catch(() => setError('The anti-spam check could not load. Please disable content blockers for this site and reload.'));
    return () => {
      unmounted = true;
      if (widgetId.current) (window as any).turnstile?.remove(widgetId.current);
      widgetId.current = null;
      setToken('');
    };
  }, []);
  const reset = () => {
    setToken('');
    if (widgetId.current) (window as any).turnstile?.reset(widgetId.current);
  };
  return { ref, token, error, reset };
}
