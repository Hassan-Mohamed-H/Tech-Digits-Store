const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { env } = require('../config/env');
const { sendEmail } = require('../utils/email');

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, name: user.name },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      password,
      phoneNumber,
      address
    } = req.body || {};

    if (!firstName || !lastName || !username || !email || !password || !phoneNumber || !address) {
      return res.status(400).json({ message: 'All fields are required: firstName, lastName, username, email, password, phoneNumber, address' });
    }

    const existing = await User.findOne({ $or: [{ email: String(email).toLowerCase().trim() }, { username: String(username).trim() }] });
    if (existing) {
      const conflict = existing.email?.toLowerCase() === String(email).toLowerCase().trim() ? 'email' : 'username';
      return res.status(409).json({ message: `A user with this ${conflict} already exists` });
    }

    const hashed = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      username: String(username).trim(),
      email: String(email).toLowerCase().trim(),
      password: hashed,
      phoneNumber: String(phoneNumber).trim(),
      address: String(address).trim()
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      userId: String(user._id)
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid Email' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid Password' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const me = async (req, res) => {
  res.json({ user: req.user });
};


const requestPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email is required' });
    try {
      const hdr = req.headers?.authorization || '';
      if (hdr.startsWith('Bearer ')) {
        const token = hdr.slice(7);
        const payload = jwt.verify(token, env.JWT_SECRET);
        if (payload?.id) {
          const self = await User.findById(payload.id);
          if (self && self.email && String(self.email).toLowerCase() !== String(email || '').toLowerCase()) {
            return res.status(403).json({ message: 'Not allowed to reset another user\'s password' });
          }
        }
      }
    } catch (_) { /* ignore optional auth */ }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.json({ message: 'If account exists, OTP sent' });

    const existing = await PasswordResetToken.findOne({ user: user._id }).sort({ createdAt: -1 });
    if (existing && existing.lastSentAt && (Date.now() - existing.lastSentAt.getTime()) < 45 * 1000) {
      return res.status(429).json({ message: 'Please wait before requesting a new code' });
    }

    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const otpHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({ user: user._id, otpHash, expiresAt, verified: false, sentCount: 1, lastSentAt: new Date() });

    await sendEmail({
      to: user.email,
      subject: 'Your password reset code',
      text: `Your password reset code is: ${code}. It expires in 10 minutes.`,
      html: `<p>Your password reset code is:</p><p style="font-size:20px;font-weight:700;letter-spacing:3px">${code}</p><p>This code expires in 10 minutes.</p>`
    });

    return res.json({ message: 'If account exists, OTP sent' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ message: 'Email and code are required' });
    try {
      const hdr = req.headers?.authorization || '';
      if (hdr.startsWith('Bearer ')) {
        const token = hdr.slice(7);
        const payload = jwt.verify(token, env.JWT_SECRET);
        if (payload?.id) {
          const self = await User.findById(payload.id);
          if (self && self.email && String(self.email).toLowerCase() !== String(email || '').toLowerCase()) {
            return res.status(403).json({ message: 'Not allowed to verify OTP for another user' });
          }
        }
      }
    } catch (_) { /* ignore optional auth */ }
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: 'Invalid code' });
    const prt = await PasswordResetToken.findOne({ user: user._id }).sort({ createdAt: -1 });
    if (!prt || !prt.otpHash) return res.status(400).json({ message: 'Invalid code' });
    if (prt.expiresAt < new Date()) return res.status(400).json({ message: 'Code expired' });
    const ok = await bcrypt.compare(String(code), prt.otpHash);
    if (!ok) return res.status(400).json({ message: 'Invalid code' });

    prt.verified = true; await prt.save();
    const resetToken = jwt.sign({ purpose: 'pwd_reset', uid: String(user._id) }, env.JWT_SECRET, { expiresIn: '15m' });
    return res.json({ message: 'OTP verified', resetToken });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const { resetToken, password } = req.body || {};
    if (!resetToken || !password) return res.status(400).json({ message: 'Missing data' });
    let payload;
    try { payload = jwt.verify(resetToken, env.JWT_SECRET); } catch (_) { return res.status(400).json({ message: 'Invalid or expired session' }); }
    if (!payload || payload.purpose !== 'pwd_reset' || !payload.uid) return res.status(400).json({ message: 'Invalid session' });

    const prt = await PasswordResetToken.findOne({ user: payload.uid }).sort({ createdAt: -1 });
    if (!prt || !prt.verified || prt.expiresAt < new Date()) return res.status(400).json({ message: 'Reset session expired' });

    const hashed = await bcrypt.hash(String(password), 10);
    await User.findByIdAndUpdate(payload.uid, { password: hashed });
    await PasswordResetToken.deleteMany({ user: payload.uid });
    return res.json({ message: 'Password updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};



module.exports = { register, login, me, requestPasswordResetOtp, verifyPasswordResetOtp, resetPasswordWithOtp };

