import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createServer as createVite } from 'vite';
import { configureLocal, database } from '../server/db.js';
import { seed } from './seed.js';
import auth from '../api/auth.js';
import cart from '../api/cart.js';
import catalog from '../api/catalog.js';
import orders from '../api/orders.js';

process.env.DEMO_PAYMENT ??= 'true';
if (!process.env.DATABASE_URL) {
  await mkdir('.data', { recursive: true });
  configureLocal(new PGlite('.data/postgres'));
}
await seed(database());
const routes = { auth, cart, catalog, orders };
const vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' });
createServer((req, res) => {
  const path = req.url.split('?')[0];
  const endpoint = routes[path.slice(5)];
  if (path.startsWith('/api/') && Object.hasOwn(routes, path.slice(5))) return endpoint(req, res);
  vite.middlewares(req, res);
}).listen(Number(process.env.PORT || 5173), process.env.BIND_ADDRESS || '127.0.0.1', () => {
  console.log('ez-commerce disponible sur le port ' + (process.env.PORT || 5173));
});
