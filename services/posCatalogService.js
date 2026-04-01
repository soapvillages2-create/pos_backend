const { v5: uuidv5 } = require('uuid');
const productModel = require('../models/product');
const tenantModel = require('../models/tenant');
const posCatalogModel = require('../models/posCatalog');

/** namespace UUID คงที่ — ใช้สร้าง category / addon group id แบบ deterministic ต่อ tenant */
const NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function iso(d) {
  if (!d) return new Date().toISOString();
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
}

function categoryIdFor(tenantId, categoryName) {
  const name = String(categoryName || '').trim() || '_uncategorized';
  return uuidv5(`${tenantId}|category|${name}`, NS);
}

function addonGroupIdFor(tenantId, nameOrKey) {
  return uuidv5(`${tenantId}|addonGroup|${String(nameOrKey)}`, NS);
}

function optionIdFor(groupId, opt, index) {
  if (opt && opt.id) return String(opt.id);
  const key = `${opt && opt.name != null ? opt.name : ''}|${index}`;
  return uuidv5(`${groupId}|option|${key}`, NS);
}

function parseMenuExtras(row) {
  const x = row.menu_extras;
  if (!x || typeof x !== 'object') return {};
  return x;
}

/**
 * รวบรวม addon groups จาก menu_extras.addons ของทุกสินค้า
 * รองรับทั้งอ็อบเจ็กต์เต็ม ({ id?, name, options }) และสตริง (อ้างอิง id กลุ่ม)
 */
function buildAddonCatalog(productRows, tenantId) {
  const groupMap = new Map();

  for (const row of productRows) {
    const extras = parseMenuExtras(row);
    const addons = extras.addons;
    if (!Array.isArray(addons)) continue;

    for (const a of addons) {
      if (typeof a === 'string') {
        const gid = String(a).trim();
        if (gid && !groupMap.has(gid)) {
          groupMap.set(gid, {
            id: gid,
            name: 'Addon',
            options: [],
          });
        }
        continue;
      }
      if (!a || typeof a !== 'object') continue;
      const gid =
        a.id != null && String(a.id).trim() !== ''
          ? String(a.id)
          : addonGroupIdFor(tenantId, a.name || 'unnamed');
      const options = Array.isArray(a.options)
        ? a.options.map((o, i) => ({
            id: optionIdFor(gid, o, i),
            name: o && o.name != null ? String(o.name) : '',
            price: o != null && o.price != null ? Number(o.price) || 0 : 0,
          }))
        : [];
      const existing = groupMap.get(gid);
      if (!existing || (existing.options.length === 0 && options.length > 0)) {
        groupMap.set(gid, {
          id: gid,
          name: a.name != null ? String(a.name) : 'Addon',
          options,
        });
      }
    }
  }

  return [...groupMap.values()];
}

function productAddonGroupIds(extras, tenantId) {
  const addons = extras.addons;
  if (!Array.isArray(addons)) return [];
  return addons.map((a) => {
    if (typeof a === 'string') return String(a).trim();
    if (a && a.id != null && String(a.id).trim() !== '') return String(a.id);
    return addonGroupIdFor(tenantId, a && a.name != null ? a.name : 'unnamed');
  });
}

