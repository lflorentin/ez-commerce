import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import Stripe from 'stripe';
import { totals, pickupPoints, TERMS_VERSION, shippingMethods } from '../shared/rules.js';
import { database, transaction } from '../server/db.js';
import { account, body, fail, origin, rawBody, service, throttle } from '../server/http.js';
import { cartLines } from './cart.js';

export const config = { api: { bodyParser: false } };
const home = z.object({
  method: z.literal('home'), street: z.string().trim().min(5).max(150),
  postal: z.string().regex(/^(0[1-9]|[1-8]\d|9[0-5])\d{3}$/),
  city: z.string().trim().min(2).max(80),
});
const pickup = z.object({ method: z.literal('pickup'), point: z.enum(pickupPoints.map(item => item.id)) });
const schema = z.object({
  terms: z.literal(TERMS_VERSION), useCredit: z.boolean(),
  delivery: z.discriminatedUnion('method', [home, pickup]),
});
const stripeClient = () => process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') && process.env.STRIPE_WEBHOOK_SECRET
  ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

async function lockUser(db, id) {
  const { rows: [user] } = await db.query('SELECT id,spent,credit FROM users WHERE id=$1 FOR UPDATE', [id]);
  return user;
}

async function finalize(id, mode, session, paid) {
  const { rows: [found] } = await database().query('SELECT user_id FROM orders WHERE id=$1', [id]);
  if (!found) fail(404, 'Commande introuvable.');
  return transaction(async db => {
    const user = await lockUser(db, found.user_id);
    const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id]);
    if (order.payment_mode !== mode) fail(409, 'Mode de paiement incohérent.');
    if (mode === 'stripe' && (
      (order.stripe_session && order.stripe_session !== session.id) ||
      session.currency !== 'eur' || session.amount_total !== order.amounts.total ||
      (paid && session.payment_status !== 'paid')
    )) fail(409, 'Confirmation Stripe incohérente.');
    if (order.state !== 'pending') return order.state;
    if (paid) {
      const spent = user.spent + order.amounts.subtotal - order.amounts.discount;
      const earned = (Math.floor(spent / 10000) - Math.floor(user.spent / 10000)) * 500;
      await db.query('UPDATE users SET spent=$2,credit=credit-$3+$4 WHERE id=$1', [user.id, spent, order.amounts.discount, earned]);
      await db.query('DELETE FROM cart WHERE user_id=$1', [user.id]);
    } else {
      for (const line of order.lines) await db.query('UPDATE products SET stock=stock+$2 WHERE id=$1', [line.id, line.quantity]);
    }
    const state = paid ? 'paid' : 'expired';
    await db.query('UPDATE orders SET state=$2,stripe_session=COALESCE(stripe_session,$3) WHERE id=$1', [id, state, session?.id ?? null]);
    return state;
  });
}

async function createOrder(user, details, mode) {
  return transaction(async db => {
    const locked = await lockUser(db, user.id);
    const { rows: [pending] } = await db.query("SELECT * FROM orders WHERE user_id=$1 AND state='pending'", [user.id]);
    if (pending) return pending;
    const lines = await cartLines(db, user.id);
    if (!lines.length) fail(400, 'Ton panier est vide.');
    for (const line of lines) {
      const { rowCount } = await db.query('UPDATE products SET stock=stock-$2 WHERE id=$1 AND stock >= $2', [line.id, line.quantity]);
      if (!rowCount) fail(409, `${line.name} est momentanément indisponible.`);
    }
    const delivery = details.delivery.method === 'pickup'
      ? { ...details.delivery, address: pickupPoints.find(item => item.id === details.delivery.point).address }
      : { ...details.delivery, address: `${details.delivery.street}, ${details.delivery.postal} ${details.delivery.city}` };
    delivery.days = Math.max(...lines.map(line => line.days)) + shippingMethods[delivery.method].extraDays;
    const amounts = totals(lines, delivery.method, details.useCredit ? locked.credit : 0);
    const id = randomUUID();
    const { rows: [order] } = await db.query(`INSERT INTO orders(id,user_id,state,payment_mode,lines,delivery,amounts,terms)
      VALUES($1,$2,'pending',$3,$4,$5,$6,$7) RETURNING *`,
    [id, user.id, mode, JSON.stringify(lines), delivery, amounts, details.terms]);
    return order;
  });
}

