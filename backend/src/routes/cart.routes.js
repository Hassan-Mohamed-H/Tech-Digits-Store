const express = require('express');
const { auth } = require('../middleware/auth');
const { getMyCart, upsertCart, updateItem, removeItem } = require('../controllers/cart.controller');

const router = express.Router();

router.get('/', auth, getMyCart);
router.post('/', auth, upsertCart);
router.put('/:id', auth, updateItem);
router.delete('/:id', auth, removeItem);

module.exports = router;
