// routes/index.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Dashboard / Landing Page
router.get('/', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthShort = nowIST.toLocaleDateString('en-IN', { month: 'short' });
    const currentYear = nowIST.getFullYear();

    const countsQuery = await pool.query(`
      SELECT
        COUNT(*) as total_units,
        COUNT(CASE WHEN is_occupied = TRUE THEN 1 END) as occupied_units,
        COUNT(CASE WHEN is_occupied = FALSE THEN 1 END) as vacant_units
      FROM units
    `);

    const monthArray = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    let monthOptionsHTML = '';
    monthArray.forEach(m => {
      monthOptionsHTML += `
        <option value="${m}" ${m === currentMonthShort ? 'selected' : ''}>
          ${m}
        </option>
      `;
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
    console.error("Dashboard Error:", err);
    res.status(500).render('dashboard/hub', {
      title: 'Dashboard',
      total_units: 0,
      occupied_units: 0,
      vacant_units: 0,
      monthOptionsHTML: '',
      currentYear: new Date().getFullYear(),
      error: 'Error loading dashboard: ' + err.message
    });
  }
});

module.exports = router;