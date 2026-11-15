// Guards AA contrast: faint ink text classes must not return on text elements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('no text-ink/10..60 on text elements', () => {
  const bad = [];
  for (const dir of ['src/components', 'src/site']) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
      readFileSync(`${dir}/${f}`, 'utf8').split('\n').forEach((line, i) => {
        if (/text-ink\/(10|20|30|40|50|60)\b/.test(line) && /<(p|span|label|h\d)\b/.test(line)) bad.push(`${dir}/${f}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(bad, []);
});
