// Optional payment QR code (GCash, Maya, bank) shown in the invitation's Gifts block. value is a data URL (new) or an R2 key (stored).
import React from 'react';
import { LIMITS } from '../../../shared/invitation-fields';
import { photoSrc } from '../kit';
import { resizeQr } from './resize';

export default function GiftQrField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [error, setError] = React.useState('');
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    try {
      const url = await resizeQr(f);
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(url)) setError('Please use a JPEG, PNG or WebP image.');
      else if (url.length > LIMITS.photoChars) setError('That image is too large. Please pick a smaller one.');
      else onChange(url);
    } catch {
      setError('We could not read that image. Please use a JPEG or PNG image.');
    }
  };
  return (
    <div className="space-y-2 border-t border-slate-200 pt-6">
      <label htmlFor="gift-qr" className="block text-sm font-extrabold text-slate-900 font-display">Gift QR code (optional)</label>
      <p id="gift-qr-hint" className="text-xs text-slate-600">Upload a payment QR code (GCash, Maya or your bank) for guests who want to send a gift.</p>
      {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
      {value && (
        <div className="flex items-center gap-4">
          <img src={photoSrc(value)} alt="Gift QR code preview" className="h-24 w-24 rounded-lg border border-slate-200 bg-white object-contain p-1" />
          <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-red-700 underline cursor-pointer">Remove QR code</button>
        </div>
      )}
      <input id="gift-qr" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="gift-qr-hint" onChange={pick} className="block w-full text-sm text-slate-700" />
    </div>
  );
}
