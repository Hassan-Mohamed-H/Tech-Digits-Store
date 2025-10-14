const express = require('express');
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const { adminPaymentsSummary, adminUserPaidOrders } = require('../controllers/payment.controller');

const router = express.Router();

router.get('/payments', auth, admin, adminPaymentsSummary);

router.get('/payments/:userId', auth, admin, adminUserPaidOrders);

module.exports = router;
