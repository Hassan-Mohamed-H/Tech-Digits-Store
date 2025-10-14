const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String },
    otpHash: { type: String },
    verified: { type: Boolean, default: false },
    sentCount: { type: Number, default: 0 },
    lastSentAt: { type: Date },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
