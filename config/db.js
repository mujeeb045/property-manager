// config/db.js  (Updated version)
const { Pool } = require('pg');
require('dotenv').config();

console.log("🔍 DEBUG: DATABASE_URL =", process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') 
  : "❌ Not found in .env");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  try {
    console.log("🔄 Connecting to PostgreSQL...");

    await pool.query('SELECT NOW()');
    console.log("✅ Database connection successful!");

    // 1. Units
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

    // 2. Tenants
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

    // 3. TRANSACTIONS TABLE (The only active transaction table now)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        tran_id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        transaction_date DATE DEFAULT CURRENT_DATE,
        tran_type TEXT NOT NULL,           -- 'Bill', 'Extra', 'Payment'
        particular TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        tran_mode TEXT DEFAULT 'Cash',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Core tables (units, tenants, transactions) initialized successfully!");

    // Data Integrity
    await pool.query(`
      UPDATE units
      SET is_occupied = FALSE
      WHERE id NOT IN (
        SELECT DISTINCT unit_id
        FROM tenants
        WHERE unit_id IS NOT NULL AND is_active = TRUE
      );
    `);

  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    throw err;
  }
}

initDatabase().catch(err => {
  console.error("💥 Critical DB error:", err.message);
});

module.exports = pool;