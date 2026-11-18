// A QR code as an SVG built from React elements. Always near-black on white so it scans in any colour scheme.
import { qrPath } from './qr';

export default function QrCode({ text, label, px = 224 }: { text: string; label: string; px?: number }) {
  const { size, d } = qrPath(text);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} width={px} height={px} shapeRendering="crispEdges" style={{ maxWidth: '100%', height: 'auto', background: '#fff' }}>
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#111" />
    </svg>
  );
}

// Saves the code as a PNG (scaled up for print and screens) through a canvas.
export function downloadQrPng(text: string, filename: string) {
  const { size, d } = qrPath(text);
  const scale = Math.ceil(1024 / size);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * scale;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.scale(scale, scale);
  c.fillStyle = '#111';
  c.fill(new Path2D(d));
  canvas.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    Object.assign(document.createElement('a'), { href: url, download: filename }).click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
