import pg from 'pg';
import { seed } from './seed.js';

const migrationUrl = process.env.DATABASE_MIGRATION_URL;
const isBuild = process.argv.includes('--if-configured');
if (isBuild && !migrationUrl && !(process.env.DEMO_PAYMENT === 'true' && process.env.DATABASE_URL)) {
  console.log('Migration ignorée : aucune base de test à initialiser au build.');
} else {
  const connectionString = migrationUrl ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Définis DATABASE_MIGRATION_URL ou DATABASE_URL.');
  const db = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  try {
    await seed(db);
    console.log('Schéma et catalogue installés.');
  } finally {
    await db.end();
  }
}
