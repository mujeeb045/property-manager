const express = require('express');
const router = express.Router();

const pool = require('../config/db');

const { wrapHTML } = require('../views/layout');
const renderTenantForm = require('../views/tenantForm');


// ========================================
// Tenant Registration Screen
// ========================================

router.get('/register-tenant', async (req, res) => {
  try {

    const vacantUnits = await pool.query(`
      SELECT
        id,
        unit_name,
        rent_amount,
        unit_area
      FROM units
      WHERE is_occupied = FALSE
      ORDER BY unit_name ASC
    `);

    let optionsHTML = '';

    vacantUnits.rows.forEach(u => {

      optionsHTML += `
        <option value="${u.id}">
          ${u.unit_name}
          — (Rent: ₹${Number(u.rent_amount).toLocaleString('en-IN')}
          | Area: ${u.unit_area} Sqft)
        </option>
      `;

    });

    res.send(
      wrapHTML(
        renderTenantForm(optionsHTML)
      )
    );

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Error compiling assignment layouts.');

  }
});


// ========================================
// Allocate Tenant
// ========================================

router.post('/allocate-tenant', async (req, res) => {
  try {

    const {
      unitId,
      tenantName,
      fatherName,
      phone,
      altPhone,
      idCardNo,
      securityDeposit
    } = req.body;

    await pool.query(
      `
      INSERT INTO tenants
      (
        unit_id,
        name,
        father_name,
        phone,
        alt_phone,
        id_card_no,
        security_deposit,
        is_active,
        move_in_date
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,TRUE,CURRENT_DATE
      )
      `,
      [
        unitId,
        tenantName,
        fatherName,
        phone,
        altPhone || 'N/A',
        idCardNo,
        securityDeposit || 0
      ]
    );

    await pool.query(`
      UPDATE units
      SET is_occupied = TRUE
      WHERE id = $1
    `, [unitId]);

    res.redirect('/');

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Allocation insert operation rejected.');

  }
});


// ========================================
// Manage Tenant Profiles
// ========================================

router.get('/manage-profiles', async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        tenants.*,
        units.unit_name,
        units.rent_amount,
        units.maintenance_amount,
        units.unit_area
      FROM tenants
      JOIN units
        ON tenants.unit_id = units.id
      WHERE tenants.is_active = TRUE
      ORDER BY units.unit_name ASC
    `);

    let rowsHTML = '';

    result.rows.forEach(t => {

      rowsHTML += `
        <li
          class="tenant-item"
          style="margin-bottom:12px;padding:16px;"
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:center;
            "
          >

            <div>

              <strong>👤 ${t.name}</strong>

              —
              <span
                style="
                  color:#2563eb;
                  font-weight:600;
                "
              >
                Unit ${t.unit_name}
              </span>

              (${t.unit_area} Sqft)

              <div
                style="
                  font-size:13px;
                  color:#64748b;
                  margin-top:4px;
                "
              >
                Father: ${t.father_name}
                |
                Phone: +91 ${t.phone}
                |
                Rent: ₹${Number(t.rent_amount).toLocaleString('en-IN')}
                <br>

                Aadhaar:
                <span id="id-container-${t.id}">
                  •••• •••• ••••
                </span>

                <span
                  class="reveal-link"
                  onclick="toggleReveal('${t.id}','${String(t.id_card_no).replace(/'/g, "\\'")}')"
                >
                  (Reveal)
                </span>

                <br>

                Move In:
                ${t.move_in_date
                  ? new Date(t.move_in_date).toLocaleDateString('en-IN')
                  : '-'
                }

              </div>

            </div>

            <form
              action="/delete-tenant/${t.id}/${t.unit_id}"
              method="POST"
              style="margin:0;"
            >
              <button
                type="submit"
                class="btn btn-danger"
              >
                🗑️ Move Out
              </button>
            </form>

          </div>
        </li>
      `;

    });

    const wrapperHTML = `
      <h1>
        <span>📋 Manage Profiles Record</span>

        <a
          href="/"
          class="btn btn-secondary"
          style="padding:6px 14px;font-size:13px;"
        >
          ← Main Hub
        </a>
      </h1>

      <ul
        class="tenant-list"
        style="margin-top:20px;"
      >
        ${
          rowsHTML ||
          `
          <li
            class="tenant-item"
            style="
              text-align:center;
              padding:30px;
              color:#64748b;
            "
          >
            No active profile occupants.
          </li>
          `
        }
      </ul>
    `;

    res.send(
      wrapHTML(wrapperHTML)
    );

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Error compiling profile lists.');

  }
});


// ========================================
// Move Out Tenant
// ========================================

router.post('/delete-tenant/:id/:unitId', async (req, res) => {
  try {

    await pool.query(
      `
      UPDATE tenants
      SET
        is_active = FALSE,
        move_out_date = CURRENT_DATE,
        unit_id = NULL
      WHERE id = $1
      `,
      [req.params.id]
    );

    await pool.query(
      `
      UPDATE units
      SET is_occupied = FALSE
      WHERE id = $1
      `,
      [req.params.unitId]
    );

    res.redirect('/manage-profiles');

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send('Profile layout archive operations failed.');

  }
});

module.exports = router;