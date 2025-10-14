const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    username: { type: String, trim: true, unique: true, sparse: true },
    address: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },

    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    phone: { type: String, trim: true }
  },
  { timestamps: true }
);

userSchema.pre('save', function(next) {
  if (!this.name) {
    const fn = (this.firstName || '').trim();
    const ln = (this.lastName || '').trim();
    const full = [fn, ln].filter(Boolean).join(' ').trim();
    if (full) this.name = full;
  }
  if (!this.phone && this.phoneNumber) {
    this.phone = this.phoneNumber;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
