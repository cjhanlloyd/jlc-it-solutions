/// <reference types="@cloudflare/workers-types" />
// Detects a live database that is behind the code: one schema marker per migration (its last table or column).
// Migrations run by hand on production, so a skipped one otherwise only shows up as a generic 500.

type Marker = { migration: string; table: string; column?: string } | { migration: string; dataOnly: true };

export const MIGRATION_MARKERS: Marker[] = [
  { migration: '0001_invitations', table: 'rsvps' },
  { migration: '0002_occasions', table: 'rsvps', column: 'kids_count' },
  { migration: '0003_orders_gcash', table: 'payment_settings' },
  { migration: '0003_orders_gcash', table: 'orders', column: 'updated_at' },
  { migration: '0004_remap_legacy', dataOnly: true }, // data remap only: nothing to detect
  { migration: '0005_design_marketing', table: 'products_designs', column: 'featured' },
  { migration: '0006_packages_content', table: 'faqs', column: 'category' },
  { migration: '0006_packages_content', table: 'orders', column: 'package_name' },
  { migration: '0007_custom_orders', table: 'orders', column: 'designer_notes' },
  { migration: '0007_custom_orders', table: 'order_proofs' },
  { migration: '0008_invitation_style', table: 'invitations', column: 'style' },
  { migration: '0009_new_designs', dataOnly: true }, // data only: five inactive designs
];

/** Names of migrations whose marker is missing, in order, without duplicates. */
export async function missingMigrations(db: D1Database): Promise<string[]> {
  const checks = MIGRATION_MARKERS.filter((m): m is Extract<Marker, { table: string }> => 'table' in m);
  const tables = new Set(((await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()).results || []).map((r) => r.name));
  const columns = new Map<string, Set<string>>();
  for (const t of new Set(checks.filter((c) => c.column && tables.has(c.table)).map((c) => c.table))) {
    const rows = (await db.prepare('SELECT name FROM pragma_table_info(?)').bind(t).all<{ name: string }>()).results || [];
    columns.set(t, new Set(rows.map((r) => r.name)));
  }
  const missing = checks.filter((c) => !tables.has(c.table) || (c.column && !columns.get(c.table)?.has(c.column))).map((c) => c.migration);
  return [...new Set(missing)];
}

export const migrationWarning = (missing: string[]) =>
  `The live database is missing ${missing.length === 1 ? 'migration' : 'migrations'} ${missing.join(', ')}. Run ${missing.length === 1 ? 'it' : 'them'} on the live database, then reload.`;
