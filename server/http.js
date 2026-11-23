import { createHash } from 'node:crypto';
import { database } from './db.js';

export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const hash = value => createHash('sha256').update(value).digest('hex');
export const cookieName = process.env.VERCEL ? '__Host-ez_session' : 'ez_session';

export function cookie(res, value, maxAge) {
  const secure = process.env.VERCEL || process.env.PUBLIC_ORIGIN?.startsWith('https:');
  res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
export function token(req) {
  return (req.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
}
export async function account(req, required = true) {
  const session = token(req);
  if (session && /^[a-f0-9]{64}$/.test(session)) {
    const { rows } = await database().query(
      'SELECT u.id,u.email,u.name,u.spent,u.credit FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=$1 AND s.expires>now()', [hash(session)]
    );
    if (rows[0]) return rows[0];
  }
  if (required) fail(401, 'Connecte-toi pour continuer.');
  return null;
}
export async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) fail(415, 'Format JSON attendu.');
  if (req.body !== undefined) {
    if (Buffer.byteLength(JSON.stringify(req.body)) > 16000) fail(413, 'Requête trop volumineuse.');
    if (typeof req.body !== 'string') return req.body;
    try { return JSON.parse(req.body); } catch { fail(400, 'Requête JSON invalide.'); }
  }
  const raw = await rawBody(req, 16000);
  try { return JSON.parse(raw.toString()); } catch { fail(400, 'Requête JSON invalide.'); }
}
export async function rawBody(req, limit = 128000) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) fail(413, 'Requête trop volumineuse.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function throttle(req, action, limit, userId) {
  const ip = process.env.VERCEL ? req.headers['x-vercel-forwarded-for']?.split(',')[0] : req.socket.remoteAddress;
  const bucket = Math.floor(Date.now() / 900000);
  const db = database();
  await db.query('DELETE FROM rate_limits WHERE bucket < $1', [bucket - 1]);
  const { rows } = await db.query(
    'INSERT INTO rate_limits(key,bucket,count) VALUES ($1,$2,1) ON CONFLICT(key,bucket) DO UPDATE SET count=rate_limits.count+1 RETURNING count',
    [hash(`${action}:${userId ?? ip ?? 'unknown'}`), bucket]
  );
  if (rows[0].count > limit) fail(429, 'Trop de tentatives. Réessaie dans quelques minutes.');
}
export function origin(req) {
  if (process.env.PUBLIC_ORIGIN) return new URL(process.env.PUBLIC_ORIGIN).origin;
  if (process.env.VERCEL_URL) {
    const candidates = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean);
    return 'https://' + (candidates.includes(req.headers.host) ? req.headers.host : candidates[0]);
  }
  return 'http://' + req.headers.host;
}
export function service(routes) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(req.url, 'http://localhost');
      const action = url.searchParams.get('action') ?? 'index';
      const route = routes[`${req.method} ${action}`];
      if (!route) fail(404, 'Route inconnue.');
      if (req.method !== 'GET' && action !== 'webhook' && req.headers.origin !== origin(req)) fail(403, 'Origine de la requête refusée.');
      const result = await route(req, res, url);
      res.end(JSON.stringify(result));
    } catch (error) {
      const status = error.status ?? (error.name === 'ZodError' ? 400 : 500);
      if (status === 500) console.error('Erreur API', error.code ?? error.name);
      res.statusCode = status;
      res.end(JSON.stringify({ error: status === 500 ? 'Une erreur est survenue.' : error.name === 'ZodError' ? 'Vérifie les champs du formulaire.' : error.message }));
    }
  };
}
