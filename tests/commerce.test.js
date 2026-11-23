import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { activeEvents, totals, TERMS_VERSION } from '../shared/rules.js';
import { configureLocal } from '../server/db.js';
import { seed } from '../scripts/seed.js';
import auth from '../api/auth.js';
import catalog from '../api/catalog.js';
import cart from '../api/cart.js';
import orders from '../api/orders.js';

const db = new PGlite();
const routes = { auth, catalog, cart, orders };
const server = createServer((req, res) => routes[new URL(req.url, 'http://localhost').pathname.slice(1)](req, res));
let base;
before(async () => {
  process.env.DEMO_PAYMENT = 'true';
  configureLocal(db);
  await seed(db);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { server.close(); await once(server, 'close'); await db.close(); });

async function request(path, { method = 'GET', data, session, origin = base } = {}) {
  const response = await fetch(base + '/' + path, {
    method, headers: { origin, ...(data ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Cookie: session } : {}) },
    body: data && JSON.stringify(data),
  });
  return { status: response.status, cookie: response.headers.get('set-cookie'), data: await response.json() };
}

test('remise strictement au-delà de 20 € et calcul en centimes', () => {
  assert.equal(totals([{ price: 2000, quantity: 1 }]).shipping, 549);
  assert.deepEqual(totals([{ price: 2001, quantity: 1 }], 'pickup', 500), {
    subtotal: 2001, shipping: 359, shippingDiscount: 120, discount: 500, total: 1860,
  });
});

test('sélections saisonnières selon la date française', () => {
  assert.deepEqual(activeEvents(new Date('2026-10-31T20:00:00Z')).map(e => e.id), ['halloween']);
  assert.deepEqual(activeEvents(new Date('2026-11-23T14:00:00Z')).map(e => e.id), ['black-friday', 'noel']);
  assert.deepEqual(activeEvents(new Date('2026-07-02T14:00:00Z')).map(e => e.id), ['ete']);
});

test('parcours catalogue, compte, isolation, commande, fidélité et avis', async () => {
  const list = await request('catalog?category=Tech&max=3500&days=2&sale=1');
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.products.map(product => product.id), ['q20i', 'm185']);
  assert.equal((await request('cart')).status, 401);
  const data = { name: 'Compte Test', email: 'demo@example.test', password: 'demonstration-fictive' };
  assert.equal((await request('auth?action=register', { method: 'POST', data, origin: 'https://elsewhere.example' })).status, 403);
  const registration = await request('auth?action=register', { method: 'POST', data });
  assert.equal(registration.status, 200);
  assert.match(registration.cookie, /HttpOnly; SameSite=Lax/);
  const session = registration.cookie.split(';')[0];
  const reviewer = { id: 'q20i', rating: 5, comment: 'Un avis de démonstration.' };
  assert.equal((await request('catalog?action=review', { method: 'POST', session, data: reviewer })).status, 403);
  assert.equal((await request('cart', { method: 'PUT', session, data: { id: 'q20i', quantity: 3 } })).data.lines[0].quantity, 3);
  const second = await request('auth?action=register', { method: 'POST', data: { ...data, email: 'second@example.test' } });
  const secondSession = second.cookie.split(';')[0];
  assert.deepEqual((await request('cart', { session: secondSession })).data.lines, []);
  const order = { terms: TERMS_VERSION, useCredit: false, delivery: { method: 'pickup', point: 'paris' } };
  assert.equal((await request('orders?action=checkout', { method: 'POST', session, data: { ...order, terms: 'old' } })).status, 400);
  const paid = await request('orders?action=checkout', { method: 'POST', session, data: order });
  assert.deepEqual(paid.data, { url: '/compte?payment=demo' });
  const { user } = (await request('auth', { session })).data;
  assert.equal(user.spent, 10497);
  assert.equal(user.credit, 500);
  const { orders: [record] } = (await request('orders', { session })).data;
  assert.equal(record.state, 'paid');
  assert.equal(record.amounts.total, 10856);
  assert.equal((await request('catalog?action=review', { method: 'POST', session, data: reviewer })).status, 200);
  const detail = await request('catalog?action=product&id=q20i');
  assert.equal(detail.data.reviews[0].name, 'Compte');
  assert.equal(detail.data.product.rating, 5);
  assert.equal(detail.data.product.stock, 21);
  assert.equal((await request('orders?action=checkout', { method: 'POST', session, data: order })).status, 400);
  await request('cart', { method: 'PUT', session, data: { id: 'm185', quantity: 1 } });
  await request('orders?action=checkout', { method: 'POST', session, data: { ...order, useCredit: true } });
  const afterReward = (await request('auth', { session })).data.user;
  assert.equal(afterReward.spent, 11196);
  assert.equal(afterReward.credit, 0);
  await request('auth?action=logout', { method: 'POST', session });
  assert.equal((await request('cart', { session })).status, 401);
  assert.equal((await request('auth?action=login', { method: 'POST', data })).status, 200);
});
