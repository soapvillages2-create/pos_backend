const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const qrController = require('../controllers/qrController');

router.use(authMiddleware);

router.get('/pending-orders', qrController.getPendingOrders);
router.patch('/orders/:orderId/confirm', qrController.confirmOrder);
router.post('/push-order', qrController.pushOrder);
router.post('/table-last-payment', qrController.tableLastPayment);
router.post('/mark-table-orders-paid', qrController.markTableOrdersPaid);
router.put('/table-order-snapshot', qrController.putTableSnapshot);
router.delete('/table-order-snapshot', qrController.deleteTableSnapshot);
router.post('/sync-menu', qrController.syncMenu);
router.patch('/web-menu-config-token', qrController.patchWebMenuToken);
router.get('/call-for-payment-events', qrController.getCallForPaymentEvents);
router.get('/table-cart', qrController.getTableCart);
router.put('/table-cart', qrController.putTableCart);

module.exports = router;
