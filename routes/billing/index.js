const express = require('express');
const router = express.Router();

// Import all billing sub-routers
const ledgerRouter = require('./ledger');
const historyRouter = require('./history');
const paymentsRouter = require('./payments');

const pdfRouter = require('./tenant-pdf');
const tenantDetailRouter = require('./tenant-detail');   // ← Must be here
const settingsRouter = require('./settings');

// Mount routes
router.use(ledgerRouter);
router.use(historyRouter);
router.use(paymentsRouter);

router.use(pdfRouter);
router.use(tenantDetailRouter);   // ← Important
router.use(settingsRouter);

module.exports = router;