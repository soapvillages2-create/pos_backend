const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

router.get('/', orderController.list);
router.get('/:id', orderController.getById);
router.post('/', orderController.create);
router.patch('/:id/status', orderController.updateStatus);

module.exports = router;
