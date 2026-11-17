// Path routes of the public site, and the legacy URLs (old /invitations paths, #/ tab hashes) that redirect to them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFor, PAGE_META, withSearch } from '../src/site/routes.ts';

const route = (p, h = '') => routeFor(p, h).route;
const redirect = (p, h = '') => routeFor(p, h).redirect;

test('every public route', () => {
  assert.deepEqual(route('/'), { page: 'home' });
  assert.deepEqual(route('/designs'), { page: 'designs' });
  assert.deepEqual(route('/designs/rustic-gold'), { page: 'design', slug: 'rustic-gold' });
  assert.deepEqual(route('/designs/rustic-gold/customise'), { page: 'customise', slug: 'rustic-gold' });
  assert.deepEqual(route('/services'), { page: 'services' });
  assert.deepEqual(route('/about'), { page: 'about' });
  assert.deepEqual(route('/contact'), { page: 'contact' });
  assert.deepEqual(route('/track'), { page: 'track' });
  assert.deepEqual(route('/manage'), { page: 'manage' });
  assert.deepEqual(route('/account'), { page: 'account' });
  assert.deepEqual(route('/reviews'), { page: 'reviews' });
  for (const kind of ['terms', 'refund-policy', 'privacy']) assert.deepEqual(route(`/${kind}`), { page: 'policy', kind });
});

test('trailing slashes are accepted', () => {
  assert.deepEqual(route('/designs/'), { page: 'designs' });
  assert.deepEqual(route('/designs/a/customise/'), { page: 'customise', slug: 'a' });
  assert.deepEqual(route('/track/'), { page: 'track' });
});

test('order refs are decoded and uppercased', () => {
  assert.deepEqual(route('/order/jlc-abc123'), { page: 'order', ref: 'JLC-ABC123' });
  assert.deepEqual(route('/order/JLC-X%31'), { page: 'order', ref: 'JLC-X1' });
});

test('slugs are decoded; malformed percent-encoding is not found', () => {
  assert.deepEqual(route('/designs/my%20design'), { page: 'design', slug: 'my design' });
  assert.deepEqual(route('/designs/%E0'), { page: 'notFound' });
  assert.deepEqual(route('/order/%E0'), { page: 'notFound' });
});

test('unknown paths are not found, never redirected', () => {
  for (const p of ['/nonsense', '/toString', '/constructor', '/designs/a/b', '/i/x', '/order', '/designs/a/customise/x']) {
    assert.deepEqual(routeFor(p, ''), { route: { page: 'notFound' } }, p);
  }
});

test('old /invitations paths redirect', () => {
  assert.equal(redirect('/invitations'), '/designs');
  assert.equal(redirect('/invitations/'), '/designs');
  assert.equal(redirect('/invitations/rustic-gold'), '/designs/rustic-gold/customise');
  assert.equal(redirect('/invitations/rustic-gold/'), '/designs/rustic-gold/customise');
});

test('old tab hashes redirect', () => {
  assert.equal(redirect('/', '#/shop'), '/');
  assert.equal(redirect('/', '#/home'), '/services');
  assert.equal(redirect('/', '#/services'), '/services');
  assert.equal(redirect('/', '#/pricing'), '/services#pricing');
  assert.equal(redirect('/', '#/why'), '/services#why');
  assert.equal(redirect('/', '#/about'), '/about');
  assert.equal(redirect('/', '#/contact'), '/contact');
  assert.equal(redirect('/', '#/inquiry'), '/contact');
  assert.equal(redirect('/', '#/inquiry?step=2'), '/contact');
});

test('plain anchors and unknown hashes keep the page', () => {
  assert.deepEqual(route('/', '#how'), { page: 'home' });
  assert.deepEqual(route('/', '#/nonsense'), { page: 'home' });
  assert.deepEqual(route('/', '#/constructor'), { page: 'home' });
  assert.deepEqual(route('/services', '#pricing'), { page: 'services' });
  assert.deepEqual(route('/designs', '#/login'), { page: 'designs' });
});

test('every page has a title and description', () => {
  const pages = ['home', 'designs', 'design', 'customise', 'services', 'about', 'contact', 'order', 'track', 'manage', 'account', 'reviews', 'policy', 'notFound'];
  assert.deepEqual(Object.keys(PAGE_META).sort(), [...pages].sort());
  for (const p of pages) {
    assert.match(PAGE_META[p].title, / \| JLC Solutions$/, p);
    assert.ok(PAGE_META[p].description.length > 20, p);
  }
});

test('withSearch keeps the query string on redirects', () => {
  assert.equal(withSearch('/designs', '?utm_source=fb'), '/designs?utm_source=fb');
  assert.equal(withSearch('/services#pricing', '?utm_source=fb'), '/services?utm_source=fb#pricing');
  assert.equal(withSearch('/designs', ''), '/designs');
  assert.equal(withSearch('/x?a=1', '?b=2'), '/x?a=1');
});
