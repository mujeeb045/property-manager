function renderInvoiceHTML(inv, baseRent, maintenance, arrears, totalCharged, balance, itemizedRowsHTML, rolloverRowHTML) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - Portion ${inv.unit_name}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 50px; background: #f1f5f9; display: flex; justify-content: center; }
        .invoice-card { background: white; padding: 40px; border-radius: 8px; width: 100%; max-width: 650px; box-shadow: 0 4px 6px rgb(0 0 0 / 0.05); box-sizing: border-box; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .title { font-size: 24px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
        .meta-text { text-align: right; font-size: 13px; color: #64748b; line-height: 1.5; }
        .bill-to { font-size: 14px; margin-bottom: 25px; color: #334155; line-height: 1.6; border-top: 2px solid #f1f5f9; border-bottom: 2px solid #f1f5f9; padding: 15px 0; }
        .item-table { width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 30px; }
        .item-table th { background: #f8fafc; padding: 12px; font-size: 13px; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
        .item-table td { padding: 12px; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; }
        .totals-box { text-align: right; font-size: 14px; color: #334155; line-height: 1.8; }
        .grand-total { font-size: 18px; font-weight: bold; color: #10b981; margin-top: 5px; }
        .print-btn { display: block; width: 100%; text-align: center; background: #0f172a; color: white; padding: 12px; font-weight: bold; border-radius: 6px; text-decoration: none; margin-top: 30px; font-size: 14px; cursor:pointer; border:none; }
        @media print { .print-btn { display: none; } body { background: white; padding: 0; } .invoice-card { box-shadow: none; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <table class="header-table">
          <tr>
            <td class="title">Rent Invoice / Receipt</td>
            <td class="meta-text">
              <strong>Statement Month:</strong> ${inv.billing_month}<br>
              <strong>Invoice ID:</strong> #INV-00${inv.id}<br>
              <strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}
            </td>
          </tr>
        </table>

        <div class="bill-to">
          <strong>BILL TO:</strong><br>
          Tenant Name: ${inv.name}<br>
          Father's Name: ${inv.father_name}<br>
          Allocated Portion: Unit ${inv.unit_name}<br>
          Phone: +91 ${inv.phone}
        </div>

        <table class="item-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount Charged</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Monthly Base Rent Accommodation Charges</td>
              <td style="text-align: right;">₹${baseRent.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td>Common Area Maintenance Expenses</td>
              <td style="text-align: right;">₹${maintenance.toLocaleString('en-IN')}</td>
            </tr>
            ${rolloverRowHTML}
            ${itemizedRowsHTML}
          </tbody>
        </table>

        <div class="totals-box">
          <div>Total Monthly Assessment Due: <strong>₹${totalCharged.toLocaleString('en-IN')}</strong></div>
          <div style="color: #10b981;">Total Amount Received Cleared: <strong>₹${Number(inv.amount_paid).toLocaleString('en-IN')}</strong></div>
          <div class="grand-total">${balance <= 0 ? 'STATUS: PAID ✅' : `REMAINING BALANCE DUE: ₹${balance.toLocaleString('en-IN')}`}</div>
        </div>

        <button class="print-btn" onclick="window.print()">🖨️ Print Invoice Statement / Save as PDF</button>
      </div>
    </body>
    </html>
  `;
}

module.exports = renderInvoiceHTML;