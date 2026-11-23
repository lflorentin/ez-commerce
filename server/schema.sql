CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, password text NOT NULL,
  spent integer NOT NULL DEFAULT 0 CHECK(spent >= 0),
  credit integer NOT NULL DEFAULT 0 CHECK(credit >= 0)
);
CREATE TABLE IF NOT EXISTS sessions (
  hash text PRIMARY KEY, user_id uuid REFERENCES users ON DELETE CASCADE NOT NULL,
  expires timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS rate_limits (
  key text NOT NULL, bucket bigint NOT NULL, count integer NOT NULL, PRIMARY KEY(key,bucket)
);
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY, detail jsonb NOT NULL, stock integer NOT NULL CHECK(stock >= 0)
);
CREATE TABLE IF NOT EXISTS cart (
  user_id uuid REFERENCES users ON DELETE CASCADE NOT NULL,
  product_id text REFERENCES products NOT NULL,
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10),
  PRIMARY KEY(user_id,product_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY, user_id uuid REFERENCES users NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL CHECK(state IN ('pending','paid','expired')),
  payment_mode text NOT NULL CHECK(payment_mode IN ('stripe','demo')),
  stripe_session text UNIQUE,
  lines jsonb NOT NULL, delivery jsonb NOT NULL, amounts jsonb NOT NULL, terms text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_order ON orders(user_id) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS order_history ON orders(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reviews (
  user_id uuid REFERENCES users ON DELETE CASCADE NOT NULL, product_id text REFERENCES products NOT NULL,
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), comment text NOT NULL CHECK(length(comment) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,product_id)
);
CREATE INDEX IF NOT EXISTS review_product ON reviews(product_id, created_at DESC);
