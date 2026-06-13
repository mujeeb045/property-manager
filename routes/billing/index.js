// routes/billing/index.js
const express = require('express');
const router = express.Router();

// Import all sub-routers (correct relative paths)
const ledgerRouter = require('./ledger');
const historyRouter = require('./history');
const paymentsRouter = require('./payments');
const pdfRouter = require('./tenant-pdf');
const tenantDetailRouter = require('./tenant-detail');
const settingsRouter = require('./settings');

// Mount the routes
router.use(ledgerRouter);
router.use(historyRouter);
router.use(paymentsRouter);
router.use(pdfRouter);
router.use(tenantDetailRouter);
router.use(settingsRouter);

module.exports = router;