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
      if (f.endsWith('.sql') && parseInt(f, 10) > 2) db.exec(readFileSync(join(dir, f), 'utf8'));
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

export function makeR2() {
  const m = new Map();
  const view = (key) => {
    const o = m.get(key);
    return o && { key, body: o.body, httpMetadata: o.httpMetadata, size: o.bytes.byteLength, uploaded: o.uploaded,
      arrayBuffer: async () => o.bytes.buffer.slice(o.bytes.byteOffset, o.bytes.byteOffset + o.bytes.byteLength) };
  };
  return {
    map: m,
    async put(key, body, opts = {}) {
      const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body instanceof ArrayBuffer ? body : body.buffer ? body : await new Response(body).arrayBuffer());
      m.set(key, { body, bytes, httpMetadata: opts.httpMetadata || {}, uploaded: new Date() });
    },
    async get(key) { return view(key) || null; },
    async head(key) { return view(key) || null; },
    async delete(k) { for (const key of [].concat(k)) m.delete(key); },
    async list({ prefix = '' } = {}) {
      return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, uploaded: m.get(k).uploaded })) };
    },
  };
}
