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
      rent_paid BOOLEAN DEFAULT false,
      rent_amount NUMERIC DEFAULT 0
    );
  `);
}
initDatabase().catch(err => console.error("Database setup failed:", err));

// Global Header Style for HTML templates to keep fonts and layouts uniform
const HTML_HEAD = `
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px; display: flex; justify-content: center; }
      .container { width: 100%; max-width: 800px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05); }
      h1 { color: #0f172a; margin-top: 0; font-size: 28px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
      h3 { color: #334155; margin-top: 0; margin-bottom: 20px; font-size: 18px; }
      label { font-weight: 600; font-size: 14px; color: #475569; display: block; margin-bottom: 6px; }
      input { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; margin-bottom: 16px; font-size: 15px; transition: border 0.2s; }
      input:focus { outline: none; border-color: #2563eb; }
      .form-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; margin-bottom: 25px; }
      .btn { display: inline-block; padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; text-align: center; transition: all 0.2s; }
      .btn-primary { background: #2563eb; color: white; }
      .btn-primary:hover { background: #1d4ed8; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .btn-secondary:hover { background: #e2e8f0; }
      .btn-success { background: #10b981; color: white; padding: 6px 12px; font-size: 13px; }
      .btn-success:hover { background: #059669; }
      .btn-danger { background: #ef4444; color: white; padding: 6px 12px; font-size: 13px; }
      .btn-danger:hover { background: #dc2626; }
      .flex-stats { display: flex; gap: 20px; margin-bottom: 30px; }
      .stat-card { flex: 1; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
      .stat-card-paid { background: #ecfdf5; border-left-color: #10b981; color: #065f46; }
      .stat-card-unpaid { background: #fef2f2; border-left-color: #ef4444; color: #991b1b; }
      .stat-card small { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px; }
      .stat-card h2 { margin: 0; font-size: 24px; font-weight: 700; }
      .tenant-list { list-style: none; padding: 0; margin: 0; }
      .tenant-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #f1f5f9; }
      .tenant-item:last-child { border-bottom: none; }
      .tenant-info strong { font-size: 16px; color: #0f172a; }
      .tenant-info div { font-size: 14px; color: #64748b; margin-top: 2px; }
      .actions { display: flex; align-items: center; gap: 8px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569; }
      .badge-paid { background: #d1fae5; color: #065f46; }
    </style>
  </head>
`;

// 1. Home Page (Dashboard view with nice form layout)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      ${HTML_HEAD}
      <body>
        <div class="container">
          <h1>Property Management Dashboard</h1>
          
          <div class="form-box">
            <h3>➕ Add New Tenant</h3>
            <form action="/add-tenant" method="POST">
              <label>Tenant Name</label>
              <input type="text" name="tenantName" placeholder="Full Name" required>
              
              <label>Unit Number</label>
              <input type="text" name="unitNumber" placeholder="e.g. Apt 104" required>
              
              <label>Monthly Rent Amount ($)</label>
              <input type="number" name="rentAmount" placeholder="e.g. 1200" required>
              
              <button type="submit" class="btn btn-primary" style="width: 100%;">Save Tenant Record</button>
            </form>
          </div>

          <div style="text-align: center;">
            <a href="/tenants" class="btn btn-secondary" style="width: 100%; box-sizing: border-box; padding: 12px;">📂 Go to Financial Overview & Records</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

// 2. Action Route: Create Tenant
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

// 5. Tenants Page (The beautiful structured portal)
app.get('/tenants', async (req, res) => {
  try {
    const paidSumResult = await pool.query("SELECT SUM(rent_amount) FROM tenants WHERE rent_paid = true");
    const unpaidSumResult = await pool.query("SELECT SUM(rent_amount) FROM tenants WHERE rent_paid = false");

    const totalCollected = Number(paidSumResult.rows[0].sum || 0);
    const totalOutstanding = Number(unpaidSumResult.rows[0].sum || 0);

    const result = await pool.query('SELECT * FROM tenants ORDER BY id DESC');
    const tenantsFromDb = result.rows;

    let tenantRows = '';
    tenantsFromDb.forEach(tenant => {
      const rentButtonOrStatus = tenant.rent_paid 
        ? `<span class="badge badge-paid">🟩 Paid</span>` 
        : `
          <form action="/toggle-rent/${tenant.id}" method="POST" style="margin: 0;">
            <button type="submit" class="btn btn-success">Collect Rent</button>
          </form>
        `;

      const deleteButton = `
        <form action="/delete-tenant/${tenant.id}" method="POST" style="margin: 0;" onsubmit="return confirm('Are you sure this tenant moved out?');">
          <button type="submit" class="btn btn-danger">🗑️ Delete</button>
        </form>
      `;

      tenantRows += `
        <li class="tenant-item">
          <div class="tenant-info">
            <strong>👤 ${tenant.name}</strong>
            <div>🏠 Unit: ${tenant.unit} &bull; Rent: $${Number(tenant.rent_amount).toLocaleString()}/mo</div>
          </div>
          <div class="actions">
            ${rentButtonOrStatus}
            ${deleteButton}
          </div>
        </li>
      `;
    });

    res.send(`
      <!DOCTYPE html>
      <html>
        ${HTML_HEAD}
        <body>
          <div class="container">
            <h1>Financial Overview</h1>
            
            <div class="flex-stats">
              <div class="stat-card stat-card-paid">
                <small>Total Collected</small>
                <h2>$${totalCollected.toLocaleString()}</h2>
              </div>
              <div class="stat-card stat-card-unpaid">
                <small>Outstanding Balance</small>
                <h2>$${totalOutstanding.toLocaleString()}</h2>
              </div>
            </div>

            <h3 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Tenant Master Directory</h3>
            <ul class="tenant-list">
              ${tenantRows || '<li class="tenant-item" style="color: #64748b;">No active records found. Add a tenant to begin.</li>'}
            </ul>
            
            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <a href="/" class="btn btn-secondary">← Back to Registration Form</a>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading finance engine.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});