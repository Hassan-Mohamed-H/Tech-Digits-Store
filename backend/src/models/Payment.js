const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['visa', 'vodafone'], required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending' },
    details: {
      last4: String,
      expiry: String,
      vodafoneNumber: String,
      reference: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
