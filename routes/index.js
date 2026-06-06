const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// View Component Assemblers Import
const { wrapHTML } = require('../views/layout');
const renderHubView = require('../views/hub');
const renderUnitForm = require('../views/unitForm');
const renderTenantForm = require('../views/tenantForm');
const renderLedgerView = require('../views/ledger');
const renderInvoiceHTML = require('../views/invoiceTemplate');

const PREVIOUS_MONTH_MAP = {
  "Jan": "Dec", "Feb": "Jan", "Mar": "Feb", "Apr": "Mar", "May": "Apr", "Jun": "May",
  "Jul": "Jun", "Aug": "Jul", "Sep": "Aug", "Oct": "Sep", "Nov": "Oct", "Dec": "Nov"
};

// 1. Landing Dashboard Hub Route
router.get('/', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthShort = nowIST.toLocaleDateString('en-IN', { month: 'short' });
    const currentYear = nowIST.getFullYear();

    const countsQuery = await pool.query(`
      SELECT COUNT(*) as total_units, COUNT(CASE WHEN is_occupied = TRUE THEN 1 END) as occupied_units, COUNT(CASE WHEN is_occupied = FALSE THEN 1 END) as vacant_units FROM units
    `);
    
    const monthArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthOptionsHTML = '';
    monthArray.forEach(m => {
      monthOptionsHTML += `<option value="${m}" ${m === currentMonthShort ? 'selected' : ''}>${m}</option>`;
    });

    const body = renderHubView(countsQuery.rows[0], monthOptionsHTML, currentYear);
    res.send(wrapHTML(body));
  } catch (err) {
    console.error(err);
    res.status(500).send("Hub configuration reading error.");
  }
});

// 2. Add Unit Layout Form Page
router.get('/add-unit', async (req, res) => {
  try {
    const unitsListQuery = await pool.query('SELECT * FROM units ORDER BY unit_name ASC');
    let rowsHTML = '';
    unitsListQuery.rows.forEach(u => {
      const actionButton = u.is_occupied 
        ? `<span style="font-size:12px; color:#94a3b8; font-style:italic;">Cannot Delete (Occupied)</span>`
        : `<form action="/delete-unit/${u.id}" method="POST" style="margin:0; display:inline;" onsubmit="return confirm('Are you sure you want to permanently remove [${u.unit_name}] from your property assets database?');">
             <button type="submit" class="btn btn-danger" style="padding: 4px 8px; font-size:12px;">🗑️ Delete</button>
           </form>`;

      rowsHTML += `
        <tr style="font-size:14px; border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px; font-weight:600;">🏢 ${u.unit_name}</td>
          <td style="padding:10px;">${u.unit_area} Sqft</td>
          <td style="padding:10px; font-weight:600;">₹${Number(u.rent_amount).toLocaleString('en-IN')}</td>
          <td style="padding:10px;">₹${Number(u.maintenance_amount).toLocaleString('en-IN')}</td>
          <td style="padding:10px;">${u.is_occupied ? '<span class="badge badge-unpaid">Occupied</span>' : '<span class="badge badge-paid">Vacant</span>'}</td>
          <td style="padding:10px; text-align:right;">${actionButton}</td>
        </tr>
      `;
    });
    res.send(wrapHTML(renderUnitForm(rowsHTML)));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading assets layout forms.");
  }
});

router.post('/save-unit', async (req, res) => {
  try {
    const { unitName, unitArea, rentAmount, maintenanceAmount } = req.body;
    await pool.query('INSERT INTO units(unit_name, unit_area, rent_amount, maintenance_amount) VALUES($1,$2,$3,$4) ON CONFLICT(unit_name) DO UPDATE SET unit_area=$2, rent_amount=$3, maintenance_amount=$4', [unitName, unitArea||0, rentAmount||0, maintenanceAmount||0]);
    res.redirect('/add-unit');
  } catch (err) {
    console.error(err);
    res.status(500).send("Portion save database collision error.");
  }
});

router.post('/delete-unit/:unitId', async (req, res) => {
  try {
    const unitId = req.params.unitId;
    const checkQuery = await pool.query('SELECT is_occupied FROM units WHERE id = $1', [unitId]);
    if (checkQuery.rows.length > 0 && checkQuery.rows[0].is_occupied) {
      return res.status(400).send("Operation Rejected: You cannot delete an occupied unit.");
    }
    await pool.query('DELETE FROM units WHERE id = $1', [unitId]);
    res.redirect('/add-unit');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error wiping property portion record asset.");
  }
});

