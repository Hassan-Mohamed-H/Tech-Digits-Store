const mongoose = require('mongoose');
const slugify = require('slugify');


const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true }
  },
  { timestamps: true }
);


categorySchema.pre('validate', function (next) {
  if (this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});



module.exports = mongoose.model('Category', categorySchema);
