// routes/billing/payments.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// Record Payment (Tenant Level - No Unit Required)
router.post('/collect-invoice-payment', async (req, res) => {
  try {
    const { tenant_id, paymentAmount, paymentMode = 'Cash', selectedMonth, comments } = req.body;
    const amount = Number(paymentAmount || 0);

    if (amount <= 0 || !tenant_id) {
      return res.status(400).send("Invalid payment amount");
    }

    // 1. Record the payment with comments
    await pool.query(`
      INSERT INTO transactions 
      (tenant_id, unit_id, transaction_date, tran_type, particular, amount, tran_mode, notes)
      VALUES ($1, NULL, CURRENT_DATE, 'Payment', 'Payment Received', $2, $3, $4)
    `, [tenant_id, amount, paymentMode, comments || '']);

    // 2. Get tenant info
    const tenantInfo = await pool.query(`
      SELECT name, phone FROM tenants WHERE id = $1
    `, [tenant_id]);
    const tenant = tenantInfo.rows[0] || { name: 'Unknown', phone: '' };

    // 3. Get current month dues (Bills + Extras this month)
    const currentMonthDues = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as dues
      FROM transactions 
      WHERE tenant_id = $1 
        AND tran_type IN ('Bill', 'Extra')
        AND transaction_date >= date_trunc('month', CURRENT_DATE)
    `, [tenant_id]);

    // 4. Get total payments received this month
    const monthlyPayments = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as paid
      FROM transactions 
      WHERE tenant_id = $1 
        AND tran_type = 'Payment'
        AND transaction_date >= date_trunc('month', CURRENT_DATE)
    `, [tenant_id]);

    // 5. Get latest overall balance
    const latestBalance = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN tran_type IN ('Bill', 'Extra') THEN amount ELSE -amount END), 0) as balance
      FROM transactions 
      WHERE tenant_id = $1
    `, [tenant_id]);

    const totalDueThisMonth = Number(currentMonthDues.rows[0].dues);
    const totalReceivedThisMonth = Number(monthlyPayments.rows[0].paid);
    const balanceRemaining = Number(latestBalance.rows[0].balance);

    // 6. Create improved WhatsApp message with comments
    let receiptText = `Payment Received \n\n`;
    receiptText += `Tenant: ${tenant.name}\n`;
    receiptText += `Amount Paid: ₹${amount.toLocaleString('en-IN')}\n`;
    receiptText += `Mode: ${paymentMode}\n`;
    receiptText += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;

    if (comments) {
      receiptText += `Note: ${comments}\n`;
    }

    receiptText += `\n────────────────────\n`;
    receiptText += `Total Due this Month: ₹${totalDueThisMonth.toLocaleString('en-IN')}\n`;
    receiptText += `Total Received this Month: ₹${totalReceivedThisMonth.toLocaleString('en-IN')}\n`;
    receiptText += `Balance Remaining: ₹${balanceRemaining.toLocaleString('en-IN')}\n\n`;
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

// Add Extra Charge (Still unit-linked)
router.post('/add-extra', async (req, res) => {
  try {
    const { tenant_id, particular, amount, unit_id, transaction_date } = req.body;
    const dateToUse = transaction_date || new Date().toISOString().split('T')[0];

    await pool.query(`
      INSERT INTO transactions 
      (tenant_id, unit_id, transaction_date, tran_type, particular, amount, notes)
      VALUES ($1, $2, $3, 'Extra', $4, $5, 'Added manually')
    `, [tenant_id, unit_id, dateToUse, particular, amount]);

    res.redirect(`/history/tenant/${tenant_id}`);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding extra charge");
  }
});

// Edit & Delete Transaction
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