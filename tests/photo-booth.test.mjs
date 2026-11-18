import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOOTH_H, BOOTH_W, FRAMES, coverCrop, drawPhoto, fitText, photoRect } from '../src/invitations/booth/frames.ts';
import { cameraError, cameraUnavailable } from '../src/invitations/booth/camera.ts';

test('coverCrop takes the centred part that fills the target', () => {
  // A landscape 1920×1080 camera into the 4:5 booth: full height, centred width
  const c = coverCrop(1920, 1080, 1080, 1350);
  assert.equal(c.sh, 1080);
  assert.equal(c.sw, 864);
  assert.equal(c.sx, (1920 - 864) / 2);
  assert.equal(c.sy, 0);
  // A tall source: full width, centred height
  assert.deepEqual(coverCrop(1000, 2000, 1000, 1000), { sx: 0, sy: 500, sw: 1000, sh: 1000 });
  // Same aspect: everything
  assert.deepEqual(coverCrop(540, 675, 1080, 1350), { sx: 0, sy: 0, sw: 540, sh: 675 });
  // No video size yet: no crop, no NaN
  assert.deepEqual(coverCrop(0, 0, 1080, 1350), { sx: 0, sy: 0, sw: 0, sh: 0 });
});

// Measures each character as half the font size wide
const measuring = () => {
  const ctx = { font: '10px x', measureText: (t) => ({ width: Array.from(t).length * parseFloat(ctx.font) * 0.5 }) };
  return ctx;
};

test('fitText shrinks to fit, then cuts with an ellipsis at the minimum size', () => {
  const ctx = measuring();
  assert.deepEqual(fitText(ctx, 'Maria & Juan', 1000, 80, 20, (px) => `${px}px s`), { px: 80, text: 'Maria & Juan' });
  const shrunk = fitText(ctx, 'Maria & Juan', 300, 80, 20, (px) => `${px}px s`); // 12 chars × px/2 ≤ 300 → px ≤ 50
  assert.equal(shrunk.px, 50);
  assert.equal(shrunk.text, 'Maria & Juan');
  const cut = fitText(ctx, 'A very long celebration headline indeed', 200, 40, 20, (px) => `${px}px s`);
  assert.equal(cut.px, 20);
  assert.ok(cut.text.endsWith('…'));
  assert.ok(Array.from(cut.text).length * 10 <= 200);
  assert.equal(fitText(ctx, 'abc', 1, 20, 20, (px) => `${px}px s`).text, '');
});

test('photoRect leaves the polaroid border and uses the whole canvas otherwise', () => {
  assert.deepEqual(photoRect('classic', BOOTH_W, BOOTH_H), { x: 0, y: 0, w: BOOTH_W, h: BOOTH_H });
  const p = photoRect('polaroid', BOOTH_W, BOOTH_H);
  assert.ok(p.x > 0 && p.y > 0 && p.x + p.w < BOOTH_W);
  assert.ok(BOOTH_H - (p.y + p.h) > p.y * 2, 'the bottom margin is the larger one');
});


const opts = { primary: '#7a5752', accent: '#b8955a', background: '#faf7f2', text: '#3a3330', headline: 'Maria & Juan', kicker: 'Together with their families', date: 'Sunday, February 14, 2027 · 3:30 PM' };
const longOpts = { ...opts, headline: 'Maximiliana Concepcion de los Santos & Juan Bartolome Villanueva', kicker: 'X'.repeat(200), date: 'Wednesday, September 29, 2027 · 10:30 AM' };

test('every frame draws something and nothing off the canvas', () => {
  for (const id of Object.keys(FRAMES)) {
    for (const [w, h] of [[BOOTH_W, BOOTH_H], [216, 270]]) {
      for (const o of [opts, longOpts, { ...opts, headline: '', kicker: '', date: '' }]) {
        const { ctx, calls, out } = inspect(w, h);
        assert.doesNotThrow(() => FRAMES[id].draw(ctx, w, h, o), id);
        assert.ok(calls.length > 5, `${id} draws`);
        assert.deepEqual(out, [], `${id} at ${w}×${h} stays within bounds`);
        assert.ok(calls.some((c) => c[0] === 'fillText') || (id === 'film' && !o.headline), `${id} writes text`);
      }
    }
  }
});

