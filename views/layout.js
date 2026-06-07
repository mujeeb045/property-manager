const HTML_HEAD = `
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px; display: flex; justify-content: center; }
      .container { width: 100%; max-width: 950px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
      h1 { color: #0f172a; margin-top: 0; font-size: 26px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
      .btn { display: inline-block; padding: 12px 24px; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; text-align: center; }
      .btn-primary { background: #2563eb; color: white; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      
      /* Ledger Search Styling - The Fix */
      .search-box { position: relative; margin-bottom: 25px; }
      .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 16px; pointer-events: none; }
      #tenantSearch { width: 100%; padding: 12px 16px 12px 40px; font-size: 15px; border-radius: 8px; border: 1px solid #e2e8f0; background-color: #f1f5f9; box-sizing: border-box; }
      
      .tenant-list { list-style: none; padding: 0; margin: 0; }
      .tenant-item { display: flex; flex-direction: column; border-bottom: 1px solid #f1f5f9; background: #ffffff; }
      .row-summary { display: flex; align-items: center; padding: 16px 20px; cursor: pointer; }
      .row-drawer { display: none; background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; }
    </style>
    <script>
      function toggleDrawer(invoiceId, event) {
        if (['INPUT', 'BUTTON', 'A'].includes(event.target.tagName) || event.target.classList.contains('reveal-link')) return;
        const drawer = document.getElementById('drawer-' + invoiceId);
        drawer.style.display = (drawer.style.display === 'block') ? 'none' : 'block';
      }
    </script>
  </head>
`;

function wrapHTML(bodyContent) {
  return `<!DOCTYPE html><html>${HTML_HEAD}<body><div class="container">${bodyContent}</div></body></html>`;
}

module.exports = { wrapHTML };