const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');

router.post('/register', authController.register);
router.post('/register-member', authController.registerMember);
router.post('/login-member', authController.loginMember);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/delete-account', authMiddleware, authController.deleteAccount);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
