// routes/tenant-view.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/view/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.trim();

        console.log(`[Tenant View] Request for phone: ${phone}`);

        // Get tenant details (all records with same phone)
        const tenantRes = await pool.query(`
            SELECT 
                t.id,
                t.name,
                t.phone,
                t.father_name,
                t.is_active,
                STRING_AGG(DISTINCT u.unit_name, ', ') as all_units
            FROM tenants t
            LEFT JOIN tenant_units tu ON tu.tenant_id = t.id
            LEFT JOIN units u ON tu.unit_id = u.id
            WHERE t.phone = $1
            GROUP BY t.id, t.name, t.phone, t.father_name, t.is_active
            ORDER BY t.is_active DESC
            LIMIT 1
        `, [phone]);

        if (tenantRes.rows.length === 0) {
            return res.status(404).send(`No tenant found with phone number ${phone}`);
        }

        const tenant = tenantRes.rows[0];

        // Calculate current balance
        const balanceRes = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END), 0) as current_balance
            FROM transactions 
            WHERE tenant_id IN (
                SELECT id FROM tenants WHERE phone = $1
            )
        `, [phone]);

        tenant.current_balance = Number(balanceRes.rows[0].current_balance);

        // Get transactions
        const transactions = await pool.query(`
            SELECT 
                TO_CHAR(transaction_date, 'dd Mon YYYY') as period,
                particular,
                amount,
                tran_type as type,
                tran_mode,
                notes,
                SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END) 
                  OVER (ORDER BY transaction_date, tran_id) as running_balance
            FROM transactions 
            WHERE tenant_id IN (
                SELECT id FROM tenants WHERE phone = $1
            )
            ORDER BY transaction_date DESC, tran_id DESC
        `, [phone]);

        let rowsHTML = '';

        transactions.rows.forEach(row => {
            const amount = Number(row.amount);
            const isDebit = row.type === 'Bill' || row.type === 'Extra';
            
            let displayParticular = row.particular;
            if (row.notes && row.notes.trim() !== '') {
                displayParticular += ` (${row.notes})`;
            }

            rowsHTML += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="py-3 px-4">${row.period}</td>
                    <td class="py-3 px-4">${displayParticular}</td>
                    <td class="py-3 px-4 text-right ${isDebit ? 'text-red-600' : 'text-emerald-600'}">
                        ${isDebit ? 'Dr.' : 'Cr.'} ₹${amount.toLocaleString('en-IN')}
                    </td>
                    <td class="py-3 px-4 text-right font-semibold">₹${Number(row.running_balance).toLocaleString('en-IN')}</td>
                </tr>
            `;
        });

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        res.render('tenant-view', {
            title: `${tenant.name} - Ledger`,
            tenant,
            rowsHTML: rowsHTML || '<tr><td colspan="4" class="py-12 text-center text-gray-500">No transactions found yet.</td></tr>'
        });

    } catch (err) {
        console.error("Tenant View Error:", err.message);
        res.status(500).send("Error loading tenant ledger.");
    }
});

module.exports = router;