const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

router.get('/', customerController.list);
router.get('/:id', customerController.getById);
router.post('/', customerController.create);
router.put('/:id', customerController.update);
router.patch('/:id/points', customerController.updatePoints);
router.delete('/:id', customerController.remove);

module.exports = router;
