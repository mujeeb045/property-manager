const express = require('express');
const router = express.Router();

const pool = require('../config/db');

const { wrapHTML } = require('../views/layout');
const renderUnitForm = require('../views/unitForm');


// ========================================
// Add / Edit Unit Screen
// ========================================

router.get('/add-unit', async (req, res) => {
  try {

    const unitsListQuery = await pool.query(`
      SELECT *
      FROM units
      ORDER BY unit_name ASC
    `);

    let rowsHTML = '';

    unitsListQuery.rows.forEach(u => {

      const deleteButton = u.is_occupied
        ? `
          <span style="font-size:12px;color:#94a3b8;font-style:italic;">
            Cannot Delete (Occupied)
          </span>
        `
        : `
          <form
            action="/delete-unit/${u.id}"
            method="POST"
            style="margin:0;display:inline;"
            onsubmit="return confirm('Are you sure you want to permanently remove [${u.unit_name}]?');"
          >
            <button
              type="submit"
              class="btn btn-danger"
              style="padding:4px 8px;font-size:12px;background:#ef4444;"
            >
              🗑️ Delete
            </button>
          </form>
        `;

      rowsHTML += `
        <tr
          id="view-row-${u.id}"
          style="font-size:14px;border-bottom:1px solid #e2e8f0;"
        >
          <td style="padding:10px;font-weight:600;">
            🏢 ${u.unit_name}
          </td>

          <td style="padding:10px;">
            ${u.unit_area} Sqft
          </td>

          <td style="padding:10px;font-weight:600;">
            ₹${Number(u.rent_amount).toLocaleString('en-IN')}
          </td>

          <td style="padding:10px;">
            ₹${Number(u.maintenance_amount).toLocaleString('en-IN')}
          </td>

          <td style="padding:10px;">
            ${
              u.is_occupied
                ? '<span class="badge badge-unpaid">Occupied</span>'
                : '<span class="badge badge-paid">Vacant</span>'
            }
          </td>

          <td
            style="
              padding:10px;
              text-align:right;
              display:flex;
              justify-content:flex-end;
              gap:6px;
              align-items:center;
            "
          >
            <button
              class="btn btn-secondary"
              onclick="startInlineEdit('${u.id}')"
              style="padding:4px 8px;font-size:12px;"
            >
              📝 Edit
            </button>

            ${deleteButton}
          </td>
        </tr>

        <tr
          id="edit-row-${u.id}"
          style="
            display:none;
            font-size:14px;
            background:#f8fafc;
            border-bottom:1px solid #cbd5e1;
          "
        >
          <form action="/update-unit/${u.id}" method="POST">

            <td style="padding:6px 10px;">
              <input
                type="text"
                name="unitName"
                value="${u.unit_name}"
                required
                style="margin:0;padding:6px;font-size:13px;"
              >
            </td>

            <td style="padding:6px 10px;">
              <input
                type="number"
                name="unitArea"
                value="${u.unit_area}"
                required
                style="margin:0;padding:6px;font-size:13px;width:90px;"
              >
            </td>

            <td style="padding:6px 10px;">
              <input
                type="number"
                name="rentAmount"
                value="${u.rent_amount}"
                required
                style="
                  margin:0;
                  padding:6px;
                  font-size:13px;
                  width:100px;
                  font-weight:600;
                "
              >
            </td>

            <td style="padding:6px 10px;">
              <input
                type="number"
                name="maintenanceAmount"
                value="${u.maintenance_amount}"
                required
                style="margin:0;padding:6px;font-size:13px;width:100px;"
              >
            </td>

            <td
              style="
                padding:10px;
                color:#64748b;
                font-style:italic;
                font-size:13px;
              "
            >
              ${u.is_occupied ? 'Occupied' : 'Vacant'}
            </td>

            <td
              style="
                padding:6px 10px;
                text-align:right;
                white-space:nowrap;
              "
            >
              <button
                type="submit"
                class="btn btn-success"
                style="padding:4px 10px;font-size:12px;margin-right:4px;"
              >
                💾 Save
              </button>

              <button
                type="button"
                class="btn btn-secondary"
                onclick="cancelInlineEdit('${u.id}')"
                style="padding:4px 10px;font-size:12px;"
              >
                ❌ Esc
              </button>
            </td>

          </form>
        </tr>
      `;
    });

    res.send(
      wrapHTML(
        renderUnitForm(rowsHTML)
      )
    );

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Error reading assets layout forms.');

  }
});


// ========================================
// Save Unit
// ========================================

router.post('/save-unit', async (req, res) => {
  try {

    const {
      unitName,
      unitArea,
      rentAmount,
      maintenanceAmount
    } = req.body;

    await pool.query(`
      INSERT INTO units
      (
        unit_name,
        unit_area,
        rent_amount,
        maintenance_amount
      )
      VALUES ($1,$2,$3,$4)
      ON CONFLICT(unit_name)
      DO UPDATE
      SET
        unit_area = $2,
        rent_amount = $3,
        maintenance_amount = $4
    `, [
      unitName,
      unitArea || 0,
      rentAmount || 0,
      maintenanceAmount || 0
    ]);

    res.redirect('/add-unit');

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Portion save database collision error.');

  }
});


// ========================================
// Update Unit
// ========================================

router.post('/update-unit/:unitId', async (req, res) => {
  try {

    const unitId = req.params.unitId;

    const {
      unitName,
      unitArea,
      rentAmount,
      maintenanceAmount
    } = req.body;

    await pool.query(`
      UPDATE units
      SET
        unit_name = $1,
        unit_area = $2,
        rent_amount = $3,
        maintenance_amount = $4
      WHERE id = $5
    `, [
      unitName,
      unitArea || 0,
      rentAmount || 0,
      maintenanceAmount || 0,
      unitId
    ]);

    res.redirect('/add-unit');

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Error compiling inline portion updates.');

  }
});


// ========================================
// Delete Unit
// ========================================

router.post('/delete-unit/:unitId', async (req, res) => {
  try {

    const unitId = req.params.unitId;

    const checkQuery = await pool.query(`
      SELECT is_occupied
      FROM units
      WHERE id = $1
    `, [unitId]);

    if (
      checkQuery.rows.length > 0 &&
      checkQuery.rows[0].is_occupied
    ) {
      return res
        .status(400)
        .send(
          'Operation Rejected: You cannot delete an occupied unit.'
        );
    }

    await pool.query(`
      DELETE FROM units
      WHERE id = $1
    `, [unitId]);

    res.redirect('/add-unit');

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Error wiping property portion record asset.');

  }
});

module.exports = router;