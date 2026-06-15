// server.js
const { isAuthenticated } = require('./middleware/auth');
require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Session Configuration
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/db'); // Make sure this path is correct

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true          // ← Add this line
    }),
    secret: process.env.SESSION_SECRET || 'your-super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: false
    }
}));

// ========================
// Authentication Middleware (Place here - early in the file)
// ========================
app.use((req, res, next) => {
    const publicRoutes = ['/login', '/logout', '/view/'];

    // Allow public routes
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    // Check if user is logged in
    if (req.session && req.session.userId) {
        return next();
    }

    // Not logged in → redirect to login
    return res.redirect('/login');
});


// EJS + Layouts
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout/base');

// Import Routes
const tenantViewRouter = require('./routes/tenant-view');
const authRouter = require('./routes/auth');

const qrRouter = require('./routes/qr');
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
app.use('/', tenantViewRouter);
app.use('/', authRouter);

app.use('/', qrRouter);
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