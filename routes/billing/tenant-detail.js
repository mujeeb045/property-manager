// routes/billing/tenant-detail.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.get('/history/tenant/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;

    const tenantRes = await pool.query(`
      SELECT tenants.*, COALESCE(units.unit_name, 'No Unit') as unit_name 
      FROM tenants 
      LEFT JOIN units ON tenants.unit_id = units.id 
      WHERE tenants.id = $1
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

      const actionHTML = `
        <button onclick="editTransaction(${row.tran_id}, ${amount})" 
                class="text-blue-600 hover:text-blue-700 text-sm mr-2">Edit</button>
        <button onclick="deleteTransaction(${row.tran_id})" 
                class="text-red-600 hover:text-red-700 text-sm">Delete</button>
      `;

      rowsHTML += `
        <tr class="border-b hover:bg-gray-50">
          <td class="py-4">${row.period}</td>
          <td class="py-4">${row.particular}</td>
          <td class="py-4 text-right ${isDebit ? 'text-red-600' : 'text-emerald-600'}">
            ${isDebit ? 'Dr.' : 'Cr.'} Rs. ${amount.toLocaleString('en-IN')}
          </td>
          <td class="py-4 text-right font-semibold">Rs. ${Number(row.running_balance).toLocaleString('en-IN')}</td>
          <td class="py-4 text-center">${actionHTML}</td>
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
      title: 'Tenant History Error',
      tenant: {},
      rowsHTML: '',
      error: `Error loading tenant history: ${err.message}`
    });
  }
});

module.exports = router;