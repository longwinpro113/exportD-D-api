const db = require('../config/db');

class ExportModel {
  static async getExportsByRyNumber(ry_number) {
    const [rows] = await db.query(
      'SELECT id, shipped_quantity FROM export WHERE ry_number = ? ORDER BY export_date ASC, id ASC',
      [ry_number]
    );
    return rows;
  }

  static async updateExportTotals(id, runningTotal, remaining) {
    await db.query(
      'UPDATE export SET accumulated_total = ?, remaining_quantity = ? WHERE id = ?',
      [runningTotal, remaining, id]
    );
  }

  static async createExport(data) {
    const query = `
      INSERT INTO export (
        export_date, ry_number, delivery_round, shipped_quantity,
        s3, s3_5, s4, s4_5, s5, s5_5, s6, s6_5,
        s7, s7_5, s8, s8_5, s9, s9_5, s10, s10_5,
        s11, s11_5, s12, s12_5, s13, s13_5, s14,
        s14_5, s15, s15_5, s16, s16_5, s17, s17_5, s18,
        note
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?
      )
    `;
    const [result] = await db.query(query, data);
    return result;
  }

  static async updateExport(id, fields, values) {
    await db.query(`UPDATE export SET ${fields} WHERE id = ?`, values);
  }

  static async getExportById(id) {
    const [rows] = await db.query('SELECT * FROM export WHERE id = ?', [id]);
    return rows;
  }

  static async deleteExport(id) {
    await db.query('DELETE FROM export WHERE id = ?', [id]);
  }

  static async getFilteredExports(whereSQL, params) {
    const query = `
      SELECT 
        e.id,
        DATE_FORMAT(e.export_date, '%d/%m/%Y') AS export_date,
        e.ry_number,
        COALESCE(e.delivery_round, o.delivery_round) AS delivery_round,
        e.shipped_quantity,
        e.remaining_quantity,
        e.accumulated_total,
        e.updated_at,
        e.note,
        o.article,
        o.model_name,
        o.client,
        o.total_order_qty AS total_quantity,
        e.s3, e.s3_5, e.s4, e.s4_5, e.s5, e.s5_5, e.s6, e.s6_5,
        e.s7, e.s7_5, e.s8, e.s8_5, e.s9, e.s9_5, e.s10, e.s10_5,
        e.s11, e.s11_5, e.s12, e.s12_5, e.s13, e.s13_5, e.s14,
        e.s14_5, e.s15, e.s15_5, e.s16, e.s16_5, e.s17, e.s17_5, e.s18
      FROM export e
      LEFT JOIN orders o ON e.ry_number = o.ry_number
      ${whereSQL}
      ORDER BY e.export_date DESC, e.id ASC
    `;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getFilteredOrders(ordersSQL, ordersParams) {
    const [orders] = await db.query(`SELECT * FROM orders o ${ordersSQL}`, ordersParams);
    return orders;
  }

  static async getExportTotalsGroupedByRy(whereExportSQL, exportParams) {
    const sizes = [];
    for (let i = 3; i <= 18; i += 0.5) sizes.push(`SUM(s${i.toString().replace('.', '_')}) as s${i.toString().replace('.', '_')}`);
    
    const [exports] = await db.query(`
      SELECT ry_number, SUM(shipped_quantity) as total_shipped, ${sizes.join(', ')}
      FROM export
      ${whereExportSQL}
      GROUP BY ry_number
    `, exportParams);
    return exports;
  }
}

module.exports = ExportModel;
