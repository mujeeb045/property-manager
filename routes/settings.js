const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { wrapHTML } = require('../views/layout');
const ejs = require('ejs');
const path = require('path');

// Settings Page
router.get('/settings', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthShort = nowIST.toLocaleDateString('en-IN', { month: 'short' });
    const currentYear = nowIST.getFullYear();

    const monthArray = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    let monthOptionsHTML = '';
    monthArray.forEach(m => {
      monthOptionsHTML += `
        <option value="${m}" ${m === currentMonthShort ? 'selected' : ''}>
          ${m}
        </option>
      `;
    });

    const pageContent = await ejs.renderFile(
      path.join(__dirname, '../views/settings/index.ejs'), 
      { 
        monthOptionsHTML,
        currentYear 
      }
    );

    res.send(wrapHTML("Settings", pageContent));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading settings page.");
  }
});

module.exports = router;