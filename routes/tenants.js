const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { wrapHTML } = require('../views/layout');
const ejs = require('ejs');
const path = require('path');

// ========================================
// Tenant Registration Screen
// ========================================

router.get('/register-tenant', async (req, res) => {
  try {
    const vacantUnits = await pool.query(`
      SELECT id, unit_name, rent_amount, unit_area 
      FROM units 
      WHERE is_occupied = FALSE 
      ORDER BY unit_name ASC
    `);

    let vacantUnitsOptions = '';
    vacantUnits.rows.forEach(u => {
      vacantUnitsOptions += `
        <option value="${u.id}">
          ${u.unit_name} — (Rent: ₹${Number(u.rent_amount).toLocaleString('en-IN')} | ${u.unit_area} Sqft)
        </option>
      `;
    });

    const pageContent = await ejs.renderFile(
      path.join(__dirname, '../views/tenants/register.ejs'), 
      { vacantUnitsOptions }
    );

    res.send(wrapHTML("Register New Tenant", pageContent));

  } catch (err) {
    console.error("Register Tenant Error:", err);
    res.status(500).send("Error loading registration form.");
  }
});

// ========================================
// Allocate Tenant
// ========================================

router.post('/allocate-tenant', async (req, res) => {
  try {
    const { unitId, tenantName, fatherName, phone, altPhone, idCardNo, securityDeposit } = req.body;

    await pool.query(`
      INSERT INTO tenants (unit_id, name, father_name, phone, alt_phone, id_card_no, security_deposit, is_active, move_in_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, CURRENT_DATE)
    `, [unitId, tenantName, fatherName, phone, altPhone || 'N/A', idCardNo, securityDeposit || 0]);

    await pool.query(`UPDATE units SET is_occupied = TRUE WHERE id = $1`, [unitId]);

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error allocating tenant.");
  }
});

// ========================================
// Manage Tenant Profiles
// ========================================

router.get('/manage-profiles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tenants.*, units.unit_name, units.rent_amount, units.unit_area
      FROM tenants 
      JOIN units ON tenants.unit_id = units.id 
      WHERE tenants.is_active = TRUE 
      ORDER BY units.unit_name ASC
    `);

    let rowsHTML = '';

    result.rows.forEach(t => {
      rowsHTML += `
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
          <div class="flex justify-between items-start">
            <div>
              <strong class="text-lg">👤 ${t.name}</strong> 
              <span class="text-emerald-600 font-medium">— Unit ${t.unit_name}</span>
              <div class="text-sm text-gray-600 mt-2">
                Father: ${t.father_name}<br>
                Phone: +91 ${t.phone}<br>
                Rent: ₹${Number(t.rent_amount).toLocaleString('en-IN')}<br>
                Move-in: ${t.move_in_date ? new Date(t.move_in_date).toLocaleDateString('en-IN') : '-'}
              </div>
            </div>
            <form action="/delete-tenant/${t.id}/${t.unit_id}" method="POST" 
                  onsubmit="return confirm('Move out tenant ${t.name}?');">
              <button type="submit" class="text-red-600 hover:text-red-700 px-5 py-2 rounded-xl border border-red-200 hover:bg-red-50">
                Move Out
              </button>
            </form>
          </div>
        </div>
      `;
    });

    const pageContent = `
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-8">Manage Active Tenants</h1>
        ${rowsHTML || '<p class="text-gray-500 text-center py-12">No active tenants found.</p>'}
      </div>
    `;

    res.send(wrapHTML("Manage Tenants", pageContent));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading tenant profiles.");
  }
});

// ========================================
// Move Out Tenant
// ========================================

router.post('/delete-tenant/:id/:unitId', async (req, res) => {
  try {
    await pool.query(`
      UPDATE tenants 
      SET is_active = FALSE, move_out_date = CURRENT_DATE, unit_id = NULL 
      WHERE id = $1
    `, [req.params.id]);

    await pool.query(`UPDATE units SET is_occupied = FALSE WHERE id = $1`, [req.params.unitId]);

    res.redirect('/manage-profiles');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error moving out tenant.");
  }
});

module.exports = router;