import { z } from 'zod';
import seed from '../shared/catalog.json' with { type: 'json' };
import { activeEvents, events } from '../shared/rules.js';
import { database } from '../server/db.js';
import { account, body, fail, service, throttle } from '../server/http.js';

const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

async function products() {
  if (process.env.VERCEL && !process.env.DATABASE_URL) return seed;
  const { rows } = await database().query(`SELECT p.detail,p.stock,
      COALESCE(r.rating,0)::float AS rating,COALESCE(r.count,0)::integer AS "reviewCount"
    FROM products p LEFT JOIN (SELECT product_id,avg(rating) rating,count(*) count FROM reviews GROUP BY product_id) r
    ON r.product_id=p.id ORDER BY p.detail->>'name'`);
  const position = new Map(seed.map((item, index) => [item.id, index]));
  return rows.sort((a, b) => (position.get(a.detail.id) ?? 9999) - (position.get(b.detail.id) ?? 9999))
    .map(({ detail, stock, rating, reviewCount }) => ({ ...detail, stock, rating, reviewCount }));
}

export default service({
  'GET index': async (_req, _res, url) => {
    const params = url.searchParams;
    const query = normalize((params.get('q') ?? '').slice(0, 100));
    const category = params.get('category');
    const max = Number(params.get('max') || Infinity);
    const days = Number(params.get('days') || Infinity);
    const event = params.get('event');
    const list = (await products()).filter(item =>
      (!query || normalize(`${item.name} ${item.category} ${item.description}`).includes(query)) &&
      (!category || item.category === category) && item.price <= max && item.days <= days &&
      (!event || item.events.includes(event)) &&
      (!params.has('sale') || item.previous > item.price) && (!params.has('stock') || item.stock > 0)
    );
    if (params.get('sort') === 'price') list.sort((a, b) => a.price - b.price);
    if (params.get('sort') === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (params.get('sort') === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return { products: list, active: activeEvents(), events };
  },
  'GET product': async (req, _res, url) => {
    const id = url.searchParams.get('id');
    const product = (await products()).find(item => item.id === id);
    if (!product) fail(404, 'Article introuvable.');
    if (process.env.VERCEL && !process.env.DATABASE_URL) return { product, reviews: [], canReview: false };
    const user = await account(req, false);
    const { rows: reviews } = await database().query(`SELECT r.rating,r.comment,r.created_at,split_part(u.name,' ',1) AS name
      FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=$1 ORDER BY r.created_at DESC LIMIT 100`, [id]);
    const canReview = user && (await database().query(`SELECT 1 FROM orders WHERE user_id=$1 AND state='paid' AND lines @> $2::jsonb LIMIT 1`,
      [user.id, JSON.stringify([{ id }])])).rows.length > 0;
    return { product, reviews, canReview: Boolean(canReview) };
  },
  'POST review': async req => {
    const user = await account(req);
    await throttle(req, 'review', 20, user.id);
    const { id, rating, comment } = z.object({
      id: z.string().max(80), rating: z.number().int().min(1).max(5), comment: z.string().trim().min(10).max(1000),
    }).parse(await body(req));
    const db = database();
    const { rowCount } = await db.query(`INSERT INTO reviews(user_id,product_id,rating,comment)
      SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM orders WHERE user_id=$1 AND state='paid' AND lines @> $5::jsonb)
      ON CONFLICT(user_id,product_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,created_at=now()`,
      [user.id, id, rating, comment, JSON.stringify([{ id }])]);
    if (!rowCount) fail(403, 'Seul un achat confirmé permet de publier un avis.');
    return { ok: true };
  },
});
