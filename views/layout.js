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
      .btn-success { background: #10b981; color: white; padding: 6px 12px; font-size: 13px; border-radius: 4px; }
      .btn-danger { background: #ef4444; color: white; padding: 6px 12px; font-size: 13px; border-radius: 4px; }
      .btn-info { background: #0284c7; color: white; padding: 6px 12px; font-size: 13px; border-radius: 4px; text-decoration: none; }
      .hub-menu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
      .hub-btn { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #0f172a; font-weight: 600; font-size: 15px; }
      .hub-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
      .hub-icon-wrap { display: flex; align-items: center; gap: 12px; }
      .hub-arrow { color: #64748b; font-size: 18px; }
      .flex-stats { display: flex; gap: 16px; margin-bottom: 25px; }
      .stat-card { flex: 1; padding: 18px 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
      .stat-card-occupied { background: #fff1f2; border-left-color: #f43f5e; color: #9f1239; }
      .stat-card-vacant { background: #f0fdf4; border-left-color: #22c55e; color: #166534; }
      .stat-card-total { background: #f8fafc; border-left-color: #64748b; color: #334155; }
      .tenant-list { list-style: none; padding: 0; margin: 0; }
      .tenant-item { display: flex; flex-direction: column; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; background: #ffffff; }
      .item-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px; }
      .actions { display: flex; align-items: center; gap: 8px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
      .badge-occupied { background: #ffe4e6; color: #9f1239; }
      .badge-vacant { background: #d1fae5; color: #065f46; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-partial { background: #ffedd5; color: #9a3412; }
      .badge-unpaid { background: #ffeeeb; color: #b91c1c; }
      .badge-advance { background: #e0f2fe; color: #0369a1; } 
      .pay-input { width: 95px; padding: 6px; margin: 0; font-size: 13px; border-radius: 4px; border: 1px solid #cbd5e1; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 13px; color: #64748b; }
      .reveal-link { color: #2563eb; cursor: pointer; font-weight: 600; text-decoration: underline; font-size: 13px; }
      .history-box { margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; max-height: 120px; overflow-y: auto; }
      .history-title { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; display: block; }
      .history-item { font-size: 12px; color: #334155; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; display: flex; justify-content: space-between; }
      .history-item:last-child { border-bottom: none; }
      .search-box { position: relative; margin-bottom: 20px; }
      .search-box input { padding: 12px 16px 12px 40px; font-size: 15px; border-radius: 8px; background-color: #f1f5f9; border-color: #e2e8f0; margin-bottom: 0; }
      .search-box::before { content: "🔍"; position: absolute; left: 14px; top: 11px; font-size: 16px; color: #64748b; }
      .extra-charge-form { background: #e0f2fe; border: 1px solid #bae6fd; padding: 12px; border-radius: 6px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-end; }
      .extra-charge-form input { margin-bottom: 0; padding: 6px 10px; font-size: 13px; }
      .charge-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .charge-tag { background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; font-size: 12px; padding: 4px 10px; border-radius: 20px; display: flex; align-items: center; gap: 6px; }
      .charge-tag-delete { color: #ef4444; font-weight: bold; border: none; background: none; padding: 0; font-size: 14px; cursor: pointer; }
      .batch-billing-panel { background: #1e293b; color: white; padding: 16px 20px; border-radius: 8px; display: flex; gap: 12px; align-items: flex-end; font-size: 14px; width: 100%; box-sizing: border-box; margin-bottom: 20px; border: none; }
      .batch-billing-panel div { display: flex; flex-direction: column; gap: 4px; }
      .batch-billing-panel select, .batch-billing-panel input { margin-bottom: 0; padding: 8px 12px; border-radius: 4px; font-size: 13px; border: none; width: auto; }
      .top-nav-box { display: flex; align-items: center; gap: 10px; }
    </style>
    <script>
      function toggleReveal(id, actualValue) {
        const element = document.getElementById('id-container-' + id);
        if (element.innerText.includes('•')) {
          element.innerText = actualValue;
          element.style.color = '#0f172a';
        } else {
          element.innerText = '•••• •••• ••••';
          element.style.color = '#64748b';
        }
      }
      function filterTenants() {
        const query = document.getElementById('tenantSearch').value.toLowerCase();
        const items = document.getElementsByClassName('tenant-item');
        for (let i = 0; i < items.length; i++) {
          const searchContent = items[i].getAttribute('data-search').toLowerCase();
          if (searchContent.includes(query)) {
            items[i].style.display = 'flex';
          } else {
            items[i].style.display = 'none';
          }
        }
      }
      function confirmBatchGeneration() {
        const selectedMonth = document.getElementById('targetMonth').value;
        const selectedYear = document.getElementById('targetYear').value;
        return confirm('⚠️ Are you sure you want to generate bills for ' + selectedMonth + ' ' + selectedYear + '? Outstanding dues and allocations will align.');
      }
    </script>
  </head>
`;

function wrapHTML(bodyContent) {
  return `<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container">${bodyContent}</div></body></html>`;
}

module.exports = { wrapHTML };