export type Api = (path: string, init?: RequestInit) => Promise<Response>;
export const OFFLINE = 'We could not reach the server. Please check your connection and try again.';
export const btnCls = 'inline-flex min-h-11 items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-slate-700 disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';
export const ghostBtn = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';
export const postJson = (api: Api, path: string, body: unknown) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
