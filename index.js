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
      father_name TEXT,
      phone TEXT,
      alt_phone TEXT,
      id_card_no TEXT,
      unit TEXT NOT NULL,
      unit_area NUMERIC DEFAULT 0,
      security_deposit NUMERIC DEFAULT 0,
      rent_amount NUMERIC DEFAULT 0,
      maintenance_amount NUMERIC DEFAULT 0
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
      item_amount NUMERIC NOT NULL
    );
  `);

  // NEW: Add a billing_month tracking tag directly to extra items to handle deferred cycles
  await pool.query(`
    ALTER TABLE invoice_extra_items ADD COLUMN IF NOT EXISTS item_billing_month TEXT DEFAULT '';
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
initDatabase().catch(err => console.error("Database setup failed:", err));

const PREVIOUS_MONTH_MAP = {
  "Jan": "Dec", "Feb": "Jan", "Mar": "Feb", "Apr": "Mar", "May": "Apr", "Jun": "May",
  "Jul": "Jun", "Aug": "Jul", "Sep": "Aug", "Oct": "Sep", "Nov": "Oct", "Dec": "Nov"
};

const HTML_HEAD = `
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px; display: flex; justify-content: center; }
      .container { width: 100%; max-width: 950px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
      h1 { color: #0f172a; margin-top: 0; font-size: 26px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
      h3 { color: #334155; margin-top: 0; margin-bottom: 20px; font-size: 18px; }
      label { font-weight: 600; font-size: 13px; color: #475569; display: block; margin-bottom: 6px; }
      input, select { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; margin-bottom: 14px; font-size: 14px; background: white; }
      .form-grid { display: flex; gap: 16px; margin-bottom: 4px; }
      .form-grid > div { flex: 1; }
      .form-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; margin-bottom: 25px; }
      .btn { display: inline-block; padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; text-align: center; }
      .btn-primary { background: #2563eb; color: white; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .btn-success { background: #10b981; color: white; padding: 6px 12px; font-size: 13px; border-radius: 4px; }
      .btn-danger { background: #ef4444; color: white; padding: 6px 12px; font-size: 13px; }
      .btn-info { background: #0284c7; color: white; padding: 6px 12px; font-size: 13px; border-radius: 4px; text-decoration: none; }
      .flex-stats { display: flex; gap: 20px; margin-bottom: 30px; }
      .stat-card { flex: 1; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
      .stat-card-paid { background: #ecfdf5; border-left-color: #10b981; color: #065f46; }
      .stat-card-unpaid { background: #fef2f2; border-left-color: #ef4444; color: #991b1b; }
      .tenant-list { list-style: none; padding: 0; margin: 0; }
      .tenant-item { display: flex; flex-direction: column; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; background: #ffffff; }
      .item-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px; }
      .actions { display: flex; align-items: center; gap: 8px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-partial { background: #ffedd5; color: #9a3412; }
      .badge-unpaid { background: #ffeeeb; color: #b91c1c; }
      .badge-advance { background: #e0f2fe; color: #0369a1; } 
      .pay-input { width: 95px; padding: 6px; margin: 0; font-size: 13px; border-radius: 4px; border: 1px solid #cbd5e1; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 13px; color: #64748b; }
      .reveal-link { color: #2563eb; cursor: pointer; font-weight: 600; text-decoration: underline; font-size: 13px; }
      .history-box { margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; max-height: 120px; overflow-y: auto; }
      .history-title { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; display: block; }
      .history-item { font-size: 12px; color: #334155; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; display: flex; justify-content: space-between; }
      .history-item:last-child { border-bottom: none; }
      .search-box { position: relative; margin-bottom: 20px; }
      .search-box input { padding: 12px 16px 12px 40px; font-size: 15px; border-radius: 8px; background-color: #f1f5f9; border-color: #e2e8f0; margin-bottom: 0; }
      .search-box::before { content: "🔍"; position: absolute; left: 14px; top: 11px; font-size: 16px; color: #64748b; }
      
      .extra-charge-form { background: #e0f2fe; border: 1px solid #bae6fd; padding: 12px; border-radius: 6px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-end; }
      .extra-charge-form input { margin-bottom: 0; padding: 6px 10px; font-size: 13px; }
      
      .charge-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .charge-tag { background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; font-size: 12px; padding: 4px 10px; border-radius: 20px; display: flex; align-items: center; gap: 6px; }
      .charge-tag-delete { color: #ef4444; font-weight: bold; border: none; background: none; padding: 0; font-size: 14px; cursor: pointer; }
      
      .batch-billing-panel { background: #1e293b; color: white; padding: 16px 20px; border-radius: 8px; display: flex; gap: 12px; align-items: flex-end; font-size: 14px; width: 100%; box-sizing: border-box; margin-bottom: 25px; }
      .batch-billing-panel div { display: flex; flex-direction: column; gap: 4px; }
      .batch-billing-panel select, .batch-billing-panel input { margin-bottom: 0; padding: 8px 12px; border-radius: 4px; font-size: 13px; border: none; width: auto; }
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

      function filterTenants() {
        const query = document.getElementById('tenantSearch').value.toLowerCase();
        const items = document.getElementsByClassName('tenant-item');
        for (let i = 0; i < items.length; i++) {
          const searchContent = items[i].getAttribute('data-search').toLowerCase();
          if (searchContent.includes(query)) {
            items[i].style.display = 'flex';
          } else {
            items[i].style.display = 'none';
          }
        }
      }

      function confirmBatchGeneration() {
        const selectedMonth = document.getElementById('targetMonth').value;
        const selectedYear = document.getElementById('targetYear').value;
        const targetString = selectedMonth + ' ' + selectedYear;
        return confirm('⚠️ Are you sure you want to generate bills for [' + targetString + ']? Maintenance charges logged in the previous month will automatically attach to this new statement.');
      }
    </script>
  </head>
`;

