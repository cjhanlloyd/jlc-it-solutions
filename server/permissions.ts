// Admin role permissions. Enforced server-side; the client only hides buttons.
export type Action = 'orders.view' | 'orders.contact' | 'orders.work' | 'orders.assign' | 'payments.review' | 'orders.refund' | 'settings.payment' | 'designs.manage' | 'content.manage' | 'reports.view' | 'inquiries.manage' | 'customers.view' | 'users.manage' | 'activity.view' | 'settings.email';

const ALL: Action[] = ['inquiries.manage', 'customers.view','orders.view', 'orders.contact', 'orders.work', 'orders.assign', 'payments.review', 'orders.refund', 'settings.payment', 'designs.manage', 'content.manage', 'reports.view', 'users.manage', 'activity.view', 'settings.email'];
// A Map, so a role like 'constructor' cannot reach Object.prototype
const ROLES = new Map<string, readonly Action[]>([
  ['Super Admin', ALL],
  ['Administrator', ALL.filter((a) => !['settings.payment', 'users.manage', 'settings.email'].includes(a))],
  ['Editor', ['orders.view', 'orders.work']],
]);

export const can = (role: string, action: Action): boolean => ROLES.get(role)?.includes(action) ?? false;
