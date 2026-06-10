const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// Record New Payment
router.post('/collect-invoice-payment', async (req, res) => {
  try {
    const { tenant_id, paymentAmount, paymentMode = 'Cash', selectedMonth } = req.body;
    const amount = Number(paymentAmount || 0);

    if (amount <= 0 || !tenant_id) {
      return res.status(400).send("Invalid payment amount");
    }

    await pool.query(`
      INSERT INTO transactions 
      (tenant_id, transaction_date, tran_type, particular, amount, tran_mode, notes)
      VALUES ($1, CURRENT_DATE, 'Payment', 'Payment Received', $2, $3, $4)
    `, [tenant_id, amount, paymentMode, selectedMonth ? `Payment for ${selectedMonth}` : '']);

    const tenantInfo = await pool.query(`
      SELECT name, phone, COALESCE((SELECT unit_name FROM units WHERE id = tenants.unit_id), 'No Unit') as unit_name
      FROM tenants WHERE id = $1
    `, [tenant_id]);

    const tenant = tenantInfo.rows[0];

    let receiptText = `Payment Received\n\n`;
    receiptText += `Tenant: ${tenant.name}\n`;
    receiptText += `Unit: ${tenant.unit_name}\n\n`;
    receiptText += `Amount Received: Rs.${amount.toLocaleString('en-IN')}\n`;
    receiptText += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;
    receiptText += `Mode: ${paymentMode}\n\n`;
    receiptText += `Thank you!`;

    const cleanPhone = String(tenant.phone || '').replace(/\D/g, '');
    const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(receiptText)}` : '#';

    res.send(`
      <div style="max-width:620px; margin:80px auto; text-align:center; font-family:Arial, sans-serif; padding:30px;">
        <h1 style="color:#10b981; font-size:36px;">✅ Payment Recorded Successfully!</h1>
        <p style="font-size:22px; margin:25px 0;">₹${amount.toLocaleString('en-IN')} received from <strong>${tenant.name}</strong></p>
        
        <a href="${whatsappLink}" target="_blank" 
           style="display:inline-block; background:#25D366; color:white; padding:18px 40px; 
                  border-radius:50px; text-decoration:none; font-size:19px; margin:30px 0;">
          📱 Send Receipt on WhatsApp
        </a>
        
        <br><br>
        <a href="/tenants" style="color:#64748b; text-decoration:underline; font-size:16px;">
          ← Back to This Month Collection
        </a>
      </div>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error recording payment.");
  }
});

// Add Extra Charge
router.post('/add-extra', async (req, res) => {
  try {
    const { tenant_id, particular, amount } = req.body;
    await pool.query(`
      INSERT INTO transactions 
      (tenant_id, transaction_date, tran_type, particular, amount, notes)
      VALUES ($1, CURRENT_DATE, 'Extra', $2, $3, 'Added manually')
    `, [tenant_id, particular, amount]);
    res.redirect(`/history/tenant/${tenant_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding extra charge");
  }
});

// Edit Transaction
router.post('/edit-transaction/:id', async (req, res) => {
  try {
    const { amount } = req.body;
    await pool.query('UPDATE transactions SET amount = $1 WHERE tran_id = $2', [amount, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Delete Transaction
router.post('/delete-transaction/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE tran_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;