const Cart = require('../models/Cart');
const Product = require('../models/Product');


async function getMyCart(req, res) {
  try {
    const userId = req.user.id;
    let cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
      cart = await cart.populate('items.product');
    }
    return res.json(cart);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function upsertCart(req, res) {
  try {
    const userId = req.user.id;
    const { items } = req.body || {};

    if (Array.isArray(items)) {
      const normalized = [];
      for (const it of items) {
        const productId = it.product || it.productId || it.id;
        if (!productId) continue;
        const qty = Math.max(1, Number(it.quantity || it.qty || 1));
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: `Product not found: ${productId}` });
        normalized.push({ product: product._id, quantity: qty, price: product.price });
      }
      const cart = await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: normalized } },
        { new: true, upsert: true }
      ).populate('items.product');
      return res.status(200).json(cart);
    }

    const productId = req.body.product || req.body.productId || req.body.id;
    const qty = Math.max(1, Number(req.body.quantity || req.body.qty || 1));
    if (!productId) return res.status(400).json({ message: 'Missing productId' });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = await Cart.create({ user: userId, items: [] });
    const idx = cart.items.findIndex(x => String(x.product) === String(product._id));
    if (idx >= 0) {
      cart.items[idx].quantity += qty;
      cart.items[idx].price = product.price;
    } else {
      cart.items.push({ product: product._id, quantity: qty, price: product.price });
    }
    await cart.save();
    await cart.populate('items.product');
    return res.status(201).json(cart);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateItem(req, res) {
  try {
    const userId = req.user.id;
    const productId = req.params.id;
    const qty = Math.max(1, Number(req.body.quantity || req.body.qty || 1));

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = await Cart.create({ user: userId, items: [] });
    const idx = cart.items.findIndex(x => String(x.product) === String(product._id));
    if (idx < 0) return res.status(404).json({ message: 'Item not in cart' });

    cart.items[idx].quantity = qty;
    cart.items[idx].price = product.price;
    await cart.save();
    await cart.populate('items.product');
    return res.json(cart);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function removeItem(req, res) {
  try {
    const userId = req.user.id;
    const productId = req.params.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const before = cart.items.length;
    cart.items = cart.items.filter(it => String(it.product) !== String(productId));
    if (cart.items.length === before) return res.status(404).json({ message: 'Item not found' });

    await cart.save();
    await cart.populate('items.product');
    return res.json(cart);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}

module.exports = { getMyCart, upsertCart, updateItem, removeItem };
