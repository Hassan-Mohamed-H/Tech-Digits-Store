const Product = require('../models/Product');

const createProduct = async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
};

const listProducts = async (req, res) => {
  const { category } = req.query || {};
  let filter = {};
  if (category) {
    try {
      const Category = require('../models/Category');
      const cat = await Category.findOne({
        $or: [
          { _id: category },
          { slug: String(category).toLowerCase() },
          { name: new RegExp(`^${String(category)}$`, 'i') }
        ]
      });
      if (cat) filter.category = cat._id; else filter.category = null;
    } catch (_) {
      filter.category = null;
    }
  }
  const products = await Product.find(filter).populate('category', 'name slug');
  res.json(products);
};

const getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category');
  if (!product) return res.status(404).json({ message: 'Not found' });
  res.json(product);
};

const updateProduct = async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
};

const deleteProduct = async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};

module.exports = { createProduct, listProducts, getProduct, updateProduct, deleteProduct };
