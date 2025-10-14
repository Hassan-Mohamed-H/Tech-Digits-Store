const express = require('express');
const { createOrder, listMyOrders, listAllOrders, getOrder, updateOrderStatus, deleteOrder, deleteAllOrders } = require('../controllers/order.controller');
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

const router = express.Router();

router.post('/', auth, createOrder);
router.get('/mine', auth, listMyOrders);
router.get('/', auth, admin, listAllOrders);
router.get('/:id', auth, getOrder);
router.put('/:id/status', auth, admin, updateOrderStatus);
router.delete('/:id', auth, admin, deleteOrder);
router.delete('/', auth, admin, deleteAllOrders);

module.exports = router;
