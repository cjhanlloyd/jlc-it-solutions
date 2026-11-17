// Packages for one design: 1–4 rows (name, price in pesos, kind, inclusions one per line), add/remove/reorder.
import { tierOf, type Tier } from '../../shared/tiers';
import { validatePackages, type Package } from '../../shared/packages';
import { Button, Select, TextArea, TextField } from '../ui';
import { centavosToPesos, move, pesosToCentavos, slugify } from './design-form';

// fixedKey: loaded from the server, so its key stays (orders and ?package= links use it); new rows take their key from the name.
export type PackageRow = { key: string; fixedKey: boolean; name: string; price: string; kind: Package['kind']; inclusions: string; tier?: Tier };

export const toRows = (packages: Package[]): PackageRow[] => packages.map((p) => ({
  key: p.key, fixedKey: true, name: p.name, price: centavosToPesos(p.priceCentavos), kind: p.kind, inclusions: p.inclusions.join('\n'), ...(p.tier ? { tier: p.tier } : {}),
}));
export const newRow = (name = '', price = ''): PackageRow => ({ key: slugify(name, 30), fixedKey: false, name, price, kind: 'template', inclusions: '' });
export const toPackages = (rows: PackageRow[]) => rows.map((r) => ({
  key: r.key, name: r.name, priceCentavos: pesosToCentavos(r.price), kind: r.kind, inclusions: r.inclusions.split('\n'), ...(r.kind === 'template' && r.tier ? { tier: r.tier } : {}),
}));
export const packagesError = (rows: PackageRow[]) => { const v = validatePackages(toPackages(rows)); return v.ok === false ? v.error : ''; };

export default function PackagesEditor({ rows, onChange }: { rows: PackageRow[]; onChange: (rows: PackageRow[]) => void }) {
  const set = (i: number, patch: Partial<PackageRow>) => onChange(rows.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, ...patch };
    return next.fixedKey ? next : { ...next, key: slugify(next.name, 30) };
  }));
  const error = packagesError(rows);
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <fieldset key={i} className="rounded-control border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">Package {i + 1}{r.key && <span className="ml-2 font-mono text-xs font-normal text-slate-600">{r.key}</span>}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Name" maxLength={40} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            <TextField label="Price (₱)" inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
            <Select label="Kind" value={r.kind} onChange={(e) => set(i, { kind: e.target.value as Package['kind'] })}>
              <option value="template">Template</option>
              <option value="custom">Made to order</option>
            </Select>
            {r.kind === 'template' && (
              <Select label="Tier" value={tierOf(r)} onChange={(e) => set(i, { tier: e.target.value as Tier })}>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </Select>
            )}
          </div>
          <div className="mt-3">
            <TextArea label="Inclusions" hint="One per line, up to 10." rows={3} value={r.inclusions} onChange={(e) => set(i, { inclusions: e.target.value })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={i === 0} onClick={() => onChange(move(rows, i, -1))} aria-label={`Move package ${i + 1} up`}>Up</Button>
            <Button size="sm" variant="secondary" disabled={i === rows.length - 1} onClick={() => onChange(move(rows, i, 1))} aria-label={`Move package ${i + 1} down`}>Down</Button>
            <Button size="sm" variant="ghost" disabled={rows.length <= 1} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove package ${i + 1}`}>Remove</Button>
          </div>
        </fieldset>
      ))}
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      {rows.length < 4 && <Button variant="secondary" size="sm" onClick={() => onChange([...rows, newRow()])}>Add package</Button>}
    </div>
  );
}
