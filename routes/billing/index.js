const express = require('express');
const router = express.Router();

// Import sub-routers
const ledgerRouter = require('./ledger');
const historyRouter = require('./history');
const paymentsRouter = require('./payments');
const extrasRouter = require('./extras');

// Use them
router.use(ledgerRouter);
router.use(historyRouter);
router.use(paymentsRouter);
router.use(extrasRouter);

module.exports = router;