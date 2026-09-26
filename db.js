const { Pool } = require("pg");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDb() {
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
      balance NUMERIC(18,4) NOT NULL DEFAULT 0,
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
      api_price NUMERIC(18,4) NOT NULL DEFAULT 0,
      price NUMERIC(18,4) NOT NULL DEFAULT 0,
      profit NUMERIC(18,4) NOT NULL DEFAULT 0,
      discount NUMERIC(5,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      amount NUMERIC(18,4) NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      target TEXT NOT NULL DEFAULT 'all',
      customer_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
