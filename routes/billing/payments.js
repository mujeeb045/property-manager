// routes/billing/payments.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// ========================
// Record New Payment
// ========================
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
      SELECT name, phone FROM tenants WHERE id = $1
    `, [tenant_id]);

    const tenant = tenantInfo.rows[0] || { name: 'Unknown', phone: '' };

    let receiptText = `Payment Received\n\n`;
    receiptText += `Tenant: ${tenant.name}\n`;
    receiptText += `Amount: Rs.${amount.toLocaleString('en-IN')}\n`;
    receiptText += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;
    receiptText += `Mode: ${paymentMode}\n\n`;
    receiptText += `Thank you!`;

    const cleanPhone = String(tenant.phone || '').replace(/\D/g, '');
    const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(receiptText)}` : '#';

    res.render('billing/payment-success', {
      title: 'Payment Recorded',
      amount,
      tenantName: tenant.name,
      whatsappLink,
      error: null
    });

  } catch (err) {
    console.error(err);
    res.status(500).render('billing/payment-success', {
      title: 'Payment Failed',
      error: 'Error recording payment: ' + err.message
    });
  }
});

// ========================
// Add Extra Charge
// ========================
router.post('/add-extra', async (req, res) => {
  try {
    const { tenant_id, particular, amount, transaction_date } = req.body;
    const dateToUse = transaction_date || new Date().toISOString().split('T')[0];

    await pool.query(`
      INSERT INTO transactions 
      (tenant_id, transaction_date, tran_type, particular, amount, notes)
      VALUES ($1, $2, 'Extra', $3, $4, 'Added manually')
    `, [tenant_id, dateToUse, particular, amount]);

    res.redirect(`/history/tenant/${tenant_id}`);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding extra charge");
  }
});

// ========================
// Edit Transaction
// ========================
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

// ========================
// Delete Transaction
// ========================
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