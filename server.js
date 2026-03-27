const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------
// 📦 API CHO QUẢN LÝ ĐƠN HÀNG (ClientOrders)
// -----------------------------------------------------------------

app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orders');
    res.json(rows);
  } catch (err) {
    console.error('GET /orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

app.patch('/api/orders/:ry_number', async (req, res) => {
  try {
    const { ry_number } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    values.push(ry_number);
    await db.query(`UPDATE orders SET ${fields} WHERE ry_number = ?`, values);
    res.json({ message: 'Updated', ry_number });
  } catch (err) {
    console.error('PATCH /orders error:', err.message);
    res.status(500).json({ error: 'Failed to update order.' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { orderCode, article, modelName } = req.body;
    const [result] = await db.query(
      'INSERT INTO orders (ry_number, article, model_name) VALUES (?, ?, ?)',
      [orderCode, article, modelName]
    );
    res.json({ id: result.insertId, orderCode, article, modelName });
  } catch (err) {
    console.error('POST /orders error:', err.message);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

// -----------------------------------------------------------------
// 📦 API CHO PHIẾU XUẤT KHO (export table)
// -----------------------------------------------------------------

// POST: Lưu một bản ghi xuất kho mới
app.post('/api/export', async (req, res) => {
  try {
    const {
      export_date, ry_number,
      shipped_quantity, remaining_quantity, accumulated_total,
      s3, s3_5, s4, s4_5, s5, s5_5, s6, s6_5,
      s7, s7_5, s8, s8_5, s9, s9_5, s10, s10_5,
      s11, s11_5, s12, s12_5, s13, s13_5, s14,
      s14_5, s15, s15_5, s16, s16_5, s17, s17_5, s18
    } = req.body;

    const query = `
      INSERT INTO export (
        export_date, ry_number,
        accumulated_total, shipped_quantity, remaining_quantity,
        s3, s3_5, s4, s4_5, s5, s5_5, s6, s6_5,
        s7, s7_5, s8, s8_5, s9, s9_5, s10, s10_5,
        s11, s11_5, s12, s12_5, s13, s13_5, s14,
        s14_5, s15, s15_5, s16, s16_5, s17, s17_5, s18
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const values = [
      export_date, ry_number,
      accumulated_total || 0, shipped_quantity || 0, remaining_quantity || 0,
      s3||0, s3_5||0, s4||0, s4_5||0, s5||0, s5_5||0, s6||0, s6_5||0,
      s7||0, s7_5||0, s8||0, s8_5||0, s9||0, s9_5||0, s10||0, s10_5||0,
      s11||0, s11_5||0, s12||0, s12_5||0, s13||0, s13_5||0, s14||0,
      s14_5||0, s15||0, s15_5||0, s16||0, s16_5||0, s17||0, s17_5||0, s18||0
    ];

    const [result] = await db.query(query, values);
    res.json({ id: result.insertId, message: 'Export saved.' });
  } catch (err) {
    console.error('POST /export error:', err.message);
    res.status(500).json({ error: 'Failed to save export: ' + err.message });
  }
});

// GET: Lấy dữ liệu phiếu xuất kho, JOIN với orders để lấy article, model_name, total_quantity
// Query params: ?date=DD/MM/YYYY  hoặc  ?ry_number=AH2603-030
app.get('/api/export', async (req, res) => {
  try {
    const { date, ry_number } = req.query;

    let whereClauses = [];
    let params = [];

    if (date) {
      // date truyền vào dạng DD/MM/YYYY, export_date lưu trong DB dạng DATE (YYYY-MM-DD)
      // Hoặc nếu lưu dạng VARCHAR thì so sánh trực tiếp
      // Ta sẽ hỗ trợ cả hai: convert từ DD/MM/YYYY sang YYYY-MM-DD để so sánh DATE
      const parts = date.split('/');
      if (parts.length === 3) {
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        whereClauses.push('DATE(e.export_date) = ?');
        params.push(isoDate);
      }
    }

    if (ry_number) {
      whereClauses.push('e.ry_number = ?');
      params.push(ry_number);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
      SELECT 
        e.id,
        DATE_FORMAT(e.export_date, '%d/%m/%Y') AS export_date,
        e.ry_number,
        e.shipped_quantity,
        e.remaining_quantity,
        e.accumulated_total,
        o.article,
        o.model_name,
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
    res.json(rows);
  } catch (err) {
    console.error('GET /export error:', err.message);
    res.status(500).json({ error: 'Failed to fetch export data: ' + err.message });
  }
});

// PATCH: Cập nhật một bản ghi xuất kho
app.patch('/api/export/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const fields = Object.keys(body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(body), id];

    if (!fields) return res.status(400).json({ error: 'No fields to update.' });

    await db.query(`UPDATE export SET ${fields} WHERE id = ?`, values);
    res.json({ message: 'Updated.' });
  } catch (err) {
    console.error('PATCH /export error:', err.message);
    res.status(500).json({ error: 'Failed to update export: ' + err.message });
  }
});

// DELETE: Xóa một bản ghi xuất kho
app.delete('/api/export/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM export WHERE id = ?', [id]);
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error('DELETE /export error:', err.message);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
