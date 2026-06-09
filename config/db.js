const { Pool } = require('pg');
require('dotenv').config();

console.log("🔍 DEBUG: DATABASE_URL =", process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') 
  : "❌ Not found in .env");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Enhanced Database Initialization
async function initDatabase() {
  try {
    console.log("🔄 Connecting to PostgreSQL...");

    // Test connection
    await pool.query('SELECT NOW()');
    console.log("✅ Database connection successful!");

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

    console.log("✅ All database tables initialized successfully!");

    // Data Integrity Check
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
    console.error("❌ Database initialization failed:");
    console.error("   Error:", err.message);
    
    if (err.code === '3D000') {
      console.error("💡 Hint: Database 'property_manager' does not exist.");
      console.error("   Please create it using: CREATE DATABASE property_manager;");
    } else if (err.code === '28P01' || err.message.includes('password')) {
      console.error("💡 Hint: Check your DATABASE_URL password in .env file");
    } else if (err.code === 'ECONNREFUSED') {
      console.error("💡 Hint: PostgreSQL server is not running.");
    }
    
    console.error("\nFull error for debugging:", err);
    throw err; // Re-throw so server knows something went wrong
  }
}

// Run initialization
initDatabase().catch(err => {
  console.error("\n💥 Critical: Could not initialize database. Server may still start but features will fail.");
});

module.exports = pool;