function buildCategoriesFromProducts(productRows, tenantId) {
  const seen = new Map();
  let needsUncategorized = false;
  for (const row of productRows) {
    const raw = row.category != null ? String(row.category).trim() : '';
    if (!raw) {
      needsUncategorized = true;
      continue;
    }
    if (!seen.has(raw)) {
      seen.set(raw, {
        id: categoryIdFor(tenantId, raw),
        name: raw,
        sortOrder: seen.size,
      });
    }
  }
  if (needsUncategorized) {
    const uid = uncategorizedCategoryId(tenantId);
    seen.set('__uncat__', {
      id: uid,
      name: 'ไม่ระบุหมวด',
      sortOrder: seen.size,
    });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

function uncategorizedCategoryId(tenantId) {
  return categoryIdFor(tenantId, '_uncategorized');
}

function buildProductsPayload(productRows, tenantId, categoryIdByLabel, uncategorizedId) {
  let maxTs = 0;

  const products = productRows.map((row) => {
    const t = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (t > maxTs) maxTs = t;

    const extras = parseMenuExtras(row);
    const catLabel = row.category != null ? String(row.category).trim() : '';
    const categoryId = catLabel
      ? categoryIdByLabel.get(catLabel) || uncategorizedId
      : uncategorizedId;

    return {
      id: String(row.id),
      name: String(row.name || ''),
      categoryId,
      price: row.price != null ? Number(row.price) : 0,
      description: row.description != null ? String(row.description) : '',
      imageUrl: row.image_url != null ? String(row.image_url) : '',
      isActive: row.is_active !== false,
      emoji: extras.emoji != null ? String(extras.emoji) : '',
      imageAlignY: extras.imageAlignY != null ? Number(extras.imageAlignY) : 0,
      addonGroupIds: productAddonGroupIds(extras, tenantId),
    };
  });

  return { products, maxTs };
}

async function buildSalesSettingsPartial(tenantId, snapshotSales) {
  const tenant = await tenantModel.getTenantByTenantId(tenantId);
  const qrCfg = await posCatalogModel.getQrWebMenuConfig(tenantId);

  const merged = {};
  if (snapshotSales && typeof snapshotSales === 'object') {
    Object.assign(merged, snapshotSales);
  }
  if (qrCfg) {
    if (merged.storeName == null && qrCfg.store_name) merged.storeName = String(qrCfg.store_name);
    if (merged.webMenuLogoUrl == null && qrCfg.web_menu_logo_url) {
      merged.webMenuLogoUrl = String(qrCfg.web_menu_logo_url);
    }
  }
  if (merged.storeName == null && tenant && tenant.name) {
    merged.storeName = String(tenant.name);
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

async function buildFromProducts(tenantId) {
  const rows = await productModel.findAllForCatalog(tenantId);
  const uncatId = uncategorizedCategoryId(tenantId);
  const categories = buildCategoriesFromProducts(rows, tenantId);
  const categoryIdByLabel = new Map(categories.map((c) => [c.name, c.id]));

  const addonGroups = buildAddonCatalog(rows, tenantId);
  const { products, maxTs } = buildProductsPayload(rows, tenantId, categoryIdByLabel, uncatId);

  const updatedAt = iso(maxTs ? new Date(maxTs) : new Date());
  const salesSettings = await buildSalesSettingsPartial(tenantId, null);

  return {
    version: 1,
    updatedAt,
    categories,
    addonGroups,
    products,
    salesSettings,
  };
}

function snapshotHasCatalog(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const c = payload.categories;
  const p = payload.products;
  const g = payload.addonGroups;
  if (Array.isArray(c) && c.length > 0) return true;
  if (Array.isArray(p) && p.length > 0) return true;
  if (Array.isArray(g) && g.length > 0) return true;
  return false;
}

/**
 * คืน object ตรงกับ data ใน { success, data }
 */
async function getCatalogForTenant(tenantId) {
  const row = await posCatalogModel.getSnapshot(tenantId);
  const payload = row && row.payload ? row.payload : null;

  if (row && snapshotHasCatalog(payload)) {
    const base = typeof payload === 'object' && payload !== null ? { ...payload } : {};
    const version = row.version != null ? Number(row.version) : 1;
    const updatedAt = iso(row.updated_at);
    const salesSettings = await buildSalesSettingsPartial(
      tenantId,
      base.salesSettings != null ? base.salesSettings : null
    );
    return {
      version,
      updatedAt,
      categories: Array.isArray(base.categories) ? base.categories : [],
      addonGroups: Array.isArray(base.addonGroups) ? base.addonGroups : [],
      products: Array.isArray(base.products) ? base.products : [],
      salesSettings,
    };
  }

  const derived = await buildFromProducts(tenantId);
  if (row && payload && typeof payload === 'object' && payload.salesSettings != null) {
    derived.salesSettings = {
      ...(derived.salesSettings || {}),
      ...payload.salesSettings,
    };
    if (Object.keys(derived.salesSettings).length === 0) derived.salesSettings = null;
  }
  if (row && row.version != null) {
    derived.version = Number(row.version) || derived.version;
  }
  if (row && row.updated_at) {
    derived.updatedAt = iso(row.updated_at);
  }
  return derived;
}

module.exports = {
  getCatalogForTenant,
};
