const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'ไม่พบ Token กรุณาเข้าสู่ระบบ',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่',
    });
  }
}

module.exports = authMiddleware;
