const Review = require('../models/Review');
const Order = require('../models/Order');

const addReview = async (req, res) => {
  const { productId, rating, comment } = req.body;
  try {
    const hasPaidOrder = await Order.findOne({
      user: req.user.id,
      status: 'paid',
      'items.product': productId
    }).select('_id');
    if (!hasPaidOrder) {
      return res.status(403).json({ success: false, message: 'You can only review products you have purchased and paid for.' });
    }
    const review = await Review.create({ user: req.user.id, product: productId, rating, comment });
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add review' });
  }
};

const listProductReviews = async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId }).populate('user', 'name');
  res.json(reviews);
};

const listAllReviews = async (req, res) => {
  const reviews = await Review.find({}).populate('user', 'name').populate('product', 'name');
  res.json(reviews);
};

const deleteReview = async (req, res) => {
  const { id } = req.params;
  const r = await Review.findByIdAndDelete(id);
  if (!r) return res.status(404).json({ message: 'Review not found' });
  res.json({ message: 'Review deleted' });
};

module.exports = { addReview, listProductReviews, listAllReviews, deleteReview };

const canReview = async (req, res) => {
  try {
    const productId = req.params.id || req.params.productId;
    if (!req.user || !req.user.id) return res.status(401).json({ canReview: false });
    const hasPaidOrder = await Order.findOne({
      user: req.user.id,
      status: 'paid',
      'items.product': productId
    }).select('_id');
    res.json({ canReview: !!hasPaidOrder });
  } catch (err) {
    res.status(500).json({ canReview: false, message: err.message || 'Error checking permission' });
  }
};

module.exports = { ...module.exports, canReview };
