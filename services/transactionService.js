// services/transactionService.js
const pool = require('../config/db');

async function getTenantOutstanding(tenantId) {
  const result = await pool.query(`
    SELECT COALESCE(SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END), 0) as outstanding
    FROM transactions WHERE tenant_id = $1
  `, [tenantId]);
  return Number(result.rows[0].outstanding);
}

async function getCurrentMonthDues(tenantId) {
  const result = await pool.query(`
    SELECT COALESCE(SUM(amount), 0) as dues
    FROM transactions 
    WHERE tenant_id = $1 
      AND tran_type IN ('Bill', 'Extra')
      AND transaction_date >= date_trunc('month', CURRENT_DATE)
  `, [tenantId]);
  return Number(result.rows[0].dues);
}

module.exports = {
  getTenantOutstanding,
  getCurrentMonthDues
};