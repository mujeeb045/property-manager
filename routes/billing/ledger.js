const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../../config/db');
const { wrapHTML } = require('../../views/layout');

// This Month Collection (Main Ledger)
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
          <h1 class="text-3xl font-bold">This Month Collection</h1>
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

module.exports = router;