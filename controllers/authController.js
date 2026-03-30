const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const tenantModel = require('../models/tenant');
const userModel = require('../models/user');
const customerModel = require('../models/customer');
const { sendResetPasswordEmail } = require('../services/emailService');

const RESET_TOKEN_TTL_MINUTES = 15;

/** รหัส OTP 6 หลัก (100000–999999) สำหรับรีเซ็ตรหัสผ่าน */
function generateResetPasswordOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function register(req, res) {
  try {
    const { storeName, email, password, province, country, agreedToTerms } = req.body;
    const fullName = req.body.fullName || storeName;

    if (!storeName || !email || !password || !province || !country) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก อีเมล, รหัสผ่าน, ชื่อร้าน, จังหวัด และประเทศ ให้ครบถ้วน',
      });
    }

    if (agreedToTerms !== true) {
      return res.status(400).json({
        success: false,
        message: 'กรุณายอมรับข้อตกลงการใช้บริการ (Terms of Use)',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      });
    }

    const existingUser = await userModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'อีเมลนี้ถูกใช้งานแล้ว',
      });
    }

    const tenant = await tenantModel.createTenant(storeName, province, country);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.createUser(
      tenant.tenant_id,
      email,
      passwordHash,
      fullName,
      'admin',
      new Date()
    );

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      data: {
        token,
        tenantId: tenant.tenant_id,
        storeName: tenant.name,
        province: tenant.province,
        country: tenant.country,
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก',
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกอีเมลและรหัสผ่าน',
      });
    }

    const user = await userModel.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const tenant = await tenantModel.getTenantByTenantId(user.tenant_id);
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      data: {
        token,
        user: {
          id: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
        store: tenant ? { name: tenant.name, province: tenant.province, country: tenant.country } : null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
    });
  }
}

async function me(req, res) {
  try {
    const tokenUser = req.user;
    const user = await userModel.getUserById(tokenUser.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    }
    const tenant = await tenantModel.getTenantByTenantId(tokenUser.tenantId);
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
        store: tenant ? { name: tenant.name, province: tenant.province, country: tenant.country } : null,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function registerMember(req, res) {
  try {
    const { tenantId, email, password, name, phone } = req.body;

    if (!tenantId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก tenantId, อีเมล และรหัสผ่าน',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      });
    }

    const tenant = await tenantModel.getTenantByTenantId(tenantId);
    if (!tenant) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบร้านค้า',
      });
    }

    const existing = await customerModel.findByEmail(email, tenantId);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'อีเมลนี้ถูกใช้งานแล้วในร้านนี้',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const member = await customerModel.create(tenantId, {
      name: name || email.split('@')[0],
      phone: phone || null,
      email: email.trim().toLowerCase(),
      passwordHash,
    });

    res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      data: {
        ok: true,
        member: {
          id: member.id,
          tenantId: member.tenant_id,
          email: member.email,
          name: member.name,
          phone: member.phone,
        },
      },
    });
  } catch (err) {
    console.error('Register member error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก',
    });
  }
}

async function loginMember(req, res) {
  try {
    const { tenantId, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกอีเมลและรหัสผ่าน',
      });
    }

    let customer;
    if (tenantId) {
      customer = await customerModel.findByEmail(email, tenantId);
    } else {
      const matches = await customerModel.findByEmailGlobal(email);
      if (matches.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        });
      }
      if (matches.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'พบอีเมลนี้ในหลายร้าน กรุณาติดต่อพนักงานเพื่อระบุร้าน',
        });
      }
      customer = matches[0];
    }

    if (!customer || !customer.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const isMatch = await bcrypt.compare(password, customer.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const tenant = await tenantModel.getTenantByTenantId(customer.tenant_id);
    const token = jwt.sign(
      { customerId: customer.id, tenantId: customer.tenant_id, email: customer.email, role: 'member' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      data: {
        ok: true,
        token,
        member: {
          id: customer.id,
          tenantId: customer.tenant_id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          points: customer.points,
        },
        store: tenant ? { name: tenant.name } : null,
      },
    });
  } catch (err) {
    console.error('Login member error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
    });
  }
}

