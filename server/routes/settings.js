const express = require('express');
const router = express.Router();
const http = require('http');
const authMiddleware = require('../middleware/auth');
const config = require('../config');

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

// OpenAPI 配置
const EFFICIENCY_API = {
  token: config.openapi.token,
  userId: config.openapi.userId,
  tableKey: 'tb_f78e9d4db7476'
};

// 门店ID到门店名称的映射
const STORE_ID_TO_NAME = config.stores.STORE_ID_TO_NAME;

// 默认值
const DEFAULT_VALUES = {
  front_efficiency: 2800,
  back_efficiency: 2200,
  front_bonus_ratio: '10%',
  back_bonus_ratio: '12%'
};

// 调用 OpenAPI
function callOpenAPI(path, postData, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${EFFICIENCY_API.token}`,
        'Emoo-User-Id': EFFICIENCY_API.userId
      }
    };

    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const body = buffer.toString('utf8');
          const json = JSON.parse(body);
          if (json.code === 200 && json.data) {
            resolve(json.data);
          } else {
            console.error('[Settings] API error:', json.code, json.message);
            resolve(null);
          }
        } catch (e) {
          console.error('[Settings] Parse error:', e.message);
          resolve(null);
        }
      });
    });
    req.on('error', e => reject(e));
    req.write(JSON.stringify(postData));
    req.end();
  });
}

// 查询指定门店的记录
async function findExistingRecord(storeName) {
  const title = `人效标准_${storeName}`;
  const postData = {
    table_key: EFFICIENCY_API.tableKey,
    page_size: 1,
    current_page: 1,
    filters: [`标题:eq:${title}`]
  };
  const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
  if (data && data.results && data.results.length > 0) {
    return data.results[0];
  }
  return null;
}

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const storeId = req.storeId;

    // 管理员查看全部门店时返回默认值
    if (!storeId) {
      return res.json(response(1, '获取成功', DEFAULT_VALUES));
    }

    const storeName = STORE_ID_TO_NAME[storeId];
    if (!storeName) {
      return res.json(response(1, '获取成功', DEFAULT_VALUES));
    }

    const existing = await findExistingRecord(storeName);

    if (existing) {
      res.json(response(1, '获取成功', {
        front_efficiency: existing.fields['前厅人效标准'] || DEFAULT_VALUES.front_efficiency,
        back_efficiency: existing.fields['后厨人效标准'] || DEFAULT_VALUES.back_efficiency,
        front_bonus_ratio: existing.fields['前厅奖金比例'] || DEFAULT_VALUES.front_bonus_ratio,
        back_bonus_ratio: existing.fields['后厨奖金比例'] || DEFAULT_VALUES.back_bonus_ratio
      }));
    } else {
      res.json(response(1, '获取成功', DEFAULT_VALUES));
    }
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

    const storeName = STORE_ID_TO_NAME[storeId];
    if (!storeName) {
      return res.status(400).json(response(0, '无效的门店ID'));
    }

    const { front_efficiency, back_efficiency, front_bonus_ratio, back_bonus_ratio } = req.body;
    if (front_efficiency == null && back_efficiency == null && !front_bonus_ratio && !back_bonus_ratio) {
      return res.status(400).json(response(0, '缺少设置值'));
    }

    // 校验奖金比例
    const frontRatioNum = parseInt(front_bonus_ratio);
    const backRatioNum = parseInt(back_bonus_ratio);
    if (isNaN(frontRatioNum) || frontRatioNum <= 0) {
      return res.json(response(0, '前厅奖金比例不可为负数或0'));
    }
    if (isNaN(backRatioNum) || backRatioNum <= 0) {
      return res.json(response(0, '后厨奖金比例不可为负数或0'));
    }

    const existing = await findExistingRecord(storeName);
    const frontValue = Number(front_efficiency) || DEFAULT_VALUES.front_efficiency;
    const backValue = Number(back_efficiency) || DEFAULT_VALUES.back_efficiency;
    const frontRatio = front_bonus_ratio || DEFAULT_VALUES.front_bonus_ratio;
    const backRatio = back_bonus_ratio || DEFAULT_VALUES.back_bonus_ratio;

    if (existing) {
      // 更新
      const postData = {
        table_key: EFFICIENCY_API.tableKey,
        record_key: existing.record_key,
        fields: {
          前厅人效标准: frontValue,
          后厨人效标准: backValue,
          前厅奖金比例: frontRatio,
          后厨奖金比例: backRatio
        }
      };
      const result = await callOpenAPI('/open-api/v1/data/records', postData, 'PUT');
      if (result) {
        res.json(response(1, '保存成功'));
      } else {
        res.status(500).json(response(0, '保存失败'));
      }
    } else {
      // 初始化新增
      const title = `人效标准_${storeName}`;
      const postData = {
        table_key: EFFICIENCY_API.tableKey,
        records: [{
          标题: title,
          所属门店: storeName,
          前厅人效标准: frontValue,
          后厨人效标准: backValue,
          前厅奖金比例: frontRatio,
          后厨奖金比例: backRatio
        }]
      };
      const result = await callOpenAPI('/open-api/v1/data/records', postData, 'POST');
      if (result) {
        res.json(response(1, '保存成功'));
      } else {
        res.status(500).json(response(0, '保存失败'));
      }
    }
  } catch (err) {
    console.error('[Settings] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;