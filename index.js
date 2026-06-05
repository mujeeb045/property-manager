require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  // 1. Create table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      rent_paid BOOLEAN DEFAULT false
    );
  `);

  // 2. Add the 'rent_amount' column if it's not already in the table
  await pool.query(`
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rent_amount NUMERIC DEFAULT 0;
  `);
}
initDatabase().catch(err => console.error("Database setup failed:", err));

// 1. Home Page (Dashboard + Form with Price input)
app.get('/', (req, res) => {
  res.send(`
    <h1 style="font-family: sans-serif;">Property Management Dashboard</h1>
    
    <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; max-width: 400px; margin-bottom: 20px;">
      <h3>➕ Add New Tenant</h3>
      <form action="/add-tenant" method="POST">
        <label style="font-family: sans-serif;">Tenant Name:</label><br>
        <input type="text" name="tenantName" required style="width: 100%; padding: 8px; margin: 5px 0 15px 0;"><br>
        
        <label style="font-family: sans-serif;">Unit Number:</label><br>
        <input type="text" name="unitNumber" placeholder="e.g. Apt 104" required style="width: 100%; padding: 8px; margin: 5px 0 15px 0;"><br>
        
        <label style="font-family: sans-serif;">Monthly Rent Amount ($):</label><br>
        <input type="number" name="rentAmount" placeholder="e.g. 1200" required style="width: 100%; padding: 8px; margin: 5px 0 15px 0;"><br>
        
        <button type="submit" style="padding: 10px 15px; background: blue; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: sans-serif;">Save Tenant</button>
      </form>
    </div>

    <a href="/tenants" style="display: inline-block; padding: 12px; background: green; color: white; text-decoration: none; border-radius: 5px; font-family: sans-serif;">📂 View Financial Overview & Tenants</a>
  `);
});

// 2. Action Route: Create Tenant with Rent Amount
app.post('/add-tenant', async (req, res) => {
  try {
    const { tenantName, unitNumber, rentAmount } = req.body;
    await pool.query(
      'INSERT INTO tenants (name, unit, rent_amount, rent_paid) VALUES ($1, $2, $3, $4)',
      [tenantName, unitNumber, rentAmount, false]
    );
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving tenant.");
  }
});

// 3. Action Route: Mark as Paid
app.post('/toggle-rent/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;
    await pool.query('UPDATE tenants SET rent_paid = true WHERE id = $1', [tenantId]);
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating rent status.");
  }
});

// 4. Action Route: Delete Tenant
app.post('/delete-tenant/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting tenant.");
  }
});

// 5. Tenants Page (Calculates Financial Stats + Displays Tenants)
app.get('/tenants', async (req, res) => {
  try {
    // RUN FINANCIAL CALCULATIONS DIRECTLY IN POSTGRES USING SUM
    const paidSumResult = await pool.query("SELECT SUM(rent_amount) FROM tenants WHERE rent_paid = true");
    const unpaidSumResult = await pool.query("SELECT SUM(rent_amount) FROM tenants WHERE rent_paid = false");

    // Convert string null results from database to 0 if empty
    const totalCollected = Number(paidSumResult.rows[0].sum || 0);
    const totalOutstanding = Number(unpaidSumResult.rows[0].sum || 0);

    const result = await pool.query('SELECT * FROM tenants ORDER BY id DESC');
    const tenantsFromDb = result.rows;

    let tenantRows = '';
    tenantsFromDb.forEach(tenant => {
      const rentButtonOrStatus = tenant.rent_paid 
        ? `<span style="color: green; font-weight: bold; margin-right: 15px;">🟩 Paid</span>` 
        : `
          <form action="/toggle-rent/${tenant.id}" method="POST" style="display:inline; margin-right: 15px;">
            <button type="submit" style="background: #e67e22; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
              Mark as Paid
            </button>
          </form>
        `;

      const deleteButton = `
        <form action="/delete-tenant/${tenant.id}" method="POST" style="display:inline;" onsubmit="return confirm('Are you sure this tenant moved out?');">
          <button type="submit" style="background: #c0392b; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
            🗑️ Delete
          </button>
        </form>
      `;

      tenantRows += `
        <li style="padding: 15px; border-bottom: 1px solid #ddd; font-family: sans-serif; list-style: none; display: flex; justify-content: space-between; max-width: 650px; align-items: center;">
          <div>
            <strong>👤 ${tenant.name}</strong> — 🏠 ${tenant.unit} <br>
            <span style="color: #555; font-size: 0.9em;">Rent: $${tenant.rent_amount} / month</span>
          </div>
          <div style="display: flex; align-items: center;">
            ${rentButtonOrStatus}
            ${deleteButton}
          </div>
        </li>
      `;
    });

    res.send(`
      <h1 style="font-family: sans-serif;">Financial Overview & Tenants</h1>
      
      <div style="display: flex; gap: 20px; font-family: sans-serif; margin-bottom: 30px;">
        <div style="background: #d4edda; color: #155724; padding: 20px; border-radius: 6px; min-width: 180px; border-left: 5px solid green;">
          <small>TOTAL COLLECTED</small>
          <h2>$${totalCollected.toLocaleString()}</h2>
        </div>
        <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 6px; min-width: 180px; border-left: 5px solid red;">
          <small>OUTSTANDING BALANCE</small>
          <h2>$${totalOutstanding.toLocaleString()}</h2>
        </div>
      </div>

      <h3 style="font-family: sans-serif; border-bottom: 2px solid #333; padding-bottom: 5px; max-width: 650px;">Active Tenants</h3>
      <ul style="padding: 0;">${tenantRows || '<li>No tenants found. Add one on the dashboard!</li>'}</ul>
      <br>
      <a href="/" style="font-family: sans-serif; color: blue; text-decoration: none;">← Back to Dashboard</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading finance engine.");
  }
});

app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});