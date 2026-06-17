const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { getTenantOutstanding } = require('../../services/transactionService');

router.get('/tenants', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthLabel = `${nowIST.toLocaleDateString('en-IN', { month: 'short' })} ${nowIST.getFullYear()}`;
    const selectedMonth = req.query.month || currentMonthLabel;

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

    const extrasData = await pool.query(`
      SELECT tenant_id, unit_id, SUM(amount) as extra_amount
      FROM transactions 
      WHERE tran_type = 'Extra' 
        AND transaction_date >= date_trunc('month', CURRENT_DATE)
      GROUP BY tenant_id, unit_id
    `);

    const extrasMap = {};
    extrasData.rows.forEach(row => {
      if (!extrasMap[row.tenant_id]) extrasMap[row.tenant_id] = {};
      extrasMap[row.tenant_id][row.unit_id] = Number(row.extra_amount);
    });

    const statsRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT t.id) as active_tenants,
        COALESCE(SUM(CASE WHEN tr.tran_type = 'Payment' THEN tr.amount ELSE 0 END), 0) as total_collected
      FROM tenants t
      LEFT JOIN transactions tr ON tr.tenant_id = t.id 
        AND tr.transaction_date >= date_trunc('month', CURRENT_DATE)
      WHERE t.is_active = TRUE
    `);

    const activeTenants = Number(statsRes.rows[0].active_tenants);
    const totalCollectedThisMonth = Number(statsRes.rows[0].total_collected);

    let totalDueAll = 0;
    let tenantRows = '';

    for (const tenant of tenantsData.rows) {
      const units = tenant.units || [];
      const totalOutstanding = await getTenantOutstanding(tenant.tenant_id);
      totalDueAll += totalOutstanding;

      let unitsHTML = '';
      units.forEach(unit => {
        const rent = Number(unit.rent) || 0;
        const maint = Number(unit.maintenance) || 0;
        const extras = (extrasMap[tenant.tenant_id] && extrasMap[tenant.tenant_id][unit.unit_id]) || 0;
        unitsHTML += `
          <div class="flex justify-between text-sm py-1 border-b">
            <span>${unit.unit_name}</span>
            <span>Rent: ₹${rent.toLocaleString('en-IN')} | Maint: ₹${maint.toLocaleString('en-IN')} ${extras > 0 ? `| Extras: ₹${extras.toLocaleString('en-IN')}` : ''}</span>
          </div>`;
      });

      tenantRows += `
        <div class="tenant-card bg-white rounded-2xl p-6 border border-gray-100 hover:border-emerald-400 mb-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="font-semibold text-xl">👤 ${tenant.name}</h3>
              <p class="text-gray-600">${tenant.phone ? '+91 ' + tenant.phone : ''}</p>
            </div>
            <div class="text-right">
              <div class="text-sm text-gray-500">Balance</div>
              <div class="text-2xl font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}">
                ₹${totalOutstanding.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div class="mb-4">
            <h4 class="font-semibold text-sm mb-2">Units Breakdown</h4>
            ${unitsHTML || '<p class="text-sm text-gray-500">No active units</p>'}
          </div>

          <!-- Payment Form -->
          <form action="/collect-invoice-payment" method="POST" class="flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded-2xl">
            <input type="hidden" name="tenant_id" value="${tenant.tenant_id}">
            <input type="hidden" name="selectedMonth" value="${selectedMonth}">
            
            <div class="flex flex-col">
              <label class="text-xs text-gray-500 mb-1">Amount (₹)</label>
              <input type="number" name="paymentAmount" placeholder="0" class="border border-gray-300 rounded-2xl px-4 py-3 w-32" required>
            </div>
            
            <div class="flex flex-col">
              <label class="text-xs text-gray-500 mb-1">Mode</label>
              <select name="paymentMode" class="border border-gray-300 rounded-2xl px-4 py-3">
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank</option>
              </select>
            </div>

            <div class="flex flex-col flex-1 min-w-[220px]">
              <label class="text-xs text-gray-500 mb-1">Comments (Optional)</label>
              <input type="text" name="comments" placeholder="e.g. Paid by father..." class="border border-gray-300 rounded-2xl px-4 py-3 text-sm">
            </div>
            
            <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-medium">
              Receive Payment
            </button>
          </form>

          <!-- WhatsApp Button -->
          <a href="https://wa.me/91${tenant.phone}?text=Hello%20${encodeURIComponent(tenant.name)}%2C%0A%0A*Bill%20for%20${encodeURIComponent(selectedMonth)}*%0A%0A${units.map(u => {
            const rent = Number(u.rent) || 0;
            const maint = Number(u.maintenance) || 0;
            const extras = (extrasMap[tenant.tenant_id] && extrasMap[tenant.tenant_id][u.unit_id]) || 0;
	    const ledgerUrl = `http://80.225.194.65/view/${tenant.phone}`;
            return `*${u.unit_name}*%0A` +
                   `Rent%20-%20₹${rent.toLocaleString('en-IN')}%0A` +
                   `Maintenance%20-%20₹${maint.toLocaleString('en-IN')}%0A` +
                   `${extras > 0 ? `Extras%20-%20₹${extras.toLocaleString('en-IN')}%0A` : ''}` +
                   `────────────────────%0A`;
          }).join('')}*Total%20Due:%20₹${totalOutstanding.toLocaleString('en-IN')}*%0A%0A*Please%20pay%20by%2010th%20of%20the%20month.*%0ALate%20payment%20charges%20of%20₹200%20will%20apply%20after%2010th.%0A%0AView%20your%20full%20ledger%20here%3A%0A${ledgerUrl}%0A%0AThank%20you!"
             target="_blank"
             class="mt-3 inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-2xl text-sm font-medium">
            📱 Send Detailed Bill via WhatsApp
          </a>
        </div>`;
    }

    res.render('billing/ledger', {
      title: `Rent Collection - ${selectedMonth}`,
      selectedMonth,
      tenantRows,
      totalDueAll,
      totalCollectedThisMonth,
      activeTenants,
      error: null
    });

  } catch (err) {
    console.error("Ledger Error:", err.message);
    res.render('billing/ledger', {
      title: 'Rent Collection',
      selectedMonth: '',
      tenantRows: '',
      totalDueAll: 0,
      totalCollectedThisMonth: 0,
      activeTenants: 0,
      error: err.message
    });
  }
});

module.exports = router;
