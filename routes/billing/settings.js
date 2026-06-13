// routes/billing/settings.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// ========================
// GET: Settings Page
// ========================
router.get('/settings', async (req, res) => {
  try {
    res.render('billing/settings', {
      title: 'Settings',
      message: null,
      success: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('billing/settings', {
      title: 'Settings',
      message: 'Error loading settings page',
      success: false
    });
  }
});

// ========================
// POST: Generate Monthly Bills
// ========================
router.post('/generate-monthly-invoices', async (req, res) => {
  try {
    const { month, year } = req.body;
    const billingMonth = `${month} ${year}`;

    if (!month || !year) {
      return res.status(400).render('billing/settings', {
        title: 'Settings',
        message: "Month and Year are required",
        success: false
      });
    }

    const tenants = await pool.query(`
      SELECT t.id, t.name, COALESCE(u.unit_name, 'N/A') as unit_name,
             COALESCE(u.rent_amount, 15000) as rent,
             COALESCE(u.maintenance_amount, 0) as maintenance
      FROM tenants t 
      LEFT JOIN units u ON t.unit_id = u.id
      WHERE t.is_active = true
    `);

    let created = 0;

    for (const t of tenants.rows) {
      const existing = await pool.query(`
        SELECT 1 FROM transactions 
        WHERE tenant_id = $1 
          AND tran_type = 'Bill' 
          AND particular ILIKE $2
      `, [t.id, `%${billingMonth}%`]);

      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO transactions 
            (tenant_id, tran_type, particular, amount, notes)
          VALUES ($1, 'Bill', $2, $3, $4)
        `, [
          t.id, 
          `Monthly Rent - ${billingMonth}`, 
          Number(t.rent) + Number(t.maintenance), 
          `Unit: ${t.unit_name}`
        ]);
        created++;
      }
    }

    res.render('billing/settings', {
      title: 'Settings',
      message: `${created} bills generated successfully for ${billingMonth}`,
      success: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).render('billing/settings', {
      title: 'Settings',
      message: 'Error generating bills: ' + err.message,
      success: false
    });
  }
});

module.exports = router;