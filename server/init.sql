-- 创建数据库
CREATE DATABASE IF NOT EXISTS mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mydb;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'manager',
  real_name VARCHAR(50) DEFAULT '',
  store_id INT,
  is_active TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 门店表
CREATE TABLE IF NOT EXISTS stores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(200) DEFAULT '',
  is_active TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认管理员账号
INSERT INTO users (username, password, role, real_name, is_active) VALUES
('admin', 'admin123', 'admin', '系统管理员', 1)
ON DUPLICATE KEY UPDATE password = 'admin123';

-- 插入默认门店
INSERT INTO stores (id, name, address) VALUES (1, '默认门店', '')
ON DUPLICATE KEY UPDATE name = '默认门店';

-- 日汇总表
CREATE TABLE IF NOT EXISTS daily_summary (
  id INT PRIMARY KEY AUTO_INCREMENT,
  summary_date DATE NOT NULL UNIQUE,
  actual_revenue DECIMAL(12,2) DEFAULT 0,
  front_check_count DECIMAL(6,1) DEFAULT 0,
  front_bonus DECIMAL(12,2) DEFAULT 0,
  back_check_count DECIMAL(6,1) DEFAULT 0,
  back_bonus DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 个人汇总表
CREATE TABLE IF NOT EXISTS personal_summary (
  id INT PRIMARY KEY AUTO_INCREMENT,
  summary_date DATE NOT NULL,
  employee_name VARCHAR(50) NOT NULL,
  front_check_count DECIMAL(6,1) DEFAULT 0,
  back_check_count DECIMAL(6,1) DEFAULT 0,
  bonus DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (summary_date)
);

-- 员工表
CREATE TABLE IF NOT EXISTS staff (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL,
  phone VARCHAR(20) DEFAULT '',
  store_id INT DEFAULT 1,
  is_active TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 排班表
CREATE TABLE IF NOT EXISTS schedules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  period VARCHAR(20) NOT NULL,
  staff_id INT NOT NULL,
  role VARCHAR(50) NOT NULL,
  store_id INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id),
  UNIQUE KEY unique_schedule (date, period, staff_id)
);

-- 营业额预测表
CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  period VARCHAR(20) NOT NULL,
  hall_tables INT DEFAULT 0,
  hall_avg INT DEFAULT 200,
  hall_revenue INT DEFAULT 0,
  banquet_tables INT DEFAULT 0,
  banquet_avg INT DEFAULT 300,
  banquet_revenue INT DEFAULT 0,
  room_tables INT DEFAULT 0,
  room_avg INT DEFAULT 250,
  room_revenue INT DEFAULT 0,
  delivery_orders INT DEFAULT 0,
  delivery_price INT DEFAULT 50,
  delivery_revenue INT DEFAULT 0,
  total_revenue INT DEFAULT 0,
  store_id INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_forecast (date, period, store_id)
);