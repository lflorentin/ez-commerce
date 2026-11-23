import pg from 'pg';

let pool;
let localDb;
let tail = Promise.resolve();

export function configureLocal(db) { localDb = db; }

export function database() {
  if (localDb) return localDb;
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('La base de données est indisponible.'), { status: 503 });
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 4000, idleTimeoutMillis: 8000 });
  return pool;
}

export async function transaction(work) {
  if (localDb) {
    const run = tail.then(() => localDb.transaction(work));
    tail = run.catch(() => {});
    return run;
  }
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
