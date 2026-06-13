/**
 * 服务器配置模块
 * 统一管理所有敏感配置信息
 */

require('dotenv').config();

const config = {
  // OpenAPI 配置
  openapi: {
    token: process.env.OPENAPI_TOKEN || 'emoo_W7ExdLzLIff1VI8WEFHV8y3a_nb1mOGD6_ZrRroA',
    userId: process.env.OPENAPI_USER_ID || '{{Emoo-User-Id}}'
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || '930-system-dev-secret-key-2024',
    expiresIn: '24h',
    refreshExpiresIn: '7d'
  },

  // 营业额配置
  revenue: {
    wsAppKey: process.env.REVENUE_WS_APP_KEY || 'ac5513bfd12145f89fb81fa8596588af'
  },

  // Webhook 配置
  webhook: {
    url: process.env.WEBHOOK_URL || ''
  },

  // 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 3001
  },

  // 门店配置
  stores: {
    STORE_IDS: [3, 4, 5, 7, 8, 9, 13, 15, 16, 18, 19],
    STORE_ID_TO_NAME: {
      3: '930殷高店',
      4: '930长江西路店',
      5: '930国和店',
      7: '930宜川店',
      8: '930小馆拾光里店',
      9: '930浦锦路店',
      13: '930金沙江店',
      15: '930车站南路店',
      16: '930中华路店',
      18: '930柳营路店',
      19: '930长阳店'
    }
  }
};

// 检查必要的配置
if (!config.openapi.token) {
  console.error('[Config] OPENAPI_TOKEN 未配置！');
}

if (!config.jwt.secret || config.jwt.secret === '930-system-dev-secret-key-2024') {
  console.warn('[Config] JWT_SECRET 未配置或使用默认值，生产环境请配置环境变量！');
}

module.exports = config;
