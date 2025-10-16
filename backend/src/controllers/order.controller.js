const Product = require('../models/Product');
const Order = require('../models/Order');

const createOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order must have at least one item" });
    }

    const orderItems = [];
    let totalAmount = 0;

    for (let it of items) {
      const productId = it.product || it.productId || it.id;
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${productId}` });
      }

      const price = product.price;
      const qty = it.qty || 1;

      orderItems.push({
        product: product._id,
        price,
        qty
      });

      totalAmount += price * qty;
    }

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      totalAmount
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const listMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).populate('items.product');
  res.json(orders);
};

const listAllOrders = async (req, res) => {
  // ✅ Added by Windsurf: include customerName in admin orders listing
  const orders = await Order.find().populate('user').populate('items.product');
  const data = (orders || []).map(o => {
    const obj = typeof o.toObject === 'function' ? o.toObject() : o;
    const u = o.user || {};
    const name = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.email || '';
    obj.customerName = name;
    return obj;
  });
  res.json(data);
};

const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('items.product');
  if (!order) return res.status(404).json({ message: 'Not found' });
  res.json(order);
};

const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const updated = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
};

const deleteOrder = async (req, res) => {
  try {
    const removed = await Order.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Not found' });
    return res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteAllOrders = async (_req, res) => {
  try {
    const result = await Order.deleteMany({});
    return res.json({ success: true, deleted: result.deletedCount || 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { createOrder, listMyOrders, listAllOrders, getOrder, updateOrderStatus, deleteOrder, deleteAllOrders };
