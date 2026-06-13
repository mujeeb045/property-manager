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

    // Updated query for multiple units support
    const ledger = await pool.query(`
      SELECT 
        t.id AS tenant_id,
        t.name,
        t.phone,

        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'unit_name', u.unit_name,
              'rent', u.rent_amount,
              'maintenance', u.maintenance_amount
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as units_data,

        COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE tenant_id = t.id 
            AND tran_type = 'Bill' 
            AND particular LIKE $1
        ), 0) as current_bill,

        COALESCE((
          SELECT STRING_AGG(particular || ': Rs.' || amount, '\n')
          FROM transactions 
          WHERE tenant_id = t.id 
            AND tran_type = 'Extra' 
            AND particular LIKE $1
        ), '') as extras_details,

        COALESCE((
          SELECT SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END)
          FROM transactions 
          WHERE tenant_id = t.id
        ), 0) as full_balance

      FROM tenants t
      LEFT JOIN tenant_units tu ON tu.tenant_id = t.id AND tu.is_active = true
      LEFT JOIN units u ON tu.unit_id = u.id
      WHERE t.is_active = true
      GROUP BY t.id, t.name, t.phone
      ORDER BY t.name ASC
    `, [`%${selectedMonth}%`]);

    let tenantRows = '';

    ledger.rows.forEach(row => {
      const units = row.units_data || [];
      const extrasDetails = row.extras_details || '';

      // Calculate totals
      let totalRent = 0;
      let totalMaintenance = 0;

      units.forEach(unit => {
        totalRent += Number(unit.rent) || 0;
        totalMaintenance += Number(unit.maintenance) || 0;
      });

      const currentBill = Number(row.current_bill) || 0;
      const fullBalance = Number(row.full_balance) || 0;

      // ==================== WHATSAPP MESSAGE ====================
      let waText = `Rent Invoice - ${selectedMonth}\n\n`;
      waText += `Tenant: ${row.name}\n`;
      waText += `Units: ${units.map(u => u.unit_name).join(', ')}\n\n`;

      waText += `Bill Details:\n`;

      units.forEach(unit => {
        const rent = Number(unit.rent) || 0;
        const maintenance = Number(unit.maintenance) || 0;

        waText += `• ${unit.unit_name}\n`;
        waText += `   - Rent        : Rs.${rent.toLocaleString('en-IN')}\n`;
        waText += `   - Maintenance : Rs.${maintenance.toLocaleString('en-IN')}\n\n`;
      });

      if (extrasDetails) {
        waText += `Extras:\n${extrasDetails}\n\n`;
      }

      waText += `────────────────────\n`;
      waText += `Total Due this month : Rs.${currentBill.toLocaleString('en-IN')}\n`;
      waText += `Current Balance      : Rs.${fullBalance.toLocaleString('en-IN')}\n\n`;

      waText += `Please pay by 10th of the month.\n`;
      waText += `Late payment charges of Rs.200 will apply after 10th.\n\n`;
      waText += `Thank you!`;
      // ========================================================

      const cleanPhone = String(row.phone || '').replace(/\D/g, '');
      const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waText)}` : '#';

      // Tenant Card
      tenantRows += `
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex-1">
              <strong class="text-lg">👤 ${row.name}</strong>
              <span class="text-gray-500 ml-2">(${units.map(u => u.unit_name).join(', ')})</span>
              <div class="text-sm text-gray-600 mt-1">
                ${row.phone ? '+91 ' + row.phone : 'No phone'}
              </div>
            </div>

            <div class="flex flex-col sm:items-end gap-3">
              <div class="text-right">
                <div class="text-xs text-gray-500">Total Balance</div>
                <div class="font-bold text-2xl ${fullBalance > 0 ? 'text-red-600' : 'text-emerald-600'}">
                  ₹${fullBalance.toLocaleString('en-IN')}
                </div>
              </div>

              <div class="flex gap-2">
                <a href="${whatsappLink}" target="_blank" 
                   class="bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium">
                  📱 WhatsApp
                </a>

                <form action="/collect-invoice-payment" method="POST" class="flex gap-2">
                  <input type="hidden" name="tenant_id" value="${row.tenant_id}">
                  <input type="hidden" name="selectedMonth" value="${selectedMonth}">
                  <input type="number" name="paymentAmount" placeholder="₹" 
                         class="w-24 border border-gray-300 rounded-2xl px-4 py-3 text-sm" required>
                  <select name="paymentMode" class="border border-gray-300 rounded-2xl px-3 py-3 text-sm">
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank</option>
                  </select>
                  <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-medium">
                    Receive
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      `;
    });

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