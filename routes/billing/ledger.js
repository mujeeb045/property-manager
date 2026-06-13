// routes/billing/ledger.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// ========================
// This Month Collection
// ========================
router.get('/tenants', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthLabel = `${nowIST.toLocaleDateString('en-IN', { month: 'short' })} ${nowIST.getFullYear()}`;
    const selectedMonth = req.query.month || currentMonthLabel;
    const receiptLink = req.query.receipt;

    const ledger = await pool.query(`
      SELECT 
        tenants.id AS tenant_id,
        tenants.name,
        tenants.phone,
        COALESCE(units.unit_name, 'No Unit') as unit_name,
        COALESCE(units.rent_amount, 0) as rent_amount,
        COALESCE(units.maintenance_amount, 0) as maintenance_amount,
        COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE tenant_id = tenants.id 
          AND tran_type = 'Bill' 
          AND particular LIKE $1
        ), 0) as current_bill,
        COALESCE((
          SELECT STRING_AGG(particular || ': Rs.' || amount, '\n')
          FROM transactions 
          WHERE tenant_id = tenants.id 
          AND tran_type = 'Extra' 
          AND particular LIKE $1
        ), '') as extras_details,
        COALESCE((
          SELECT SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END)
          FROM transactions 
          WHERE tenant_id = tenants.id
        ), 0) as full_balance
      FROM tenants 
      LEFT JOIN units ON tenants.unit_id = units.id 
      WHERE tenants.is_active = true
      ORDER BY units.unit_name ASC
    `, [`%${selectedMonth}%`]);

    let tenantRows = '';

    ledger.rows.forEach(row => {
      const rent = Number(row.rent_amount || 0);
      const maintenance = Number(row.maintenance_amount || 0);
      const currentBill = Number(row.current_bill || 0);
      const fullBalance = Number(row.full_balance || 0);
      const extrasDetails = row.extras_details || '';

      let waText = `Rent Invoice - ${selectedMonth}\n\n`;
      waText += `Tenant: ${row.name}\n`;
      waText += `Unit: ${row.unit_name}\n\n`;

      waText += `Bill Details:\n`;
      waText += `• Base Rent        : Rs.${rent.toLocaleString('en-IN')}\n`;
      waText += `• Maintenance      : Rs.${maintenance.toLocaleString('en-IN')}\n`;

      if (extrasDetails) {
        waText += `• Extras:\n${extrasDetails}\n`;
      }

      waText += `──────────────────\n`;
      waText += `Total Due this month : Rs.${currentBill.toLocaleString('en-IN')}\n`;
      waText += `Current Balance      : Rs.${fullBalance.toLocaleString('en-IN')}\n\n`;

      waText += `Please pay by 10th of the month.\n`;
      waText += `Late payment charges of Rs.200 will apply after 10th.\n\n`;
      waText += `Thank you!`;

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
              <div class="text-sm text-gray-500">Total Balance</div>
              <div class="font-bold text-xl ${fullBalance > 0 ? 'text-red-600' : 'text-emerald-600'}">
                ₹${fullBalance.toLocaleString('en-IN')}
              </div>
            </div>

            <a href="${whatsappLink}" target="_blank" 
               class="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium">
              <i class="fab fa-whatsapp"></i> Send Bill
            </a>

            <form action="/collect-invoice-payment" method="POST" class="flex gap-2">
              <input type="hidden" name="tenant_id" value="${row.tenant_id}">
              <input type="hidden" name="selectedMonth" value="${selectedMonth}">
              <input type="number" name="paymentAmount" placeholder="₹" 
                     class="w-28 border border-gray-300 rounded-2xl px-4 py-3 text-center focus:outline-none" required>
              <select name="paymentMode" class="border border-gray-300 rounded-2xl px-3 py-3 text-sm">
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank</option>
              </select>
              <button type="submit" 
                      class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-medium">
                Receive
              </button>
            </form>
          </div>
        </div>
      `;
    });

    // At the end of the successful try block (around line 110-120)
    res.render('billing/ledger', {
      title: `This Month Collection - ${selectedMonth}`,
      selectedMonth,
      tenantRows: tenantRows || '<p class="text-center py-12 text-gray-500">No active tenants found.</p>',
      error: null
    });

  } catch (err) {
    console.error("Ledger Error:", err.message);
    res.status(500).render('billing/ledger', {
      title: 'This Month Collection',
      selectedMonth: '',
      tenantRows: '',
      error: `Error loading ledger: ${err.message}`
    });
  }
});

module.exports = router;