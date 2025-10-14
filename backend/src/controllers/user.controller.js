const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Order = require('../models/Order');
const Review = require('../models/Review');

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load profile' });
  }
};

const listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to list users' });
  }
};

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get user' });
  }
};

const updateMe = async (req, res) => {
  try {
    const { name, email, firstName, lastName, username, phoneNumber, address } = req.body || {};
    const update = { name, email, firstName, lastName, username, phoneNumber, address };

    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);
    const updated = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true }).select('-password');
    res.json(updated);
  } catch (err) {
    const code = err.code === 11000 ? 409 : 500;
    const msg = err.code === 11000 ? 'Email or username already exists' : (err.message || 'Failed to update profile');
    res.status(code).json({ message: msg });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['user','admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const updated = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true }).select('-password');
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update role' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { firstName, lastName, username, email, phoneNumber, address, name, role } = req.body || {};
    const update = { firstName, lastName, username, email, phoneNumber, address, name };
    if (role) update.role = role;
    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);
    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-password');
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json(updated);
  } catch (err) {
    const code = err.code === 11000 ? 409 : 500;
    const msg = err.code === 11000 ? 'Email or username already exists' : (err.message || 'Failed to update user');
    res.status(code).json({ message: msg });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await Promise.all([
      Order.deleteMany({ user: userId }).catch(()=>{}),
      Review.deleteMany({ user: userId }).catch(()=>{})
    ]);
    await User.findByIdAndDelete(userId);
    res.json({ message: 'User and related data deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete user' });
  }
};

module.exports = { getMe, listUsers, getUser, updateMe, updateUserRole, updateUser, deleteUser };
