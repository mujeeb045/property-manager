const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { wrapHTML } = require('../../views/layout');
const ejs = require('ejs');
const path = require('path');

// ========================
// History and Details Page
// ========================
router.get('/history', async (req, res) => {
  try {
    const tenants = await pool.query(`
      SELECT 
        tenants.id,
        tenants.name,
        tenants.father_name,
        tenants.phone,
        tenants.id_card_no,
        tenants.security_deposit,
        tenants.is_active,
        tenants.move_out_date,
        COALESCE(units.unit_name, 'No Unit / Departed') as unit_name
      FROM tenants 
      LEFT JOIN units ON tenants.unit_id = units.id 
      ORDER BY tenants.name ASC
    `);

    let tenantListHTML = '';

    tenants.rows.forEach(tenant => {
      const status = tenant.is_active 
        ? `<span class="inline-block px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>` 
        : `<span class="inline-block px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full">Left</span>`;

      tenantListHTML += `
        <div class="tenant-card bg-white rounded-2xl p-6 border border-gray-100 hover:border-emerald-300 cursor-pointer"
             data-id="${tenant.id}"
             data-name="${tenant.name}">
          <div class="flex justify-between items-start">
            <div>
              <strong class="text-lg">👤 ${tenant.name}</strong>
              <p class="text-gray-500 text-sm mt-1">${tenant.unit_name}</p>
            </div>
            ${status}
          </div>
        </div>
      `;
    });

    const pageContent = await ejs.renderFile(
      path.join(__dirname, '../../views/billing/history.ejs'), 
      { 
        tenantListHTML,
        tenantsData: tenants.rows 
      }
    );

    res.send(wrapHTML("History & Details", pageContent));

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading history page.");
  }
});

module.exports = router;