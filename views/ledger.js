function renderLedgerView(selectedMonth, grossCollected, grossOutstanding, dropdownOptions, tenantRows) {
  return `
    <h1>
      <span>Monthly Financial Ledgers</span>
      <div class="top-nav-box">
        <a href="/" class="btn btn-secondary" style="padding:6px 14px; font-size:13px; background:#f8fafc;">🏠 Go to Dashboard</a>
        <form method="GET" action="/tenants" style="margin:0; display:flex; align-items:center; gap:8px;">
          <select name="month" onchange="this.form.submit()" style="margin:0; padding:6px 12px; width:130px; font-size:13px;">${dropdownOptions}</select>
        </form>
      </div>
    </h1>
    
    <div class="flex-stats">
      <div class="stat-card stat-card-paid"><small>Total Collected (${selectedMonth})</small><h2>₹${grossCollected.toLocaleString('en-IN')}</h2></div>
      <div class="stat-card stat-card-unpaid"><small>Outstanding Dues (${selectedMonth})</small><h2>₹${grossOutstanding.toLocaleString('en-IN')}</h2></div>
    </div>

    <div class="search-box">
      <input type="text" id="tenantSearch" onkeyup="filterTenants()" placeholder="Search by Tenant Name, Unit Number, Father's name, or Phone...">
    </div>

    <h3>Billing Ledger Roll - ${selectedMonth}</h3>
    <ul class="tenant-list">
      ${tenantRows || `<li class="tenant-item" style="color:#64748b; text-align:center;">No bills generated for ${selectedMonth} yet. Go back to Dashboard and select a cycle to generate.</li>`}
    </ul>
    <div style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:20px;"><a href="/" class="btn btn-secondary">← Back to Dashboard Input</a></div>
  `;
}

module.exports = renderLedgerView;