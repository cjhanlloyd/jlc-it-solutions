// Phase 4b: design proofs (admin upload, streaming) and the customer's review, on the real-SQL harness.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, makeR2 } from './helpers/d1.mjs';
import { bundle } from './helpers/bundle.mjs';

const { onRequest: adminOrders } = await bundle('functions/api/admin/orders/[[path]].ts');
const { onRequest: orders } = await bundle('functions/api/orders/[[path]].ts');
const { signAdminToken, sha256 } = await bundle('server/crypto.ts');
const { decodeProof } = await bundle('server/proofs.ts');

const SECRET = 'jwt-secret';
let db, r2, n;
beforeEach(() => {
  db = makeD1();
  r2 = makeR2();
  n = 0;
  for (const [name, role] of Object.entries({ boss: 'Super Admin', ed: 'Editor' })) {
    db.exec.prepare("INSERT INTO admins (email, fullName, role, status, verified, createdAt) VALUES (?, ?, ?, 'Active', 1, 't')").run(`${name}@jlc.test`, name, role);
  }
  db.exec.exec(`INSERT INTO products_designs (id, slug, name, layout_key, price_centavos, color_schemes, product_type)
    VALUES (1, 'classic-elegance', 'Classic Elegance', 'classic', 99900, '[{"name":"Blush"}]', 'wedding_invitation')`);
});
const q = (sql) => db.exec.prepare(sql).all();
// Order in <status>; its tracking token is "tok-<ref>"
const addOrder = async (status, kind = 'custom') => {
  n++;
  const ref = `JLC-AAAAA${n}`;
  const i = db.exec.prepare(`INSERT INTO invitations (design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash)
    VALUES (1, ?, '{"name":"Blush"}', '{}', '[]', 'pending', '2027-06-12', ?)`).run(`s-${n}`, `h${n}`);
  const id = Number(db.exec.prepare(`INSERT INTO orders (product_id, customer_email, amount_centavos, status, reference, provider, package_kind, designer_notes, tracking_token_hash)
    VALUES (?, 'c@example.com', 500000, ?, ?, 'manual_gcash', ?, ?, ?)`)
    .run(Number(i.lastInsertRowid), status, ref, kind, kind === 'custom' ? 'Gold foil' : null, await sha256(`tok-${ref}`)).lastInsertRowid);
  return { id, ref, token: `tok-${ref}` };
};
const env = () => ({ DB: db, PHOTOS: r2, JWT_SECRET: SECRET });
const admin = async (path, { as = 'boss', body } = {}) => adminOrders({ env: env(), waitUntil() {}, request: new Request('https://shop.test/api/admin/orders' + path, {
  method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { Authorization: 'Bearer ' + await signAdminToken(`${as}@jlc.test`, SECRET) } }) });