// 3. Allocate Vacant Unit Form Page
router.get('/register-tenant', async (req, res) => {
  try {
    const vacantUnits = await pool.query('SELECT id, unit_name, rent_amount, unit_area FROM units WHERE is_occupied=FALSE ORDER BY unit_name ASC');
    let optionsHTML = '';
    vacantUnits.rows.forEach(u => {
      optionsHTML += `<option value="${u.id}">${u.unit_name} — (Rent: ₹${Number(u.rent_amount).toLocaleString('en-IN')} | Area: ${u.unit_area} Sqft)</option>`;
    });
    res.send(wrapHTML(renderTenantForm(optionsHTML)));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error compiling assignment layouts.");
  }
});

router.post('/allocate-tenant', async (req, res) => {
  try {
    const { unitId, tenantName, fatherName, phone, altPhone, idCardNo, securityDeposit } = req.body;
    // Set is_active = TRUE explicitly upon profile creation
    await pool.query('INSERT INTO tenants (unit_id, name, father_name, phone, alt_phone, id_card_no, security_deposit, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)', [unitId, tenantName, fatherName, phone, altPhone||'N/A', idCardNo, securityDeposit||0]);
    await pool.query('UPDATE units SET is_occupied=TRUE WHERE id=$1', [unitId]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send("Allocation insert operation rejected.");
  }
});

// 4. Batch Invoice Process Generator (Generates bills ONLY for active occupants)
router.post('/generate-monthly-invoices', async (req, res) => {
  try {
    const { targetMonth, targetYear } = req.body;
    const billingMonth = `${targetMonth} ${targetYear}`;
    const prevMonthShort = PREVIOUS_MONTH_MAP[targetMonth];
    const prevYear = (targetMonth === "Jan") ? Number(targetYear) - 1 : targetYear;
    const previousMonthLabel = `${prevMonthShort} ${prevYear}`;

    // Filter by is_active = TRUE so departed records don't get new recurring statements
    const activeTenants = await pool.query('SELECT tenants.id as tenant_id, units.rent_amount, units.maintenance_amount FROM tenants JOIN units ON tenants.unit_id = units.id WHERE tenants.is_active = TRUE');
    
    for (let t of activeTenants.rows) {
      let carriedBalance = 0;
      const prevInvoice = await pool.query('SELECT invoices.id, invoices.rent_charged, invoices.maintenance_charged, invoices.amount_paid, invoices.arrears_brought_forward, COALESCE(extras.extra_sum, 0) as item_extras FROM invoices LEFT JOIN (SELECT invoice_id, SUM(item_amount) as extra_sum FROM invoice_extra_items WHERE item_billing_month = $1 GROUP BY invoice_id) extras ON invoices.id = extras.invoice_id WHERE invoices.tenant_id = $2 AND invoices.billing_month = $1', [previousMonthLabel, t.tenant_id]);

      if (prevInvoice.rows.length > 0) {
        const p = prevInvoice.rows[0];
        carriedBalance = (Number(p.rent_charged) + Number(p.maintenance_charged) + Number(p.arrears_brought_forward) + Number(p.item_extras)) - Number(p.amount_paid);
      }

      const currentInvoice = await pool.query('INSERT INTO invoices (tenant_id, billing_month, rent_charged, maintenance_charged, amount_paid, arrears_brought_forward) VALUES ($1,$2,$3,$4,0,$5) ON CONFLICT(tenant_id, billing_month) DO UPDATE SET arrears_brought_forward=$5 RETURNING id', [t.tenant_id, billingMonth, t.rent_amount, t.maintenance_amount, carriedBalance]);
      
      if (prevInvoice.rows.length > 0) {
        await pool.query('UPDATE invoice_extra_items SET invoice_id = $1 WHERE invoice_id = $2 AND item_billing_month = $3', [currentInvoice.rows[0].id, prevInvoice.rows[0].id, billingMonth]);
      }
    }
    res.redirect('/tenants?month=' + encodeURIComponent(billingMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error compiling cycle generations.");
  }
});

// 5. Add / Delete Itemized Ad-hoc Repairs
router.post('/add-extra-item/:invoiceId', async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    const { itemDesc, itemAmount, selectedMonth } = req.body;
    const parts = selectedMonth.split(' ');
    const monthArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let nextIndex = (monthArray.indexOf(parts[0]) + 1) % 12;
    let nextYear = (parts[0] === "Dec") ? Number(parts[1]) + 1 : parts[1];
    const nextMonthLabel = `${monthArray[nextIndex]} ${nextYear}`;

    await pool.query('INSERT INTO invoice_extra_items (invoice_id, item_desc, item_amount, item_billing_month) VALUES ($1,$2,$3,$4)', [invoiceId, itemDesc, Number(itemAmount||0), nextMonthLabel]);
    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error appending item lines.");
  }
});

router.post('/delete-extra-item/:itemId', async (req, res) => {
  try {
    const { selectedMonth } = req.body;
    await pool.query('DELETE FROM invoice_extra_items WHERE id = $1', [req.params.itemId]);
    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error clearing item fields.");
  }
});

// 6. Post Payments Action
router.post('/collect-invoice-payment/:invoiceId', async (req, res) => {
  try {
    const { paymentAmount, selectedMonth } = req.body;
    await pool.query('UPDATE invoices SET amount_paid = COALESCE(amount_paid, 0) + $1 WHERE id = $2', [Number(paymentAmount||0), req.params.invoiceId]);
    await pool.query('INSERT INTO payment_logs (invoice_id, amount_paid) VALUES ($1,$2)', [req.params.invoiceId, Number(paymentAmount||0)]);
    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error posting transaction ledger logs.");
  }
});

// 7. Core Ledger Roll View Sheet (Altered with LEFT JOIN to pull departed history perfectly)
router.get('/tenants', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthLabel = `${nowIST.toLocaleDateString('en-IN', { month: 'short' })} ${nowIST.getFullYear()}`;
    const selectedMonth = req.query.month || currentMonthLabel;

    const allExtras = await pool.query('SELECT * FROM invoice_extra_items WHERE invoice_id IN (SELECT id FROM invoices WHERE billing_month = $1)', [selectedMonth]);
    const pendingExtras = await pool.query('SELECT * FROM invoice_extra_items WHERE invoice_id IN (SELECT id FROM invoices WHERE billing_month = $1) AND item_billing_month != $1', [selectedMonth]);
    const statsCollected = await pool.query("SELECT SUM(COALESCE(amount_paid, 0)) FROM invoices WHERE billing_month = $1", [selectedMonth]);
    const statsOwed = await pool.query(`SELECT SUM(CASE WHEN (rent_charged + maintenance_charged + COALESCE(arrears_brought_forward,0) + COALESCE(extra_sum, 0)) > amount_paid THEN (rent_charged + maintenance_charged + COALESCE(arrears_brought_forward,0) + COALESCE(extra_sum, 0)) - amount_paid ELSE 0 END) FROM invoices LEFT JOIN (SELECT invoice_id, SUM(item_amount) as extra_sum FROM invoice_extra_items WHERE item_billing_month = $1 GROUP BY invoice_id) extras ON invoices.id = extras.invoice_id WHERE invoices.billing_month = $1`, [selectedMonth]);

    const monthsDropdown = await pool.query('SELECT DISTINCT billing_month FROM invoices');
    const availableMonths = monthsDropdown.rows.map(r => r.billing_month);
    if (!availableMonths.includes(currentMonthLabel)) availableMonths.unshift(currentMonthLabel);
    if (!availableMonths.includes(selectedMonth)) availableMonths.push(selectedMonth);

    // CRITICAL FIX: Changed to LEFT JOIN on units so that if a tenant moved out and unit_id became null, their past statements still display their layout criteria!
    const ledger = await pool.query(`
      SELECT invoices.id AS invoice_id, invoices.rent_charged, invoices.maintenance_charged, invoices.amount_paid, invoices.billing_month, invoices.arrears_brought_forward, 
             tenants.id AS tenant_id, tenants.name, tenants.father_name, tenants.phone, tenants.id_card_no, tenants.security_deposit, tenants.is_active,
             COALESCE(units.unit_name, 'Departed History Archive') as unit_name, COALESCE(units.unit_area, 0) as unit_area 
      FROM invoices 
      JOIN tenants ON invoices.tenant_id = tenants.id 
      LEFT JOIN units ON tenants.unit_id = units.id 
      WHERE invoices.billing_month = $1 
      ORDER BY units.unit_name ASC
    `, [selectedMonth]);
    
    const globalLogs = await pool.query('SELECT * FROM payment_logs ORDER BY payment_date DESC');

    let tenantRows = '';
    ledger.rows.forEach(row => {
      const activeItems = allExtras.rows.filter(i => i.invoice_id === row.invoice_id && i.item_billing_month === selectedMonth);
      const sumActive = activeItems.reduce((s, i) => s + Number(i.item_amount), 0);
      const pendingItems = pendingExtras.rows.filter(i => i.invoice_id === row.invoice_id);

      const baseRent = Number(row.rent_charged||0);
      const maintenance = Number(row.maintenance_charged||0);
      const arrears = Number(row.arrears_brought_forward||0);
      const targetInvoice = baseRent + maintenance + arrears + sumActive;
      const remainingBalance = targetInvoice - Number(row.amount_paid);

      let statusBadge = '';
      if (!row.is_active) {
        statusBadge = `<span class="badge" style="background:#e2e8f0; color:#475569;">🛑 Left Property (Archived Log)</span>`;
      } else if (remainingBalance < 0) {
        statusBadge = `<span class="badge badge-advance">🔵 Credit Advance (₹${Math.abs(remainingBalance).toLocaleString('en-IN')})</span>`;
      } else if (remainingBalance === 0) {
        statusBadge = `<span class="badge badge-paid">Fully Paid</span>`;
      } else if (Number(row.amount_paid) === 0 && arrears >= 0) {
        statusBadge = `<span class="badge badge-unpaid">Unpaid</span>`;
      } else {
        statusBadge = `<span class="badge badge-partial">Partial (₹${remainingBalance.toLocaleString('en-IN')} Due)</span>`;
      }

      let tagsHTML = '';
      activeItems.forEach(i => { tagsHTML += `<div class="charge-tag" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534;">📋 [Billed] ${i.item_desc}: ₹${Number(i.item_amount).toLocaleString('en-IN')}</div>`; });
      
      if (row.is_active) {
        pendingItems.forEach(i => { tagsHTML += `<div class="charge-tag" style="background:#eff6ff; border-color:#bfdbfe; color:#1e40af;">⏳ [Next Month Bill] ${i.item_desc}: ₹${Number(i.item_amount).toLocaleString('en-IN')}<form action="/delete-extra-item/${i.id}" method="POST" style="display:inline; margin:0;"><input type="hidden" name="selectedMonth" value="${selectedMonth}"><button type="submit" class="charge-tag-delete">&times;</button></form></div>`; });
      }

      let internalLogs = '';
      globalLogs.rows.filter(l => l.invoice_id === row.invoice_id).forEach(l => {
        internalLogs += `<div class="history-item"><span>➕ Paid: ₹${Number(l.amount_paid).toLocaleString('en-IN')}</span><span>📅 ${new Date(l.payment_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>`;
      });

      let alertHTML = arrears > 0 ? `<div style="font-size:12px; margin-top:6px; color:#991b1b; background:#fef2f2; padding:6px 10px; border-radius:4px; font-weight:600;">⚠️ Outstanding Arrears Carried Forward: +₹${arrears.toLocaleString('en-IN')}</div>` : (arrears < 0 ? `<div style="font-size:12px; margin-top:6px; color:#0369a1; background:#f0f9ff; padding:6px 10px; border-radius:4px; font-weight:600;">🔵 Advance Credit Applied: -₹${Math.abs(arrears).toLocaleString('en-IN')}</div>` : '');

      // Hide next-month repair logging forms if the tenant has already moved out
      const repairFormHTML = row.is_active ? `
        <form action="/add-extra-item/${row.invoice_id}" method="POST" class="extra-charge-form">
          <input type="hidden" name="selectedMonth" value="${selectedMonth}">
          <div style="flex:2;"><label style="color:#0369a1; font-size:11px;">🛠️ Log Work Now (Bills Next Month)</label><input type="text" name="itemDesc" placeholder="e.g. Plumbing Repair" required style="width:100%;"></div>
          <div style="flex:1;"><label style="color:#0369a1; font-size:11px;">Cost (₹)</label><input type="number" name="itemAmount" placeholder="Price" required style="width:100%;"></div>
          <button type="submit" class="btn btn-primary" style="padding: 7px 12px; font-size:12px; background:#0284c7;">Log Repair</button>
        </form>
      ` : '';

      tenantRows += `
        <li class="tenant-item" data-search="${row.name} ${row.unit_name} ${row.phone}">
          <div class="item-header">
            <div><strong>👤 ${row.name}</strong> — <span style="color:#2563eb; font-weight:600;">Portion ${row.unit_name}</span> ${statusBadge}</div>
            <div class="actions">
              <form action="/collect-invoice-payment/${row.invoice_id}" method="POST" style="margin:0; display:flex; gap:6px;">
                <input type="hidden" name="selectedMonth" value="${selectedMonth}">
                <input type="number" name="paymentAmount" class="pay-input" placeholder="Amt (₹)" required>
                <button type="submit" class="btn btn-success">Pay</button>
              </form>
              <a href="/invoice/${row.invoice_id}" target="_blank" class="btn btn-info">📄 View Invoice</a>
            </div>
          </div>
          <div class="meta-grid">
            <div>💼 <strong>Father's Name:</strong> ${row.father_name}</div>
            <div>📞 <strong>Phone:</strong> ${row.phone}</div>
            <div>🔒 <strong>Aadhaar:</strong> <span id="id-container-${row.tenant_id}">•••• •••• ••••</span> <span class="reveal-link" onclick="toggleReveal('${row.tenant_id}', '${String(row.id_card_no).replace(/'/g, "\\'")}')">(Reveal)</span></div>
            <div>💰 <strong>Security Deposit:</strong> ₹${Number(row.security_deposit).toLocaleString('en-IN')}</div>
            <div>📐 <strong>Area:</strong> ${row.unit_area} Sqft</div>
            <div>📊 <strong>Assessment:</strong> Total: ₹${targetInvoice.toLocaleString('en-IN')} (Rent: ₹${baseRent.toLocaleString('en-IN')} + Maint: ₹${maintenance.toLocaleString('en-IN')} + Rollover: ₹${arrears.toLocaleString('en-IN')})</div>
          </div>
          ${alertHTML}
          ${tagsHTML ? `<div class="charge-tag-list">${tagsHTML}</div>` : ''}
          <div style="font-size:13px; margin-top:8px; font-weight:600; color:#10b981;">Total Paid This Month: ₹${Number(row.amount_paid).toLocaleString('en-IN')}</div>
          ${repairFormHTML}
          <div class="history-box"><span class="history-title">📜 Month Payment Audit Timeline</span>${internalLogs || '<div style="font-size:11px; color:#94a3b8;">No transactions logged.</div>'}</div>
        </li>
      `;
    });

    let dropdownOptions = '';
    availableMonths.sort((a,b) => new Date(b) - new Date(a));
    availableMonths.forEach(m => { dropdownOptions += `<option value="${m}" ${m===selectedMonth?'selected':''}>${m}</option>`; });

    res.send(wrapHTML(renderLedgerView(selectedMonth, Number(statsCollected.rows[0].sum||0), Number(statsOwed.rows[0].sum||0), dropdownOptions, tenantRows)));
  } catch (err) {
    console.error(err);
    res.status(500).send("Ledger processing engine crash.");
  }
});

