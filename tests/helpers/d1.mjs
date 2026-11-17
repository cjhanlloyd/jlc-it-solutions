// Real-SQL D1/R2 fakes for Function tests: node:sqlite in memory, loaded from schema.sql + later migrations.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../..', import.meta.url));
const plain = (r) => (r ? { ...r } : null);
const args = (a) => a.map((v) => (v === undefined ? null : v));

export function applyMigration(db, file) {
  db.exec(readFileSync(file, 'utf8'));
}

export function makeD1({ migrations = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(root, 'schema.sql'), 'utf8'));
  if (migrations) {
    // 0001/0002 are already in schema.sql
    const dir = join(root, 'migrations');
    for (const f of readdirSync(dir).sort()) {
      // 0009 seeds catalogue rows and 0012 reprices them; tests that need them apply them themselves
      if (f.endsWith('.sql') && parseInt(f, 10) > 2 && !f.startsWith('0009') && !f.startsWith('0012')) db.exec(readFileSync(join(dir, f), 'utf8'));
    }
  }
  const stmt = (sql, params = []) => ({
    bind: (...a) => stmt(sql, args(a)),
    first: async () => plain(db.prepare(sql).get(...params)),
    all: async () => ({ results: db.prepare(sql).all(...params).map(plain) }),
    // sync so batch() never yields to the event loop inside its transaction
    runSync: () => {
      const r = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
    run: async () => stmt(sql, params).runSync(),
  });
  return {
    exec: db,
    prepare: (sql) => stmt(sql),
    async batch(stmts) {
      const out = [];
      db.exec('BEGIN');
      try {
        for (const s of stmts) out.push(s.runSync());
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      return out;
    },
  };
}

export function makeR2({ pageSize = 1000 } = {}) {
  const m = new Map();
  // Handles `bytes=a-b` and `bytes=a-` from a Headers range; a start past the end throws like R2
  const view = (key, opts = {}) => {
    const o = m.get(key);
    const r = /^bytes=(\d+)-(\d*)$/.exec(opts.range?.get?.('range') ?? '');
    const sfx = /^bytes=-(\d+)$/.exec(opts.range?.get?.('range') ?? '');
    let range, body = o?.body;
    if (o && sfx) { // the runtime reports a suffix range as { suffix }
      const n = Math.min(Number(sfx[1]), o.bytes.byteLength);
      range = { suffix: Number(sfx[1]) };
      body = o.bytes.slice(o.bytes.byteLength - n);
    } else if (o && r) {
      const start = Number(r[1]), size = o.bytes.byteLength;
      if (start >= size) throw new Error('range not satisfiable');
      const end = Math.min(r[2] === '' ? size - 1 : Number(r[2]), size - 1);
      range = { offset: start, length: end - start + 1 };
      body = o.bytes.slice(start, end + 1);
    }
    return o && { key, body, range, httpMetadata: o.httpMetadata, size: o.bytes.byteLength, uploaded: o.uploaded,
      arrayBuffer: async () => o.bytes.buffer.slice(o.bytes.byteOffset, o.bytes.byteOffset + o.bytes.byteLength) };
  };
  return {
    map: m,
    async put(key, body, opts = {}) {
      const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body instanceof ArrayBuffer ? body : body.buffer ? body : await new Response(body).arrayBuffer());
      m.set(key, { body, bytes, httpMetadata: opts.httpMetadata || {}, uploaded: new Date() });
    },
    async get(key, opts) { return view(key, opts) || null; },
    async head(key) { return view(key) || null; },
    async delete(k) { for (const key of [].concat(k)) m.delete(key); },
    async list({ prefix = '', limit = pageSize, cursor } = {}) {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort().filter((k) => !cursor || k > cursor);
      const page = keys.slice(0, Math.min(limit, pageSize));
      const truncated = keys.length > page.length;
      return { objects: page.map((k) => ({ key: k, uploaded: m.get(k).uploaded })), truncated, cursor: truncated ? page.at(-1) : undefined };
    },
  };
}
