import { readFile } from 'node:fs/promises';

export async function seed(db) {
  await db.query("SELECT 1");
  const schema = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
  const catalog = JSON.parse(await readFile(new URL('../shared/catalog.json', import.meta.url), 'utf8'));
  if (db.exec) await db.exec(schema);
  else await db.query(schema);
  for (const { stock, ...product } of catalog) {
    await db.query('INSERT INTO products(id,detail,stock) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING', [product.id, product, stock]);
  }
}
