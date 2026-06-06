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
      rent_amount NUMERIC DEFAULT 0,
      maintenance_amount NUMERIC DEFAULT 0,
      amount_paid NUMERIC DEFAULT 0
    );
  `);

  // NEW: Add columns for all your specific legal & structural requirements
  await pool.query(`
    ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS father_name TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS alt_phone TEXT,
    ADD COLUMN IF NOT EXISTS id_card_no TEXT,
    ADD COLUMN IF NOT EXISTS unit_area NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS security_deposit NUMERIC DEFAULT 0;
  `);
}
initDatabase().catch(err => console.error("Database setup failed:", err));

const HTML_HEAD = `
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px; display: flex; justify-content: center; }
      .container { width: 100%; max-width: 900px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
      h1 { color: #0f172a; margin-top: 0; font-size: 28px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
      h3 { color: #334155; margin-top: 0; margin-bottom: 20px; font-size: 18px; }
      label { font-weight: 600; font-size: 13px; color: #475569; display: block; margin-bottom: 6px; }
      input { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; margin-bottom: 14px; font-size: 14px; }
      .form-grid { display: flex; gap: 16px; margin-bottom: 4px; }
      .form-grid > div { flex: 1; }
      .form-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; margin-bottom: 25px; }
      .btn { display: inline-block; padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; text-align: center; }
      .btn-primary { background: #2563eb; color: white; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .btn-success { background: #10b981; color: white; padding: 6px 12px; font-size: 13px; }
      .btn-danger { background: #ef4444; color: white; padding: 6px 12px; font-size: 13px; }
      .flex-stats { display: flex; gap: 20px; margin-bottom: 30px; }
      .stat-card { flex: 1; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
      .stat-card-paid { background: #ecfdf5; border-left-color: #10b981; color: #065f46; }
      .stat-card-unpaid { background: #fef2f2; border-left-color: #ef4444; color: #991b1b; }
      .tenant-list { list-style: none; padding: 0; margin: 0; }
      .tenant-item { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #f1f5f9; }
      .actions { display: flex; align-items: center; gap: 12px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-partial { background: #ffedd5; color: #9a3412; }
      .badge-unpaid { background: #ffeeeb; color: #b91c1c; }
      .pay-input { width: 90px; padding: 6px; margin: 0; font-size: 13px; border-radius: 4px; border: 1px solid #cbd5e1; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 15px; font-size: 13px; color: #64748b; margin-top: 6px; }
    </style>
  </head>
`;

// 1. Intake Dashboard View
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      ${HTML_HEAD}
      <body>
        <div class="container">
          <h1>Property Management Dashboard</h1>
          <div class="form-box">
            <h3>📋 Comprehensive Tenant Intake Form</h3>
            <form action="/add-tenant" method="POST">
              
              <div class="form-grid">
                <div>
                  <label>Tenant Name</label>
                  <input type="text" name="tenantName" placeholder="Full Name" required>
                </div>
                <div>
                  <label>Father's Name</label>
                  <input type="text" name="fatherName" placeholder="Father's Full Name" required>
                </div>
              </div>

              <div class="form-grid">
                <div>
                  <label>Primary Phone Number</label>
                  <input type="tel" name="phone" placeholder="e.g. 9876543210" required>
                </div>
                <div>
                  <label>Alternate Phone Number</label>
                  <input type="tel" name="altPhone" placeholder="Emergency Contact">
                </div>
              </div>

              <div class="form-grid">
                <div>
                  <label>Aadhaar Card Number</label>
                  <input type="text" name="idCardNo" placeholder="12-Digit Number" required>
                </div>
                <div>
                  <label>Unit Allocated</label>
                  <input type="text" name="unitNumber" placeholder="e.g. Flat 302" required>
                </div>
              </div>

              <div class="form-grid">
                <div>
                  <label>Area of Unit (Sq. Ft.)</label>
                  <input type="number" name="unitArea" placeholder="e.g. 1250" required>
                </div>
                <div>
                  <label>Security Deposit Paid ($)</label>
                  <input type="number" name="securityDeposit" placeholder="e.g. 25000" required>
                </div>
              </div>

              <div class="form-grid">
                <div>
                  <label>Monthly Base Rent ($)</label>
                  <input type="number" name="rentAmount" placeholder="e.g. 15000" required>
                </div>
                <div>
                  <label>Monthly Maintenance Charges ($)</label>
                  <input type="number" name="maintenanceAmount" placeholder="e.g. 2000" required>
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Register Tenant & Open Account</button>
            </form>
          </div>
          <div style="text-align: center;">
            <a href="/tenants" class="btn btn-secondary" style="width: 100%; box-sizing: border-box; padding: 12px;">📂 Access Tenant Master Directory & Ledgers</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

// 2. Process All Details and Store Safely
app.post('/add-tenant', async (req, res) => {
  try {
    const { 
      tenantName, fatherName, phone, altPhone, 
      idCardNo, unitNumber, unitArea, securityDeposit, 
      rentAmount, maintenanceAmount 
    } = req.body;

    await pool.query(
      \`INSERT INTO tenants (
        name, father_name, phone, alt_phone, id_card_no, 
        unit, unit_area, security_deposit, rent_amount, 
        maintenance_amount, amount_paid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)\`,
      [
        tenantName, fatherName, phone, altPhone || 'N/A', idCardNo,
        unitNumber, unitArea || 0, securityDeposit || 0, rentAmount || 0,
        maintenanceAmount || 0
      ]
    );
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error compiling complete profile schema.");
  }
});

// 3. Collect Ledger Updates
app.post('/collect-payment/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;
    const paymentAmount = Number(req.body.paymentAmount || 0);
    await pool.query('UPDATE tenants SET amount_paid = amount_paid + $1 WHERE id = $2', [paymentAmount, tenantId]);
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Processing statement failed.");
  }
});

// 4. Delete Profile
app.post('/delete-tenant/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Eviction logging failed.");
  }
});

// 5. Master Directory View 
app.get('/tenants', async (req, res) => {
  try {
    const totalCollectedQuery = await pool.query("SELECT SUM(amount_paid) FROM tenants");
    const totalOwedQuery = await pool.query("SELECT SUM((rent_amount + maintenance_amount) - amount_paid) FROM tenants");

    const grossCollected = Number(totalCollectedQuery.rows[0].sum || 0);
    const grossOutstanding = Number(totalOwedQuery.rows[0].sum || 0);

    const result = await pool.query('SELECT * FROM tenants ORDER BY id DESC');
    const tenantsFromDb = result.rows;

    let tenantRows = '';
    tenantsFromDb.forEach(tenant => {
      const baseRent = Number(tenant.rent_amount || 0);
      const maintenance = Number(tenant.maintenance_amount || 0);
      const currentPaid = Number(tenant.amount_paid || 0);
      const totalTargetInvoice = baseRent + maintenance;
      const remainingBalanceOwed = totalTargetInvoice - currentPaid;

      let statusBadge = '';
      if (currentPaid === 0) {
        statusBadge = \`<span class="badge badge-unpaid">Unpaid</span>\`;
      } else if (remainingBalanceOwed > 0) {
        statusBadge = \`<span class="badge badge-partial">Partial ($${remainingBalanceOwed.toLocaleString()})</span>\`;
      } else {
        statusBadge = \`<span class="badge badge-paid">Fully Paid</span>\`;
      }

      const dynamicPaymentInput = remainingBalanceOwed > 0 
        ? \`
          <form action="/collect-payment/\${tenant.id}" method="POST" style="margin: 0; display: flex; gap: 6px; align-items: center;">
            <input type="number" name="paymentAmount" class="pay-input" max="\${remainingBalanceOwed}" placeholder="Amt" required>
            <button type="submit" class="btn btn-success" style="padding: 6px 10px;">Pay</button>
          </form>
        \`
        : \`<span style="color: #10b981; font-weight: 600; font-size: 13px;">Cleared</span>\`;

      tenantRows += \`
        <li class="tenant-item">
          <div class="tenant-info">
            <div style="display: flex; align-items: center; gap: 10px;">
              <strong>👤 \${tenant.name}</strong> 
              \${statusBadge}
            </div>
            
            <div class="meta-grid">
              <div>🏠 <strong>Unit:</strong> \${tenant.unit} (\${tenant.unit_area} Sq. Ft.)</div>
              <div>💼 <strong>Father's Name:</strong> \${tenant.father_name}</div>
              <div>📞 <strong>Primary Phone:</strong> \${tenant.phone}</div>
              <div>🔒 <strong>Identity Verification:</strong> <span style="color: #0284c7; font-weight:600;">[ Aadhaar Saved ✅ ]</span></div>
              <div>💰 <strong>Security Deposit:</strong> $\${Number(tenant.security_deposit).toLocaleString()}</div>
              <div>📊 <strong>Invoice Target:</strong> $\${totalTargetInvoice.toLocaleString()} (Rent: $\${baseRent} + Maint: $\${maintenance})</div>
            </div>
            
            <div style="font-size: 13px; color: #1e293b; margin-top: 8px; font-weight: 500;">
              Total Paid Current Month: <span style="color: #10b981; font-weight:700;">$\${currentPaid.toLocaleString()}</span>
            </div>
          </div>
          <div class="actions">
            \${dynamicPaymentInput}
            <form action="/delete-tenant/\${tenant.id}" method="POST" style="margin: 0;">
              <button type="submit" class="btn btn-danger">🗑️</button>
            </form>
          </div>
        </li>
      \`;
    });

    res.send(\`
      <!DOCTYPE html>
      <html>
        \${HTML_HEAD}
        <body>
          <div class="container">
            <h1>Master Directory & Business Ledgers</h1>
            
            <div class="flex-stats">
              <div class="stat-card stat-card-paid">
                <small>Gross Collections</small>
                <h2>$\${grossCollected.toLocaleString()}</h2>
              </div>
              <div class="stat-card stat-card-unpaid">
                <small>Total Dues Outstanding</small>
                <h2>$\${grossOutstanding.toLocaleString()}</h2>
              </div>
            </div>

            <h3 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Active Records Ledger</h3>
            <ul class="tenant-list">
              \${tenantRows || '<li class="tenant-item">No active leasing portfolios found.</li>'}
            </ul>
            
            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <a href="/" class="btn btn-secondary">← Back to Registration Form</a>
            </div>
          </div>
        </body>
      </html>
    \`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading master dashboard calculations.");
  }
});

app.listen(PORT, () => {
  console.log(\`Server is running on http://localhost:\${PORT}\`);
});