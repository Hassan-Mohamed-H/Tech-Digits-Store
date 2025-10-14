const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    sentCount: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

otpTokenSchema.index({ expiresAt: 1 });
otpTokenSchema.index({ user: 1, order: 1, createdAt: -1 });

module.exports = mongoose.model('OtpToken', otpTokenSchema);
