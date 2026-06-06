function renderHubView(stats, monthOptionsHTML, currentYear) {
  return `
    <h1>🏠 Property Management Asset Hub</h1>
    
    <div class="flex-stats" style="margin-top: 20px;">
      <div class="stat-card stat-card-total"><small>Total Portions Inventory</small><h2>${stats.total_units || 0} Units</h2></div>
      <div class="stat-card stat-card-occupied"><small>🔴 Occupied Portions</small><h2>${stats.occupied_units || 0} Occupied</h2></div>
      <div class="stat-card stat-card-vacant"><small>🟢 Vacant / Available</small><h2>${stats.vacant_units || 0} Vacant</h2></div>
    </div>
    
    <div style="border-bottom:1px solid #f1f5f9; padding-bottom:15px;">
      <h2>⚡ Monthly Billing Cycle Engine</h2>
      <form action="/generate-monthly-invoices" method="POST" onsubmit="return confirmBatchGeneration();" class="batch-billing-panel">
        <div style="flex:1;">
          <label style="color:#cbd5e1;">Select Month Cycle</label>
          <select id="targetMonth" name="targetMonth">${monthOptionsHTML}</select>
        </div>
        <div style="flex:1;">
          <label style="color:#cbd5e1;">Select Year</label>
          <input type="number" id="targetYear" name="targetYear" value="${currentYear}" min="2020" max="2100" required>
        </div>
        <div>
          <button type="submit" class="btn btn-primary" style="background:#10b981; padding:9px 20px;">Generate Monthly Bills</button>
        </div>
      </form>
    </div>

    <div class="hub-menu-grid">
      <a href="/tenants" class="hub-btn">
        <span class="hub-icon-wrap">📂 <span>Access Billing Ledgers & Invoices</span></span>
        <span class="hub-arrow">→</span>
      </a>
      <a href="/add-unit" class="hub-btn" style="background: #fdf8f6;">
        <span class="hub-icon-wrap">🏢 <span>Add / Configure Property Portions</span></span>
        <span class="hub-arrow">→</span>
      </a>
      <a href="/register-tenant" class="hub-btn">
        <span class="hub-icon-wrap">👤 <span>Allocate Vacant Unit to Tenant</span></span>
        <span class="hub-arrow">→</span>
      </a>
      <a href="/manage-profiles" class="hub-btn">
        <span class="hub-icon-wrap">🗑️ <span>Manage / Remove Tenant Profiles</span></span>
        <span class="hub-arrow">→</span>
      </a>
    </div>
  `;
}

module.exports = renderHubView;