const posCatalogService = require('../services/posCatalogService');

/**
 * GET /api/pos/catalog — snapshot เมนู/หมวด/addon/ราคา ต่อร้าน (JWT)
 */
async function getCatalog(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const data = await posCatalogService.getCatalogForTenant(tenantId);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('POS catalog error:', err);
    return res.status(500).json({
      success: false,
      message: 'ไม่สามารถโหลดแคตตาล็อกได้',
    });
  }
}

module.exports = {
  getCatalog,
};
