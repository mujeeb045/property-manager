// routes/index.js  ← MAIN FILE
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Import all route groups
const unitRoutes = require('./units');
const tenantRoutes = require('./tenants');

// Import billing sub-routes directly
const ledgerRouter = require('./billing/ledger');
const historyRouter = require('./billing/history');
const paymentsRouter = require('./billing/payments');
const tenantDetailRouter = require('./billing/tenant-detail');
const tenantPdfRouter = require('./billing/tenant-pdf');
const settingsRouter = require('./billing/settings');

// Mount routes
router.use('/', unitRoutes);
router.use('/', tenantRoutes);

// Billing routes
router.use('/', ledgerRouter);
router.use('/', historyRouter);
router.use('/', paymentsRouter);
router.use('/', tenantDetailRouter);
router.use('/', tenantPdfRouter);
router.use('/', settingsRouter);

// Dashboard Route
router.get('/', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthShort = nowIST.toLocaleDateString('en-IN', { month: 'short' });
    const currentYear = nowIST.getFullYear();

    const countsQuery = await pool.query(`
      SELECT COUNT(*) as total_units,
             COUNT(CASE WHEN is_occupied = TRUE THEN 1 END) as occupied_units,
             COUNT(CASE WHEN is_occupied = FALSE THEN 1 END) as vacant_units
      FROM units
    `);

    const monthArray = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let monthOptionsHTML = '';
    monthArray.forEach(m => {
      monthOptionsHTML += `<option value="${m}" ${m === currentMonthShort ? 'selected' : ''}>${m}</option>`;
    });

    res.render('dashboard/hub', {
      title: 'Dashboard',
      total_units: countsQuery.rows[0].total_units,
      occupied_units: countsQuery.rows[0].occupied_units,
      vacant_units: countsQuery.rows[0].vacant_units,
      monthOptionsHTML,
      currentYear,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('dashboard/hub', { title: 'Dashboard', error: 'Error loading dashboard' });
  }
});

module.exports = router;