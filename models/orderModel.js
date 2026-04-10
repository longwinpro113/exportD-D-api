const db = require('../config/db');
const { buildInsertParts, buildUpdateParts } = require('../utils/sqlBuilder');
const { sizeColumns } = require('../utils/sizeColumns');

const ORDER_SELECT_COLUMNS = [
  'ry_number',
  'article',
  'model_name',
  'product',
  'delivery_round',
  'CRD',
  'client_export_date',
  'client_import_date',
  'client',
  'total_order_qty',
  ...sizeColumns
];

class OrderModel {
  static async getAll(client) {
    // 1. Dùng dấu backtick (`) để viết chuỗi trên nhiều dòng
    // 2. Thêm dấu phẩy sau model_name
    let query = `SELECT ${ORDER_SELECT_COLUMNS.join(', ')} FROM orders`;

    const params = [];
    if (client) {
      query += ' WHERE client = ?';
      params.push(client);
    }

    query += ' ORDER BY ry_number DESC';

    try {
      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error("Lỗi truy vấn Database:", error);
      throw error;
    }
  }

  static async getClients() {
    const [rows] = await db.query('SELECT DISTINCT client FROM orders WHERE client IS NOT NULL');
    return rows;
  }

  static async getByRyNumber(ry_number) {
    const [rows] = await db.query('SELECT * FROM orders WHERE ry_number = ?', [ry_number]);
    return rows;
  }

  static async create(data) {
    const keys = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const [result] = await db.query(
      `INSERT INTO orders (${keys}) VALUES (${placeholders})`,
      values
    );
    return result;
  }

  static async update(ry_number, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    if (fields.length === 0) return null;
    values.push(ry_number);
    await db.query(`UPDATE orders SET ${fields} WHERE ry_number = ?`, values);
    return true;
  }
}

module.exports = OrderModel;
