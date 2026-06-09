const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// Collect Payment
router.post('/collect-invoice-payment/:invoiceId', async (req, res) => {
  try {
    const { paymentAmount, selectedMonth } = req.body;

    await pool.query(`
      UPDATE invoices 
      SET amount_paid = COALESCE(amount_paid, 0) + $1 
      WHERE id = $2
    `, [Number(paymentAmount || 0), req.params.invoiceId]);

    await pool.query(`
      INSERT INTO payment_logs (invoice_id, amount_paid)
      VALUES ($1, $2)
    `, [req.params.invoiceId, Number(paymentAmount || 0)]);

    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error recording payment.");
  }
});

module.exports = router;