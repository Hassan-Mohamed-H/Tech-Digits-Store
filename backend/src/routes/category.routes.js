const express = require('express');
const { createCategory, listCategories, getCategory, updateCategory, deleteCategory } = require('../controllers/category.controller');
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

const router = express.Router();

router.get('/', listCategories);
router.get('/:id', getCategory);
router.post('/', auth, admin, createCategory);
router.put('/:id', auth, admin, updateCategory);
router.delete('/:id', auth, admin, deleteCategory);

module.exports = router;
