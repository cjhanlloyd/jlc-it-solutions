// QR code geometry from qrcode-generator: one SVG path of the dark modules. No React, so the node tests load it directly.
import qrcode from 'qrcode-generator';

export const QUIET = 4; // modules of white around the code, the minimum scanners expect

export function qrPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M'); // type 0 = smallest version that fits
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
  return { size: n + QUIET * 2, d };
}
