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

      /* HIGH-EFFICIENCY COMPACT LEDGER ROWS SYSTEM */
      .tenant-list { list-style: none; padding: 0; margin: 0; }
      .tenant-item { display: flex; flex-direction: column; border-bottom: 1px solid #f1f5f9; background: #ffffff; margin-bottom: 0; border-radius: 0; }
      .tenant-item:last-child { border-bottom: none; }
      
      .row-summary { display: flex; align-items: center; padding: 16px 20px; cursor: pointer; transition: background 0.15s ease; position: relative; }
      .row-summary:hover { background: #f8fafc; }
      
      .col-name { flex: 2; font-weight: 600; color: #0f172a; font-size: 15px; display: flex; align-items: center; gap: 10px; }
      .col-due { flex: 1; font-weight: 700; text-align: center; font-size: 15px; }
      .col-actions { flex: 2; display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
      
      .pay-input { width: 110px; padding: 8px 12px; margin: 0; font-size: 13px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; text-align: right; }
      
      /* COLLAPSIBLE SLIDE-DOWN DRAWER UTILITIES */
      .row-drawer { display: none; background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 24px; box-sizing: border-box; animation: slideDown 0.2s ease-out; }
      @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
      .badge-occupied { background: #ffe4e6; color: #9f1239; }
      .badge-vacant { background: #d1fae5; color: #065f46; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-partial { background: #ffedd5; color: #9a3412; }
      .badge-unpaid { background: #ffeeeb; color: #b91c1c; }
      .badge-advance { background: #e0f2fe; color: #0369a1; } 
      
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; font-size: 13px; color: #475569; background: white; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; }
      .reveal-link { color: #2563eb; cursor: pointer; font-weight: 600; text-decoration: underline; font-size: 13px; }
      
      .history-box { margin-top: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; max-height: 180px; overflow-y: auto; }
      .history-title { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 10px; display: block; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
      .history-item { font-size: 12px; color: #334155; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
      .history-item:last-child { border-bottom: none; }
      
      .search-box { position: relative; }
      .search-box input { padding: 12px 16px 12px 40px; font-size: 15px; border-radius: 8px; background-color: #f1f5f9; border-color: #e2e8f0; margin-bottom: 0; }
      .search-box::before { content: "🔍"; position: absolute; left: 14px; top: 12px; font-size: 16px; color: #64748b; }
      .extra-charge-form { background: #e0f2fe; border: 1px solid #bae6fd; padding: 12px; border-radius: 6px; margin-top: 16px; display: flex; gap: 10px; align-items: flex-end; }
      .extra-charge-form input { margin-bottom: 0; padding: 6px 10px; font-size: 13px; }
      .charge-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .charge-tag { background: #e2e8f0; color: #334155; font-size: 12px; padding: 4px 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; font-weight: 500; }
      .charge-tag-delete { color: #ef4444; font-weight: bold; border: none; background: none; padding: 0; font-size: 14px; cursor: pointer; }
      .batch-billing-panel { background: #1e293b; color: white; padding: 16px 20px; border-radius: 8px; display: flex; gap: 12px; align-items: flex-end; font-size: 14px; width: 100%; box-sizing: border-box; margin-bottom: 20px; border: none; }
      .batch-billing-panel div { display: flex; flex-direction: column; gap: 4px; }
      .batch-billing-panel select, .batch-billing-panel input { margin-bottom: 0; padding: 8px 12px; border-radius: 4px; font-size: 13px; border: none; width: auto; }
      .top-nav-box { display: flex; align-items: center; gap: 10px; }
    </style>
    <script>
      // DYNAMIC DRAWER TOGGLE SCRIPT
      function toggleDrawer(invoiceId, event) {
        // Prevent form clicks, inputs, or buttons from accidentally triggering the toggle collapse
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.tagName === 'A' || event.target.classList.contains('reveal-link')) {
          return;
        }
        const drawer = document.getElementById('drawer-' + invoiceId);
        if (drawer.style.display === 'block') {
          drawer.style.display = 'none';
        } else {
          drawer.style.display = 'block';
        }
      }
    </script>
  </head>
`;

function wrapHTML(bodyContent) {
  return `<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container">${bodyContent}</div></body></html>`;
}

module.exports = { wrapHTML };