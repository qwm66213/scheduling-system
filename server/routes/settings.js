const express = require('express');
const router = express.Router();
const { getDB, save } = require('../db');

function getStandard(key) {
  const db = getDB();
  const result = db.exec('SELECT rule_value FROM scheduling_rules WHERE rule_key = ?', [key]);
  if (!result[0] || !result[0].values[0]) return null;
  const val = result[0].values[0][0];
  try { return JSON.parse(val); } catch { return Number(val) || 0; }
}

function setStandard(key, value) {
  const db = getDB();
  const jsonStr = JSON.stringify(value);
  db.run('UPDATE scheduling_rules SET rule_value = ? WHERE rule_key = ?', [jsonStr, key]);
  save();
}

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const frontStandard = getStandard('front_standard') || { efficiency: 2800 };
    const backStandard = getStandard('back_standard') || { efficiency: 2200 };
    res.json({
      front_efficiency: frontStandard.efficiency || 2800,
      back_efficiency: backStandard.efficiency || 2200
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', (req, res) => {
  try {
    const { front_efficiency, back_efficiency } = req.body;
    if (front_efficiency != null) {
      const frontStandard = getStandard('front_standard') || {};
      frontStandard.efficiency = Number(front_efficiency);
      setStandard('front_standard', frontStandard);
    }
    if (back_efficiency != null) {
      const backStandard = getStandard('back_standard') || {};
      backStandard.efficiency = Number(back_efficiency);
      setStandard('back_standard', backStandard);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
