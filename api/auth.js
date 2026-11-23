import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { account, body, cookie, fail, hash, service, throttle, token } from '../server/http.js';
import { database, transaction } from '../server/db.js';

const derive = promisify(scrypt);
const credentials = z.object({ email: z.email().max(254).trim().toLowerCase(), password: z.string().min(12).max(128) });
const signUp = credentials.extend({ name: z.string().trim().min(2).max(50) });
const lifespan = 60 * 60 * 24 * 7;

async function openSession(req, res, userId) {
  const secret = randomBytes(32).toString('hex');
  await transaction(async db => {
    const old = token(req);
    if (old && /^[\da-f]{64}$/.test(old)) await db.query('DELETE FROM sessions WHERE hash=$1', [hash(old)]);
    await db.query('DELETE FROM sessions WHERE expires <= now()');
    await db.query('INSERT INTO sessions(hash,user_id,expires) VALUES ($1,$2,$3)', [hash(secret), userId, new Date(Date.now() + lifespan * 1000)]);
  });
  cookie(res, secret, lifespan);
  return { ok: true };
}

export default service({
  'GET index': async req => ({ user: await account(req, false) }),
  'POST register': async (req, res) => {
    await throttle(req, 'register', 10);
    const { name, email, password } = signUp.parse(await body(req));
    const salt = randomBytes(16).toString('hex');
    const digest = await derive(password, salt, 64);
    const id = randomUUID();
    const { rowCount } = await database().query(
      'INSERT INTO users(id,email,name,password) VALUES ($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING',
      [id, email, name, salt + ':' + digest.toString('hex')]
    );
    if (!rowCount) fail(409, 'Impossible de créer ce compte. Essaie de te connecter.');
    return openSession(req, res, id);
  },
  'POST login': async (req, res) => {
    await throttle(req, 'login', 20);
    const { email, password } = credentials.parse(await body(req));
    await throttle(req, 'login-email', 8, email);
    const { rows: [user] } = await database().query('SELECT id,password FROM users WHERE email=$1', [email]);
    const [salt, digest] = user?.password.split(':') ?? ['0'.repeat(32), '0'.repeat(128)];
    const candidate = await derive(password, salt, 64);
    if (!timingSafeEqual(candidate, Buffer.from(digest, 'hex')) || !user) fail(401, 'Adresse e-mail ou mot de passe incorrect.');
    return openSession(req, res, user.id);
  },
  'POST logout': async (req, res) => {
    const session = token(req);
    if (session && /^[\da-f]{64}$/.test(session)) await database().query('DELETE FROM sessions WHERE hash=$1', [hash(session)]);
    cookie(res, '', 0);
    return { ok: true };
  },
});
