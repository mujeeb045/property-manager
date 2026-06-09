const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// Add Extra Item
router.post('/add-extra-item/:invoiceId', async (req, res) => {
  try {
    const { itemDesc, itemAmount, selectedMonth } = req.body;
    await pool.query(`
      INSERT INTO invoice_extra_items (invoice_id, item_desc, item_amount, item_billing_month)
      VALUES ($1, $2, $3, $4)
    `, [req.params.invoiceId, itemDesc, Number(itemAmount || 0), selectedMonth]);

    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding extra item.");
  }
});

// Delete Extra Item
router.post('/delete-extra-item/:itemId', async (req, res) => {
  try {
    const { selectedMonth } = req.body;
    await pool.query('DELETE FROM invoice_extra_items WHERE id = $1', [req.params.itemId]);
    res.redirect('/tenants?month=' + encodeURIComponent(selectedMonth));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting extra item.");
  }
});

module.exports = router;