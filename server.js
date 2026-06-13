// server.js
require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout/base');   // Points to views/layout/base.ejs

// Routes
const dashboardRoutes = require('./routes/index');
const unitRoutes = require('./routes/units');
const tenantRoutes = require('./routes/tenants');
const billingRoutes = require('./routes/billing');

app.use('/', dashboardRoutes);
app.use('/', unitRoutes);
app.use('/', tenantRoutes);
app.use('/', billingRoutes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));