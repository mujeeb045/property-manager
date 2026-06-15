// routes/index.js - MAIN AGGREGATOR
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Import all routes
const unitRoutes = require('./units');
const tenantRoutes = require('./tenants');

// Import billing routes directly
const ledgerRouter = require('./billing/ledger');
const tenantDetailRouter = require('./billing/tenant-detail');
const historyRouter = require('./billing/history');
const paymentsRouter = require('./billing/payments');

const tenantPdfRouter = require('./billing/tenant-pdf');
const settingsRouter = require('./billing/settings');

// Mount routes
router.use('/', unitRoutes);
router.use('/', tenantRoutes);
router.use('/', ledgerRouter);
router.use('/', tenantDetailRouter);
router.use('/', historyRouter);
router.use('/', paymentsRouter);

router.use('/', tenantPdfRouter);
router.use('/', settingsRouter);

// routes/index.js (Dashboard)
router.get('/', async (req, res) => {
  try {
    // Total active tenants
    const tenantsRes = await pool.query(`
      SELECT COUNT(*) as total_active 
      FROM tenants WHERE is_active = TRUE
    `);

    // Total units
    const unitsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_units,
        COUNT(CASE WHEN is_occupied = TRUE THEN 1 END) as occupied_units
      FROM units
    `);

    // Total due across all tenants
    const dueRes = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END), 0) as total_due
      FROM transactions
    `);

    // Collected this month
    const collectedRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as collected
      FROM transactions 
      WHERE tran_type = 'Payment'
        AND transaction_date >= date_trunc('month', CURRENT_DATE)
    `);

    const stats = {
      totalActiveTenants: tenantsRes.rows[0].total_active,
      totalUnits: unitsRes.rows[0].total_units,
      occupiedUnits: unitsRes.rows[0].occupied_units,
      totalDue: Number(dueRes.rows[0].total_due),
      collectedThisMonth: Number(collectedRes.rows[0].collected)
    };

    res.render('dashboard', {
      title: 'Dashboard',
      stats,
      currentMonth: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    });

  } catch (err) {
    console.error("Dashboard Error:", err.message);
    res.status(500).send("Error loading dashboard");
  }
});

module.exports = router;