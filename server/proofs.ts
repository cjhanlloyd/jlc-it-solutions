/// <reference types="@cloudflare/workers-types" />
// Design proofs for custom orders: decode an uploaded file, store it in R2, list and stream proofs.
// Keys live under proofs/, which /photos and /media never serve.
import { decodeImage } from './images';
import { sqlUtcToIso } from './orders';
import { SECURITY_HEADERS } from './security-headers';

export const PROOF_BYTES = 10_000_000;
const PDF_RE = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/;
type Proof = { bytes: Uint8Array; contentType: string; ext: string };

// 'type' = not a JPEG, PNG, WebP or PDF (by magic bytes); 'size' = over 10 MB.
export function decodeProof(input: unknown): Proof | 'type' | 'size' {
  const m = typeof input === 'string' ? PDF_RE.exec(input) : null;
  if (!m) {
    const img = decodeImage(input, PROOF_BYTES);
    return typeof img === 'string' ? img : { bytes: img.bytes, contentType: `image/${img.type}`, ext: img.ext };
  }
  if (m[1].length * 3 / 4 > PROOF_BYTES + 2) return 'size';
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  if (bytes.length > PROOF_BYTES) return 'size';
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return 'type';
  return { bytes, contentType: 'application/pdf', ext: 'pdf' };
}

export async function putProof(r2: R2Bucket, orderId: number, p: Proof): Promise<string> {
  const key = `proofs/${orderId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${p.ext}`;
  await r2.put(key, p.bytes, { httpMetadata: { contentType: p.contentType } });
  return key;
}

export async function proofList(db: D1Database, orderId: number) {
  const { results } = await db.prepare('SELECT id, round, kind, url, message, created_by, created_at FROM order_proofs WHERE order_id = ? ORDER BY round, id').bind(orderId).all<any>();
  return (results || []).map((p) => ({
    id: p.id, round: p.round, kind: p.kind, ...(p.kind === 'link' ? { url: p.url } : {}), message: p.message, createdBy: p.created_by, createdAt: sqlUtcToIso(p.created_at),
  }));
}

// Streams a file proof of this order, or null if there is none.
export async function streamProof(db: D1Database, r2: R2Bucket, orderId: number, proofId: number, reference: string): Promise<Response | null> {
  const p = await db.prepare("SELECT round, file_key, content_type FROM order_proofs WHERE id = ? AND order_id = ? AND kind = 'file'").bind(proofId, orderId).first<any>();
  const obj = p?.file_key && await r2.get(p.file_key);
  if (!obj) return null;
  const type = p.content_type || 'application/octet-stream';
  const name = `proof-${String(reference).replace(/[^A-Za-z0-9-]/g, '')}-${p.round}`;
  return new Response(obj.body, { headers: {
    // sandbox: an inline PDF (or anything mislabelled) runs with no script or same-origin access
    ...SECURITY_HEADERS, 'Content-Security-Policy': 'sandbox', 'Content-Type': type, 'Cache-Control': 'private, no-store',
    ...(type === 'application/pdf' ? { 'Content-Disposition': `inline; filename="${name}.pdf"` } : {}),
  } });
}
