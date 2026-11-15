// Shared by the admin reports and dashboard so both use the same Manila day bounds and the same "paid at" rule.
export const MANILA_MS = 8 * 3600_000; // UTC+8, no DST
export const DAY_MS = 86400_000;
export const sqlTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

const DATE = /^\d{4}-\d\d-\d\d$/;
const dayStart = (d: string) => { const ms = Date.parse(`${d}T00:00:00.000Z`); return !isNaN(ms) && new Date(ms).toISOString().startsWith(d) ? ms - MANILA_MS : NaN; };

// Inclusive Manila days → half-open bounds, in ISO (events, delivered_at, ...) and SQL UTC (orders.created_at)
export function parseRange(from: string | null, to: string | null) {
  const a = DATE.test(from ?? '') ? dayStart(from!) : NaN;
  const b = DATE.test(to ?? '') ? dayStart(to!) : NaN;
  if (isNaN(a) || isNaN(b)) return { error: 'Use dates like 2026-11-15.' };
  if (a > b) return { error: 'The start date must be before the end date.' };
  const days = (b - a) / DAY_MS + 1;
  if (days > 366) return { error: 'Choose a range of 366 days or less.' };
  const end = b + DAY_MS;
  return { fromIso: new Date(a).toISOString(), toIsoExclusive: new Date(end).toISOString(), fromSql: sqlTime(a), toSqlExclusive: sqlTime(end), days };
}

// ISO paid-at per order: first payment_confirmed event, else delivered_at, else created_at (SQL UTC → ISO)
export const paidAtSql = (alias = 'o') =>
  `COALESCE((SELECT MIN(pe.at) FROM order_events pe WHERE pe.order_id = ${alias}.id AND pe.kind = 'status' AND pe.to_status = 'payment_confirmed'), ${alias}.delivered_at, replace(${alias}.created_at, ' ', 'T') || '.000Z')`;

export const manilaMonthKey = (iso: string) => new Date(Date.parse(iso) + MANILA_MS).toISOString().slice(0, 7);

export function median(nums: number[]) {
  if (!nums.length) return null;
  const s = [...nums].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