app.get('/', (req, res) => {
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentMonthShort = nowIST.toLocaleDateString('en-IN', { month: 'short' });
  const currentYear = nowIST.getFullYear();

  const monthArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let monthOptionsHTML = '';
  monthArray.forEach(m => {
    monthOptionsHTML += `<option value="${m}" ${m === currentMonthShort ? 'selected' : ''}>${m}</option>`;
  });

  res.send(`<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container">
    <h1 style="border-bottom:none; margin-bottom:10px;">Property Management Dashboard</h1>

    <form action="/generate-monthly-invoices" method="POST" onsubmit="return confirmBatchGeneration();" class="batch-billing-panel">
      <div style="flex:1;">
        <label style="color:#cbd5e1;">Select Month Cycle</label>
        <select id="targetMonth" name="targetMonth">${monthOptionsHTML}</select>
      </div>
      <div style="flex:1;">
        <label style="color:#cbd5e1;">Select Year</label>
        <input type="number" id="targetYear" name="targetYear" value="${currentYear}" min="2020" max="2100" required>
      </div>
      <div>
        <button type="submit" class="btn btn-primary" style="background:#10b981; padding:9px 20px;">⚡ Generate Bills</button>
      </div>
    </form>

    <div class="form-box">
      <h3>➕ Register New Tenant Profile</h3>
      <form action="/add-tenant" method="POST">
        <div class="form-grid">
          <div><label>Tenant Name</label><input type="text" name="tenantName" placeholder="Full Name" required></div>
          <div><label>Father's Name</label><input type="text" name="fatherName" placeholder="Father's Full Name" required></div>
        </div>
        <div class="form-grid">
          <div><label>Primary Phone Number</label><input type="tel" name="phone" placeholder="e.g. 9876543210" required></div>
          <div><label>Alternate Phone Number</label><input type="tel" name="altPhone" placeholder="Emergency Contact"></div>
        </div>
        <div class="form-grid">
          <div><label>Aadhaar Card Number</label><input type="text" name="idCardNo" placeholder="12-Digit Number" required></div>
          <div><label>Unit Allocated</label><input type="text" name="unitNumber" placeholder="e.g. Flat 302" required></div>
        </div>
        <div class="form-grid">
          <div><label>Area of Unit (Sq. Ft.)</label><input type="number" name="unitArea" placeholder="e.g. 1250" required></div>
          <div><label>Security Deposit Paid (₹)</label><input type="number" name="securityDeposit" placeholder="e.g. 50000" required></div>
        </div>
        <div class="form-grid">
          <div><label>Monthly Base Rent (₹)</label><input type="number" name="rentAmount" placeholder="e.g. 19000" required></div>
          <div><label>Monthly Maintenance Charges (₹)</label><input type="number" name="maintenanceAmount" placeholder="e.g. 2000" required></div>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Register Tenant Profile</button>
      </form>
    </div>
    
    <div style="text-align: center;">
      <a href="/tenants" class="btn btn-secondary" style="width: 100%; box-sizing: border-box; padding: 12px;">📂 Access Monthly Billing Ledgers Directory →</a>
    </div>
  </div></body></html>`);
});

