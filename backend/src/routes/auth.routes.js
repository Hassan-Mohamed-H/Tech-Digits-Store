const express = require('express');
const { register, login, me, requestPasswordResetOtp, verifyPasswordResetOtp, resetPasswordWithOtp } = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);

router.post('/password/request-otp', requestPasswordResetOtp);
router.post('/password/verify-otp', verifyPasswordResetOtp);
router.post('/password/reset-otp', resetPasswordWithOtp);

module.exports = router;
