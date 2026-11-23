import { z } from 'zod';
import { database, transaction } from '../server/db.js';
import { account, body, fail, service, throttle } from '../server/http.js';

export async function cartLines(db, userId) {
  const { rows } = await db.query(`SELECT p.detail,p.stock,c.quantity FROM cart c JOIN products p ON p.id=c.product_id
    WHERE c.user_id=$1 ORDER BY p.id`, [userId]);
  return rows.map(({ detail, stock, quantity }) => ({ ...detail, stock, quantity }));
}

export default service({
  'GET index': async req => ({ lines: await cartLines(database(), (await account(req)).id) }),
  'PUT index': async req => {
    const user = await account(req);
    await throttle(req, 'cart', 100, user.id);
    const { id, quantity, increment } = z.object({
      id: z.string().max(80), quantity: z.number().int().min(0).max(10), increment: z.boolean().optional(),
    }).parse(await body(req));
    return transaction(async db => {
      await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
      const { rows: [pending] } = await db.query("SELECT id FROM orders WHERE user_id=$1 AND state='pending'", [user.id]);
      if (pending) fail(409, 'Reprends ou annule le paiement en cours avant de modifier le panier.');
      const { rows: [product] } = await db.query('SELECT stock FROM products WHERE id=$1', [id]);
      if (!product) fail(404, 'Article introuvable.');
      const { rows: [line] } = await db.query('SELECT quantity FROM cart WHERE user_id=$1 AND product_id=$2', [user.id, id]);
      const next = increment ? (line?.quantity ?? 0) + quantity : quantity;
      if (next > Math.min(product.stock, 10)) fail(409, 'Quantité indisponible.');
      if (!next) await db.query('DELETE FROM cart WHERE user_id=$1 AND product_id=$2', [user.id, id]);
      else await db.query(`INSERT INTO cart(user_id,product_id,quantity) VALUES($1,$2,$3)
        ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity`, [user.id, id, next]);
      return { lines: await cartLines(db, user.id) };
    });
  },
});
