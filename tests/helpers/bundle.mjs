import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'jlc-bundle-'));
let n = 0;

// Bundle a Pages Function (path relative to repo root) and import it.
export async function bundle(entry) {
  const outfile = join(dir, `b${n++}.mjs`);
  await build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm',
    outfile, logLevel: 'warning', alias: { 'cloudflare:sockets': join(root, 'tests/smtp-stub.mjs') } });
  return import(pathToFileURL(outfile).href);
}
