// Raw lowercase or snake_case values become Title Case; anything already readable is kept as stored.
export function displayLabel(v: string): string {
  if (!/^[a-z0-9_ -]+$/.test(v)) return v;
  return v.split(/[_ -]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