const customer = (o, path = '', { body, token = o.token } = {}) => orders({ env: env(), waitUntil() {}, request: new Request(`https://shop.test/api/orders/${o.ref}${path}`, {
  method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Order-Token': token } }) });
const status = (o) => q(`SELECT status FROM orders WHERE id = ${o.id}`)[0].status;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest-of-png')]);
const png = `data:image/png;base64,${PNG.toString('base64')}`;
const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.7 hello').toString('base64')}`;
const proof = (o, body, as) => admin(`/${o.id}`, { as, body: { action: 'proof', ...body } });
// Custom order in for_review through a real proof upload; returns the order and that proof's id
const inReview = async () => {
  const o = await addOrder('in_production');
  assert.equal((await proof(o, { url: 'https://example.com/p' })).status, 200);
  return { ...o, proofId: latestProof(o) };
};
const latestProof = (o) => q(`SELECT MAX(id) id FROM order_proofs WHERE order_id = ${o.id}`)[0].id;

test('decodeProof: PNG and PDF accepted; HTML labelled PDF and oversize rejected', () => {
  assert.equal(decodeProof(png).contentType, 'image/png');
  assert.deepEqual({ ...decodeProof(pdf), bytes: undefined }, { contentType: 'application/pdf', ext: 'pdf', bytes: undefined });
  assert.equal(decodeProof(`data:application/pdf;base64,${Buffer.from('<html><script>1</script>').toString('base64')}`), 'type');
  assert.equal(decodeProof(`data:application/pdf;base64,${Buffer.alloc(11_000_000, 0x25).toString('base64')}`), 'size');
  assert.equal(decodeProof('data:text/html;base64,PGh0bWw+'), 'type');
});

test('file proof then link proof: for_review each time, rounds 1 and 2, R2 key under proofs/<id>/', async () => {
  const o = await addOrder('in_production');
  const r1 = await proof(o, { file: png, message: 'First draft' });
  assert.equal(r1.status, 200, await r1.clone().text());
  assert.equal(status(o), 'for_review');
  db.exec.exec(`UPDATE orders SET status = 'revision_requested' WHERE id = ${o.id}`);
  const r2res = await proof(o, { url: 'https://www.canva.com/design/abc/view' });
  assert.equal(r2res.status, 200, await r2res.clone().text());
  assert.equal(status(o), 'for_review');
  const rows = q(`SELECT round, kind, file_key, content_type, url, message, created_by FROM order_proofs WHERE order_id = ${o.id} ORDER BY round`);
  assert.deepEqual(rows.map((r) => [r.round, r.kind, r.created_by]), [[1, 'file', 'boss@jlc.test'], [2, 'link', 'boss@jlc.test']]);
  assert.match(rows[0].file_key, new RegExp(`^proofs/${o.id}/\\d+-[a-z0-9]{8}\\.png$`));
  assert.ok(r2.map.has(rows[0].file_key));
  assert.equal(rows[0].content_type, 'image/png');
  assert.equal(rows[1].url, 'https://www.canva.com/design/abc/view');
  assert.equal(q(`SELECT COUNT(*) n FROM order_events WHERE order_id = ${o.id} AND to_status = 'for_review'`)[0].n, 2);

  // Admin detail: kind, notes, proofs with createdBy; no 'completed', no 'delivered' while for_review
  const d = await (await admin(`/${o.id}`)).json();
  assert.equal(d.order.packageKind, 'custom');
  assert.equal(d.order.designerNotes, 'Gold foil');
  assert.deepEqual(d.proofs.map((p) => [p.round, p.kind, p.createdBy, p.message]), [[1, 'file', 'boss@jlc.test', 'First draft'], [2, 'link', 'boss@jlc.test', null]]);
  assert.ok(!d.allowedNext.includes('completed') && !d.allowedNext.includes('delivered'), d.allowedNext.join());

  // Customer view lists proofs without createdBy; url only for links
  const v = await (await customer(o)).json();
  assert.equal(v.proofs.length, 2);
  assert.ok(v.proofs.every((p) => !('createdBy' in p) && typeof p.createdAt === 'string'));
  assert.equal(v.proofs[0].url, undefined);
  assert.equal(v.proofs[1].url, 'https://www.canva.com/design/abc/view');

  // Streaming, both sides
  const fileId = d.proofs[0].id;
  for (const res of [await admin(`/${o.id}/proofs/${fileId}`), await customer(o, `/proofs/${fileId}`)]) {
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'image/png');
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.headers.get('Content-Security-Policy'), 'sandbox');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
  }
});

test('PDF proof streams inline with a safe filename', async () => {
  const o = await addOrder('in_production');
  assert.equal((await proof(o, { file: pdf })).status, 200);
  const id = q('SELECT id FROM order_proofs')[0].id;
  const res = await customer(o, `/proofs/${id}`);
  assert.equal(res.headers.get('Content-Type'), 'application/pdf');
  assert.match(res.headers.get('Content-Disposition'), /^inline; filename="[A-Za-z0-9-]+\.pdf"$/);
});

test('bad proofs → 400, nothing stored, status unchanged', async () => {
  const o = await addOrder('in_production');
  const bad = [
    { file: `data:application/pdf;base64,${Buffer.from('<html>hi</html>').toString('base64')}` },
    { file: `data:image/png;base64,${Buffer.concat([PNG, Buffer.alloc(11_000_000)]).toString('base64')}` },
    { url: 'http://example.com/proof' },
    { url: 'javascript:alert(1)' },
    { url: '/relative' },
    {},
    { file: png, url: 'https://example.com/p' },
    { file: png, message: 'm'.repeat(1001) },
  ];
  for (const b of bad) assert.equal((await proof(o, b)).status, 400, JSON.stringify(b).slice(0, 80));
  assert.equal(q('SELECT * FROM order_proofs').length, 0);
  assert.equal(r2.map.size, 0);
  assert.equal(status(o), 'in_production');
});

test('proof upload: template order → 400; wrong status → 409; R2 object removed when the order changed', async () => {
  const t = await addOrder('in_production', 'template');
  assert.equal((await proof(t, { file: png })).status, 400);
  const c = await addOrder('for_review');
  assert.equal((await proof(c, { file: png })).status, 409);
  assert.equal(r2.map.size, 0);
  // The order changes between the read and the write: no proof row, R2 object deleted
  const raced = await addOrder('in_production');
  const batch = db.batch;
  db.batch = (s) => { db.exec.exec(`UPDATE orders SET status = 'refunded' WHERE id = ${raced.id}`); return batch(s); };
  assert.equal((await proof(raced, { file: png })).status, 409);
  // The database step throws: R2 object deleted too
  db.exec.exec(`UPDATE orders SET status = 'in_production' WHERE id = ${raced.id}`);
  db.batch = async () => { throw new Error('D1 down'); };
  assert.equal((await proof(raced, { file: png })).status, 500);
  db.batch = batch;
  assert.equal(r2.map.size, 0);
  assert.equal(q('SELECT * FROM order_proofs').length, 0);
});

test('Editor: out-of-scope proof upload → 404; in-scope (unassigned paid) ok', async () => {
  const theirs = await addOrder('in_production');
  db.exec.exec(`UPDATE orders SET assigned_to = 'boss@jlc.test' WHERE id = ${theirs.id}`);
  assert.equal((await proof(theirs, { file: png }, 'ed')).status, 404);
  assert.equal((await admin(`/${theirs.id}/proofs/1`, { as: 'ed' })).status, 404);
  assert.equal(r2.map.size, 0);
  const open = await addOrder('in_production');
  assert.equal((await proof(open, { url: 'https://example.com/p' }, 'ed')).status, 200);
});

test("customer B's token cannot read A's proof; a proof id from another order → 404", async () => {
  const a = await addOrder('in_production');
  const b = await addOrder('in_production');
  assert.equal((await proof(a, { file: png })).status, 200);
  const id = q('SELECT id FROM order_proofs')[0].id;
  const wrong = await customer(a, `/proofs/${id}`, { token: b.token });
  const none = await customer(a, `/proofs/${id}`, { token: 'nope' });
  assert.equal(wrong.status, 404);
  assert.deepEqual(await wrong.json(), await none.json());
  assert.equal((await customer(b, `/proofs/${id}`)).status, 404);
  assert.equal((await admin(`/${b.id}/proofs/${id}`)).status, 404);
});

test('approve twice concurrently → one completed event, second 409', async () => {
  const o = await inReview();
  const res = await Promise.all([1, 2].map(() => customer(o, '/review', { body: { decision: 'approve', proofId: o.proofId } })));
  assert.deepEqual(res.map((r) => r.status).sort(), [200, 409]);
  assert.equal(status(o), 'completed');
  assert.equal(q(`SELECT COUNT(*) n FROM order_events WHERE order_id = ${o.id} AND to_status = 'completed'`)[0].n, 1);
  assert.equal(q(`SELECT actor FROM order_events WHERE to_status = 'completed'`)[0].actor, 'customer');
});

test('request changes: note required (≤1,000) → revision_requested with a visible note', async () => {
  const o = await inReview();
  const proofId = o.proofId;
  for (const body of [{ decision: 'changes', proofId }, { decision: 'changes', note: '   ', proofId }, { decision: 'changes', note: 'x'.repeat(1001), proofId }, { decision: 'maybe', proofId }, { decision: 'approve' }, { decision: 'approve', proofId: String(proofId) }]) {
    assert.equal((await customer(o, '/review', { body })).status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(status(o), 'for_review');
  assert.equal((await customer(o, '/review', { body: { decision: 'changes', note: '  Bigger names please  ', proofId } })).status, 200);
  assert.equal(status(o), 'revision_requested');
  const ev = q(`SELECT note, visible FROM order_events WHERE order_id = ${o.id} AND to_status = 'revision_requested'`)[0];
  assert.deepEqual({ ...ev }, { note: 'Bigger names please', visible: 1 });
  assert.ok((await (await customer(o)).json()).events.some((e) => e.note === 'Bigger names please'));
});

test("review on a template order or outside for_review → 409 \"isn't waiting\"", async () => {
  const t = await addOrder('for_review', 'template');
  const c = await addOrder('in_production');
  for (const o of [t, c]) {
    const res = await customer(o, '/review', { body: { decision: 'approve', proofId: 1 } });
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "This order isn't waiting for your review." });
  }
  assert.equal(status(t), 'for_review');
  assert.equal((await (await customer(t)).json()).proofs, undefined, 'template orders list no proofs');
});

test("admin can't complete a custom order via status (B5); allowedNext offers delivered only from completed (B3)", async () => {
  const o = await addOrder('for_review');
  const res = await admin(`/${o.id}`, { body: { action: 'status', to: 'completed' } });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Only the customer can approve a custom design.' });
  db.exec.exec(`UPDATE orders SET status = 'completed' WHERE id = ${o.id}`);
  assert.ok((await (await admin(`/${o.id}`)).json()).allowedNext.includes('delivered'));
  const t = await addOrder('for_review', 'template');
  const tn = (await (await admin(`/${t.id}`)).json()).allowedNext;
  assert.ok(tn.includes('completed') && tn.includes('delivered'));
});

test('B6: admin cannot put a custom order in review without a proof; allowedNext omits for_review', async () => {
  for (const s of ['in_production', 'revision_requested']) {
    const o = await addOrder(s);
    const res = await admin(`/${o.id}`, { body: { action: 'status', to: 'for_review' } });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'Send a proof to put a custom order in review.' });
    assert.equal(status(o), s);
    assert.ok(!(await (await admin(`/${o.id}`)).json()).allowedNext.includes('for_review'));
  }
  const t = await addOrder('in_production', 'template');
  assert.ok((await (await admin(`/${t.id}`)).json()).allowedNext.includes('for_review'));
  assert.equal((await admin(`/${t.id}`, { body: { action: 'status', to: 'for_review' } })).status, 200);
});

test('stale tab: approving an older proof → 409 and stays for_review; the latest proof approves', async () => {
  const o = await inReview();
  const round1 = o.proofId;
  assert.equal((await customer(o, '/review', { body: { decision: 'changes', note: 'Bigger names', proofId: round1 } })).status, 200);
  assert.equal((await proof(o, { file: png })).status, 200);
  const round2 = latestProof(o);
  assert.notEqual(round1, round2);
  const stale = await customer(o, '/review', { body: { decision: 'approve', proofId: round1 } });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'A newer proof is waiting for your review. Please reload.' });
  assert.equal(status(o), 'for_review');
  assert.equal((await customer(o, '/review', { body: { decision: 'approve', proofId: round2 } })).status, 200);
  assert.equal(status(o), 'completed');
});
