// Pure: "2d 3h 20m" until the deadline (minutes rounded up), or null once it has passed.
export function timeLeft(deadline: string | null, now: number): string | null {
  const ms = deadline ? Date.parse(deadline) - now : NaN;
  if (!(ms > 0)) return null;
  const mins = Math.ceil(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}
