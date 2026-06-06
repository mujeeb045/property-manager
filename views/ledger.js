function renderLedgerView(selectedMonth, grossCollected, grossOutstanding, dropdownOptions, tenantRows) {
  return `
    <h1>
      <span>Monthly Financial Ledgers</span>
      <div class="top-nav-box">
        <a href="/" class="btn btn-secondary" style="padding:6px 14px; font-size:13px; background:#f8fafc;">🏠 Go to Dashboard</a>
        <a href="/export-ledger/${encodeURIComponent(selectedMonth)}" class="btn btn-primary" style="padding:6px 14px; font-size:13px; background:#059669;">📊 Export Excel</a>
        <form method="GET" action="/tenants" style="margin:0; display:flex; align-items:center; gap:8px;">
          <select name="month" onchange="this.form.submit()" style="margin:0; padding:6px 12px; width:130px; font-size:13px;">${dropdownOptions}</select>
        </form>
      </div>
    </h1>
    
    <div class="flex-stats">
      <div class="stat-card stat-card-paid"><small>Total Collected (${selectedMonth})</small><h2>₹${grossCollected.toLocaleString('en-IN')}</h2></div>
      <div class="stat-card stat-card-unpaid"><small>Outstanding Dues (${selectedMonth})</small><h2>₹${grossOutstanding.toLocaleString('en-IN')}</h2></div>
    </div>

    <div class="search-box" style="margin-bottom: 25px;">
      <input type="text" id="tenantSearch" onkeyup="filterTenants()" placeholder="Search by Tenant Name, Unit Number, or Phone...">
    </div>

    <div style="background: #1e293b; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; display: flex; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
      <div style="flex: 2;">Occupant Profile & Unit</div>
      <div style="flex: 1; text-align: center;">Net Due</div>
      <div style="flex: 2; text-align: right; padding-right: 10px;">Quick Payment Actions</div>
    </div>

    <ul class="tenant-list" style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: white; overflow: hidden;">
      ${tenantRows || `<li style="color:#64748b; text-align:center; padding: 40px; list-style: none;">No generated statements found for ${selectedMonth}.</li>`}
    </ul>
    
    <div style="margin-top:25px; border-top:1px solid #e2e8f0; padding-top:20px;"><a href="/" class="btn btn-secondary">← Back to Dashboard Input</a></div>
  `;
}

module.exports = renderLedgerView;