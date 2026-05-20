const express = require('express');
const router = express.Router();
const pool = require('../db-mysql');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

/**
 * 统一响应格式
 */
function response(status, errmsg, data = null) {
  const result = { status, errmsg };
  if (data !== null) {
    result.data = data;
  }
  return result;
}

async function getStandard(key, storeId = 1) {
  const [rows] = await pool.execute(
    'SELECT rule_value FROM scheduling_rules WHERE rule_key = ? AND store_id = ?',
    [key, storeId]
  );
  if (!rows.length) return null;
  const val = rows[0].rule_value;
  try { return JSON.parse(val); } catch { return Number(val) || 0; }
}

async function setStandard(key, value, storeId = 1) {
  const jsonStr = JSON.stringify(value);
  await pool.execute(
    'INSERT INTO scheduling_rules (store_id, rule_key, rule_value, description) VALUES (?, ?, ?, "") ON DUPLICATE KEY UPDATE rule_value = ?',
    [storeId, key, jsonStr, jsonStr]
  );
}

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.json(response(1, '获取成功', { front_efficiency: 2800, back_efficiency: 2200 }));
    }
    const frontStandard = await getStandard('front_standard', storeId) || { efficiency: 2800 };
    const backStandard = await getStandard('back_standard', storeId) || { efficiency: 2200 };
    res.json(response(1, '获取成功', {
      front_efficiency: frontStandard.efficiency || 2800,
      back_efficiency: backStandard.efficiency || 2200
    }));
  } catch (err) {
    console.error('[Settings] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(400).json(response(0, '缺少门店ID'));
    }
    const { front_efficiency, back_efficiency } = req.body;
    if (front_efficiency != null) {
      const frontStandard = await getStandard('front_standard', storeId) || {};
      frontStandard.efficiency = Number(front_efficiency);
      await setStandard('front_standard', frontStandard, storeId);
    }
    if (back_efficiency != null) {
      const backStandard = await getStandard('back_standard', storeId) || {};
      backStandard.efficiency = Number(back_efficiency);
      await setStandard('back_standard', backStandard, storeId);
    }
    res.json(response(1, '保存成功'));
  } catch (err) {
    console.error('[Settings] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;
