const http = require('http');

const OPEN_API = {
  token: 'emoo_W7ExdLzLIff1VI8WEFHV8y3a_nb1mOGD6_ZrRroA',
  userId: '{{Emoo-User-Id}}',
  hostname: 'localhost'
};

function callOpenAPI(path, postData, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: OPEN_API.hostname,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${OPEN_API.token}`,
        'Emoo-User-Id': OPEN_API.userId
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
          console.log('[Response]', JSON.stringify(json, null, 2));
          resolve(json);
        } catch (e) {
          console.error('[Parse error]', e.message);
          resolve(null);
        }
      });
    });
    req.on('error', e => {
      console.error('[Request error]', e.message);
      resolve(null);
    });
    req.write(JSON.stringify(postData));
    req.end();
  });
}

async function test() {
  console.log('=== 查询已知数据表 ===\n');

  const tables = [
    { key: 'tb_b6d4799a5697f', name: '员工信息表' },
    { key: 'tb_fa58d498f9bcb', name: '实际考勤记录表' },
    { key: 'tb_b9c58872b103f', name: '预估营业额表' },
    { key: 'tb_58c08b4f443af', name: '预排班表' },
    { key: 'tb_f78e9d4db7476', name: '设置标准人效奖金比例' },
    { key: 'tb_a5f4e61599971', name: '用户认证表' },
    { key: 'tb_b7440ebfcd35b', name: '用户尝试表' },
    { key: 'tb_97ed403b695f3', name: '用户日志表' },
  ];

  for (const table of tables) {
    console.log(`--- ${table.name} (${table.key}) ---`);
    const res = await callOpenAPI('/open-api/v1/data/records/list', {
      table_key: table.key,
      page_size: 2
    });
    if (res && res.results) {
      console.log(`✅ 共 ${res.total} 条记录`);
      if (res.results.length > 0) {
        console.log('字段:', Object.keys(res.results[0].fields).join(', '));
      }
    } else {
      console.log('❌ 查询失败');
    }
    console.log('');
  }
}

test();
