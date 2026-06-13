// server.js
require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// EJS + Layouts
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout/base');

// Import Routes
const dashboardRoutes = require('./routes/index');
const unitRoutes = require('./routes/units');
const tenantRoutes = require('./routes/tenants');

// Import Billing Routes Directly (since we removed billing/index.js)
const ledgerRouter = require('./routes/billing/ledger');
const historyRouter = require('./routes/billing/history');
const paymentsRouter = require('./routes/billing/payments');
const tenantDetailRouter = require('./routes/billing/tenant-detail');
const tenantPdfRouter = require('./routes/billing/tenant-pdf');
const settingsRouter = require('./routes/billing/settings');

// Mount Routes
app.use('/', dashboardRoutes);
app.use('/', unitRoutes);
app.use('/', tenantRoutes);
app.use('/', ledgerRouter);
app.use('/', historyRouter);
app.use('/', paymentsRouter);
app.use('/', tenantDetailRouter);
app.use('/', tenantPdfRouter);
app.use('/', settingsRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'Sorry, the page you are looking for does not exist.'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong. Please try again later.'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});