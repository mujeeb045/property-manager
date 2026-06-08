const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {

  // 1. Permanent Portions / Units Asset Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      unit_name TEXT UNIQUE NOT NULL,
      unit_area NUMERIC DEFAULT 0,
      rent_amount NUMERIC DEFAULT 0,
      maintenance_amount NUMERIC DEFAULT 0,
      is_occupied BOOLEAN DEFAULT FALSE
    );
  `);

  // 2. Permanent Tenant Profiles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER UNIQUE REFERENCES units(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      father_name TEXT,
      phone TEXT,
      alt_phone TEXT,
      id_card_no TEXT,
      security_deposit NUMERIC DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      move_in_date DATE DEFAULT CURRENT_DATE,
      move_out_date DATE
    );
  `);

  // Backward-Compatible Tenant Upgrades
  await pool.query(`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);

  await pool.query(`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS move_in_date DATE DEFAULT CURRENT_DATE;
  `);

  await pool.query(`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS move_out_date DATE;
  `);

  // 3. Monthly Invoice Records
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      billing_month TEXT NOT NULL,
      rent_charged NUMERIC DEFAULT 0,
      maintenance_charged NUMERIC DEFAULT 0,
      amount_paid NUMERIC DEFAULT 0,
      arrears_brought_forward NUMERIC DEFAULT 0,
      UNIQUE(tenant_id, billing_month)
    );
  `);

  // 4. Itemized Maintenance Items
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_extra_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      item_desc TEXT NOT NULL,
      item_amount NUMERIC NOT NULL,
      item_billing_month TEXT DEFAULT ''
    );
  `);

  // 5. Payment Logs + Receipt Tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_logs (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      amount_paid NUMERIC NOT NULL,
      receipt_no TEXT,
      payment_mode TEXT DEFAULT 'Cash',
      reference_no TEXT DEFAULT '',
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Upgrade older deployments automatically
  await pool.query(`
    ALTER TABLE payment_logs
    ADD COLUMN IF NOT EXISTS receipt_no TEXT;
  `);

  await pool.query(`
    ALTER TABLE payment_logs
    ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';
  `);

  await pool.query(`
    ALTER TABLE payment_logs
    ADD COLUMN IF NOT EXISTS reference_no TEXT DEFAULT '';
  `);

  // Data Integrity Check
  await pool.query(`
    UPDATE units
    SET is_occupied = FALSE
    WHERE id NOT IN (
      SELECT DISTINCT unit_id
      FROM tenants
      WHERE unit_id IS NOT NULL
      AND is_active = TRUE
    );
  `);

}

initDatabase().catch(err =>
  console.error("Database asset registry failed to sync:", err)
);

module.exports = pool;