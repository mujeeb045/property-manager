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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      rent_paid BOOLEAN DEFAULT false
    );
  `);
}
initDatabase().catch(err => console.error("Database setup failed:", err));

// 1. Home Page (Dashboard + Form)
app.get('/', (req, res) => {
  res.send(`
    <h1 style="font-family: sans-serif;">Property Management Dashboard</h1>
    
    <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; max-width: 400px; margin-bottom: 20px;">
      <h3>➕ Add New Tenant</h3>
      <form action="/add-tenant" method="POST">
        <label>Tenant Name:</label><br>
        <input type="text" name="tenantName" required style="width: 100%; padding: 8px; margin: 5px 0 15px 0;"><br>
        
        <label>Unit Number:</label><br>
        <input type="text" name="unitNumber" placeholder="e.g. Apt 104" required style="width: 100%; padding: 8px; margin: 5px 0 15px 0;"><br>
        
        <button type="submit" style="padding: 10px 15px; background: blue; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Tenant</button>
      </form>
    </div>

    <a href="/tenants" style="display: inline-block; padding: 12px; background: green; color: white; text-decoration: none; border-radius: 5px; font-family: sans-serif;">📂 View All Live Tenants</a>
  `);
});

// 2. Action Route: Create Tenant
app.post('/add-tenant', async (req, res) => {
  try {
    const { tenantName, unitNumber } = req.body;
    await pool.query(
      'INSERT INTO tenants (name, unit, rent_paid) VALUES ($1, $2, $3)',
      [tenantName, unitNumber, false]
    );
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving tenant.");
  }
});

// 3. New Action Route: Toggles Rent Status to Paid
app.post('/toggle-rent/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;

    // Run an SQL command to flip rent_paid to true for this specific tenant ID
    await pool.query(
      'UPDATE tenants SET rent_paid = true WHERE id = $1',
      [tenantId]
    );

    // Redirect straight back to the list to see the update live!
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating rent status.");
  }
});

// 4. Tenants Page (with dynamic buttons)
app.get('/tenants', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants ORDER BY id DESC');
    const tenantsFromDb = result.rows;

    let tenantRows = '';
    tenantsFromDb.forEach(tenant => {
      // If rent is not paid, show a button. If it is paid, show text.
      const rentButtonOrStatus = tenant.rent_paid 
        ? `<span style="color: green; font-weight: bold;">🟩 Paid</span>` 
        : `
          <form action="/toggle-rent/${tenant.id}" method="POST" style="display:inline; margin-left: 10px;">
            <button type="submit" style="background: #e67e22; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
              Mark as Paid
            </button>
          </form>
        `;

      tenantRows += `
        <li style="padding: 15px; border-bottom: 1px solid #ddd; font-family: sans-serif; list-style: none; display: flex; justify-content: space-between; max-width: 500px;">
          <div>
            <strong>👤 ${tenant.name}</strong> — 🏠 ${tenant.unit}
          </div>
          <div>
            ${rentButtonOrStatus}
          </div>
        </li>
      `;
    });

    res.send(`
      <h1 style="font-family: sans-serif;">Active Tenants List</h1>
      <ul style="padding: 0;">${tenantRows || '<li>No tenants found. Add one on the dashboard!</li>'}</ul>
      <br>
      <a href="/" style="font-family: sans-serif; color: blue; text-decoration: none;">← Back to Dashboard</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});