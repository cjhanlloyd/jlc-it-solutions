// Test stand-in for 'cloudflare:sockets': a fake SMTP server that accepts every command
// and records what was written. Set globalThis.SMTP_FAIL = true to simulate a refused connection.
export function connect() {
  if (globalThis.SMTP_FAIL) throw new Error('connection refused');
  const sent = (globalThis.SMTP_SENT ??= []);
  const replies = ['220 hi', '250 ok', '250 ok', '250 ok', '354 go', '250 queued', '221 bye'];
  const pending = [replies.shift()];
  let wake;
  return {
    readable: { getReader: () => ({
      async read() {
        while (!pending.length) await new Promise(r => (wake = r));
        return { value: new TextEncoder().encode(pending.shift() + '\r\n'), done: false };
      },
      releaseLock() {},
    }) },
    writable: { getWriter: () => ({
      async write(bytes) {
        const text = new TextDecoder().decode(bytes);
        sent.push(text);
        // The message body is one write ending in "\r\n.\r\n"; every other write is one command
        if (!text.startsWith('Message-ID') || text.endsWith('\r\n.\r\n')) { pending.push(replies.shift()); wake?.(); }
      },
      releaseLock() {},
    }) },
    async close() {},
  };
}
