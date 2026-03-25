const productModel = require('../models/product');

async function create(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { name, price, description, imageUrl, category, isActive } = req.body;

    if (!name || price == null) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อสินค้าและราคา',
      });
    }

    const product = await productModel.create(tenantId, {
      name,
      price,
      description,
      imageUrl,
      category,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: 'เพิ่มสินค้าสำเร็จ',
      data: product,
    });
  } catch (err) {
    console.error('Product create error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function list(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { category, isActive, limit, offset } = req.query;

    const products = await productModel.findAllByTenant(tenantId, {
      category: category || undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    res.json({
      success: true,
      data: products,
    });
  } catch (err) {
    console.error('Product list error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function getById(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const product = await productModel.findById(id, tenantId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสินค้า',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error('Product getById error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function update(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, price, description, imageUrl, category, isActive } = req.body;

    const product = await productModel.findById(id, tenantId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสินค้า',
      });
    }

    const updated = await productModel.update(id, tenantId, {
      name,
      price,
      description,
      imageUrl,
      category,
      isActive,
    });

    res.json({
      success: true,
      message: 'อัปเดตสินค้าสำเร็จ',
      data: updated,
    });
  } catch (err) {
    console.error('Product update error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function remove(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const deleted = await productModel.remove(id, tenantId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสินค้า',
      });
    }

    res.json({
      success: true,
      message: 'ลบสินค้าสำเร็จ',
    });
  } catch (err) {
    console.error('Product remove error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
};
