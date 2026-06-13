const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Register Tenant Page
router.get('/register-tenant', async (req, res) => {
  try {
    const vacantUnits = await pool.query(`
      SELECT id, unit_name, rent_amount, unit_area 
      FROM units 
      WHERE is_occupied = FALSE 
      ORDER BY unit_name ASC
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

// Allocate Tenant (Multiple Units Supported)
router.post('/allocate-tenant', async (req, res) => {
  try {
    const { unitIds, tenantName, fatherName, phone, altPhone, idCardNo, securityDeposit } = req.body;

    const tenantResult = await pool.query(`
      INSERT INTO tenants (name, father_name, phone, alt_phone, id_card_no, security_deposit, is_active, move_in_date)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, CURRENT_DATE)
      RETURNING id
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

// Manage Tenants (Clean Version)
router.get('/manage-profiles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.id, t.name, t.father_name, t.phone, t.security_deposit,
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
      SELECT id, unit_name FROM units 
      WHERE is_occupied = FALSE 
      ORDER BY unit_name ASC
    `);

    let rowsHTML = '';

    result.rows.forEach(t => {
      const unitList = t.unit_names ? t.unit_names.split(', ') : [];
      const unitIdList = t.unit_ids ? t.unit_ids.split(',') : [];

      let unitsHTML = '';
      if (unitList.length > 0) {
        unitsHTML = `<div class="mt-3 text-sm"><strong>Units:</strong>`;
        unitList.forEach((unitName, index) => {
          unitsHTML += `
            <div class="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg mt-1">
              <span>• ${unitName}</span>
              <form action="/delete-tenant/${t.id}/${unitIdList[index]}" method="POST" 
                    onsubmit="return confirm('Move out from this unit?');">
                <button type="submit" class="text-red-600 hover:text-red-700 text-xs px-3 py-1 rounded border border-red-200">
                  Move Out
                </button>
              </form>
            </div>
          `;
        });
        unitsHTML += `</div>`;
      }

      rowsHTML += `
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <strong class="text-xl">👤 ${t.name}</strong>
                <a href="/edit-tenant/${t.id}" class="text-blue-600 hover:text-blue-700 text-sm px-3 py-1 rounded border border-blue-200">✏️ Edit</a>
              </div>
              <div class="text-sm text-gray-600 mt-2">
                Father: ${t.father_name || 'N/A'}<br>
                Phone: +91 ${t.phone || 'N/A'}<br>
                Security Deposit: ₹${Number(t.security_deposit || 0).toLocaleString('en-IN')}
              </div>
              ${unitsHTML}
            </div>
          </div>

          <!-- Assign Additional Unit -->
          <form action="/assign-unit" method="POST" class="mt-4 flex gap-2">
            <input type="hidden" name="tenantId" value="${t.id}">
            <select name="unitId" required class="border border-gray-300 rounded-xl px-3 py-2 text-sm flex-1">
              <option value="">Select Vacant Unit</option>
              ${vacantUnits.rows.map(u => `<option value="${u.id}">${u.unit_name}</option>`).join('')}
            </select>
            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
              Assign Unit
            </button>
          </form>
        </div>
      `;
    });

    res.render('tenants/manage-profiles', { 
      title: 'Manage Active Tenants',
      rowsHTML: rowsHTML || '<p class="text-gray-500 text-center py-12">No active tenants found.</p>',
      error: null
    });

  } catch (err) {
    console.error(err);
    res.status(500).render('tenants/manage-profiles', { 
      title: 'Manage Active Tenants',
      rowsHTML: '',
      error: 'Error loading profiles'
    });
  }
});

// Assign Additional Unit
router.post('/assign-unit', async (req, res) => {
  try {
    const { tenantId, unitId } = req.body;

    const unitCheck = await pool.query(`SELECT is_occupied FROM units WHERE id = $1`, [unitId]);
    if (!unitCheck.rows[0] || unitCheck.rows[0].is_occupied) {
      return res.status(400).send("This unit is already occupied");
    }

    await pool.query(`
      INSERT INTO tenant_units (tenant_id, unit_id, move_in_date, is_active)
      VALUES ($1, $2, CURRENT_DATE, TRUE)
    `, [tenantId, unitId]);

    await pool.query(`UPDATE units SET is_occupied = TRUE WHERE id = $1`, [unitId]);
    res.redirect('/manage-profiles');

  } catch (err) {
    console.error(err);
    res.status(500).send("Error assigning unit");
  }
});

// Edit Tenant
router.get('/edit-tenant/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM tenants WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).send("Tenant not found");

    res.render('tenants/edit-tenant', {
      title: 'Edit Tenant',
      tenant: result.rows[0],
      error: null
    });
  } catch (err) {
    res.status(500).send("Error loading form");
  }
});

router.post('/update-tenant/:id', async (req, res) => {
  try {
    const { name, fatherName, phone, altPhone, idCardNo, securityDeposit } = req.body;
    await pool.query(`
      UPDATE tenants SET name = $1, father_name = $2, phone = $3, alt_phone = $4, 
      id_card_no = $5, security_deposit = $6 WHERE id = $7
    `, [name, fatherName, phone, altPhone || null, idCardNo, securityDeposit || 0, req.params.id]);

    res.redirect('/manage-profiles');
  } catch (err) {
    res.status(500).send("Error updating tenant");
  }
});

// Move Out from Specific Unit
router.post('/delete-tenant/:tenantId/:unitId', async (req, res) => {
  try {
    const { tenantId, unitId } = req.params;

    await pool.query(`
      UPDATE tenant_units SET is_active = FALSE, move_out_date = CURRENT_DATE 
      WHERE tenant_id = $1 AND unit_id = $2
    `, [tenantId, unitId]);

    await pool.query(`UPDATE units SET is_occupied = FALSE WHERE id = $1`, [unitId]);

    const activeCount = await pool.query(`
      SELECT COUNT(*) FROM tenant_units WHERE tenant_id = $1 AND is_active = TRUE
    `, [tenantId]);

    if (parseInt(activeCount.rows[0].count) === 0) {
      await pool.query(`UPDATE tenants SET is_active = FALSE, move_out_date = CURRENT_DATE WHERE id = $1`, [tenantId]);
    }

    res.redirect('/manage-profiles');
  } catch (err) {
    res.status(500).send("Error moving out");
  }
});

module.exports = router;