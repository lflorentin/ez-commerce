// Integration tests own an isolated in-memory database and a loopback origin.
for (const name of [
  'VERCEL', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'PUBLIC_ORIGIN',
  'DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
]) {
  delete process.env[name];
}