test('drawPhoto mirrors the camera into the photo area', () => {
  const { ctx, calls, out } = inspect(BOOTH_W, BOOTH_H);
  drawPhoto(ctx, {}, 1920, 1080, photoRect('polaroid', BOOTH_W, BOOTH_H));
  assert.deepEqual(out, []);
  assert.ok(calls.some((c) => c[0] === 'scale' && c[1] === -1));
  const img = calls.find((c) => c[0] === 'drawImage');
  assert.equal(img.length, 10);
});

function inspect(w, h) {
  const calls = [];
  const out = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const check = (name, x, y) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), `${name}: not a number`);
    const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
    if (X < -0.5 || Y < -0.5 || X > w + 0.5 || Y > h + 0.5) out.push(`${name} at ${X.toFixed(1)},${Y.toFixed(1)}`);
  };
  const size = () => parseFloat(/(\d+(?:\.\d+)?)px/.exec(t.font)[1]);
  const t = {
    font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic',
    measureText: (s) => ({ width: Array.from(s).length * size() * 0.55 }),
    save: () => stack.push(m.slice()), restore: () => { m = stack.pop(); },
    translate: (x, y) => { m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
    scale: (sx, sy) => { m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]; },
    beginPath() {}, stroke() {}, fill() {},
    fillRect: (x, y, rw, rh) => { check('fillRect', x, y); check('fillRect', x + rw, y + rh); },
    strokeRect: (x, y, rw, rh) => { check('strokeRect', x, y); check('strokeRect', x + rw, y + rh); },
    moveTo: (x, y) => check('moveTo', x, y), lineTo: (x, y) => check('lineTo', x, y),
    bezierCurveTo: (a, b, c, d, x, y) => { check('bezier', a, b); check('bezier', c, d); check('bezier', x, y); },
    ellipse: (x, y, rx, ry) => { const r = Math.max(rx, ry); check('ellipse', x - r, y - r); check('ellipse', x + r, y + r); },
    arc: (x, y, r) => { check('arc', x - r, y - r); check('arc', x + r, y + r); },
    fillText: (s, x, y) => {
      const tw = t.measureText(s).width;
      const left = t.textAlign === 'center' ? x - tw / 2 : t.textAlign === 'right' ? x - tw : x;
      check('fillText', left, y); check('fillText', left + tw, y);
    },
    drawImage: (...a) => { const [dx, dy, dw, dh] = a.slice(-4); check('drawImage', dx, dy); check('drawImage', dx + dw, dy + dh); },
  };
  const ctx = new Proxy(t, {
    get: (o, k) => (typeof o[k] === 'function' && k !== 'measureText' ? (...a) => { calls.push([k, ...a]); return o[k](...a); } : o[k]),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  return { ctx, calls, out };
}

test('camera messages', () => {
  assert.equal(cameraError({ name: 'NotAllowedError' }), 'Camera access was blocked. Allow it in your browser settings to use the photo booth.');
  assert.match(cameraError({ name: 'NotFoundError' }), /could not find a camera/);
  assert.match(cameraError(new Error('x')), /could not start/);
  assert.match(cameraUnavailable(false, true), /secure \(https\)/);
  assert.match(cameraUnavailable(true, false), /cannot use the camera/);
  assert.equal(cameraUnavailable(true, true), '');
});

test('the camera is allowed for the site itself in both header sources', () => {
  const root = new URL('..', import.meta.url);
  assert.match(readFileSync(new URL('public/_headers', root), 'utf8'), /Permissions-Policy: camera=\(self\), microphone=\(\)/);
  assert.match(readFileSync(new URL('server/security-headers.ts', root), 'utf8'), /'Permissions-Policy': 'camera=\(self\), microphone=\(\)/);
});

test('the booth is lazy-loaded and asks for the camera only from the Start camera tap', () => {
  const root = new URL('..', import.meta.url);
  const guest = readFileSync(new URL('src/invitations/guest-main.tsx', root), 'utf8');
  assert.match(guest, /lazy\(\(\) => import\('\.\/booth\/PhotoBooth'\)\)/);
  assert.doesNotMatch(guest, /from '\.\/booth\//);
  const booth = readFileSync(new URL('src/invitations/booth/PhotoBooth.tsx', root), 'utf8');
  assert.equal(booth.match(/getUserMedia\(/g).length, 1);
  assert.match(booth, /async function start\(\)[\s\S]*getUserMedia\(CAMERA\)/);
});
