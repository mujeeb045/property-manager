// routes/billing/history.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.get('/history', async (req, res) => {
  try {
    const tenants = await pool.query(`
      SELECT 
        tenants.id,
        tenants.name,
        tenants.father_name,
        tenants.phone,
        COALESCE(units.unit_name, 'No Unit / Departed') as unit_name,
        tenants.is_active,
        tenants.move_out_date
      FROM tenants 
      LEFT JOIN units ON tenants.unit_id = units.id 
      ORDER BY tenants.name ASC
    `);

    let tenantListHTML = '';

    tenants.rows.forEach(tenant => {
      const status = tenant.is_active 
        ? `<span class="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>` 
        : `<span class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full">Left</span>`;

      tenantListHTML += `
        <div onclick="window.location.href='/history/tenant/${tenant.id}'" 
             class="tenant-card bg-white rounded-2xl p-6 border border-gray-100 hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all">
          <div class="flex justify-between items-start">
            <div>
              <strong class="text-lg">👤 ${tenant.name}</strong>
              <p class="text-gray-600 mt-1">${tenant.unit_name}</p>
            </div>
            ${status}
          </div>
          <p class="text-sm text-gray-500 mt-3">${tenant.phone || 'No phone'}</p>
        </div>
      `;
    });

    res.render('billing/history', {
      title: 'History & Details',
      tenantListHTML: tenantListHTML || '<p class="col-span-full text-center py-12 text-gray-500">No tenants found.</p>',
      error: null
    });

  } catch (err) {
    console.error("History Page Error:", err.message);
    res.status(500).render('billing/history', {
      title: 'History & Details',
      tenantListHTML: '',
      error: `Error loading history: ${err.message}`
    });
  }
});
// ========================
// History by Tenant (List of Tenants)
// ========================
router.get('/history/tenants', async (req, res) => {
  try {
    const tenants = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.phone,
        t.is_active,
        STRING_AGG(u.unit_name, ', ') as unit_names
      FROM tenants t
      LEFT JOIN tenant_units tu ON tu.tenant_id = t.id AND tu.is_active = true
      LEFT JOIN units u ON tu.unit_id = u.id
      GROUP BY t.id, t.name, t.phone, t.is_active
      ORDER BY t.name ASC
    `);

    res.render('billing/history-tenants', {
      title: 'History by Tenant',
      tenants: tenants.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading tenant history");
  }
});

// ========================
// History by Unit (List of Units)
// ========================
router.get('/history/units', async (req, res) => {
  try {
    const units = await pool.query(`
      SELECT 
        units.id,
        units.unit_name,
        units.rent_amount,
        units.is_occupied,
        tenants.id as tenant_id,
        tenants.name as tenant_name
      FROM units 
      LEFT JOIN tenant_units tu ON tu.unit_id = units.id AND tu.is_active = true
      LEFT JOIN tenants ON tu.tenant_id = tenants.id
      ORDER BY units.unit_name ASC
    `);

    res.render('billing/history-units', {
      title: 'History by Unit',
      units: units.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading unit history");
  }
});
// ========================
// Unit History Detail Page
// ========================
router.get('/history/unit/:unitId', async (req, res) => {
  try {
    const unitId = req.params.unitId;

    // Get unit details + current tenant
    const unitRes = await pool.query(`
      SELECT 
        units.*,
        tenants.id as tenant_id,
        tenants.name as tenant_name,
        tenants.phone as tenant_phone
      FROM units 
      LEFT JOIN tenant_units tu ON tu.unit_id = units.id AND tu.is_active = true
      LEFT JOIN tenants ON tu.tenant_id = tenants.id
      WHERE units.id = $1
    `, [unitId]);

    if (unitRes.rows.length === 0) {
      return res.status(404).send("Unit not found");
    }

    const unit = unitRes.rows[0];

    // Get transactions of the current tenant (if any)
    let transactions = { rows: [] };
    let rowsHTML = '';

    if (unit.tenant_id) {
      transactions = await pool.query(`
        SELECT 
          tran_id,
          TO_CHAR(transaction_date, 'dd Mon YYYY') as period,
          particular,
          amount,
          tran_type as type,
          SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END) 
            OVER (ORDER BY transaction_date, tran_id) as running_balance
        FROM transactions 
        WHERE tenant_id = $1
        ORDER BY transaction_date DESC, tran_id DESC
      `, [unit.tenant_id]);

      transactions.rows.forEach(row => {
        const amount = Number(row.amount);
        const isDebit = row.type === 'Bill' || row.type === 'Extra';

        rowsHTML += `
          <tr class="border-b hover:bg-gray-50">
            <td class="py-4">${row.period}</td>
            <td class="py-4">${row.particular}</td>
            <td class="py-4 text-right ${isDebit ? 'text-red-600' : 'text-emerald-600'}">
              ${isDebit ? 'Dr.' : 'Cr.'} ₹${amount.toLocaleString('en-IN')}
            </td>
            <td class="py-4 text-right font-semibold">₹${Number(row.running_balance).toLocaleString('en-IN')}</td>
          </tr>
        `;
      });
    }

    res.render('billing/unit-detail', {
      title: `${unit.unit_name} - History`,
      unit,
      rowsHTML: rowsHTML || '<tr><td colspan="4" class="py-12 text-center text-gray-500">No transactions found</td></tr>'
    });

  } catch (err) {
    console.error("Unit History Error:", err.message);
    res.status(500).send("Error loading unit history");
  }
});

module.exports = router;