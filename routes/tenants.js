const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Register Tenant
router.get('/register-tenant', async (req, res) => {
  try {
    const vacantUnits = await pool.query(`
      SELECT id, unit_name, rent_amount, unit_area 
      FROM units WHERE is_occupied = FALSE ORDER BY unit_name ASC
    `);

    res.render('tenants/register', { 
      title: 'Register New Tenant',
      vacantUnits,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('tenants/register', { 
      title: 'Register New Tenant',
      vacantUnits: { rows: [] },
      error: 'Error loading form'
    });
  }
});

// Allocate Tenant (Multiple Units)
router.post('/allocate-tenant', async (req, res) => {
  try {
    const { unitIds, tenantName, fatherName, phone, altPhone, idCardNo, securityDeposit } = req.body;

    const tenantResult = await pool.query(`
      INSERT INTO tenants (name, father_name, phone, alt_phone, id_card_no, security_deposit, is_active, move_in_date)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, CURRENT_DATE) RETURNING id
    `, [tenantName, fatherName, phone, altPhone || null, idCardNo, securityDeposit || 0]);

    const tenantId = tenantResult.rows[0].id;

    if (unitIds) {
      const unitsArray = Array.isArray(unitIds) ? unitIds : [unitIds];
      for (const unitId of unitsArray) {
        await pool.query(`
          INSERT INTO tenant_units (tenant_id, unit_id, move_in_date, is_active)
          VALUES ($1, $2, CURRENT_DATE, TRUE)
        `, [tenantId, unitId]);

        await pool.query(`UPDATE units SET is_occupied = TRUE WHERE id = $1`, [unitId]);
      }
    }

    res.redirect('/manage-profiles');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error allocating tenant");
  }
});

// Manage Profiles (Clean)
router.get('/manage-profiles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.father_name, t.phone, t.security_deposit,
             STRING_AGG(u.unit_name, ', ') as unit_names,
             STRING_AGG(u.id::text, ',') as unit_ids
      FROM tenants t
      LEFT JOIN tenant_units tu ON tu.tenant_id = t.id AND tu.is_active = TRUE
      LEFT JOIN units u ON tu.unit_id = u.id
      WHERE t.is_active = TRUE
      GROUP BY t.id, t.name, t.father_name, t.phone, t.security_deposit
      ORDER BY t.name ASC
    `);

    const vacantUnits = await pool.query(`
      SELECT id, unit_name FROM units WHERE is_occupied = FALSE ORDER BY unit_name ASC
    `);

    let rowsHTML = '';

    result.rows.forEach(t => {
      const unitList = t.unit_names ? t.unit_names.split(', ') : [];
      const unitIdList = t.unit_ids ? t.unit_ids.split(',') : [];

      let unitsHTML = unitList.length ? `<div class="mt-3"><strong>Units:</strong>` : '';
      unitList.forEach((unitName, i) => {
        unitsHTML += `
          <div class="flex justify-between bg-gray-50 px-3 py-2 rounded-lg mt-1">
            <span>• ${unitName}</span>
            <form action="/delete-tenant/${t.id}/${unitIdList[i]}" method="POST" onsubmit="return confirm('Move out?');">
              <button type="submit" class="text-red-600 hover:text-red-700 text-xs px-3 py-1 rounded border border-red-200">Move Out</button>
            </form>
          </div>`;
      });
      if (unitList.length) unitsHTML += '</div>';

      rowsHTML += `
        <div class="bg-white rounded-2xl p-6 shadow-sm border">
          <div class="flex justify-between">
            <div>
              <div class="flex items-center gap-3">
                <strong class="text-xl">👤 ${t.name}</strong>
                <a href="/edit-tenant/${t.id}" class="text-blue-600 text-sm px-3 py-1 border border-blue-200 rounded">Edit</a>
              </div>
              <div class="text-sm text-gray-600 mt-2">
                Father: ${t.father_name || 'N/A'}<br>
                Phone: +91 ${t.phone || 'N/A'}
              </div>
              ${unitsHTML}
            </div>
          </div>

          <form action="/assign-unit" method="POST" class="mt-4 flex gap-2">
            <input type="hidden" name="tenantId" value="${t.id}">
            <select name="unitId" required class="border rounded-xl px-3 py-2 flex-1">
              <option value="">Select Vacant Unit</option>
              ${vacantUnits.rows.map(u => `<option value="${u.id}">${u.unit_name}</option>`).join('')}
            </select>
            <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm">Assign</button>
          </form>
        </div>`;
    });

    res.render('tenants/manage-profiles', { 
      title: 'Manage Active Tenants',
      rowsHTML: rowsHTML || '<p>No active tenants found.</p>',
      error: null
    });

  } catch (err) {
    console.error(err);
    res.status(500).render('tenants/manage-profiles', { title: 'Manage Active Tenants', rowsHTML: '', error: err.message });
  }
});

// Other routes (assign-unit, edit, delete, etc.) remain the same as before

module.exports = router;