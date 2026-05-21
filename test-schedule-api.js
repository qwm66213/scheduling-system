const https = require('https');

// OpenAPI 配置
const SCHEDULE_API = {
  token: 'emoo_1qTLvYd7MO6IUN0KUxrIPYJSDPUCZqS8ItVi3Abh',
  userId: '{{Emoo-User-Id}}',
  tableKey: 'tb_1ea7b2229e96f'
};

// 门店ID到门店名称的映射
const STORE_ID_TO_NAME = {
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
};

function callOpenAPI(path, postData, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'app.emoosearch.com',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${SCHEDULE_API.token}`,
        'Emoo-User-Id': SCHEDULE_API.userId
      }
    };

    console.log('\n[Request]', method, path);
    console.log('[PostData]', JSON.stringify(postData, null, 2));

    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const body = buffer.toString('utf8');
          console.log('\n[Response Status]', res.statusCode);
          console.log('[Raw Body]', body);

          const json = JSON.parse(body);
          console.log('[JSON Code]', json.code);
          console.log('[JSON Message]', json.message);

          if (json.code === 200 && json.data) {
            resolve(json.data);
          } else {
            resolve(null);
          }
        } catch (e) {
          console.error('[Parse Error]', e.message);
          resolve(null);
        }
      });
    });
    req.on('error', e => {
      console.error('[Request Error]', e.message);
      reject(e);
    });
    req.write(JSON.stringify(postData));
    req.end();
  });
}

async function testCreateRecord() {
  console.log('=== 测试新增预排班记录 ===\n');

  // 新增一条记录
  const recordData = {
    标题: '2026-05-18GHD000419',
    日期: '2026-05-18',
    所属门店: '930国和店',
    月份: 5,
    员工编码: 'GHD000419',
    姓名: '马继跃',
    岗位: '厨师长',
    工作名: '后厨',
    上午出勤状态: '√',
    下午出勤状态: '',
    小时工工时: 0,
    借调门店: ''
  };

  const createData = {
    table_key: SCHEDULE_API.tableKey,
    records: [recordData]
  };

  const result = await callOpenAPI('/open-api/v1/data/records', createData, 'POST');
  console.log('\n[Result]', result);
}

testCreateRecord().catch(console.error);
