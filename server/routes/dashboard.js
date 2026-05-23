const express = require('express');
const router = express.Router();
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

// GET /api/dashboard/summary?month=2026-05
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json(response(0, 'month format required: YYYY-MM'));
    }

    // 数据看板功能已迁移，暂返回空数据
    res.json(response(1, '获取成功', {
      totalRevenue: 0,
      dataDays: 0,
      front: {
        staff: 0,
        dailyStaff: [],
        staffStd: 0,
        salaryStd: 0,
        salary: 0,
        ratioStd: 8.0,
        ratio: 0,
        efficiency: 0,
        standard: { efficiency: 2800, salary: 69195, ratio: 8.0 }
      },
      back: {
        staff: 0,
        dailyStaff: [],
        staffStd: 0,
        salaryStd: 0,
        salary: 0,
        ratioStd: 12.5,
        ratio: 0,
        efficiency: 0,
        standard: { efficiency: 2200, salary: 108117, ratio: 12.5 }
      },
      total: {
        staff: 0,
        dailyStaff: [],
        staffStd: 0,
        salaryStd: 0,
        salary: 0,
        ratioStd: 20.5,
        ratio: 0,
        efficiency: 0,
        standard: { efficiency: 1200, salary: 177312, ratio: 20.5 }
      },
      revenueTarget: 864936,
      revenueAchieve: 0,
      effAchieve: 0,
      efficiencyStandard: { revenue: 100, efficiency: 100 }
    }));
  } catch (err) {
    console.error('[Dashboard] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;