const { Pool } = require("pg");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

function databaseConnectionString() {
  const raw = String(process.env.DATABASE_URL || "");
  if (!raw) return raw;

  // pg v8 warns when legacy sslmode values are present in the URL.
  // Render already provides the TLS connection; keep TLS explicit below
  // and remove URL-only sslmode flags to avoid ambiguous future semantics.
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return raw;
  }
}

const pool = new Pool({
  connectionString: databaseConnectionString(),
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function initDb() {
  // Allow provider prices and quantity totals to retain high precision; final customer prices are rounded up to the product precision.
  for (const sql of [
    "ALTER TABLE customers ALTER COLUMN balance TYPE NUMERIC(24,12)",
    "ALTER TABLE orders ALTER COLUMN api_price TYPE NUMERIC(24,12)",
    "ALTER TABLE orders ALTER COLUMN price TYPE NUMERIC(24,12)",
    "ALTER TABLE orders ALTER COLUMN profit TYPE NUMERIC(24,12)",
    "ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(24,12)",
    "ALTER TABLE transactions ALTER COLUMN balance_before TYPE NUMERIC(24,12)",
    "ALTER TABLE transactions ALTER COLUMN balance_after TYPE NUMERIC(24,12)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_params JSONB NOT NULL DEFAULT '{}'::jsonb"
  ]) {
    try { await query(sql); } catch (error) { console.warn("Money precision migration:", error.message); }
  }

  await query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      customer_number BIGSERIAL UNIQUE,
      name TEXT NOT NULL DEFAULT 'عميل',
      email TEXT,
      password_hash TEXT,
      phone TEXT,
      phone_country TEXT,
      avatar_url TEXT,
      balance NUMERIC(24,12) NOT NULL DEFAULT 0,
      orders_count INTEGER NOT NULL DEFAULT 0,
      discount NUMERIC(5,2) NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number BIGINT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
    CREATE SEQUENCE IF NOT EXISTS customer_number_seq;
    ALTER SEQUENCE customer_number_seq OWNED BY NONE;
    ALTER TABLE customers ALTER COLUMN customer_number SET DEFAULT nextval('customer_number_seq');
    UPDATE customers SET customer_number=nextval('customer_number_seq') WHERE customer_number IS NULL;
    SELECT setval('customer_number_seq', GREATEST(COALESCE((SELECT MAX(customer_number) FROM customers),0),1), true);

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_country TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique
      ON customers(LOWER(email)) WHERE email IS NOT NULL;

    CREATE TABLE IF NOT EXISTS customer_sessions (
      token TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
      ON customer_sessions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires
      ON customer_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL DEFAULT '',
      api_price NUMERIC(24,12) NOT NULL DEFAULT 0,
      price NUMERIC(24,12) NOT NULL DEFAULT 0,
      profit NUMERIC(24,12) NOT NULL DEFAULT 0,
      discount NUMERIC(5,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      amount NUMERIC(24,12) NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_before NUMERIC(24,12) NOT NULL DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC(24,12) NOT NULL DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note TEXT;
    CREATE INDEX IF NOT EXISTS idx_transactions_customer_created
      ON transactions(customer_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      target TEXT NOT NULL DEFAULT 'all',
      customer_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS game_images (
      game_key TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      image_data BYTEA NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/png',
      source_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getSetting(key, fallback) {
  const r = await query("SELECT value FROM admin_settings WHERE key=$1", [key]);
  return r.rows[0]?.value ?? fallback;
}

async function setSetting(key, value) {
  await query(`INSERT INTO admin_settings(key,value) VALUES($1,$2)
    ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`, [key, String(value)]);
}

const crypto = require("crypto");

function sessionHash(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

async function createSession(token, expiresAt) {
  await query("INSERT INTO admin_sessions(token,expires_at) VALUES($1,$2)", [sessionHash(token), expiresAt]);
}

async function getSession(token) {
  const r = await query(
    "SELECT token,created_at,expires_at FROM admin_sessions WHERE token=$1 AND expires_at>NOW()",
    [sessionHash(token)]
  );
  return r.rows[0] || null;
}

async function deleteSession(token) {
  await query("DELETE FROM admin_sessions WHERE token=$1", [sessionHash(token)]);
}

async function createCustomerSession(token, customerId, expiresAt) {
  await query(
    "INSERT INTO customer_sessions(token,customer_id,expires_at) VALUES($1,$2,$3)",
    [sessionHash(token), customerId, expiresAt]
  );
}

async function getCustomerSession(token) {
  const r = await query(
    "SELECT token,customer_id,created_at,expires_at FROM customer_sessions WHERE token=$1 AND expires_at>NOW()",
    [sessionHash(token)]
  );
  return r.rows[0] || null;
}

async function deleteCustomerSession(token) {
  await query("DELETE FROM customer_sessions WHERE token=$1", [sessionHash(token)]);
}

async function cleanupSessions() {
  await query("DELETE FROM admin_sessions WHERE expires_at<=NOW()");
  await query("DELETE FROM customer_sessions WHERE expires_at<=NOW()");
}

module.exports = {
  query,
  withTransaction,
  initDb,
  getSetting,
  setSetting,
  createSession,
  getSession,
  deleteSession,
  createCustomerSession,
  getCustomerSession,
  deleteCustomerSession,
  cleanupSessions
};
