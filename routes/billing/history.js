// routes/billing/history.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.get('/history', async (req, res) => {
  try {
    const tenants = await pool.query(`
      SELECT 
        tenants.id,
        tenants.name,
        tenants.father_name,
        tenants.phone,
        COALESCE(units.unit_name, 'No Unit / Departed') as unit_name,
        tenants.is_active,
        tenants.move_out_date
      FROM tenants 
      LEFT JOIN units ON tenants.unit_id = units.id 
      ORDER BY tenants.name ASC
    `);

    let tenantListHTML = '';

    tenants.rows.forEach(tenant => {
      const status = tenant.is_active 
        ? `<span class="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>` 
        : `<span class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full">Left</span>`;

      tenantListHTML += `
        <div onclick="window.location.href='/history/tenant/${tenant.id}'" 
             class="tenant-card bg-white rounded-2xl p-6 border border-gray-100 hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all">
          <div class="flex justify-between items-start">
            <div>
              <strong class="text-lg">👤 ${tenant.name}</strong>
              <p class="text-gray-600 mt-1">${tenant.unit_name}</p>
            </div>
            ${status}
          </div>
          <p class="text-sm text-gray-500 mt-3">${tenant.phone || 'No phone'}</p>
        </div>
      `;
    });

    res.render('billing/history', {
      title: 'History & Details',
      tenantListHTML: tenantListHTML || '<p class="col-span-full text-center py-12 text-gray-500">No tenants found.</p>',
      error: null
    });

  } catch (err) {
    console.error("History Page Error:", err.message);
    res.status(500).render('billing/history', {
      title: 'History & Details',
      tenantListHTML: '',
      error: `Error loading history: ${err.message}`
    });
  }
});

module.exports = router;