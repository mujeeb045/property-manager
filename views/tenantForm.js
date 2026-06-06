function renderTenantForm(dropdownOptionsHTML) {
  return `
    <h1>
      <span>👤 Allocate Vacant Portion to Tenant</span>
      <a href="/" class="btn btn-secondary" style="padding:6px 14px; font-size:13px;">← Main Hub</a>
    </h1>
    
    <div class="form-box" style="margin-top:25px; background:white; border-color:#cbd5e1;">
      <form action="/allocate-tenant" method="POST">
        <div class="form-grid">
          <div style="flex:2;">
            <label>Select Portion to Allocate</label>
            <select name="unitId" required>
              <option value="" disabled selected>-- Choose an available vacant unit layout --</option>
              ${dropdownOptionsHTML}
            </select>
          </div>
          <div style="flex:1;">
            <label>Security Deposit Received (₹)</label>
            <input type="number" name="securityDeposit" placeholder="e.g. 50000" required>
          </div>
        </div>
        
        <div class="form-grid">
          <div><label>Tenant Full Name</label><input type="text" name="tenantName" placeholder="Full Name" required></div>
          <div><label>Father's Name</label><input type="text" name="fatherName" placeholder="Father's Full Name" required></div>
        </div>
        <div class="form-grid">
          <div><label>Primary Phone Number</label><input type="tel" name="phone" placeholder="e.g. 9876543210" required></div>
          <div><label>Alternate Phone Number</label><input type="tel" name="altPhone" placeholder="Emergency Contact"></div>
        </div>
        <div class="form-grid">
          <div style="width:100%;"><label>Aadhaar Card Number</label><input type="text" name="idCardNo" placeholder="12-Digit Number" required></div>
        </div>
        
        <button type="submit" class="btn btn-primary" style="width: 100%; padding:14px; margin-top:10px;">Register Tenant Profile & Move In</button>
      </form>
    </div>
  `;
}

module.exports = renderTenantForm;