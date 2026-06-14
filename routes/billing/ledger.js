// routes/billing/ledger.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.get('/tenants', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthLabel = `${nowIST.toLocaleDateString('en-IN', { month: 'short' })} ${nowIST.getFullYear()}`;
    const selectedMonth = req.query.month || currentMonthLabel;

    // Get tenants with units
    const tenantsData = await pool.query(`
      SELECT 
        t.id as tenant_id,
        t.name,
        t.phone,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'unit_id', u.id,
            'unit_name', u.unit_name,
            'rent', u.rent_amount,
            'maintenance', u.maintenance_amount
          )
        ) as units
      FROM tenants t
      LEFT JOIN tenant_units tu ON tu.tenant_id = t.id AND tu.is_active = TRUE
      LEFT JOIN units u ON tu.unit_id = u.id
      WHERE t.is_active = TRUE
      GROUP BY t.id, t.name, t.phone
      ORDER BY t.name ASC
    `);

    // Get extras for current month
    const extrasData = await pool.query(`
      SELECT tenant_id, unit_id, SUM(amount) as extra_amount
      FROM transactions 
      WHERE tran_type = 'Extra' AND particular LIKE $1
      GROUP BY tenant_id, unit_id
    `, [`%${selectedMonth}%`]);

    const extrasMap = {};
    extrasData.rows.forEach(row => {
      if (!extrasMap[row.tenant_id]) extrasMap[row.tenant_id] = {};
      extrasMap[row.tenant_id][row.unit_id] = Number(row.extra_amount);
    });

    // Step 1: Collect all tenants with their balance
    let tenantList = [];

    for (const tenant of tenantsData.rows) {
      const units = tenant.units || [];
      let currentMonthDues = 0;
      let unitsHTML = '';

      units.forEach(unit => {
        const rent = Number(unit.rent) || 0;
        const maintenance = Number(unit.maintenance) || 0;
        const unitExtras = (extrasMap[tenant.tenant_id] && extrasMap[tenant.tenant_id][unit.unit_id]) || 0;
        const unitTotal = rent + maintenance + unitExtras;

        currentMonthDues += unitTotal;

        unitsHTML += `
          <div class="flex justify-between items-center text-sm py-2 border-b">
            <span class="font-medium">${unit.unit_name}</span>
            <span class="text-right">
              Rent: ₹${rent.toLocaleString('en-IN')}<br>
              Maint: ₹${maintenance.toLocaleString('en-IN')}<br>
              ${unitExtras > 0 ? `Extras: ₹${unitExtras.toLocaleString('en-IN')}<br>` : ''}
              <span class="font-semibold text-emerald-700">Total: ₹${unitTotal.toLocaleString('en-IN')}</span>
            </span>
          </div>
        `;
      });

      // Get total outstanding
      const balance = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END), 0) as outstanding
        FROM transactions 
        WHERE tenant_id = $1
      `, [tenant.tenant_id]);

      const totalOutstanding = Number(balance.rows[0].outstanding);

      tenantList.push({
        tenant,
        unitsHTML,
        totalOutstanding,
        currentMonthDues
      });
    }

    // Step 2: Sort - Due tenants first, then paid/advance
    tenantList.sort((a, b) => {
      if (a.totalOutstanding > 0 && b.totalOutstanding <= 0) return -1;
      if (a.totalOutstanding <= 0 && b.totalOutstanding > 0) return 1;
      return 0;
    });

    // Step 3: Build HTML
    let tenantRows = '';

    tenantList.forEach(item => {
      const { tenant, unitsHTML, totalOutstanding } = item;

      let balanceHTML = '';
      if (totalOutstanding > 0) {
        balanceHTML = `<div class="text-2xl font-bold text-red-600">₹${totalOutstanding.toLocaleString('en-IN')}</div>`;
      } else if (totalOutstanding < 0) {
        balanceHTML = `<div class="text-2xl font-bold text-emerald-600">₹${totalOutstanding.toLocaleString('en-IN')} <span class="text-sm font-normal">(Advance)</span></div>`;
      } else {
        balanceHTML = `<div class="text-2xl font-bold text-gray-600">₹0</div>`;
      }

      tenantRows += `
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-4 tenant-card" data-tenant-name="${tenant.name.toLowerCase()}">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-xl font-bold">👤 ${tenant.name}</h3>
              <p class="text-sm text-gray-600">${tenant.phone ? '+91 ' + tenant.phone : ''}</p>
            </div>
            
            <div class="text-right">
              <div class="text-xs text-gray-500">Balance</div>
              ${balanceHTML}
            </div>
          </div>

          <div class="mb-4">
            <h4 class="font-semibold text-sm mb-2">Units Breakdown (This Month)</h4>
            ${unitsHTML || '<p class="text-sm text-gray-500">No active units</p>'}
          </div>

          <!-- Payment Form with Comments -->
<form action="/collect-invoice-payment" method="POST" class="flex flex-wrap gap-2 items-end">
    <input type="hidden" name="tenant_id" value="${tenant.tenant_id}">
    <input type="hidden" name="selectedMonth" value="${selectedMonth}">
    
    <div class="flex flex-col">
        <label class="text-xs text-gray-500 mb-1">Amount</label>
        <input type="number" name="paymentAmount" placeholder="Amount" 
               class="border border-gray-300 rounded-2xl px-4 py-3 text-sm w-28" required>
    </div>
    
    <div class="flex flex-col">
        <label class="text-xs text-gray-500 mb-1">Mode</label>
        <select name="paymentMode" class="border border-gray-300 rounded-2xl px-3 py-3 text-sm">
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank</option>
        </select>
    </div>

    <!-- Comments Field -->
    <div class="flex flex-col flex-1 min-w-[200px]">
        <label class="text-xs text-gray-500 mb-1">Comments (Optional)</label>
        <input type="text" name="comments" placeholder="e.g. Paid by father, Partial payment..." 
               class="border border-gray-300 rounded-2xl px-4 py-3 text-sm">
    </div>
    
    <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-medium h-[48px]">
        Receive Payment
    </button>
</form>
        </div>
      `;
    });

    res.render('billing/ledger', {
      title: `Rent Collection - ${selectedMonth}`,
      selectedMonth,
      tenantRows,
      error: null
    });

  } catch (err) {
    console.error("Ledger Error:", err.message);
    res.status(500).render('billing/ledger', {
      title: 'Rent Collection',
      selectedMonth: '',
      tenantRows: '',
      error: `Error loading ledger: ${err.message}`
    });
  }
});

module.exports = router;