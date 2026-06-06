function renderUnitForm(unitsRowsHTML) {
  return `
    <h1>
      <span>🏢 Configure Property Portions / Units</span>
      <a href="/" class="btn btn-secondary" style="padding:6px 14px; font-size:13px;">← Main Hub</a>
    </h1>
    
    <div class="form-box" style="margin-top:20px; background:#f8fafc;">
      <h3>Add a New Portion Asset</h3>
      <form action="/save-unit" method="POST">
        <div class="form-grid">
          <div><label>Portion / Unit Name</label><input type="text" name="unitName" placeholder="e.g. Flat 101, Portion A" required></div>
          <div><label>Portion Area Size (Sq. Ft.)</label><input type="number" name="unitArea" placeholder="e.g. 1200" required></div>
        </div>
        <div class="form-grid">
          <div><label>Standard Monthly Rent (₹)</label><input type="number" name="rentAmount" placeholder="e.g. 15000" required></div>
          <div><label>Standard Monthly Maintenance (₹)</label><input type="number" name="maintenanceAmount" placeholder="e.g. 2000" required></div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Save Unit Layout to Directory</button>
      </form>
    </div>

    <h2>Master Portions Inventory Registry</h2>
    <table style="width:100%; border-collapse:collapse; margin-top:15px; text-align:left;">
      <thead>
        <tr style="background:#1e293b; color:white; font-size:13px; text-transform:uppercase;">
          <th style="padding:12px;">Portion Name</th>
          <th style="padding:12px;">Size (Sqft)</th>
          <th style="padding:12px;">Base Rent (₹)</th>
          <th style="padding:12px;">Maintenance (₹)</th>
          <th style="padding:12px;">Status</th>
          <th style="padding:12px; text-align:right;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${unitsRowsHTML || '<tr><td colspan="6" style="padding:20px; text-align:center; color:#64748b;">No portions found. Use the form above to add an asset.</td></tr>'}
      </tbody>
    </table>

    <script>
      // Live inline row switcher script
      function startInlineEdit(unitId) {
        document.getElementById('view-row-' + unitId).style.display = 'none';
        document.getElementById('edit-row-' + unitId).style.display = 'table-row';
      }

      function cancelInlineEdit(unitId) {
        document.getElementById('edit-row-' + unitId).style.display = 'none';
        document.getElementById('view-row-' + unitId).style.display = 'table-row';
      }
    </script>
  `;
}

module.exports = renderUnitForm;