// 8. Printable Statement Invoice Route Handler
router.get('/invoice/:invoiceId', async (req, res) => {
  try {
    const invoiceQuery = await pool.query(`
      SELECT invoices.*, tenants.name, tenants.father_name, tenants.phone, COALESCE(units.unit_name, 'Departed Archive') as unit_name 
      FROM invoices 
      JOIN tenants ON invoices.tenant_id = tenants.id 
      LEFT JOIN units ON tenants.unit_id = units.id 
      WHERE invoices.id = $1
    `, [req.params.invoiceId]);
    
    if (invoiceQuery.rows.length === 0) return res.status(404).send("Invoice Statement Not Found.");
    const inv = invoiceQuery.rows[0];

    const myActiveExtras = await pool.query('SELECT * FROM invoice_extra_items WHERE invoice_id = $1 AND item_billing_month = $2', [req.params.invoiceId, inv.billing_month]);
    const sumExtras = myActiveExtras.rows.reduce((s, i) => s + Number(i.item_amount), 0);

    const baseRent = Number(inv.rent_charged||0);
    const maintenance = Number(inv.maintenance_charged||0);
    const arrears = Number(inv.arrears_brought_forward||0);
    const totalCharged = baseRent + maintenance + arrears + sumExtras;

    let rowsHTML = '';
    myActiveExtras.rows.forEach(i => { rowsHTML += `<tr><td>🛠️ Maintenance repair: ${i.item_desc}</td><td style="text-align: right;">₹${Number(i.item_amount).toLocaleString('en-IN')}</td></tr>`; });

    let rolloverRowHTML = arrears > 0 ? `<tr><td>⚠️ Unpaid Arrears Carried Forward</td><td style="text-align: right; font-weight:600;">₹${arrears.toLocaleString('en-IN')}</td></tr>` : (arrears < 0 ? `<tr><td>🔵 Advance Credit Applied</td><td style="text-align: right; font-weight:600;">-₹${Math.abs(arrears).toLocaleString('en-IN')}</td></tr>` : '');

    res.send(renderInvoiceHTML(inv, baseRent, maintenance, arrears, totalCharged, (totalCharged - Number(inv.amount_paid)), rowsHTML, rolloverRowHTML));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading printable invoice layouts.");
  }
});

