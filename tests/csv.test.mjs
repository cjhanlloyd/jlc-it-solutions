// CSV builder: BOM, CRLF, RFC 4180 quoting, formula escaping, money columns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from './helpers/bundle.mjs';

const { toCsv } = await bundle('server/csv.ts');

test('BOM, CRLF rows, header first', () => {
  const out = toCsv(['a', 'b'], [['1', '2']], []);
  assert.equal(out, '﻿a,b\r\n1,2\r\n');
});

test('formula characters get a quote prefix', () => {
  for (const c of ['=SUM(1)', '+1', '-1', '@x', '\tx', '\rx']) {
    const out = toCsv(['h'], [[c]], []).slice(1);
    assert.ok(out.split('\r\n')[1].replace(/^"|"$/g, '').startsWith("'" + c[0]), JSON.stringify(c));
  }
});

test('quotes and commas are quoted', () => {
  assert.equal(toCsv(['h'], [['a,"b"'], ['x\ny']], []), '﻿h\r\n"a,""b"""\r\n"x\ny"\r\n');
});

test('money column is a plain 2-decimal number, even negative, and not escaped', () => {
  assert.equal(toCsv(['t', 'amt'], [['x', -150000], ['y', 150000], ['z', null]], [1]), '﻿t,amt\r\nx,-1500.00\r\ny,1500.00\r\nz,\r\n');
});
