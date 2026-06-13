// server.js
require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View Engine + Layouts
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout/base');

// Routes
const dashboardRoutes = require('./routes/index');
const unitRoutes = require('./routes/units');
const tenantRoutes = require('./routes/tenants');
const billingRoutes = require('./routes/billing');

app.use('/', dashboardRoutes);
app.use('/', unitRoutes);
app.use('/', tenantRoutes);
app.use('/', billingRoutes);

// ========================
// 404 Not Found Handler
// ========================
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'Sorry, the page you are looking for does not exist.',
    error: {}
  });
});

// ========================
// Global Error Handler
// ========================
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).render('error', {
    title: 'Something went wrong',
    message: err.message || 'An unexpected error occurred.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});