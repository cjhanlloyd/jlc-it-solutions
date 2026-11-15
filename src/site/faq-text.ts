import { INLINE_LINK_RE, isSafeLink } from '../../shared/links';

// FAQ answers support only [text](url) links; an unsafe url is downgraded to plain text.
export function splitAnswer(text: string): Array<{ text: string; href?: string }> {
  const out: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_LINK_RE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(isSafeLink(m[2]) ? { text: m[1], href: m[2] } : { text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
