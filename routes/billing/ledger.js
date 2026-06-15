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

    // Quick Stats
    const collectedRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_collected
      FROM transactions 
      WHERE tran_type = 'Payment'
        AND transaction_date >= date_trunc('month', CURRENT_DATE)
    `);

    let totalDueAll = 0;
    for (const tenant of tenantsData.rows) {
      const balance = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END), 0) as outstanding
        FROM transactions WHERE tenant_id = $1
      `, [tenant.tenant_id]);
      totalDueAll += Number(balance.rows[0].outstanding);
    }

    const totalCollectedThisMonth = Number(collectedRes.rows[0].total_collected);
    const tenantsWithDues = tenantsData.rows.length;   // All active tenants shown

    // Build tenant list
    let tenantList = [];

    for (const tenant of tenantsData.rows) {
      const units = tenant.units || [];
      let unitsHTML = '';

      units.forEach(unit => {
        const rent = Number(unit.rent) || 0;
        const maintenance = Number(unit.maintenance) || 0;
        const unitExtras = (extrasMap[tenant.tenant_id] && extrasMap[tenant.tenant_id][unit.unit_id]) || 0;
        const unitTotal = rent + maintenance + unitExtras;

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

      const balance = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END), 0) as outstanding
        FROM transactions WHERE tenant_id = $1
      `, [tenant.tenant_id]);

      const totalOutstanding = Number(balance.rows[0].outstanding);

      tenantList.push({
        tenant,
        units,
        unitsHTML,
        totalOutstanding
      });
    }

    // Sort: Due tenants first
    tenantList.sort((a, b) => {
      if (a.totalOutstanding > 0 && b.totalOutstanding <= 0) return -1;
      if (a.totalOutstanding <= 0 && b.totalOutstanding > 0) return 1;
      return 0;
    });

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

          <!-- Payment Form -->
          <form action="/collect-invoice-payment" method="POST" class="flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded-2xl">
            <input type="hidden" name="tenant_id" value="${tenant.tenant_id}">
            <input type="hidden" name="selectedMonth" value="${selectedMonth}">
            
            <div class="flex flex-col">
              <label class="text-xs text-gray-500 mb-1 font-medium">Amount (₹)</label>
              <input type="number" name="paymentAmount" placeholder="0" 
                     class="border border-gray-300 rounded-2xl px-4 py-3 text-sm w-32 focus:outline-none focus:border-emerald-500" required>
            </div>
            
            <div class="flex flex-col">
              <label class="text-xs text-gray-500 mb-1 font-medium">Mode</label>
              <select name="paymentMode" class="border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500">
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div class="flex flex-col flex-1 min-w-[220px]">
              <label class="text-xs text-gray-500 mb-1 font-medium">Comments (Optional)</label>
              <input type="text" name="comments" placeholder="e.g. Paid by father..." 
                     class="border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500">
            </div>
            
            <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-medium transition duration-200">
              Receive Payment
            </button>
          </form>

          <!-- WhatsApp Button -->
          <a href="https://wa.me/91${tenant.phone}?text=Hello%20${encodeURIComponent(tenant.name)},%0A%0A*Bill%20for%20${encodeURIComponent(selectedMonth)}*%0A%0A${item.units.map(u => {
            const rent = Number(u.rent) || 0;
            const maint = Number(u.maintenance) || 0;
            const extras = (extrasMap[tenant.tenant_id] && extrasMap[tenant.tenant_id][u.unit_id]) || 0;
            return `*${u.unit_name}*%0A` +
                   `Rent%20-%20₹${rent.toLocaleString('en-IN')}%0A` +
                   `Maintenance%20-%20₹${maint.toLocaleString('en-IN')}%0A` +
                   `${extras > 0 ? `Extras%20-%20₹${extras.toLocaleString('en-IN')}%0A` : ''}` +
                   `────────────────────%0A`;
          }).join('')}*Total%20Due:%20₹${totalOutstanding.toLocaleString('en-IN')}*%0A%0A*Please%20pay%20by%2010th%20of%20the%20month.*%0ALate%20payment%20charges%20of%20₹200%20will%20apply%20after%2010th.%0A%0A%F0%9F%93%B1%20*Scan%20QR%20Code%20to%20Pay*%0Ahttp%3A%2F%2Flocalhost%3A3000%2Fqr%2F${encodeURIComponent(process.env.UPI_ID)}%0A%0AView%20your%20full%20ledger%20here%3A%0A${encodeURIComponent('http://localhost:3000/view/' + tenant.phone)}%0A%0AThank%20you!"
             target="_blank"
             class="mt-3 inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-2xl text-sm font-medium">
            📱 Send Bill + QR Code via WhatsApp
          </a>
        </div>
      `;
    });

    res.render('billing/ledger', {
      title: `Rent Collection - ${selectedMonth}`,
      selectedMonth,
      tenantRows,
      totalDueAll,
      totalCollectedThisMonth,
      tenantsWithDues: tenantsData.rows.length,   // Number of active tenants
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