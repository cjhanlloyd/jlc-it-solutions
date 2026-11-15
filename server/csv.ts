// RFC 4180 CSV with a UTF-8 BOM (Excel) and CRLF rows. Text cells that start with a formula character get a ' prefix.
// Money columns hold centavos (numbers), are written as plain decimals and are exempt from the prefix.
export function toCsv(headers: string[], rows: (string | number | null)[][], moneyCols: number[] = []): string {
  const cell = (v: string | number | null, money: boolean) => {
    if (v == null) return '';
    let s = money && typeof v === 'number' ? (v / 100).toFixed(2) : String(v);
    if (!money && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map((h) => cell(h, false)), ...rows.map((r) => r.map((v, i) => cell(v, moneyCols.includes(i))))];
  return '﻿' + lines.map((l) => l.join(',')).join('\r\n') + '\r\n';
}
