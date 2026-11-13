// Admin role permissions. Enforced server-side; the client only hides buttons.
export type Action = 'orders.view' | 'orders.contact' | 'orders.work' | 'orders.assign' | 'payments.review' | 'orders.refund' | 'settings.payment';

const ALL: Action[] = ['orders.view', 'orders.contact', 'orders.work', 'orders.assign', 'payments.review', 'orders.refund', 'settings.payment'];
// A Map, so a role like 'constructor' cannot reach Object.prototype
const ROLES = new Map<string, readonly Action[]>([
  ['Super Admin', ALL],
  ['Administrator', ALL.filter((a) => a !== 'settings.payment')],
  ['Editor', ['orders.view', 'orders.work']],
]);

export const can = (role: string, action: Action): boolean => ROLES.get(role)?.includes(action) ?? false;
