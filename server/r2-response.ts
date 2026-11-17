/// <reference types="@cloudflare/workers-types" />
// Serves an R2 object with Range support (206, Content-Range, suffix ranges, 416). iOS Safari needs 206 to play and seek audio.
// Returns null when the key does not exist; `headers` are the caller's cache and security headers.
export async function r2Response(bucket: R2Bucket, key: string, request: Request, headers: Record<string, string>): Promise<Response | null> {
  let obj: R2ObjectBody | null;
  try { obj = await bucket.get(key, { range: request.headers }); } catch { return new Response('Range not satisfiable', { status: 416 }); }
  if (!obj) return null;
  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  let slice: { start: number; len: number } | null = null;
  if (r && obj.size > 0) {
    if (r.suffix !== undefined) { const len = Math.min(r.suffix, obj.size); slice = { start: obj.size - len, len }; }
    else slice = { start: r.offset ?? 0, len: r.length ?? obj.size - (r.offset ?? 0) };
  }
  return new Response(obj.body, { status: slice ? 206 : 200, headers: {
    ...headers,
    'Accept-Ranges': 'bytes',
    ...(slice ? { 'Content-Range': `bytes ${slice.start}-${slice.start + slice.len - 1}/${obj.size}`, 'Content-Length': String(slice.len) } : { 'Content-Length': String(obj.size) }),
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  } });
}
