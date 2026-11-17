// "Your invitation link": the guest link with Copy, Open and Share. Used on the account dashboard and the manage page.
import React from 'react';
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
export const primaryBtn = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 cursor-pointer ${focusRing}`;
export const secondaryBtn = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gold bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-60 cursor-pointer ${focusRing}`;

// Clipboard, or a prompt to copy by hand where the clipboard is blocked. True when it reached the clipboard.
export async function copyText(text: string, what: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { window.prompt(`Copy ${what}:`, text); return false; }
}

// "Copied" for two seconds after a successful copy.
export function useCopied(): [string | null, (key: string) => void] {
  const [copied, setCopied] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  return [copied, (key) => { setCopied(key); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(null), 2000); }];
}

export default function LinkBox({ url, title, label = 'Your invitation link' }: { url: string; title?: string; label?: string }) {
  const [copied, markCopied] = useCopied();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = () => navigator.share({ title: title || 'Our invitation', url }).catch(() => { /* dismissed */ });

  return (
    <div className="min-w-0 rounded-2xl border border-gold-light bg-ivory p-4 sm:p-5">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-brand-700">{label}</p>
      <p className="mt-2 break-all font-mono text-sm text-ink select-all">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={secondaryBtn} onClick={async () => { if (await copyText(url, 'your invitation link')) markCopied('link'); }}>
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
        </button>
        <a href={url} target="_blank" rel="noopener" className={secondaryBtn}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {canShare && (
          <button type="button" className={secondaryBtn} onClick={share}>
            <Share2 className="h-4 w-4" aria-hidden="true" /> Share
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</p>
    </div>
  );
}
