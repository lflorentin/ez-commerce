import { database } from '../server/db.js';
import { seed } from './seed.js';

const db = database();
try {
  await seed(db);
  console.log('Schéma et catalogue installés.');
} finally {
  await db.end();
}
