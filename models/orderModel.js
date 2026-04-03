const db = require('../config/db');

class OrderModel {
  static async getAll() {
    const [rows] = await db.query('SELECT * FROM orders');
    return rows;
  }

  static async getByRyNumber(ry_number) {
    const [rows] = await db.query('SELECT * FROM orders WHERE ry_number = ?', [ry_number]);
    return rows;
  }

  static async create(orderCode, article, modelName) {
    const [result] = await db.query(
      'INSERT INTO orders (ry_number, article, model_name) VALUES (?, ?, ?)',
      [orderCode, article, modelName]
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
