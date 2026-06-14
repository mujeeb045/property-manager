// routes/billing/settings.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// GET Settings Page
router.get('/settings', async (req, res) => {
  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonth = (nowIST.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = nowIST.getFullYear();

    res.render('billing/settings', {
      title: 'Settings',
      message: null,
      success: null,
      currentMonth,
      currentYear
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('billing/settings', {
      title: 'Settings',
      message: 'Error loading page',
      success: false,
      currentMonth: '01',
      currentYear: new Date().getFullYear()
    });
  }
});

// POST Generate Monthly Bills (Per Unit)
router.post('/generate-monthly-invoices', async (req, res) => {
  try {
    const { month, year } = req.body;
    const billingMonth = `${month} ${year}`;

    if (!month || !year) {
      return res.status(400).render('billing/settings', {
        title: 'Settings',
        message: "Month and Year are required",
        success: false,
        currentMonth: month || '01',
        currentYear: year || new Date().getFullYear()
      });
    }

    const assignments = await pool.query(`
      SELECT 
        tu.tenant_id,
        tu.unit_id,
        t.name as tenant_name,
        u.unit_name,
        COALESCE(u.rent_amount, 15000) as rent,
        COALESCE(u.maintenance_amount, 0) as maintenance
      FROM tenant_units tu
      JOIN tenants t ON tu.tenant_id = t.id
      JOIN units u ON tu.unit_id = u.id
      WHERE tu.is_active = TRUE AND t.is_active = TRUE
    `);

    let created = 0;

    for (const a of assignments.rows) {
      const existing = await pool.query(`
        SELECT 1 FROM transactions 
        WHERE tenant_id = $1 
          AND tran_type = 'Bill' 
          AND particular ILIKE $2
          AND particular ILIKE $3
      `, [a.tenant_id, `%${billingMonth}%`, `%${a.unit_name}%`]);

      if (existing.rows.length === 0) {
        const total = Number(a.rent) + Number(a.maintenance);

        await pool.query(`
          INSERT INTO transactions (tenant_id, transaction_date, tran_type, particular, amount, notes)
          VALUES ($1, CURRENT_DATE, 'Bill', $2, $3, $4)
        `, [
          a.tenant_id,
          `Monthly Rent - ${billingMonth} (${a.unit_name})`,
          total,
          `Unit: ${a.unit_name} | Tenant: ${a.tenant_name}`
        ]);

        created++;
      }
    }

    res.render('billing/settings', {
      title: 'Settings',
      message: `${created} bills generated for ${billingMonth}`,
      success: true,
      currentMonth: month,
      currentYear: parseInt(year)
    });

  } catch (err) {
    console.error(err);
    res.status(500).render('billing/settings', {
      title: 'Settings',
      message: 'Error generating bills: ' + err.message,
      success: false,
      currentMonth: '01',
      currentYear: new Date().getFullYear()
    });
  }
});

// GET: PDF Download Section in Settings
router.get('/pdf-download', async (req, res) => {
  try {
    const tenants = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.is_active,
        STRING_AGG(u.unit_name, ', ') as unit_names
      FROM tenants t
      LEFT JOIN tenant_units tu ON tu.tenant_id = t.id
      LEFT JOIN units u ON tu.unit_id = u.id
      GROUP BY t.id, t.name, t.is_active
      ORDER BY t.is_active DESC, t.name ASC
    `);

    res.render('billing/pdf-download', {
      title: 'Download Tenant PDF',
      tenants: tenants.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading PDF download page");
  }
});

module.exports = router;