async function stripeSession(stripe, order, req) {
  if (order.stripe_session) return stripe.checkout.sessions.retrieve(order.stripe_session);
  const base = origin(req);
  if (Date.now() - new Date(order.created_at).getTime() > 22 * 3600000) {
    fail(409, 'Cette tentative nécessite une vérification du paiement avant de pouvoir être reprise.');
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', payment_method_types: ['card'],
    line_items: [{
      price_data: { currency: 'eur', unit_amount: order.amounts.total, product_data: { name: 'Commande ez-commerce • Démonstration' } }, quantity: 1,
    }],
    metadata: { order_id: order.id },
    success_url: base + '/compte?payment=success',
    cancel_url: base + '/panier?payment=cancel',
  }, { idempotencyKey: 'ez-order-' + order.id });
  await database().query('UPDATE orders SET stripe_session=$2 WHERE id=$1 AND stripe_session IS NULL', [order.id, session.id]);
  return session;
}

export default service({
  'GET index': async req => {
    const user = await account(req);
    const { rows } = await database().query(`SELECT id,created_at,state,payment_mode,lines,delivery,amounts FROM orders
      WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [user.id]);
    return { orders: rows };
  },
  'GET config': async () => ({ stripe: Boolean(stripeClient()), demo: process.env.DEMO_PAYMENT === 'true' }),
  'POST checkout': async req => {
    const user = await account(req);
    await throttle(req, 'checkout', 20, user.id);
    const details = schema.parse(await body(req));
    const stripe = stripeClient();
    if (!stripe && process.env.DEMO_PAYMENT !== 'true') fail(503, 'Le paiement de test doit être configuré.');
    const order = await createOrder(user, details, stripe ? 'stripe' : 'demo');
    if (order.payment_mode === 'demo') {
      if (process.env.DEMO_PAYMENT !== 'true') fail(503, 'La simulation est désactivée.');
      await finalize(order.id, 'demo', null, true);
      return { url: '/compte?payment=demo' };
    }
    if (!stripe) fail(503, 'Stripe est temporairement indisponible.');
    const session = await stripeSession(stripe, order, req);
    if (session.status === 'expired') {
      await finalize(order.id, 'stripe', session, false);
      fail(409, 'Le paiement précédent a expiré. Réessaie.');
    }
    if (session.payment_status === 'paid') {
      await finalize(order.id, 'stripe', session, true);
      return { url: '/compte?payment=success' };
    }
    return { url: session.url };
  },
  'POST cancel': async req => {
    const user = await account(req);
    await throttle(req, 'checkout', 20, user.id);
    const { rows: [order] } = await database().query("SELECT * FROM orders WHERE user_id=$1 AND state='pending'", [user.id]);
    if (!order) return { ok: true };
    const stripe = stripeClient();
    if (order.payment_mode === 'demo') {
      await finalize(order.id, 'demo', null, false);
    } else {
      if (!stripe) fail(503, 'Stripe est temporairement indisponible.');
      let session = await stripeSession(stripe, order, req);
      if (session.status === 'open') {
        try { session = await stripe.checkout.sessions.expire(session.id); }
        catch { session = await stripe.checkout.sessions.retrieve(session.id); }
      }
      if (session.payment_status === 'paid') await finalize(order.id, 'stripe', session, true);
      else if (session.status === 'expired') await finalize(order.id, 'stripe', session, false);
      else fail(409, 'Le paiement est encore en cours.');
    }
    return { ok: true };
  },
  'POST webhook': async req => {
    const stripe = stripeClient();
    if (!stripe) fail(503, 'Stripe est indisponible.');
    let event;
    try {
      event = stripe.webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch { fail(400, 'Signature Stripe invalide.'); }
    if (!['checkout.session.completed', 'checkout.session.expired'].includes(event.type)) return { received: true };
    const session = event.data.object;
    const id = session.metadata?.order_id;
    if (id && (event.type === 'checkout.session.expired' || session.payment_status === 'paid')) {
      await finalize(id, 'stripe', session, event.type === 'checkout.session.completed');
    }
    return { received: true };
  },
});