/** ข้อความตอบกลับแบบเดียวกันเสมอ — ป้องกันการเดาอีเมลในระบบ */
const FORGOT_PASSWORD_GENERIC_MESSAGE =
  'หากอีเมลถูกต้องและมีบัญชีในระบบ คุณจะได้รับรหัสยืนยันการรีเซ็ตรหัสผ่านทางอีเมล';

async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    const trimmed = typeof email === 'string' ? email.trim() : '';

    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกอีเมล',
      });
    }
    if (!isValidEmailFormat(trimmed)) {
      return res.status(400).json({
        success: false,
        message: 'รูปแบบอีเมลไม่ถูกต้อง',
      });
    }

    const user = await userModel.getUserByEmail(trimmed);
    if (!user) {
      return res.json({
        success: true,
        message: FORGOT_PASSWORD_GENERIC_MESSAGE,
      });
    }

    const otpCode = generateResetPasswordOtp();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await userModel.setResetPasswordToken(user.id, otpCode, expiresAt);

    try {
      await sendResetPasswordEmail(user.email, otpCode);
    } catch (mailErr) {
      console.error('forgotPassword send email error:', mailErr?.message || mailErr);
      if (mailErr?.response) console.error('SMTP response:', mailErr.response);
      return res.status(503).json({
        success: false,
        message: 'ไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาตรวจสอบการตั้งค่าอีเมลหรือลองใหม่ภายหลัง',
      });
    }

    return res.json({
      success: true,
      message: FORGOT_PASSWORD_GENERIC_MESSAGE,
    });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง',
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, token, newPassword } = req.body || {};
    const emailTrim = typeof email === 'string' ? email.trim() : '';
    const tokenTrim =
      token == null ? '' : String(token).trim().replace(/\s/g, '');
    const pwd = typeof newPassword === 'string' ? newPassword : '';

    if (!emailTrim || !tokenTrim || !pwd) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกอีเมล โค้ดรีเซ็ต และรหัสผ่านใหม่ให้ครบ',
      });
    }
    if (!isValidEmailFormat(emailTrim)) {
      return res.status(400).json({
        success: false,
        message: 'รูปแบบอีเมลไม่ถูกต้อง',
      });
    }
    if (pwd.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      });
    }

    const user = await userModel.findUserByEmailAndValidResetToken(
      emailTrim,
      tokenTrim
    );
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'โค้ดไม่ถูกต้องหรือหมดอายุ',
      });
    }

    const passwordHash = await bcrypt.hash(pwd, 10);
    await userModel.updatePasswordAndClearResetToken(user.id, passwordHash);

    return res.json({
      success: true,
      message: 'รีเซ็ตรหัสผ่านสำเร็จ คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้',
    });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง',
    });
  }
}

/**
 * POST /api/auth/delete-account — ปิดบัญชีร้านถาวร (เฉพาะ admin / เจ้าของร้าน)
 * Body: { password, confirmation: "DELETE" }
 */
async function deleteAccount(req, res) {
  try {
    const { password, confirmation } = req.body || {};
    const pwd = typeof password === 'string' ? password : '';
    const conf =
      confirmation == null ? '' : String(confirmation).trim();

    if (!pwd) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกรหัสผ่าน',
      });
    }
    if (conf !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'กรุณายืนยันโดยพิมพ์ DELETE',
      });
    }

    const tokenUser = req.user;
    const user = await userModel.getUserByIdWithPassword(tokenUser.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้',
      });
    }

    if (user.tenant_id !== tokenUser.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์ลบบัญชีร้าน',
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์ลบบัญชีร้าน (เฉพาะเจ้าของร้านเท่านั้น)',
      });
    }

    const isMatch = await bcrypt.compare(pwd, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'รหัสผ่านไม่ถูกต้อง',
      });
    }

    const deleted = await tenantModel.deleteTenantByTenantId(user.tenant_id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลร้าน',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'บัญชีร้านถูกลบแล้ว',
    });
  } catch (err) {
    console.error('deleteAccount error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด ไม่สามารถลบบัญชีได้',
    });
  }
}

module.exports = {
  register,
  registerMember,
  login,
  loginMember,
  me,
  forgotPassword,
  resetPassword,
  deleteAccount,
};
