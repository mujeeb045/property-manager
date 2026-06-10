const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { wrapHTML } = require('../../views/layout');   // ← Correct path

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

    res.send(wrapHTML("History & Details", `
      <div class="max-w-6xl mx-auto px-4">
        <h1 class="text-3xl font-bold mb-2">History & Details</h1>
        <p class="text-gray-600 mb-8">Click on any tenant to view full transaction history</p>

        <div class="mb-8">
          <input type="text" id="tenantSearch" 
                 placeholder="Search tenants by name..." 
                 onkeyup="filterTenants()"
                 class="w-full border border-gray-300 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="tenantList">
          ${tenantListHTML || '<p class="col-span-full text-center py-12 text-gray-500">No tenants found.</p>'}
        </div>
      </div>

      <script>
        function filterTenants() {
          const filter = document.getElementById("tenantSearch").value.toLowerCase();
          const cards = document.getElementsByClassName("tenant-card");
          for (let i = 0; i < cards.length; i++) {
            const text = cards[i].textContent.toLowerCase();
            cards[i].style.display = text.includes(filter) ? "" : "none";
          }
        }
      </script>
    `));

  } catch (err) {
    console.error("History Page Error:", err.message);
    res.status(500).send(`Error loading history: ${err.message}`);
  }
});

module.exports = router;