// routes/billing/tenant-pdf.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const PDFDocument = require('pdfkit');

function formatINR(num) {
  num = Math.abs(Math.round(num));
  let str = num.toString();
  let lastThree = str.substring(str.length - 3);
  let otherNumbers = str.substring(0, str.length - 3);
  if (otherNumbers !== '') lastThree = ',' + lastThree;
  return 'Rs. ' + otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
}

router.get('/tenant-pdf/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;

    const tenantQuery = await pool.query(`
      SELECT tenants.*, COALESCE(units.unit_name, 'No Unit') as unit_name 
      FROM tenants 
      LEFT JOIN units ON tenants.unit_id = units.id 
      WHERE tenants.id = $1
    `, [tenantId]);

    if (tenantQuery.rows.length === 0) {
      return res.status(404).send("Tenant not found");
    }

    const tenant = tenantQuery.rows[0];

    const transactions = await pool.query(`
      SELECT 
        TO_CHAR(transaction_date, 'dd Mon YYYY') as period,
        particular,
        amount,
        tran_type as type,
        tran_mode as mode,
        SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END) 
          OVER (ORDER BY transaction_date, tran_id) as running_balance
      FROM transactions 
      WHERE tenant_id = $1
      ORDER BY transaction_date DESC, tran_id DESC
    `, [tenantId]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${tenant.name.replace(/ /g, '_')}_Statement.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('PROPERTY MANAGEMENT STATEMENT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).font('Helvetica').text(tenant.name, { align: 'center' });
    doc.fontSize(13).text(`Unit: ${tenant.unit_name}`, { align: 'center' });
    doc.moveDown(2);

    // Tenant Information
    doc.fontSize(12).font('Helvetica-Bold').text('TENANT INFORMATION');
    doc.moveDown(0.4);

    const infoY = doc.y;
    doc.font('Helvetica').fontSize(11);

    doc.text(`Father's Name : ${tenant.father_name || 'N/A'}`, 70, infoY);
    doc.text(`Phone          : ${tenant.phone || 'N/A'}`, 70, infoY + 20);
    doc.text(`Aadhaar        : ${tenant.id_card_no || 'N/A'}`, 70, infoY + 40);
    doc.text(`Security Deposit : ${formatINR(Number(tenant.security_deposit || 0))}`, 70, infoY + 60);

    doc.moveDown(3);

    // Transaction Table
    doc.fontSize(14).font('Helvetica-Bold').text('TRANSACTION HISTORY');
    doc.moveDown(0.7);

    const tableTop = doc.y;
    doc.fontSize(10.5).font('Helvetica-Bold');

    doc.text('Date', 70, tableTop);
    doc.text('Particular', 190, tableTop);
    doc.text('Amount', 400, tableTop);
    doc.text('Balance', 480, tableTop);

    doc.lineWidth(2).moveTo(70, tableTop + 18).lineTo(570, tableTop + 18).stroke();

    let y = tableTop + 45;
    doc.font('Helvetica').fontSize(9.8);

    transactions.rows.forEach(row => {
      const amount = Number(row.amount);
      const isDebit = row.type === 'Bill' || row.type === 'Extra';
      const amountText = `${isDebit ? 'Dr.' : 'Cr.'} ${formatINR(amount)}`;

      doc.text(row.period, 70, y, { width: 110 });
      doc.text(row.particular, 190, y, { width: 200 });
      doc.text(amountText, 400, y);
      doc.text(formatINR(row.running_balance), 480, y);

      doc.lineWidth(0.5).moveTo(70, y + 16).lineTo(570, y + 16).stroke();

      y += 28;
    });

    // Footer
    doc.moveDown(4);
    doc.fontSize(9.5).text(`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, { align: 'center' });

    doc.end();

  } catch (err) {
    console.error("PDF Generation Error:", err.message);
    res.status(500).send("Error generating PDF: " + err.message);
  }
});

module.exports = router;