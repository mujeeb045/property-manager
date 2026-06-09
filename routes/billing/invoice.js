const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { wrapHTML } = require('../../views/layout');

// Single Invoice View (if needed later)
router.get('/invoice/:invoiceId', async (req, res) => {
  // You can move your old invoice logic here later
  res.send("Invoice page coming soon...");
});