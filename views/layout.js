const HTML_HEAD = `
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px; display: flex; justify-content: center; }
      .container { width: 100%; max-width: 950px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
      h1 { color: #0f172a; margin-top: 0; font-size: 26px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
      h2 { color: #1e293b; font-size: 19px; font-weight: 600; margin-top: 0; margin-bottom: 15px; }
      h3 { color: #475569; margin-top: 0; margin-bottom: 20px; font-size: 16px; font-weight: 500; }
      label { font-weight: 600; font-size: 13px; color: #475569; display: block; margin-bottom: 6px; }
      input, select { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; margin-bottom: 14px; font-size: 14px; background: white; }
      .form-grid { display: flex; gap: 16px; margin-bottom: 4px; }
      .form-grid > div { flex: 1; }
      .form-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; margin-bottom: 25px; }
      .btn { display: inline-block; padding: 12px 24px; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; text-align: center; box-sizing: border-box; }
      .btn-primary { background: #2563eb; color: white; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .btn-success { background: #10b981; color: white; padding: 8px 16px; font-size: 13px; border-radius: 6px; font-weight: 600; }
      .btn-danger { background: #ef4444; color: white; padding: 6px 12px; font-size: 13px; border-radius: 4px; }
      .btn-info { background: #0284c7; color: white; padding: 8px 14px; font-size: 13px; border-radius: 6px; text-decoration: none; font-weight: 600; }
      
      .hub-menu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
      .hub-btn { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #0f172a; font-weight: 600; font-size: 15px; }
      .hub-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
      .flex-stats { display: flex; gap: 16px; margin-bottom: 25px; }
      .stat-card { flex: 1; padding: 18px 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
      .stat-card-occupied { background: #fff1f2; border-left-color: #f43f5e; color: #9f1239; }
      .stat-card-vacant { background: #f0fdf4; border-left-color: #22c55e; color: #166534; }
      .stat-card-total { background: #f8fafc; border-left-color: #64748b; color: #334155; }
      .tenant-list { list-style: none; padding: 0; margin: 0; }
      .tenant-item { display: flex; flex-direction: column; border-bottom: 1px solid #f1f5f9; background: #ffffff; margin-bottom: 0; border-radius: 0; }
      .row-summary { display: flex; align-items: center; padding: 16px 20px; cursor: pointer; transition: background 0.15s ease; position: relative; }
      .row-summary:hover { background: #f8fafc; }
      .col-name { flex: 2; font-weight: 600; color: #0f172a; font-size: 15px; display: flex; align-items: center; gap: 10px; }
      .col-due { flex: 1; font-weight: 700; text-align: center; font-size: 15px; }
      .col-actions { flex: 2; display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
      .pay-input { width: 110px; padding: 8px 12px; margin: 0; font-size: 13px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; text-align: right; }
      .row-drawer { display: none; background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 24px; box-sizing: border-box; }
      .search-box { position: relative; margin-bottom: 25px; }
      .search-box input { width: 100%; padding: 12px 16px 12px 40px; font-size: 15px; border-radius: 8px; background-color: #f1f5f9; border: 1px solid #e2e8f0; margin-bottom: 0; box-sizing: border-box; }
      .search-box::before { content: "🔍"; position: absolute; left: 14px; top: 12px; font-size: 16px; color: #64748b; }
      .top-nav-box { display: flex; align-items: center; gap: 10px; }
    </style>
    <script>
      function toggleDrawer(invoiceId, event) {
        if (['INPUT', 'BUTTON', 'A'].includes(event.target.tagName) || event.target.classList.contains('reveal-link')) return;
        const drawer = document.getElementById('drawer-' + invoiceId);
        drawer.style.display = (drawer.style.display === 'block') ? 'none' : 'block';
      }

      function toggleReveal(tenantId, actualValue) {
        const container = document.getElementById('id-container-' + tenantId);
        if (container.textContent.includes('••••')) {
          container.textContent = actualValue;
        } else {
          container.textContent = '•••• •••• ••••';
        }
      }
    </script>
  </head>
`;

function wrapHTML(bodyContent) {
  return `<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container">${bodyContent}</div></body></html>`;
}

module.exports = { wrapHTML };