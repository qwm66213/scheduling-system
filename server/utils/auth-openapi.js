/**
 * 认证相关 OpenAPI 操作
 * 处理用户数据的增删改查
 */

const { findRecordByTitle, findRecords, createRecord, updateRecord } = require('./openapi');
const bcrypt = require('bcryptjs');

// 用户认证表配置
const AUTH_TABLE_KEY = 'tb_872fe963589b5';

/**
 * 查询用户（按用户名）
 * @param {string} username 用户名
 * @returns {Promise<object|null>}
 */
async function findUserByUsername(username) {
  const record = await findRecordByTitle(AUTH_TABLE_KEY, username);
  if (record) {
    const f = record.fields || {};
    return {
      id: record.record_key,
      record_key: record.record_key,
      username: f['用户名'] || username,
      password: f['密码哈希'],
      role: f['角色'],
      store_id: f['门店ID'] ? Number(f['门店ID']) : null,
      real_name: f['真实姓名'] || username,
      is_active: f['账号状态'] === 1 || f['账号状态'] === '启用',
      created_at: f['创建时间']
    };
  }
  return null;
}

/**
 * 查询用户（按record_key）
 * @param {string} recordKey 记录key
 * @returns {Promise<object|null>}
 */
async function findUserByRecordKey(recordKey) {
  const records = await findRecords(AUTH_TABLE_KEY, [`record_key:eq:${recordKey}`], 1);
  if (records.length > 0) {
    const record = records[0];
    const f = record.fields || {};
    return {
      id: record.record_key,
      record_key: record.record_key,
      username: f['用户名'] || f['标题'],
      password: f['密码哈希'],
      role: f['角色'],
      store_id: f['门店ID'] ? Number(f['门店ID']) : null,
      real_name: f['真实姓名'] || f['用户名'],
      is_active: f['账号状态'] === 1 || f['账号状态'] === '启用',
      created_at: f['创建时间']
    };
  }
  return null;
}

/**
 * 查询所有用户
 * @returns {Promise<array>}
 */
async function findAllUsers() {
  const records = await findRecords(AUTH_TABLE_KEY, [], 100);
  return records.map(record => {
    const f = record.fields || {};
    return {
      id: record.record_key,
      record_key: record.record_key,
      username: f['用户名'] || f['标题'],
      real_name: f['真实姓名'],
      role: f['角色'],
      store_id: f['门店ID'] ? Number(f['门店ID']) : null,
      is_active: f['账号状态'] === 1 || f['账号状态'] === '启用',
      created_at: f['创建时间']
    };
  });
}

/**
 * 创建用户
 * @param {object} userData 用户数据
 * @returns {Promise<object|null>}
 */
async function createUser(userData) {
  const { username, password, role, store_id, real_name } = userData;

  // 加密密码
  const hashedPassword = await hashPassword(password);

  const fields = {
    '标题': username,
    '用户名': username,
    '密码哈希': hashedPassword,
    '角色': role,
    '门店ID': role === 'admin' ? '' : String(store_id || ''),
    '真实姓名': real_name || username,
    '账号状态': 1
  };

  return createRecord(AUTH_TABLE_KEY, fields);
}

/**
 * 更新用户
 * @param {string} recordKey 记录key
 * @param {object} updates 要更新的字段
 * @returns {Promise<object|null>}
 */
async function updateUser(recordKey, updates) {
  const fields = {};

  if (updates.password) {
    fields['密码哈希'] = await hashPassword(updates.password);
  }
  if (updates.role) {
    fields['角色'] = updates.role;
  }
  if (updates.store_id !== undefined) {
    fields['门店ID'] = updates.store_id ? String(updates.store_id) : '';
  }
  if (updates.is_active !== undefined) {
    fields['账号状态'] = updates.is_active;
  }
  if (updates.real_name) {
    fields['真实姓名'] = updates.real_name;
  }

  return updateRecord(AUTH_TABLE_KEY, recordKey, fields);
}

/**
 * 检查用户名是否存在
 * @param {string} username 用户名
 * @returns {Promise<boolean>}
 */
async function isUsernameExists(username) {
  const user = await findUserByUsername(username);
  return user !== null;
}

/**
 * 密码加密
 * @param {string} password 明文密码
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * 密码验证
 * @param {string} password 明文密码
 * @param {string} hashedPassword 加密后的密码
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

module.exports = {
  AUTH_TABLE_KEY,
  findUserByUsername,
  findUserByRecordKey,
  findAllUsers,
  createUser,
  updateUser,
  isUsernameExists,
  hashPassword,
  comparePassword
};