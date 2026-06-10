require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
const dashboardRoutes = require('./routes/index');
const unitRoutes = require('./routes/units');
const tenantRoutes = require('./routes/tenants');
const billingRoutes = require('./routes/billing');
//const settingsRoutes = require('./routes/settings');


app.use('/', dashboardRoutes);
app.use('/', unitRoutes);
app.use('/', tenantRoutes);
app.use('/', billingRoutes);
//app.use('/', settingsRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server running smoothly on http://localhost:${PORT}`);
});