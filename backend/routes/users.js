const express = require('express');
const router = express.Router();
const { protect, requireSuperadmin } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

// All users endpoints are protected and restricted to superadmin
router.use(protect, requireSuperadmin);

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
