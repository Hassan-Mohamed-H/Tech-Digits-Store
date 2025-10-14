const express = require('express');
const { getMe, listUsers, getUser, updateMe, updateUserRole, updateUser, deleteUser } = require('../controllers/user.controller');
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

const router = express.Router();

router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);

router.get('/', auth, admin, listUsers);
router.get('/:id', auth, admin, getUser);
router.put('/:id/role', auth, admin, updateUserRole);
router.patch('/:id/role', auth, admin, updateUserRole);
router.put('/:id', auth, admin, updateUser);
router.delete('/:id', auth, admin, deleteUser);

module.exports = router;
