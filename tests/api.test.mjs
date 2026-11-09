// Security regression tests for functions/api/[[route]].ts. Run: npm test
// The real handler is bundled with esbuild; D1 and SMTP are replaced by small in-memory fakes.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import bcrypt from 'bcryptjs';

const root = fileURLToPath(new URL('..', import.meta.url));
let onRequest;
before(async () => {
  const outfile = join(mkdtempSync(join(tmpdir(), 'jlc-api-')), 'route.mjs');
  await build({
    entryPoints: [join(root, 'functions/api/[[route]].ts')], bundle: true, platform: 'node', format: 'esm',
    outfile, logLevel: 'warning', alias: { 'cloudflare:sockets': join(root, 'tests/smtp-stub.mjs') },
  });
  ({ onRequest } = await import(pathToFileURL(outfile).href));
});

// --- In-memory D1: answers only the queries these tests exercise ---
const hash = bcrypt.hashSync('pw', 4);
const admin = (email, role) => ({ email, fullName: email, role, status: 'Active', verified: 1, passwordHash: hash, verificationToken: null, resetToken: null });
const state = {
  admins: { 'boss@x.com': admin('boss@x.com', 'Super Admin'), 'ed@x.com': admin('ed@x.com', 'Editor'), 'lock@x.com': admin('lock@x.com', 'Editor') },
  logs: [], sent: [],
};
const DB = { prepare(sql) {
  const q = { args: [], bind(...a) { q.args = a; return q; },
    async first() {
      if (/FROM admins WHERE email/.test(sql)) {
        const a = state.admins[q.args[0]];
        return a && (!/status = 'Active'/.test(sql) || a.status === 'Active') ? a : null;
      }
      if (/log_type = 'auth_failure'/.test(sql)) return { count: state.logs.filter(l => l.msg === q.args[0] && l.ts > q.args[1]).length };
      if (/COUNT/.test(sql)) return { count: 0 };
      if (/smtp_settings/.test(sql)) return { enabled: 1, host: 'h', port: 587, password: 'SMTP-PW', senderName: 'JLC', senderEmail: 'co@x.com' };
      if (/email_template/.test(sql)) return { subject: 'Thanks', body: 'Hi {{name}}\n\n"{{projectDescription}}"' };
      if (/branding/.test(sql)) return { companyName: 'JLC IT', themeColor: 'deepblue' };
      return {};
    },
    async run() {
      const m = sql.match(/INSERT INTO audit_logs \(timestamp, log_type, message\) VALUES \(\?, '(\w+)'/);
      if (m) state.logs.push({ ts: q.args[0], type: m[1], msg: q.args[1] });
      if (/^INSERT INTO sent_emails/.test(sql)) state.sent.push(q.args);
      if (/^UPDATE admins SET passwordHash/.test(sql)) state.admins[q.args.at(-1)].passwordHash = 'CHANGED';
      return {};
    },
    async all() { return { results: [] }; },
  };
  return q;
} };

const call = (path, { body, token, method = body ? 'POST' : 'GET', headers = {} } = {}) => onRequest({
  request: new Request('https://x.test' + path, { method, body: body && JSON.stringify(body),
    headers: { ...headers, ...(token ? { Authorization: 'Bearer ' + token } : {}) } }),
  env: { DB, JWT_SECRET: 'test-secret' }, waitUntil() {},
});
const login = async (email, password = 'pw') => call('/api/admin/login', { body: { email, password } });
const tokenFor = async email => (await (await login(email)).json()).token;

test('only server-signed tokens are accepted', async () => {
  const forged = 'jlc.' + btoa(JSON.stringify({ email: 'boss@x.com', exp: 9e9 }));
  assert.equal((await call('/api/admin/data', { token: forged })).status, 401);
  assert.equal((await call('/api/admin/data', { token: forged + '.AAAA' })).status, 401);
  const real = await tokenFor('boss@x.com');
  assert.equal((await call('/api/admin/data', { token: real })).status, 200);
  const swapped = real.replace(/^jlc\.[^.]+/, 'jlc.' + btoa(JSON.stringify({ email: 'ed@x.com', exp: 9e9 })));
  assert.equal((await call('/api/admin/data', { token: swapped })).status, 401);
});

test('invite and reset endpoints reject a missing token', async () => {
  for (const path of ['/api/admin/verify-invite', '/api/admin/reset-password'])
    for (const token of [null, undefined, '', 0])
      assert.equal((await call(path, { body: { email: 'boss@x.com', token, password: 'x' } })).status, 400, `${path} token=${token}`);
  assert.notEqual(state.admins['boss@x.com'].passwordHash, 'CHANGED');
});

test('role rules: Editors are blocked from admin-only settings and never see the SMTP password', async () => {
  const ed = await tokenFor('ed@x.com');
  for (const path of ['/api/admin/accounts', '/api/admin/settings/branding', '/api/admin/settings/smtp', '/api/admin/email-template'])
    assert.equal((await call(path, { token: ed, body: {} })).status, 403, path);
  const data = await (await call('/api/admin/data', { token: ed })).json();
  assert.equal(data.db.smtpSettings.password, '');
});

test('login locks an account after 5 failed attempts', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await login('lock@x.com', 'wrong')).status, 401);
  assert.equal((await login('lock@x.com')).status, 429);
  assert.equal((await login('Boss@X.com ')).status, 200, 'other accounts unaffected; email case ignored');
});

test('contact form cannot inject SMTP commands, headers or HTML', async () => {
  const { question, signature } = await (await call('/api/captcha')).json();
  const [, a, b] = question.match(/(\d+) \+ (\d+)/);
  const inquiry = extra => call('/api/inquiry', { body: { fullName: 'Eve', serviceRequired: 'Web', projectDescription: 'x',
    captchaAnswer: String(+a + +b), captchaSignature: signature, ...extra } });

  assert.equal((await inquiry({ email: 'a@x.com>\r\nRCPT TO:<victim@y.com' })).status, 400);

  globalThis.SMTP_SENT = [];
  const res = await inquiry({ email: 'eve@x.com', fullName: 'Eve\r\nBcc: victim@y.com',
    projectDescription: '"hi\n.\nMAIL FROM:<spam@evil.com>\n<script>x</script>"' });
  assert.equal(res.status, 200);
  await new Promise(r => setTimeout(r, 50)); // emails go out in the background (waitUntil)
  const stream = globalThis.SMTP_SENT.join('');
  const emails = stream.split('\r\nDATA\r\n').length - 1;
  assert.equal(emails, 2, 'acknowledgment + admin alert');
  assert.equal(stream.match(/\r\n\.\r\n/g).length, emails, 'one end-of-message per email');
  assert.match(stream, /\r\n\.\.\r\n/, 'visitor "." line is dot-stuffed');
  assert.doesNotMatch(stream, /\r\nMAIL FROM:<spam|\r\nBcc:|<script>/);
});

test('a failed reply is reported and not logged as sent', async () => {
  const boss = await tokenFor('boss@x.com');
  const before = state.sent.length;
  globalThis.SMTP_FAIL = true;
  try {
    const res = await call('/api/admin/inquiries/reply', { token: boss, body: { inquiryId: 'i', to: 'c@x.com', subject: 'Hi', body: 'Hello' } });
    assert.equal(res.status, 502);
  } finally { globalThis.SMTP_FAIL = false; }
  assert.equal(state.sent.length, before);
});

test('public data answers 304 when the client already has it', async () => {
  const first = await call('/api/public-data');
  const etag = first.headers.get('ETag');
  assert.ok(etag);
  assert.equal((await call('/api/public-data', { headers: { 'If-None-Match': etag } })).status, 304);
});
