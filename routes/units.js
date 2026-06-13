// routes/units.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Add / Manage Units Page
router.get('/add-unit', async (req, res) => {
  try {
    const unitsListQuery = await pool.query(`
      SELECT * FROM units ORDER BY unit_name ASC
    `);

    let unitsRowsHTML = '';

    unitsListQuery.rows.forEach(u => {
      const deleteButton = u.is_occupied 
        ? `<span class="text-gray-400 text-sm">Cannot Delete (Occupied)</span>`
        : `
          <form action="/delete-unit/${u.id}" method="POST" style="display:inline;" 
                onsubmit="return confirm('Delete unit ${u.unit_name}?');">
            <button type="submit" class="text-red-600 hover:text-red-700 text-sm font-medium">
              🗑️ Delete
            </button>
          </form>`;

      unitsRowsHTML += `
        <tr id="view-row-${u.id}" class="border-b hover:bg-gray-50">
          <td class="p-5 font-medium">${u.unit_name}</td>
          <td class="p-5">${u.unit_area} Sqft</td>
          <td class="p-5 font-semibold">₹${Number(u.rent_amount).toLocaleString('en-IN')}</td>
          <td class="p-5">₹${Number(u.maintenance_amount).toLocaleString('en-IN')}</td>
          <td class="p-5">
            ${u.is_occupied 
              ? '<span class="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Occupied</span>' 
              : '<span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Vacant</span>'}
          </td>
          <td class="p-5 text-right">
            <button onclick="startInlineEdit('${u.id}')" class="text-blue-600 hover:text-blue-700 mr-4">Edit</button>
            ${deleteButton}
          </td>
        </tr>

        <tr id="edit-row-${u.id}" class="hidden bg-gray-50">
          <form action="/update-unit/${u.id}" method="POST">
            <td class="p-5"><input type="text" name="unitName" value="${u.unit_name}" class="w-full border rounded-lg px-3 py-2"></td>
            <td class="p-5"><input type="number" name="unitArea" value="${u.unit_area}" class="w-full border rounded-lg px-3 py-2"></td>
            <td class="p-5"><input type="number" name="rentAmount" value="${u.rent_amount}" class="w-full border rounded-lg px-3 py-2"></td>
            <td class="p-5"><input type="number" name="maintenanceAmount" value="${u.maintenance_amount}" class="w-full border rounded-lg px-3 py-2"></td>
            <td class="p-5"></td>
            <td class="p-5 text-right">
              <button type="submit" class="bg-emerald-600 text-white px-5 py-2 rounded-lg mr-2">Save</button>
              <button type="button" onclick="cancelInlineEdit('${u.id}')" class="text-gray-600 hover:text-gray-800">Cancel</button>
            </td>
          </form>
        </tr>`;
    });

    res.render('units/add-unit', { 
      title: 'Units Management',
      unitsRowsHTML 
    });

  } catch (err) {
    console.error("Units Page Error:", err);
    res.status(500).render('units/add-unit', { 
      title: 'Units Management',
      error: 'Error loading units page' 
    });
  }
});

// Save Unit
router.post('/save-unit', async (req, res) => {
  try {
    const { unitName, unitArea, rentAmount, maintenanceAmount } = req.body;

    await pool.query(`
      INSERT INTO units (unit_name, unit_area, rent_amount, maintenance_amount)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(unit_name) 
      DO UPDATE SET 
        unit_area = $2,
        rent_amount = $3,
        maintenance_amount = $4
    `, [unitName, unitArea || 0, rentAmount || 0, maintenanceAmount || 0]);

    res.redirect('/add-unit');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving unit.");
  }
});

// Update Unit
router.post('/update-unit/:unitId', async (req, res) => {
  try {
    const { unitName, unitArea, rentAmount, maintenanceAmount } = req.body;
    const unitId = req.params.unitId;

    await pool.query(`
      UPDATE units 
      SET unit_name = $1, unit_area = $2, rent_amount = $3, maintenance_amount = $4
      WHERE id = $5
    `, [unitName, unitArea || 0, rentAmount || 0, maintenanceAmount || 0, unitId]);

    res.redirect('/add-unit');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating unit.");
  }
});

// Delete Unit
router.post('/delete-unit/:unitId', async (req, res) => {
  try {
    const unitId = req.params.unitId;

    const check = await pool.query('SELECT is_occupied FROM units WHERE id = $1', [unitId]);
    
    if (check.rows[0]?.is_occupied) {
      return res.status(400).send("Cannot delete an occupied unit.");
    }

    await pool.query('DELETE FROM units WHERE id = $1', [unitId]);
    res.redirect('/add-unit');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting unit.");
  }
});

module.exports = router;