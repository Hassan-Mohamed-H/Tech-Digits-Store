const express = require('express');
const { addReview, listProductReviews, listAllReviews, deleteReview } = require('../controllers/review.controller');
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

const router = express.Router();

router.get('/', auth, admin, listAllReviews);
router.delete('/:id', auth, admin, deleteReview);

router.post('/', auth, addReview);
router.get('/:productId', listProductReviews);

module.exports = router;
