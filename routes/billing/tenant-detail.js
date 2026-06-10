const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { wrapHTML } = require('../../views/layout');

router.get('/history/tenant/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;

    const tenantRes = await pool.query(`
      SELECT tenants.*, COALESCE(units.unit_name, 'No Unit') as unit_name 
      FROM tenants LEFT JOIN units ON tenants.unit_id = units.id 
      WHERE tenants.id = $1
    `, [tenantId]);

    if (tenantRes.rows.length === 0) return res.status(404).send("Tenant not found");

    const tenant = tenantRes.rows[0];

    // Safe query - using your actual column names
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
    let runningBalance = 0;

    transactions.rows.forEach(row => {
      const amount = Number(row.amount);
      const isDebit = row.type === 'Bill' || row.type === 'Extra';

      const actionHTML = `
        <button onclick="editTransaction(${row.tran_id}, ${amount})" class="text-blue-600 hover:text-blue-700 text-sm mr-2">Edit</button>
        <button onclick="deleteTransaction(${row.tran_id})" class="text-red-600 hover:text-red-700 text-sm">Delete</button>
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

    res.send(wrapHTML(`${tenant.name} - History`, `
      <div class="max-w-6xl mx-auto px-4 py-6">
        <a href="/history" class="inline-flex items-center gap-2 text-emerald-600 hover:underline mb-6">← Back to History</a>

        <div class="bg-white rounded-3xl p-8 shadow-sm">
          <div class="flex justify-between items-start mb-8">
            <div>
              <h1 class="text-3xl font-bold">${tenant.name}</h1>
              <p class="text-xl text-gray-600">Unit: ${tenant.unit_name}</p>
            </div>
            <a href="/tenant-pdf/${tenant.id}" class="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-medium">📥 Download PDF</a>
          </div>

          <!-- Add Extra Charge -->
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
            <h3 class="font-semibold mb-4 text-amber-800">Add Extra Charge</h3>
            <form action="/add-extra" method="POST" class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="hidden" name="tenant_id" value="${tenant.id}">
              <input type="text" name="particular" placeholder="Description (e.g. Plumber repair)" 
                     class="border border-gray-300 rounded-xl px-4 py-3" required>
              <input type="number" name="amount" placeholder="Amount" 
                     class="border border-gray-300 rounded-xl px-4 py-3" required>
              <button type="submit" class="bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-medium">
                Add Extra
              </button>
            </form>
          </div>

          <table class="w-full">
            <thead>
              <tr class="border-b-2 border-gray-300">
                <th class="text-left py-4">Date</th>
                <th class="text-left py-4">Particular</th>
                <th class="text-right py-4">Amount</th>
                <th class="text-right py-4">Balance</th>
                <th class="text-center py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="5" class="py-12 text-center text-gray-500">No transactions found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        async function deleteTransaction(id) {
          if (!confirm("Delete this transaction?")) return;
          const res = await fetch('/delete-transaction/' + id, { method: 'POST' });
          if (res.ok) location.reload();
        }

        function editTransaction(id, currentAmount) {
          const newAmount = prompt("Enter new amount:", currentAmount);
          if (newAmount === null || newAmount === '') return;
          fetch('/edit-transaction/' + id, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({amount: parseFloat(newAmount)})
          }).then(() => location.reload());
        }
      </script>
    `));

  } catch (err) {
    console.error("Tenant Detail Error:", err.message);
    res.status(500).send(`Error: ${err.message}`);
  }
});

module.exports = router;