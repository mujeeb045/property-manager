const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { wrapHTML } = require('../../views/layout');

// ========================
// Settings Page
// ========================
router.get('/settings', (req, res) => {
  const currentYear = new Date().getFullYear();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let monthOptions = '';
  months.forEach((month, index) => {
    const monthNum = (index + 1).toString().padStart(2, '0');
    const selected = (index + 1 === new Date().getMonth() + 1) ? 'selected' : '';
    monthOptions += `<option value="${month}" ${selected}>${month}</option>`;
  });

  res.send(wrapHTML("Settings", `
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold mb-8">⚙️ Settings</h1>

      <div class="bg-white rounded-3xl p-8 shadow-sm">
        <h2 class="text-xl font-semibold mb-6">Generate Monthly Bills</h2>
        
        <form action="/generate-monthly-invoices" method="POST" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium mb-2">Month</label>
              <select name="month" 
                      class="w-full border border-gray-300 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-emerald-500">
                ${monthOptions}
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-2">Year</label>
              <select name="year" 
                      class="w-full border border-gray-300 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-emerald-500">
                ${Array.from({length: 3}, (_, i) => currentYear + i)
                  .map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>
          </div>

          <button type="submit" 
                  class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-medium text-lg">
            Generate Bills for Selected Month
          </button>
        </form>
      </div>

      <div class="mt-6 text-sm text-gray-500 text-center">
        Note: System will avoid creating duplicate bills for the same month.
      </div>
    </div>
  `));
});

// ========================
// Generate Monthly Bills
// ========================
router.post('/generate-monthly-invoices', async (req, res) => {
  try {
    const { month, year } = req.body;
    const billingMonth = `${month} ${year}`;

    if (!month || !year) {
      return res.status(400).send("Month and Year are required");
    }

    const tenants = await pool.query(`
      SELECT 
        t.id, 
        t.name, 
        u.unit_name,
        COALESCE(u.rent_amount, 15000) as monthly_rent,
        COALESCE(u.maintenance_amount, 0) as maintenance_amount
      FROM tenants t
      LEFT JOIN units u ON t.unit_id = u.id
      WHERE t.is_active = true
    `);

    let created = 0;

    for (const tenant of tenants.rows) {
      const existing = await pool.query(`
        SELECT 1 FROM transactions 
        WHERE tenant_id = $1 
        AND tran_type = 'Bill' 
        AND particular LIKE $2
      `, [tenant.id, `%${billingMonth}%`]);

      if (existing.rows.length === 0) {
        const rent = Number(tenant.monthly_rent || 15000);
        const maintenance = Number(tenant.maintenance_amount || 0);
        const totalBill = rent + maintenance;

        await pool.query(`
          INSERT INTO transactions 
          (tenant_id, transaction_date, tran_type, particular, amount, notes)
          VALUES ($1, CURRENT_DATE, 'Bill', $2, $3, $4)
        `, [
          tenant.id, 
          `Monthly Rent - ${billingMonth}`, 
          totalBill,
          `Rent for ${billingMonth} (Unit: ${tenant.unit_name || 'N/A'})`
        ]);
        created++;
      }
    }

    res.send(`
      <div style="max-width:600px; margin:100px auto; text-align:center; font-family:Arial, sans-serif;">
        <h2 style="color:#10b981;">✅ Monthly Bills Generated Successfully!</h2>
        <p style="font-size:18px; margin:25px 0;">${created} bills created for <strong>${billingMonth}</strong></p>
        <a href="/tenants" style="display:inline-block; padding:14px 32px; background:#10b981; color:white; text-decoration:none; border-radius:8px; font-size:16px;">
          Go to This Month Collection
        </a>
      </div>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating monthly bills: " + err.message);
  }
});

module.exports = router;