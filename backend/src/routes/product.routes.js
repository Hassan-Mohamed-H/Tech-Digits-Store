const express = require('express');
const { createProduct, listProducts, getProduct, updateProduct, deleteProduct } = require('../controllers/product.controller');
const { canReview } = require('../controllers/review.controller');
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

const router = express.Router();

router.get('/', listProducts);
router.get('/:id', getProduct);
router.get('/:id/review-permission', auth, canReview);
router.post('/', auth, admin, createProduct);
router.put('/:id', auth, admin, updateProduct);
router.delete('/:id', auth, admin, deleteProduct);

module.exports = router;