app.post('/add-tenant', async (req, res) => {
  try {
    const { tenantName, fatherName, phone, altPhone, idCardNo, unitNumber, unitArea, securityDeposit, rentAmount, maintenanceAmount } = req.body;
    await pool.query(
      'INSERT INTO tenants (name, father_name, phone, alt_phone, id_card_no, unit, unit_area, security_deposit, rent_amount, maintenance_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [tenantName, fatherName, phone, altPhone || 'N/A', idCardNo, unitNumber, unitArea || 0, securityDeposit || 0, rentAmount || 0, maintenanceAmount || 0]
    );
    res.redirect('/tenants');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving tenant profile.");
  }
});

// UPGRADED BATCH INVOICE GENERATOR WITH PREVIOUS-MONTH AD-HOC DEFERRED COUPLING ENGINE
app.post('/generate-monthly-invoices', async (req, res) => {
  try {
    const { targetMonth, targetYear } = req.body;
    const billingMonth = `${targetMonth} ${targetYear}`;
    
    const prevMonthShort = PREVIOUS_MONTH_MAP[targetMonth];
    const prevYear = (targetMonth === "Jan") ? Number(targetYear) - 1 : targetYear;
    const previousMonthLabel = `${prevMonthShort} ${prevYear}`;

    const tenantsResult = await pool.query('SELECT id, rent_amount, maintenance_amount FROM tenants');
    
    for (let tenant of tenantsResult.rows) {
      let carriedArrears = 0;

      // 1. Compute outstanding arrears from previous month
      const prevInvoiceQuery = await pool.query(`
        SELECT invoices.id, invoices.rent_charged, invoices.maintenance_charged, invoices.amount_paid, invoices.arrears_brought_forward,
               COALESCE(extras.extra_sum, 0) as item_extras
        FROM invoices
        LEFT JOIN (
          SELECT invoice_id, SUM(item_amount) as extra_sum FROM invoice_extra_items WHERE item_billing_month = $1 GROUP BY invoice_id
        ) extras ON invoices.id = extras.invoice_id
        WHERE invoices.tenant_id = $2 AND invoices.billing_month = $1
      `, [previousMonthLabel, tenant.id]);

      if (prevInvoiceQuery.rows.length > 0) {
        const pInv = prevInvoiceQuery.rows[0];
        const totalChargedLastMonth = Number(pInv.rent_charged) + Number(pInv.maintenance_charged) + Number(pInv.arrears_brought_forward) + Number(pInv.item_extras);
        const outstandingLastMonth = totalChargedLastMonth - Number(pInv.amount_paid);
        if (outstandingLastMonth > 0) {
          carriedArrears = outstandingLastMonth;
        }
      }

      // 2. Generate the main core invoice row for the target month
      const currentInvoiceResult = await pool.query(`
        INSERT INTO invoices (tenant_id, billing_month, rent_charged, maintenance_charged, amount_paid, arrears_brought_forward)
        VALUES ($1, $2, $3, $4, 0, $5)
        ON CONFLICT (tenant_id, billing_month) DO UPDATE SET arrears_brought_forward = $5
        RETURNING id
      `, [tenant.id, billingMonth, tenant.rent_amount, tenant.maintenance_amount, carriedArrears]);
      
      const newInvoiceId = currentInvoiceResult.rows[0].id;

      // 3. DEFERRED AD-HOC TRANSFER: Find repairs added *during* the previous month that were tagged for this month's bill
      if (prevInvoiceQuery.rows.length > 0) {
        const oldInvoiceId = prevInvoiceQuery.rows[0].id;
        
        // Re-target item_billing_month items to match the newly generated statement sheet
        await pool.query(`
          UPDATE invoice_extra_items 
          SET invoice_id = $1 
          WHERE invoice_id = $2 AND item_billing_month = $3
        `, [newInvoiceId, oldInvoiceId, billingMonth]);
      }
    }
    
    res.redirect('/tenants?month=' + encodeURIComponent(billingMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating monthly statements.");
  }
});

// UPGRADED ACTION ROUTE: Stores the ad-hoc expense and tags it for the *next month cycle*
app.post('/add-extra-item/:invoiceId', async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    const itemDesc = req.body.itemDesc || 'General Maintenance';
    const itemAmount = Number(req.body.itemAmount || 0);
    const selectedMonth = req.body.selectedMonth; // Current dashboard context (e.g., "Jun 2026")

    // Figure out the NEXT calendar month target label
    const parts = selectedMonth.split(' ');
    const currentM = parts[0];
    const currentY = Number(parts[1]);
    
    const monthArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentIndex = monthArray.indexOf(currentM);
    
    let nextM = monthArray[(currentIndex + 1) % 12];
    let nextY = (currentM === "Dec") ? currentY + 1 : currentY;
    const nextMonthLabel = `${nextM} ${nextY}`; // The target cycle when the tenant will see the bill

    await pool.query(`
      INSERT INTO invoice_extra_items (invoice_id, item_desc, item_amount, item_billing_month)
      VALUES ($1, $2, $3, $4)
    `, [invoiceId, itemDesc, itemAmount, nextMonthLabel]);

    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error appending itemized expense.");
  }
});

