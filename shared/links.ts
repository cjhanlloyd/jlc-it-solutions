// Link rules shared by the content API and the site renderer: a site path or an https URL, never whitespace or backslash
// (browsers turn "/\x" and "/<TAB>/x" into "//x", a protocol-relative redirect).
const SAFE_LINK_RE = /^(?:\/(?![/\\])[^\s\\]*|https:\/\/[^\s\\]+)$/;
export const isSafeLink = (url: string): boolean => SAFE_LINK_RE.test(url);

// [text](url); the url has no parentheses or whitespace
export const INLINE_LINK_RE = /\[([^\]]*)\]\(([^()\s]*)\)/g;
