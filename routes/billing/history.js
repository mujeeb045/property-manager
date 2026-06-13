// routes/billing/history.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

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
      LEFT JOIN tenant_units tu ON tu.tenant_id = t.id AND tu.is_active = TRUE
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
// Tenant History Detail
// ========================
router.get('/history/tenant/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;

    const tenantRes = await pool.query(`
      SELECT 
        t.*,
        STRING_AGG(u.unit_name, ', ') as current_units
      FROM tenants t
      LEFT JOIN tenant_units tu ON tu.tenant_id = t.id AND tu.is_active = TRUE
      LEFT JOIN units u ON tu.unit_id = u.id
      WHERE t.id = $1
      GROUP BY t.id
    `, [tenantId]);

    if (tenantRes.rows.length === 0) {
      return res.status(404).render('billing/tenant-detail', {
        title: 'Tenant Not Found',
        error: 'Tenant not found'
      });
    }

    const tenant = tenantRes.rows[0];

    const transactions = await pool.query(`
      SELECT 
        tran_id,
        TO_CHAR(transaction_date, 'dd Mon YYYY') as period,
        particular,
        amount,
        tran_type as type,
        tran_mode as mode,
        SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END) 
          OVER (ORDER BY transaction_date, tran_id) as running_balance
      FROM transactions 
      WHERE tenant_id = $1
      ORDER BY transaction_date DESC, tran_id DESC
    `, [tenantId]);

    let rowsHTML = '';

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
          <td class="py-4 text-center">
            <button onclick="editTransaction(${row.tran_id}, ${amount})" class="text-blue-600 hover:text-blue-700 text-sm mr-2">Edit</button>
            <button onclick="deleteTransaction(${row.tran_id})" class="text-red-600 hover:text-red-700 text-sm">Delete</button>
          </td>
        </tr>
      `;
    });

    res.render('billing/tenant-detail', {
      title: `${tenant.name} - History`,
      tenant,
      rowsHTML: rowsHTML || '<tr><td colspan="5" class="py-12 text-center text-gray-500">No transactions found</td></tr>',
      error: null
    });

  } catch (err) {
    console.error("Tenant Detail Error:", err.message);
    res.status(500).render('billing/tenant-detail', {
      title: 'Error',
      error: `Error loading tenant history: ${err.message}`
    });
  }
});

module.exports = router;