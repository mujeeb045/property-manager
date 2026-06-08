const express = require('express');
const router = express.Router();

const pool = require('../config/db');

const { wrapHTML } = require('../views/layout');
const renderHubView = require('../views/hub');

// Dashboard / Landing Page
router.get('/', async (req, res) => {
  try {

    const nowIST = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata"
      })
    );

    const currentMonthShort = nowIST.toLocaleDateString(
      'en-IN',
      { month: 'short' }
    );

    const currentYear = nowIST.getFullYear();

    const countsQuery = await pool.query(`
      SELECT
        COUNT(*) as total_units,
        COUNT(CASE WHEN is_occupied = TRUE THEN 1 END) as occupied_units,
        COUNT(CASE WHEN is_occupied = FALSE THEN 1 END) as vacant_units
      FROM units
    `);

    const monthArray = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ];

    let monthOptionsHTML = '';

    monthArray.forEach(m => {
      monthOptionsHTML += `
        <option
          value="${m}"
          ${m === currentMonthShort ? 'selected' : ''}
        >
          ${m}
        </option>
      `;
    });

    const body = renderHubView(
      countsQuery.rows[0],
      monthOptionsHTML,
      currentYear
    );

    res.send(wrapHTML(body));

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Hub configuration reading error.');

  }
});

module.exports = router;