const express = require('express');
const { createPaymentIntent, processPayment, listTransactions, sendOtp, verifyOtp, resendOtp, initiatePayment, visaPayment } = require('../controllers/payment.controller');
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

const router = express.Router();

router.post('/create-intent', auth, createPaymentIntent);
router.post('/process', auth, processPayment);
router.post('/initiate', auth, initiatePayment);
router.post('/send-otp', auth, sendOtp);
router.post('/verify-otp', auth, verifyOtp);
router.post('/resend-otp', auth, resendOtp);
router.post('/visa', auth, visaPayment);
router.get('/', auth, admin, listTransactions);

module.exports = router;
