// Admin sidebar structure: groups, items, permissions and which route.page values highlight each item.
import { can, type Action } from '../../server/permissions';

export type NavItem = { id: string; label: string; href: string; perm: Action; pages: string[] };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', href: '#/dashboard', perm: 'orders.view', pages: ['dashboard'] },
    { id: 'reports', label: 'Reports', href: '#/reports', perm: 'reports.view', pages: ['reports'] },
  ] },
  { label: 'Sales', items: [
    { id: 'orders', label: 'Orders', href: '#/orders', perm: 'orders.view', pages: ['orders', 'order'] },
    { id: 'customers', label: 'Customers', href: '#/customers', perm: 'customers.view', pages: ['customers', 'customer'] },
    { id: 'promos', label: 'Promo codes', href: '#/promos', perm: 'promos.manage', pages: ['promos'] },
    { id: 'inquiries', label: 'Inquiries', href: '#/inquiries', perm: 'inquiries.manage', pages: ['inquiries', 'inquiry'] },
    { id: 'invitations', label: 'Invitations & RSVPs', href: '#/invitations', perm: 'orders.view', pages: ['invitations'] },
  ] },
  { label: 'Catalogue & website', items: [
    { id: 'designs', label: 'Designs', href: '#/designs', perm: 'designs.manage', pages: ['designs', 'design'] },
    { id: 'music', label: 'Music', href: '#/music', perm: 'designs.manage', pages: ['music'] },
    { id: 'content', label: 'Content & settings', href: '#/content', perm: 'content.manage', pages: ['content'] },
    { id: 'itContent', label: 'IT pages', href: '#/it-content', perm: 'content.manage', pages: ['itContent'] },
  ] },
  { label: 'Team', items: [
    { id: 'users', label: 'Users', href: '#/users', perm: 'users.manage', pages: ['users'] },
    { id: 'activity', label: 'Activity log', href: '#/activity', perm: 'activity.view', pages: ['activity'] },
  ] },
  { label: 'Settings', items: [
    { id: 'payment', label: 'Payment settings', href: '#/settings/payment', perm: 'settings.payment', pages: ['settings'] },
    { id: 'email', label: 'Email settings', href: '#/settings/email', perm: 'settings.email', pages: ['emailSettings'] },
  ] },
];

export const visibleGroups = (role: string): NavGroup[] =>
  NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(role, i.perm)) })).filter((g) => g.items.length > 0);

export const isActive = (page: string, item: NavItem) => item.pages.includes(page);
