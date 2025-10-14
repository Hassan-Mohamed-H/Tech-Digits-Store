const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const bcrypt = require('bcryptjs');
const { sendSMS } = require('../utils/sms');
const { sendEmail } = require('../utils/email');

const createPaymentIntent = async (req, res) => {
  const mockClientSecret = 'pi_mock_client_secret';
  res.json({ success: true, message: 'ok', data: { clientSecret: mockClientSecret } });
};


const initiatePayment = async (req, res) => {
  try {
    const { orderId, method } = req.body || {};
    if (!orderId || !method) return res.status(400).json({ success: false, message: 'orderId and method are required' });

    const order = await Order.findById(orderId).populate('user');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user?._id || order.user) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not allowed for this order' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: `Order is already ${order.status}` });

    if (method === 'vodafone') {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const ttlMinutes = 5;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      const otpHash = await bcrypt.hash(code, 10);

      order.otpCode = code; 
      order.otpExpiresAt = expiresAt;
      order.otpVerified = false;
      await order.save();

      await OtpToken.deleteMany({ user: req.user.id, order: order._id, verified: false });
      await OtpToken.create({ user: req.user.id, order: order._id, otpHash, expiresAt, verified: false, sentCount: 1, lastSentAt: new Date() });

      const userPhone = String(order.user?.phone || '').trim();
      const bodyPhone = String((req.body && req.body.phone) || '').trim();
      const phone = /^01[0-9]{9}$/.test(userPhone) ? userPhone : bodyPhone;
      if (!/^01[0-9]{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Valid phone is required for Vodafone OTP' });
      }
      try {
        const smsResult = await sendSMS(phone, `Your TechDigits Store OTP is ${code}`);
        console.log(`OTP sent successfully to ${phone}`);
        console.log('SMS delivery result:', smsResult);
      } catch (e) {
        console.error('SMS sending failed:', e.message);
      }

      return res.status(200).json({ success: true, message: 'OTP sent successfully', orderId: String(order._id) });
    }

    if (method === 'visa') {
      return res.json({ success: true, message: 'Visa payment can proceed', orderId: String(order._id) });
    }

    return res.status(400).json({ success: false, message: 'Invalid payment method' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

const processPayment = async (req, res) => {
  try {
    const { orderId, method } = req.body;
    if (!orderId || !method) return res.status(400).json({ success: false, message: 'orderId and method are required' });
    if (!['visa', 'vodafone'].includes(method)) return res.status(400).json({ success: false, message: 'Invalid payment method' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not allowed for this order' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: `Order is already ${order.status}` });
    const latestOtp = await OtpToken.findOne({ user: req.user.id, order: order._id, verified: true }).sort({ updatedAt: -1 });
    if (!latestOtp) return res.status(400).json({ success: false, message: 'OTP verification required before processing payment' });

    let details = {};
    if (method === 'visa') {
      const { cardNumber, expiryMonth, expiryYear, cvv } = req.body;
      const num = (cardNumber || '').replace(/\s+/g, '');
      if (!/^\d{13,19}$/.test(num)) return res.status(400).json({ message: 'Invalid card number' });
      const mm = Number(expiryMonth), yy = Number(expiryYear);
      if (!(mm >= 1 && mm <= 12)) return res.status(400).json({ message: 'Invalid expiry month' });
      if (!(yy >= 24 && yy <= 99)) return res.status(400).json({ message: 'Invalid expiry year' });
      if (!/^\d{3,4}$/.test(String(cvv || ''))) return res.status(400).json({ message: 'Invalid CVV' });
      details.last4 = num.slice(-4);
      details.expiry = `${String(mm).padStart(2, '0')}/${yy}`;
    } else if (method === 'vodafone') {
      const { vodafoneNumber } = req.body;
      const msisdn = String(vodafoneNumber || '').trim();
      if (!/^01[0-9]{9}$/.test(msisdn)) return res.status(400).json({ message: 'Invalid Vodafone number' });
      details.vodafoneNumber = msisdn.replace(/\d(?=\d{2})/g, '*');
    }

   
    const payment = await Payment.create({
      order: order._id,
      user: order.user,
      method,
      amount: order.totalAmount,
      status: 'succeeded',
      details
    });

    order.status = 'paid';
    await order.save();

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        payment: {
          id: payment._id,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          createdAt: payment.createdAt
        },
        order: {
          id: order._id,
          status: order.status,
          totalAmount: order.totalAmount
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

const listTransactions = async (req, res) => {
  try {
    const list = await Payment.find().sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, message: 'ok', data: list.map(p => ({ id: p._id, method: p.method, status: p.status, amount: p.amount, createdAt: p.createdAt })) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load payments' });
  }
};


const sendOtp = async (req, res) => {
  try {
    const { orderId, method, phone: rawPhone } = req.body || {};
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
    const order = await Order.findById(orderId).populate('user');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user._id) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not allowed for this order' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: `Order is already ${order.status}` });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ttlMinutes = 5;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const otpHash = await bcrypt.hash(code, 10);

    await OtpToken.deleteMany({ user: req.user.id, order: order._id, verified: false });

    await OtpToken.create({ user: req.user.id, order: order._id, otpHash, expiresAt, verified: false, sentCount: 1, lastSentAt: new Date() });

    order.otpCode = code;
    order.otpExpiresAt = expiresAt;
    order.otpVerified = false;
    await order.save();

    if ((method || '').toLowerCase() === 'visa') {
      const to = (order.user && order.user.email) || '';
      if (!to) return res.status(400).json({ success: false, message: 'User email is required for Visa OTP' });
      try {
        await sendEmail({
          to,
          subject: 'Your TechDigits payment verification code',
          text: `Your OTP is ${code}. It expires in ${ttlMinutes} minutes.`,
          html: `<p>Your OTP is <strong>${code}</strong>. It expires in ${ttlMinutes} minutes.</p>`
        });
      } catch (e) {
        console.error('Email sending failed:', e.message);
      }
      return res.json({ success: true, message: 'OTP sent to email', data: { expiresAt }, orderId: String(order._id) });
    } else {

      const phone = String(rawPhone || '').trim();
      if (!/^01[0-9]{9}$/.test(phone)) return res.status(400).json({ success: false, message: 'Valid phone is required for OTP' });
      try {
        const smsResult = await sendSMS(phone, `Your TechDigits payment OTP is ${code}. It expires in ${ttlMinutes} minutes.`);
        console.log(`OTP sent successfully to ${phone}`);
        console.log('SMS delivery result:', smsResult);
      } catch (e) {
        console.error('SMS sending failed:', e.message);
      }
      return res.json({ success: true, message: 'OTP sent successfully', data: { expiresAt }, orderId: String(order._id) });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { orderId } = req.body;
    const method = req.body.method || 'vodafone';
    const otp = req.body.otp || req.body.otpCode; 
    if (!orderId || !otp) return res.status(400).json({ success: false, message: 'orderId and otp are required' });
    if (!['visa', 'vodafone'].includes(method)) return res.status(400).json({ success: false, message: 'Invalid payment method' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not allowed for this order' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: `Order is already ${order.status}` });

    const token = await OtpToken.findOne({ user: req.user.id, order: order._id }).sort({ createdAt: -1 });
    if (!token || token.verified || token.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    const ok = await bcrypt.compare(String(otp), token.otpHash);
    if (!ok) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

    token.verified = true;
    await token.save();

    order.otpVerified = true;
    await order.save();

    let details = {};
    if (method === 'visa') {
      const { cardNumber, expiryMonth, expiryYear, cvv } = req.body;
      const num = (cardNumber || '').replace(/\s+/g, '');
      if (!/^\d{13,19}$/.test(num)) return res.status(400).json({ success: false, message: 'Invalid card number' });
      const mm = Number(expiryMonth), yy = Number(expiryYear);
      if (!(mm >= 1 && mm <= 12)) return res.status(400).json({ success: false, message: 'Invalid expiry month' });
      if (!(yy >= 24 && yy <= 99)) return res.status(400).json({ success: false, message: 'Invalid expiry year' });
      if (!/^\d{3,4}$/.test(String(cvv || ''))) return res.status(400).json({ success: false, message: 'Invalid CVV' });
      details.last4 = num.slice(-4);
      details.expiry = `${String(mm).padStart(2, '0')}/${yy}`;
    } else if (method === 'vodafone') {
      const { vodafoneNumber } = req.body;
      const msisdn = String(vodafoneNumber || '').trim();
      if (!/^01[0-9]{9}$/.test(msisdn)) return res.status(400).json({ success: false, message: 'Invalid Vodafone number' });
      details.vodafoneNumber = msisdn.replace(/\d(?=\d{2})/g, '*');
    }

    const payment = await Payment.create({
      order: order._id,
      user: order.user,
      method,
      amount: order.totalAmount,
      status: 'succeeded',
      details
    });

    order.status = 'paid';
    await order.save();

    res.status(200).json({ success: true, message: 'Payment confirmed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};


const resendOtp = async (req, res) => {
  try {
    const { orderId, phone: rawPhone } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
    const order = await Order.findById(orderId).populate('user');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user._id) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not allowed for this order' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: `Order is already ${order.status}` });

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentTokens = await OtpToken.find({ user: req.user.id, createdAt: { $gte: tenMinAgo } });
    const totalSends = recentTokens.reduce((s, t) => s + (t.sentCount || 1), 0);
    if (totalSends >= 3) return res.status(429).json({ success: false, message: 'Resend limit reached. Try again later.' });

    const phone = String(rawPhone || '').trim();
    if (!/^01[0-9]{9}$/.test(phone)) return res.status(400).json({ success: false, message: 'Valid phone is required for OTP resend' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ttlMinutes = 5;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const otpHash = await bcrypt.hash(code, 10);

    await OtpToken.create({ user: req.user.id, order: order._id, otpHash, expiresAt, verified: false, sentCount: 1, lastSentAt: new Date() });

    try {
      const smsResult = await sendSMS(phone, `Your TechDigits payment OTP is ${code}. It expires in ${ttlMinutes} minutes.`);
      console.log(`OTP sent successfully to ${phone}`);
      console.log('SMS delivery result:', smsResult);
    } catch (e) {
      console.error('SMS sending failed:', e.message);
    }

    res.json({ success: true, message: 'OTP resent', data: { expiresAt } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { createPaymentIntent, processPayment, listTransactions, sendOtp, verifyOtp, resendOtp, initiatePayment };


const visaPayment = async (req, res) => {
  try {
    const { orderId, cardNumber, expiryMonth, expiryYear, cvv } = req.body || {};
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not allowed for this order' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: `Order is already ${order.status}` });

    const num = String(cardNumber || '').replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(num)) return res.status(400).json({ success: false, message: 'Invalid card number' });
    const mm = Number(expiryMonth), yy = Number(expiryYear);
    if (!(mm >= 1 && mm <= 12)) return res.status(400).json({ success: false, message: 'Invalid expiry month' });
    if (!(yy >= 24 && yy <= 99)) return res.status(400).json({ success: false, message: 'Invalid expiry year' });
    if (!/^\d{3,4}$/.test(String(cvv || ''))) return res.status(400).json({ success: false, message: 'Invalid CVV' });

    const payment = await Payment.create({
      order: order._id,
      user: order.user,
      method: 'visa',
      amount: order.totalAmount,
      status: 'succeeded',
      details: { last4: num.slice(-4), expiry: `${String(mm).padStart(2, '0')}/${yy}` }
    });

    order.status = 'paid';
    await order.save();

    return res.status(201).json({ success: true, message: 'Visa payment completed successfully', orderId: String(order._id), data: { paymentId: String(payment._id) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { ...module.exports, visaPayment };

async function adminPaymentsSummary(req, res) {
  try {
    const paidAgg = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$user', totalPaid: { $sum: '$totalAmount' }, paidOrders: { $sum: 1 } } }
    ]);
    const map = new Map();
    for (const p of paidAgg) {
      const id = String(p._id);
      map.set(id, { userId: id, totalPaid: p.totalPaid || 0, paidOrders: p.paidOrders || 0 });
    }
    const ids = Array.from(map.keys()).filter(Boolean);
    const users = await User.find({ _id: { $in: ids } }).select('name email username firstName lastName');
    const usersMap = new Map(users.map(u => [String(u._id), u]));
    const result = ids.map(id => {
      const u = usersMap.get(id);
      const name = (u && (u.name || [u.firstName, u.lastName].filter(Boolean).join(' '))) || '';
      const email = (u && u.email) || '';
      const username = (u && (u.username || '')) || '';
      const m = map.get(id) || {};
      return { userId: id, name, email, username, totalOrders: m.paidOrders || 0, totalPaid: m.totalPaid || 0, paidOrders: m.paidOrders || 0 };
    }).sort((a,b)=> (b.totalPaid||0) - (a.totalPaid||0));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load summary' });
  }
}

async function adminUserPaidOrders(req, res) {
  try {
    const userId = req.params.userId;
    const orders = await Order.find({ user: userId, status: 'paid' }).populate('items.product').sort({ createdAt: -1 });
    const data = orders.map(o => {
      const names = (o.items || []).map(it => it.product && (it.product.name || it.product.title)).filter(Boolean);
      const productNames = names.length ? names.join(', ') : '';
      return { productNames, amount: o.totalAmount, status: o.status, createdAt: o.createdAt };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load user payments' });
  }
}

module.exports = { ...module.exports, adminPaymentsSummary, adminUserPaidOrders };