// 9. Profile Record Management Page (Filters down to show only ACTIVE occupants)
router.get('/manage-profiles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tenants.*, units.unit_name, units.rent_amount, units.maintenance_amount, units.unit_area 
      FROM tenants 
      JOIN units ON tenants.unit_id = units.id 
      WHERE tenants.is_active = TRUE 
      ORDER BY units.unit_name ASC
    `);
    
    let rowsHTML = '';
    result.rows.forEach(t => {
      rowsHTML += `
        <li class="tenant-item" style="margin-bottom:12px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>👤 ${t.name}</strong> — <span style="color:#2563eb; font-weight:600;">Unit ${t.unit_name}</span> (${t.unit_area} Sqft)
              <div style="font-size:13px; color:#64748b; margin-top:4px;">Father: ${t.father_name} | Phone: +91 ${t.phone} | Rent: ₹${Number(t.rent_amount).toLocaleString('en-IN')}<br>Aadhaar: <span id="id-container-${t.id}">•••• •••• ••••</span> <span class="reveal-link" onclick="toggleReveal('${t.id}', '${String(t.id_card_no).replace(/'/g, "\\'")}')">(Reveal)</span></div>
            </div>
            <form action="/delete-tenant/${t.id}/${t.unit_id}" method="POST" style="margin:0;"><button type="submit" class="btn btn-danger">🗑️ Move Out</button></form>
          </div>
        </li>
      `;
    });
    
    const wrapperHTML = `
      <h1><span>📋 Manage Profiles Record</span><a href="/" class="btn btn-secondary" style="padding:6px 14px; font-size:13px;">← Main Hub</a></h1>
      <ul class="tenant-list" style="margin-top:20px;">${rowsHTML || '<li class="tenant-item" style="text-align:center; padding:30px; color:#64748b;">No active profile occupants.</li>'}</ul>
    `;
    res.send(wrapHTML(wrapperHTML));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error compiling profile lists.");
  }
});

// UPGRADED MOVE-OUT LOGIC ROUTER: Soft-archives the tenant instead of destroying rows
router.post('/delete-tenant/:id/:unitId', async (req, res) => {
  try {
    const tenantId = req.params.id;
    const unitId = req.params.unitId;

    // 1. Mark tenant as inactive and un-link them from the physical room layout asset
    await pool.query('UPDATE tenants SET is_active = FALSE, unit_id = NULL WHERE id = $1', [tenantId]);
    
    // 2. Open the room asset container back up to vacancy instantly
    await pool.query('UPDATE units SET is_occupied = FALSE WHERE id = $1', [unitId]);
    
    res.redirect('/manage-profiles');
  } catch (err) {
    console.error(err);
    res.status(500).send("Profile archiving move-out operations failed.");
  }
});

module.exports = router;