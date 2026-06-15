// routes/qr.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

router.get('/qr/:upiId', async (req, res) => {
    try {
        const upiId = req.params.upiId;

        const qrData = `upi://pay?pa=${upiId}`;

        const qrCodeImage = await QRCode.toBuffer(qrData, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 400
        });

        res.setHeader('Content-Type', 'image/png');
        res.send(qrCodeImage);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating QR Code");
    }
});

module.exports = router;