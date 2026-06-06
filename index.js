Ah, let's look at the logs! The "Error reading calculations" message means the app booted up fine, but when it tried to run the SQL math to load the ledger page, PostgreSQL hit a roadblock.

Since we just added the new overpayment math (CASE WHEN), it's highly likely that one of your existing tenants has a blank (NULL) or corrupted value in their rent_amount or maintenance_amount column from our earlier testing versions. When Postgres tries to do math on a blank space, it crashes.

Let's make our SQL completely bulletproof against old test data by adding a safety fallback (COALESCE) to treat any empty spaces as 0.

The Permanent Fix
Open your index.js file, erase everything, and paste this bulletproof version:

JavaScript
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
      amount_paid NUMERIC DEFAULT 0,
      father_name TEXT,
      phone TEXT,
      alt_phone TEXT,
      id_card_no TEXT,
      unit_area NUMERIC DEFAULT 0,
      security_deposit NUMERIC DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_logs (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      amount_paid NUMERIC NOT NULL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
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
      .tenant-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px; border-bottom: 1px solid #f1f5f9; gap: 20px; }
      .actions { display: flex; align-items: center; gap: 12px; margin-top: 5px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-partial { background: #ffedd5; color: #9a3412; }
      .badge-unpaid { background: #ffeeeb; color: #b91c1c; }
      .badge-advance { background: #e0f2fe; color: #0369a1; } 
      .pay-input { width: 90px; padding: 6px; margin: 0; font-size: 13px; border-radius: 4px; border: 1px solid #cbd5e1; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 15px; font-size: 13px; color: #64748b; margin-top: 6px; }
      .reveal-link { color: #2563eb; cursor: pointer; font-weight: 600; text-decoration: underline; font-size: 13px; }
      .history-box { margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; max-height: 120px; overflow-y: auto; width: 100%; box-sizing: border-box; }
      .history-title { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; display: block; }
      .history-item { font-size: 12px; color: #334155; padding: 3px 0; border-bottom: 1px dashed #e2e8f0; display: flex; justify-content: space-between; }
      .history-item:last-child { border-bottom: none; }
    </style>
    <script>
      function toggleReveal(id, actualValue) {
        const element = document.getElementById('id-container-' + id);
        if (element.innerText.includes('•')) {
          element.innerText = actualValue;
          element.style.color = '#0f172a';
        } else {
          element.innerText = '•••• •••• ••••';
          element.style.color = '#64748b';
        }
      }
    </script>
  </head>
`;

// 1. Intake Form View
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container"><h1>Property Management Dashboard</h1><div class="form-box"><h3>📋 Comprehensive Tenant Intake Form</h3><form action="/add-tenant" method="POST"><div class="form-grid"><div><label>Tenant Name</label><input type="text" name="tenantName" placeholder="Full Name" required></div><div><label>Father's Name</label><input type="text" name="fatherName" placeholder="Father's Full Name" required></div></div><div class="form-grid"><div><label>Primary Phone Number</label><input type="tel" name="phone" placeholder="e.g. 9876543210" required></div><div><label>Alternate Phone Number</label><input type="tel" name="altPhone" placeholder="Emergency Contact"></div></div><div class="form-grid"><div><label>Aadhaar Card Number</label><input type="text" name="idCardNo" placeholder="12-Digit Number" required></div><div><label>Unit Allocated</label><input type="text" name="unitNumber" placeholder="e.g. Flat 302" required></div></div><div class="form-grid"><div><label>Area of Unit (Sq. Ft.)</label><input type="number" name="unitArea" placeholder="e.g. 1250" required></div><div><label>Security Deposit Paid ($)</label><input type="number" name="securityDeposit" placeholder="e.g. 25000" required></div></div><div class="form-grid"><div><label>Monthly Base Rent ($)</label><input type="number" name="rentAmount" placeholder="e.g. 15000" required></div><div><label>Monthly Maintenance Charges ($)</label><input type="number" name="maintenanceAmount" placeholder="e.g. 2000" required></div></div><button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Register Tenant & Open Account</button></form></div><div style="text-align: center;"><a href="/tenants" class="btn btn-secondary" style="width: 100%; box-sizing: border-box; padding: 12px;">📂 Access Tenant Master Directory & Ledgers</a></div></div></body></html>`);
});

// 2. Add Tenant
app.post('/add-tenant', async (req, res) => {
  try {
    const { tenantName, fatherName, phone, altPhone, idCardNo, unitNumber, unitArea, securityDeposit, rentAmount, maintenanceAmount } = req.body;
    await pool.query(
      'INSERT INTO tenants (name, father_name, phone, alt_phone, id_card_no, unit, unit_area, security_deposit, rent_amount, maintenance_amount, amount_paid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)',
      [tenantName, fatherName, phone, altPhone || 'N/A', idCardNo, unitNumber, unitArea || 0, securityDeposit || 0, rentAmount || 0, maintenanceAmount || 0]
    );
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving profile.");
  }
});

// 3. Collect Payment
app.post('/collect-payment/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;
    const paymentAmount = Number(req.body.paymentAmount || 0);

    await pool.query('UPDATE tenants SET amount_paid = COALESCE(amount_paid, 0) + $1 WHERE id = $2', [paymentAmount, tenantId]);

    await pool.query(
      'INSERT INTO payment_logs (tenant_id, amount_paid) VALUES ($1, $2)',
      [tenantId, paymentAmount]
    );

    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Processing payment entry failed.");
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
    res.status(500).send("Deletion failed.");
  }
});

// 5. Master Ledger (With Safety Fallbacks)
app.get('/tenants', async (req, res) => {
  try {
    // COALESCE checks if a field is NULL and instantly converts it to 0 so math never crashes
    const totalCollectedQuery = await pool.query("SELECT SUM(COALESCE(amount_paid, 0)) FROM tenants");
    
    const totalOwedQuery = await pool.query(`
      SELECT SUM(
        CASE 
          WHEN (COALESCE(rent_amount, 0) + COALESCE(maintenance_amount, 0)) > COALESCE(amount_paid, 0) 
          THEN (COALESCE(rent_amount, 0) + COALESCE(maintenance_amount, 0)) - COALESCE(amount_paid, 0) 
          ELSE 0 
        END
      ) FROM tenants
    `);

    const grossCollected = Number(totalCollectedQuery.rows[0].sum || 0);
    const grossOutstanding = Number(totalOwedQuery.rows[0].sum || 0);

    const result = await pool.query('SELECT * FROM tenants ORDER BY id DESC');
    const tenantsFromDb = result.rows;

    const logHistoryResult = await pool.query('SELECT * FROM payment_logs ORDER BY payment_date DESC');
    const globalLogs = logHistoryResult.rows;

    let tenantRows = '';
    tenantsFromDb.forEach(tenant => {
      const baseRent = Number(tenant.rent_amount || 0);
      const maintenance = Number(tenant.maintenance_amount || 0);
      const currentPaid = Number(tenant.amount_paid || 0);
      const totalTargetInvoice = baseRent + maintenance;
      
      const remainingBalanceOwed = totalTargetInvoice - currentPaid;
      const clearIdString = String(tenant.id_card_no || '').replace(/'/g, "\\'");

      let statusBadge = '';
      if (currentPaid === 0) {
        statusBadge = `<span class="badge badge-unpaid">Unpaid</span>`;
      } else if (remainingBalanceOwed > 0) {
        statusBadge = `<span class="badge badge-partial">Partial ($${remainingBalanceOwed.toLocaleString()} Due)</span>`;
      } else if (remainingBalanceOwed < 0) {
        const creditBalance = Math.abs(remainingBalanceOwed);
        statusBadge = `<span class="badge badge-advance">🔵 Advance Credit ($${creditBalance.toLocaleString()})</span>`;
      } else {
        statusBadge = `<span class="badge badge-paid">Fully Paid</span>`;
      }

      const dynamicPaymentInput = `
        <form action="/collect-payment/${tenant.id}" method="POST" style="margin: 0; display: flex; gap: 6px; align-items: center;">
          <input type="number" name="paymentAmount" class="pay-input" placeholder="Amt ($)" required>
          <button type="submit" class="btn btn-success" style="padding: 6px 10px;">Pay</button>
        </form>
      `;

      let internalHistoryItems = '';
      const tenantLogs = globalLogs.filter(log => log.tenant_id === tenant.id);
      
      tenantLogs.forEach(log => {
        const cleanDate = new Date(log.payment_date).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        internalHistoryItems += `
          <div class="history-item">
            <span>➕ Received: $${Number(log.amount_paid).toLocaleString()}</span>
            <span style="color: #64748b;">📅 ${cleanDate}</span>
          </div>
        `;
      });

      const historyWrapper = `
        <div class="history-box">
          <span class="history-title">📜 Payment History Log</span>
          ${internalHistoryItems || '<div style="font-size: 11px; color:#94a3b8;">No payments recorded yet.</div>'}
        </div>
      `;

      tenantRows += `
        <li class="tenant-item" style="flex-direction: column; align-items: stretch;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="tenant-info">
              <div style="display: flex; align-items: center; gap: 10px;">
                <strong>👤 ${tenant.name}</strong> 
                ${statusBadge}
              </div>
              
              <div class="meta-grid">
                <div>🏠 <strong>Unit:</strong> ${tenant.unit} (${tenant.unit_area} Sq. Ft.)</div>
                <div>💼 <strong>Father's Name:</strong> ${tenant.father_name || 'N/A'}</div>
                <div>📞 <strong>Primary Phone:</strong> ${tenant.phone || 'N/A'}</div>
                <div>🔒 <strong>Identity Verification:</strong> <span id="id-container-${tenant.id}" style="font-weight: 600; letter-spacing: 0.05em;">•••• •••• ••••</span> <span class="reveal-link" onclick="toggleReveal('${tenant.id}', '${clearIdString}')">(Reveal)</span></div>
                <div>💰 <strong>Security Deposit:</strong> $${Number(tenant.security_deposit || 0).toLocaleString()}</div>
                <div>📊 <strong>Invoice Target:</strong> $${totalTargetInvoice.toLocaleString()} (Rent: $${baseRent} + Maint: $${maintenance})</div>
              </div>
              
              <div style="font-size: 13px; color: #1e293b; margin-top: 8px; font-weight: 500;">
                Total Paid Current Month: <span style="color: #10b981; font-weight:700;">$${currentPaid.toLocaleString()}</span>
              </div>
            </div>
            <div class="actions">
              ${dynamicPaymentInput}
              <form action="/delete-tenant/${tenant.id}" method="POST" style="margin: 0;" onsubmit="return confirm('Are you sure this tenant moved out?');">
                <button type="submit" class="btn btn-danger">🗑️</button>
              </form>
            </div>
          </div>
          ${historyWrapper}
        </li>
      `;
    });

    res.send(`<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container"><h1>Master Directory & Business Ledgers</h1><div class="flex-stats"><div class="stat-card stat-card-paid"><small>Gross Collections</small><h2>$${grossCollected.toLocaleString()}</h2></div><div class="stat-card stat-card-unpaid"><small>Total Dues Outstanding</small><h2>$${grossOutstanding.toLocaleString()}</h2></div></div><h3 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Active Records Ledger</h3><ul class="tenant-list">${tenantRows || '<li class="tenant-item">No active records found.</li>'}</ul><div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;"><a href="/" class="btn btn-secondary">← Back to Registration Form</a></div></div></body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading calculations.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});