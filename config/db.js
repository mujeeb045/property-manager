const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  // Wipes legacy test table data layouts
  await pool.query(`DROP TABLE IF EXISTS payment_logs CASCADE;`);
  await pool.query(`DROP TABLE IF EXISTS invoice_extra_items CASCADE;`);
  await pool.query(`DROP TABLE IF EXISTS invoices CASCADE;`);
  await pool.query(`DROP TABLE IF EXISTS tenants CASCADE;`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER UNIQUE REFERENCES units(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      father_name TEXT,
      phone TEXT,
      alt_phone TEXT,
      id_card_no TEXT,
      security_deposit NUMERIC DEFAULT 0
    );
  `);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_extra_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      item_desc TEXT NOT NULL,
      item_amount NUMERIC NOT NULL,
      item_billing_month TEXT DEFAULT ''
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_logs (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      amount_paid NUMERIC NOT NULL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

initDatabase().catch(err => console.error("Database initialization failed:", err));

module.exports = pool;