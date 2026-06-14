// 门店配置（与 server/config/index.js 保持一致）
export const STORE_IDS = [3, 4, 5, 7, 8, 9, 13, 15, 16, 18, 19];

export const STORE_ID_TO_NAME: Record<number, string> = {
  3: "930殷高店",
  4: "930长江西路店",
  5: "930国和店",
  7: "930宜川店",
  8: "930小馆拾光里店",
  9: "930浦锦路店",
  13: "930金沙江店",
  15: "930车站南路店",
  16: "930中华路店",
  18: "930柳营路店",
  19: "930长阳店",
};

export const STORES = STORE_IDS.map((id) => ({
  id,
  name: STORE_ID_TO_NAME[id],
}));
