const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const posCatalogController = require('../controllers/posCatalogController');
const posStaffController = require('../controllers/posStaffController');

router.use(authMiddleware);

router.get('/catalog', posCatalogController.getCatalog);

router.get('/staff', posStaffController.getStaff);
router.post('/staff/sync', posStaffController.syncStaff);
// path เดียว — บาง nginx / proxy ทำให้ POST /staff/sync 404
router.post('/staff-sync', posStaffController.syncStaff);

module.exports = router;
