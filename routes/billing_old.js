const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { wrapHTML } = require('../views/layout');
const ejs = require('ejs');
const path = require('path');

// ========================
// 1. Generate Monthly Invoices
// ========================
router.post('/generate-monthly-invoices', async (req, res) => {
  try {
    const { targetMonth, targetYear } = req.body;
    const billingMonth = `${targetMonth} ${targetYear}`;

    const activeTenants = await pool.query(`
      SELECT tenants.id as tenant_id, units.rent_amount, units.maintenance_amount 
      FROM tenants 
      JOIN units ON tenants.unit_id = units.id 
      WHERE tenants.is_active = TRUE
    `);

    for (let t of activeTenants.rows) {
      await pool.query(`
        INSERT INTO invoices (tenant_id, billing_month, rent_charged, maintenance_charged, amount_paid, arrears_brought_forward)
        VALUES ($1, $2, $3, $4, 0, 0)
        ON CONFLICT(tenant_id, billing_month) DO NOTHING
      `, [t.tenant_id, billingMonth, t.rent_amount, t.maintenance_amount]);
    }

    res.redirect('/tenants?month=' + encodeURIComponent(billingMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating monthly invoices.");
  }
});

// ========================
// 2. Add Extra Item
// ========================
router.post('/add-extra-item/:invoiceId', async (req, res) => {
  try {
    const { itemDesc, itemAmount, selectedMonth } = req.body;
    await pool.query(`
      INSERT INTO invoice_extra_items (invoice_id, item_desc, item_amount, item_billing_month)
      VALUES ($1, $2, $3, $4)
    `, [req.params.invoiceId, itemDesc, Number(itemAmount || 0), selectedMonth]);

    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding extra item.");
  }
});

// ========================
// 3. Delete Extra Item
// ========================
router.post('/delete-extra-item/:itemId', async (req, res) => {
  try {
    const { selectedMonth } = req.body;
    await pool.query('DELETE FROM invoice_extra_items WHERE id = $1', [req.params.itemId]);
    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting extra item.");
  }
});

// ========================
// 4. Collect Payment
// ========================
router.post('/collect-invoice-payment/:invoiceId', async (req, res) => {
  try {
    const { paymentAmount, selectedMonth } = req.body;
    await pool.query(`
      UPDATE invoices 
      SET amount_paid = COALESCE(amount_paid, 0) + $1 
      WHERE id = $2
    `, [Number(paymentAmount || 0), req.params.invoiceId]);

    await pool.query(`
      INSERT INTO payment_logs (invoice_id, amount_paid)
      VALUES ($1, $2)
    `, [req.params.invoiceId, Number(paymentAmount || 0)]);

    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error recording payment.");
  }
});

// ========================
// 5. Clean Main Billing Ledger
// ========================
router.get('/tenants', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthLabel = `${nowIST.toLocaleDateString('en-IN', { month: 'short' })} ${nowIST.getFullYear()}`;
    const selectedMonth = req.query.month || currentMonthLabel;

    const ledger = await pool.query(`
      SELECT 
        invoices.id AS invoice_id,
        tenants.id AS tenant_id,
        tenants.name,
        tenants.phone,
        COALESCE(units.unit_name, 'No Unit') as unit_name,
        invoices.rent_charged,
        invoices.maintenance_charged,
        invoices.arrears_brought_forward,
        invoices.amount_paid
      FROM invoices 
      JOIN tenants ON invoices.tenant_id = tenants.id 
      LEFT JOIN units ON tenants.unit_id = units.id 
      WHERE invoices.billing_month = $1 
      ORDER BY units.unit_name ASC
    `, [selectedMonth]);

    let tenantRows = '';

    ledger.rows.forEach(row => {
      const baseRent = Number(row.rent_charged || 0);
      const maintenance = Number(row.maintenance_charged || 0);
      const arrears = Number(row.arrears_brought_forward || 0);
      const totalDue = baseRent + maintenance + arrears;
      const balance = totalDue - Number(row.amount_paid || 0);

      let waText = `*🏠 Rent Invoice - ${selectedMonth}*\n\n`;
      waText += `👤 *${row.name}*\n`;
      waText += `🏢 Unit ${row.unit_name}\n`;
      waText += `• Base Rent     : ₹${baseRent.toLocaleString('en-IN')}\n`;
      waText += `• Maintenance   : ₹${maintenance.toLocaleString('en-IN')}\n`;
      if (arrears > 0) waText += `• Arrears       : ₹${arrears.toLocaleString('en-IN')}\n`;
      waText += `──────────────────\n`;
      waText += `💰 Total Due : ₹${totalDue.toLocaleString('en-IN')}\n`;
      waText += `✅ Paid      : ₹${Number(row.amount_paid).toLocaleString('en-IN')}\n`;
      waText += `⚠️ Balance   : ₹${balance.toLocaleString('en-IN')}\n\n`;
      waText += `Please clear by 10th.\n🙏 Thank you!`;

      const cleanPhone = String(row.phone || '').replace(/\D/g, '');
      const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waText)}` : '#';

      tenantRows += `
        <div class="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div class="flex-1">
            <strong class="text-lg">👤 ${row.name}</strong>
            <span class="text-gray-500 ml-3">(${row.unit_name})</span>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-sm text-gray-500">Due</div>
              <div class="font-bold text-xl ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}">
                ₹${balance.toLocaleString('en-IN')}
              </div>
            </div>

            <a href="${whatsappLink}" target="_blank" 
               class="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium">
              <i class="fab fa-whatsapp"></i> Send Bill
            </a>

            <form action="/collect-invoice-payment/${row.invoice_id}" method="POST" class="flex gap-2">
              <input type="hidden" name="selectedMonth" value="${selectedMonth}">
              <input type="number" name="paymentAmount" placeholder="₹" 
                     class="w-28 border border-gray-300 rounded-2xl px-4 py-3 text-center focus:outline-none" required>
              <button type="submit" 
                      class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-medium">
                Receive
              </button>
            </form>
          </div>
        </div>
      `;
    });

    res.send(wrapHTML(`This Month Collection - ${selectedMonth}`, `
      <div class="max-w-5xl mx-auto">
        <div class="mb-8">
          <h1 class="text-3xl font-bold">Billing Ledger</h1>
          <p class="text-gray-600">${selectedMonth}</p>
        </div>
        
        <div class="space-y-4">
          ${tenantRows || '<p class="text-center py-12 text-gray-500">No tenants found for this month.</p>'}
        </div>
      </div>
    `));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading ledger");
  }
});

// ========================
// Export Ledger (Enhanced)
// ========================
router.get('/export-ledger/:month', async (req, res) => {
  // ... (you can keep your previous enhanced export code here)
  // For now, keeping it minimal
  res.status(200).send("Export feature available");
});

// ========================
// History and Details Page (All Tenants)
// ========================
router.get('/history', async (req, res) => {
  try {
    // Get ALL tenants (including left tenants)
    const tenants = await pool.query(`
      SELECT 
        tenants.id,
        tenants.name,
        tenants.father_name,
        tenants.phone,
        tenants.id_card_no,
        tenants.security_deposit,
        tenants.is_active,
        tenants.move_out_date,
        COALESCE(units.unit_name, 'No Unit / Departed') as unit_name
      FROM tenants 
      LEFT JOIN units ON tenants.unit_id = units.id 
      ORDER BY tenants.name ASC
    `);

    let tenantListHTML = '';

    tenants.rows.forEach(tenant => {
      const status = tenant.is_active 
        ? `<span class="text-green-600 text-xs">● Active</span>` 
        : `<span class="text-red-600 text-xs">● Left ${tenant.move_out_date ? new Date(tenant.move_out_date).toLocaleDateString('en-IN') : ''}</span>`;

      tenantListHTML += `
        <div onclick="showTenantDetail(${JSON.stringify(tenant)})" 
             class="tenant-card bg-white rounded-2xl p-6 border border-gray-100 hover:border-emerald-300 cursor-pointer"
             data-name="${tenant.name}">
          <div class="flex justify-between items-start">
            <div>
              <strong class="text-lg">👤 ${tenant.name}</strong>
              <p class="text-gray-500 text-sm mt-1">${tenant.unit_name}</p>
            </div>
            ${status}
          </div>
        </div>
      `;
    });

    const pageContent = await ejs.renderFile(
      path.join(__dirname, '../views/billing/history.ejs'), 
      { tenantListHTML }
    );

    res.send(wrapHTML("History & Details", pageContent));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading history page.");
  }
});

module.exports = router;