app.post('/delete-extra-item/:itemId', async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const selectedMonth = req.body.selectedMonth;
    await pool.query('DELETE FROM invoice_extra_items WHERE id = $1', [itemId]);
    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing itemized entry.");
  }
});

app.post('/collect-invoice-payment/:invoiceId', async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    const paymentAmount = Number(req.body.paymentAmount || 0);
    const selectedMonth = req.body.selectedMonth;

    await pool.query('UPDATE invoices SET amount_paid = COALESCE(amount_paid, 0) + $1 WHERE id = $2', [paymentAmount, invoiceId]);
    await pool.query('INSERT INTO payment_logs (invoice_id, amount_paid) VALUES ($1, $2)', [invoiceId, paymentAmount]);

    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error posting payment.");
  }
});

app.get('/tenants', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthLabel = `${nowIST.toLocaleDateString('en-IN', { month: 'short' })} ${nowIST.getFullYear()}`;
    const selectedMonth = req.query.month || currentMonthLabel;

    // Pull itemized logs active on *this month's invoice target*
    const allExtrasQuery = await pool.query(`
      SELECT * FROM invoice_extra_items WHERE invoice_id IN (SELECT id FROM invoices WHERE billing_month = $1)
    `, [selectedMonth]);
    const globalExtras = allExtrasQuery.rows;

    // Pull pending future logs recorded here, but designated for NEXT month's bill
    const pendingExtrasQuery = await pool.query(`
      SELECT * FROM invoice_extra_items WHERE invoice_id IN (SELECT id FROM invoices WHERE billing_month = $1) AND item_billing_month != $1
    `, [selectedMonth]);
    const globalPending = pendingExtrasQuery.rows;

    const statsCollected = await pool.query("SELECT SUM(COALESCE(amount_paid, 0)) FROM invoices WHERE billing_month = $1", [selectedMonth]);
    const statsOwed = await pool.query(`
      SELECT SUM(CASE WHEN (rent_charged + maintenance_charged + COALESCE(arrears_brought_forward,0) + COALESCE(extra_sum, 0)) > amount_paid THEN (rent_charged + maintenance_charged + COALESCE(arrears_brought_forward,0) + COALESCE(extra_sum, 0)) - amount_paid ELSE 0 END)
      FROM invoices
      LEFT JOIN (
        SELECT invoice_id, SUM(item_amount) as extra_sum FROM invoice_extra_items WHERE item_billing_month = $1 GROUP BY invoice_id
      ) extras ON invoices.id = extras.invoice_id
      WHERE invoices.billing_month = $1
    `, [selectedMonth]);

    const grossCollected = Number(statsCollected.rows[0].sum || 0);
    const grossOutstanding = Number(statsOwed.rows[0].sum || 0);

    const monthsDropdownResult = await pool.query('SELECT DISTINCT billing_month FROM invoices');
    const availableMonths = monthsDropdownResult.rows.map(r => r.billing_month);
    if (!availableMonths.includes(currentMonthLabel)) availableMonths.unshift(currentMonthLabel);
    if (!availableMonths.includes(selectedMonth)) availableMonths.push(selectedMonth);

    const ledgerResult = await pool.query(`
      SELECT invoices.id AS invoice_id, invoices.rent_charged, invoices.maintenance_charged, invoices.amount_paid, invoices.billing_month, invoices.arrears_brought_forward,
             tenants.id AS tenant_id, tenants.name, tenants.unit, tenants.father_name, tenants.phone, tenants.id_card_no, tenants.unit_area, tenants.security_deposit
      FROM invoices
      JOIN tenants ON invoices.tenant_id = tenants.id
      WHERE invoices.billing_month = $1
      ORDER BY invoices.id DESC
    `, [selectedMonth]);

    const logsResult = await pool.query('SELECT * FROM payment_logs ORDER BY payment_date DESC');
    const globalLogs = logsResult.rows;

    let tenantRows = '';
    ledgerResult.rows.forEach(row => {
      // Filter out items charging on THIS month statement
      const myActiveExtras = globalExtras.filter(item => item.invoice_id === row.invoice_id && item.item_billing_month === selectedMonth);
      const sumOfActiveExtras = myActiveExtras.reduce((sum, item) => sum + Number(item.item_amount), 0);

      // Filter out items logged now, but deferred to NEXT month
      const myPendingExtras = globalPending.filter(item => item.invoice_id === row.invoice_id);

      const baseRent = Number(row.rent_charged || 0);
      const maintenance = Number(row.maintenance_charged || 0);
      const arrears = Number(row.arrears_brought_forward || 0);
      
      const targetInvoice = baseRent + maintenance + arrears + sumOfActiveExtras;
      const remainingBalance = targetInvoice - Number(row.amount_paid);
      const clearIdString = String(row.id_card_no || '').replace(/'/g, "\\'");

      const fmtInvoice = targetInvoice.toLocaleString('en-IN');
      const fmtRent = baseRent.toLocaleString('en-IN');
      const fmtMaint = maintenance.toLocaleString('en-IN');
      const fmtArrears = arrears.toLocaleString('en-IN');
      const fmtPaid = Number(row.amount_paid).toLocaleString('en-IN');
      const fmtDeposit = Number(row.security_deposit || 0).toLocaleString('en-IN');

      let statusBadge = '';
      if (Number(row.amount_paid) === 0) {
        statusBadge = `<span class="badge badge-unpaid">Unpaid</span>`;
      } else if (remainingBalance > 0) {
        statusBadge = `<span class="badge badge-partial">Partial (₹${remainingBalance.toLocaleString('en-IN')} Due)</span>`;
      } else if (remainingBalance < 0) {
        statusBadge = `<span class="badge badge-advance">🔵 Credit Advance (₹${Math.abs(remainingBalance).toLocaleString('en-IN')})</span>`;
      } else {
        statusBadge = `<span class="badge badge-paid">Fully Paid</span>`;
      }

      const receiptButton = `<a href="/invoice/${row.invoice_id}" target="_blank" class="btn btn-info">📄 View Invoice</a>`;

      const paymentForm = `
        <form action="/collect-invoice-payment/${row.invoice_id}" method="POST" style="margin:0; display:flex; gap:6px;">
          <input type="hidden" name="selectedMonth" value="${selectedMonth}">
          <input type="number" name="paymentAmount" class="pay-input" placeholder="Amt (₹)" required>
          <button type="submit" class="btn btn-success">Pay</button>
        </form>
      `;

      const extraItemsInputForm = `
        <form action="/add-extra-item/${row.invoice_id}" method="POST" class="extra-charge-form">
          <input type="hidden" name="selectedMonth" value="${selectedMonth}">
          <div style="flex: 2;">
            <label style="color:#0369a1; font-size:11px; margin-bottom:2px;">🛠️ Log Work Now (Bills Next Month)</label>
            <input type="text" name="itemDesc" placeholder="e.g., Plumbing Repair" required style="width:100%;">
          </div>
          <div style="flex: 1;">
            <label style="color:#0369a1; font-size:11px; margin-bottom:2px;">Cost (₹)</label>
            <input type="number" name="itemAmount" placeholder="Price" required style="width:100%;">
          </div>
          <button type="submit" class="btn btn-primary" style="padding: 7px 12px; font-size:12px; background:#0284c7;">Log Repair</button>
        </form>
      `;

      let activeChargeTagsHTML = '';
      myActiveExtras.forEach(item => {
        activeChargeTagsHTML += `
          <div class="charge-tag" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534;">
            📋 <strong>[Billed] ${item.item_desc}:</strong> ₹${Number(item.item_amount).toLocaleString('en-IN')}
          </div>
        `;
      });

      let pendingChargeTagsHTML = '';
      myPendingExtras.forEach(item => {
        pendingChargeTagsHTML += `
          <div class="charge-tag" style="background:#eff6ff; border-color:#bfdbfe; color:#1e40af;">
            ⏳ <strong>[Next Month Bill] ${item.item_desc}:</strong> ₹${Number(item.item_amount).toLocaleString('en-IN')}
            <form action="/delete-extra-item/${item.id}" method="POST" style="display:inline; margin:0;" onsubmit="return confirm('Remove this pending charge?');">
              <input type="hidden" name="selectedMonth" value="${selectedMonth}">
              <button type="submit" class="charge-tag-delete">&times;</button>
            </form>
          </div>
        `;
      });

      let internalLogs = '';
      globalLogs.filter(l => l.invoice_id === row.invoice_id).forEach(l => {
        const cleanDate = new Date(l.payment_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
        internalLogs += `<div class="history-item"><span>➕ Paid: ₹${Number(l.amount_paid).toLocaleString('en-IN')}</span><span>📅 ${cleanDate}</span></div>`;
      });

      const searchMetadata = `${row.name} ${row.unit} ${row.phone} ${row.father_name}`;

      tenantRows += `
        <li class="tenant-item" data-search="${searchMetadata}">
          <div class="item-header">
            <div><strong>👤 ${row.name}</strong> — <span style="color:#2563eb; font-weight:600;">Unit ${row.unit}</span> ${statusBadge}</div>
            <div class="actions">${paymentForm} ${receiptButton}</div>
          </div>
          <div class="meta-grid">
            <div>💼 <strong>Father's Name:</strong> ${row.father_name}</div>
            <div>📞 <strong>Phone:</strong> ${row.phone}</div>
            <div>🔒 <strong>Aadhaar Number:</strong> <span id="id-container-${row.tenant_id}">•••• •••• ••••</span> <span class="reveal-link" onclick="toggleReveal('${row.tenant_id}', '${clearIdString}')">(Reveal)</span></div>
            <div>💰 <strong>Security Deposit:</strong> ₹${fmtDeposit}</div>
            <div>📐 <strong>Area:</strong> ${row.unit_area} Sq. Ft.</div>
            <div>📊 <strong>Month Assessment:</strong> Total Owed: ₹${fmtInvoice} (Rent: ₹${fmtRent} + Maint: ₹${fmtMaint} + Arrears: ₹${fmtArrears} + Active Repairs: ₹${sumOfActiveExtras.toLocaleString('en-IN')})</div>
          </div>
          
          ${arrears > 0 ? `<div style="font-size:12px; margin-top:6px; color:#991b1b; background:#fef2f2; padding:6px 10px; border-radius:4px; font-weight:600;">⚠️ Outstanding Arrears Brought Forward from Last Month: +₹${fmtArrears}</div>` : ''}
          
          <div class="charge-tag-list">
            ${activeChargeTagsHTML}
            ${pendingChargeTagsHTML}
          </div>
          
          <div style="font-size:13px; margin-top:8px; font-weight:600; color:#10b981;">Total Paid This Month: ₹${fmtPaid}</div>
          
          ${extraItemsInputForm}

          <div class="history-box">
            <span class="history-title">📜 Month Payment Audit Timeline</span>
            ${internalLogs || '<div style="font-size:11px; color:#94a3b8;">No transactions logged for this month statement pool.</div>'}
          </div>
        </li>
      `;
    });

    let dropdownOptions = '';
    availableMonths.sort((a, b) => new Date(b) - new Date(a));
    availableMonths.forEach(m => {
      dropdownOptions += `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${m}</option>`;
    });

    res.send(`<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container">
      <h1>
        <span>Monthly Financial Ledgers</span>
        <div style="font-size:14px; font-weight:normal;">
          <form method="GET" action="/tenants" style="margin:0; display:flex; align-items:center; gap:8px;">
            <label style="margin:0; white-space:nowrap;">Active Statement Month:</label>
            <select name="month" onchange="this.form.submit()" style="margin:0; padding:6px 12px; width:130px;">${dropdownOptions}</select>
          </form>
        </div>
      </h1>
      
      <div class="flex-stats">
        <div class="stat-card stat-card-paid"><small>Total Collected (${selectedMonth})</small><h2>₹${grossCollected.toLocaleString('en-IN')}</h2></div>
        <div class="stat-card stat-card-unpaid"><small>Outstanding Dues (${selectedMonth})</small><h2>₹${grossOutstanding.toLocaleString('en-IN')}</h2></div>
      </div>

      <div class="search-box">
        <input type="text" id="tenantSearch" onkeyup="filterTenants()" placeholder="Search by Tenant Name, Unit Number, Father's name, or Phone...">
      </div>

      <h3>Billing Ledger Roll - ${selectedMonth}</h3>
      <ul class="tenant-list">
        ${tenantRows || `<li class="tenant-item" style="color:#64748b; text-align:center;">No bills generated for ${selectedMonth} yet. Go back to Dashboard and select a cycle to generate.</li>`}
      </ul>
      <div style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:20px;"><a href="/" class="btn btn-secondary">← Back to Dashboard Input</a></div>
    </div></body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading monthly engine calculations.");
  }
});

app.get('/invoice/:invoiceId', async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    const invoiceQuery = await pool.query(`
      SELECT invoices.*, tenants.name, tenants.unit, tenants.father_name, tenants.phone 
      FROM invoices JOIN tenants ON invoices.tenant_id = tenants.id WHERE invoices.id = $1
    `, [invoiceId]);

    if (invoiceQuery.rows.length === 0) return res.status(404).send("Invoice Statement Not Found.");
    const inv = invoiceQuery.rows[0];
    
    // Select ONLY the extra items designated to print on THIS billing month statement sheet
    const extrasQuery = await pool.query('SELECT * FROM invoice_extra_items WHERE invoice_id = $1 AND item_billing_month = $2', [invoiceId, inv.billing_month]);
    const myActiveExtras = extrasQuery.rows;
    const sumOfExtras = myActiveExtras.reduce((sum, item) => sum + Number(item.item_amount), 0);

    const baseRent = Number(inv.rent_charged || 0);
    const maintenance = Number(inv.maintenance_charged || 0);
    const arrears = Number(inv.arrears_brought_forward || 0);
    const totalCharged = baseRent + maintenance + arrears + sumOfExtras;
    const balance = totalCharged - Number(inv.amount_paid);

    let itemizedRowsHTML = '';
    myActiveExtras.forEach(item => {
      itemizedRowsHTML += `
        <tr>
          <td>🛠️ Maintenance repair: ${item.item_desc}</td>
          <td style="text-align: right;">₹${Number(item.item_amount).toLocaleString('en-IN')}</td>
        </tr>
      `;
    });

    let arrearsRowHTML = '';
    if (arrears > 0) {
      arrearsRowHTML = `
        <tr style="color: #b91c1c; background: #fef2f2;">
          <td>⚠️ Unpaid Arrears Carried Forward from Past Month Balance</td>
          <td style="text-align: right; font-weight: 600;">₹${arrears.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - Unit ${inv.unit}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 50px; background: #f1f5f9; display: flex; justify-content: center; }
          .invoice-card { background: white; padding: 40px; border-radius: 8px; width: 100%; max-width: 650px; box-shadow: 0 4px 6px rgb(0 0 0 / 0.05); box-sizing: border-box; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
          .meta-text { text-align: right; font-size: 13px; color: #64748b; line-height: 1.5; }
          .bill-to { font-size: 14px; margin-bottom: 25px; color: #334155; line-height: 1.6; border-top: 2px solid #f1f5f9; border-bottom: 2px solid #f1f5f9; padding: 15px 0; }
          .item-table { width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 30px; }
          .item-table th { background: #f8fafc; padding: 12px; font-size: 13px; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
          .item-table td { padding: 12px; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; }
          .totals-box { text-align: right; font-size: 14px; color: #334155; line-height: 1.8; }
          .grand-total { font-size: 18px; font-weight: bold; color: #10b981; margin-top: 5px; }
          .print-btn { display: block; width: 100%; text-align: center; background: #0f172a; color: white; padding: 12px; font-weight: bold; border-radius: 6px; text-decoration: none; margin-top: 30px; font-size: 14px; cursor:pointer; border:none; }
          @media print { .print-btn { display: none; } body { background: white; padding: 0; } .invoice-card { box-shadow: none; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="invoice-card">
          <table class="header-table">
            <tr>
              <td class="title">Rent Invoice / Receipt</td>
              <td class="meta-text">
                <strong>Statement Month:</strong> ${inv.billing_month}<br>
                <strong>Invoice ID:</strong> #INV-00${inv.id}<br>
                <strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
            </tr>
          </table>

          <div class="bill-to">
            <strong>BILL TO:</strong><br>
            Tenant Name: ${inv.name}<br>
            Father's Name: ${inv.father_name}<br>
            Unit Number: Allocated Unit ${inv.unit}<br>
            Phone: +91 ${inv.phone}
          </div>

          <table class="item-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount Charged</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Base Rent Accommodation Charges</td>
                <td style="text-align: right;">₹${baseRent.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>Common Area Maintenance Expenses</td>
                <td style="text-align: right;">₹${maintenance.toLocaleString('en-IN')}</td>
              </tr>
              ${arrearsRowHTML}
              ${itemizedRowsHTML}
            </tbody>
          </table>

          <div class="totals-box">
            <div>Total Monthly Assessment Due: <strong>₹${totalCharged.toLocaleString('en-IN')}</strong></div>
            <div style="color: #10b981;">Total Amount Received Cleared: <strong>₹${Number(inv.amount_paid).toLocaleString('en-IN')}</strong></div>
            <div class="grand-total">${balance <= 0 ? 'STATUS: PAID ✅' : `REMAINING BALANCE DUE: ₹${balance.toLocaleString('en-IN')}`}</div>
          </div>

          <button class="print-btn" onclick="window.print()">🖨️ Print Invoice Statement / Save as PDF</button>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error compiling receipt print rendering schema.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});