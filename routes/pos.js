const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const posCatalogController = require('../controllers/posCatalogController');

router.use(authMiddleware);

router.get('/catalog', posCatalogController.getCatalog);

module.exports = router;
