-- 门店ID迁移脚本
-- 将旧的门店ID (1-10) 迁移到新的门店ID (3,4,5,7,8,9,13,15,16,18,19)

-- 1. 备份相关表（可选，建议先备份）
-- CREATE TABLE users_backup AS SELECT * FROM users;
-- CREATE TABLE staff_backup AS SELECT * FROM staff;
-- CREATE TABLE schedules_backup AS SELECT * FROM schedules;
-- CREATE TABLE revenue_detail_backup AS SELECT * FROM revenue_detail;

-- 2. 更新stores表
DELETE FROM stores;

INSERT INTO stores (id, name) VALUES
(3, '殷高店'),
(4, '长江西路店'),
(5, '国和店'),
(7, '宜川店'),
(8, '小馆拾光里店'),
(9, '浦锦路店'),
(13, '金沙江店'),
(15, '车站南路店'),
(16, '中华路店'),
(18, '柳营路店'),
(19, '长阳店');

-- 3. 迁移users表的store_id
-- 映射关系：1->13, 2->15, 3->5, 4->4, 5->19, 6->3, 7->7, 8->16, 9->NULL, 10->18
UPDATE users SET store_id = 13 WHERE store_id = 1;
UPDATE users SET store_id = 15 WHERE store_id = 2;
UPDATE users SET store_id = 5 WHERE store_id = 3;
-- store_id = 4 不变
UPDATE users SET store_id = 19 WHERE store_id = 5;
UPDATE users SET store_id = 3 WHERE store_id = 6;
-- store_id = 7 不变
UPDATE users SET store_id = 16 WHERE store_id = 8;
UPDATE users SET store_id = NULL WHERE store_id = 9;  -- 灵石店无对应
UPDATE users SET store_id = 18 WHERE store_id = 10;

-- 4. 迁移staff表的store_id
UPDATE staff SET store_id = 13 WHERE store_id = 1;
UPDATE staff SET store_id = 15 WHERE store_id = 2;
UPDATE staff SET store_id = 5 WHERE store_id = 3;
UPDATE staff SET store_id = 19 WHERE store_id = 5;
UPDATE staff SET store_id = 3 WHERE store_id = 6;
UPDATE staff SET store_id = 16 WHERE store_id = 8;
UPDATE staff SET store_id = NULL WHERE store_id = 9;
UPDATE staff SET store_id = 18 WHERE store_id = 10;

-- 5. 迁移schedules表的store_id
UPDATE schedules SET store_id = 13 WHERE store_id = 1;
UPDATE schedules SET store_id = 15 WHERE store_id = 2;
UPDATE schedules SET store_id = 5 WHERE store_id = 3;
UPDATE schedules SET store_id = 19 WHERE store_id = 5;
UPDATE schedules SET store_id = 3 WHERE store_id = 6;
UPDATE schedules SET store_id = 16 WHERE store_id = 8;
UPDATE schedules SET store_id = NULL WHERE store_id = 9;
UPDATE schedules SET store_id = 18 WHERE store_id = 10;

-- 6. 迁移revenue_detail表的store_id
UPDATE revenue_detail SET store_id = 13 WHERE store_id = 1;
UPDATE revenue_detail SET store_id = 15 WHERE store_id = 2;
UPDATE revenue_detail SET store_id = 5 WHERE store_id = 3;
UPDATE revenue_detail SET store_id = 19 WHERE store_id = 5;
UPDATE revenue_detail SET store_id = 3 WHERE store_id = 6;
UPDATE revenue_detail SET store_id = 16 WHERE store_id = 8;
UPDATE revenue_detail SET store_id = NULL WHERE store_id = 9;
UPDATE revenue_detail SET store_id = 18 WHERE store_id = 10;

-- 7. 删除灵石店相关数据（可选，根据实际需求决定）
-- DELETE FROM staff WHERE store_id IS NULL;
-- DELETE FROM schedules WHERE store_id IS NULL;
-- DELETE FROM revenue_detail WHERE store_id IS NULL;

-- 8. 验证迁移结果
SELECT 'users' AS table_name, COUNT(*) AS count, GROUP_CONCAT(DISTINCT store_id) AS store_ids FROM users WHERE store_id IS NOT NULL
UNION ALL
SELECT 'staff', COUNT(*), GROUP_CONCAT(DISTINCT store_id) FROM staff WHERE store_id IS NOT NULL
UNION ALL
SELECT 'schedules', COUNT(*), GROUP_CONCAT(DISTINCT store_id) FROM schedules WHERE store_id IS NOT NULL
UNION ALL
SELECT 'revenue_detail', COUNT(*), GROUP_CONCAT(DISTINCT store_id) FROM revenue_detail WHERE store_id IS NOT NULL;
