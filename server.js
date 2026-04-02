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
    const { export_date, ry_number } = req.body;

    // Tự động tạo danh sách 31 cột size từ s3 đến s18
    const sizeFields = [];
    for (let i = 3; i <= 18; i += 0.5) {
      sizeFields.push(`s${i.toString().replace('.', '_')}`);
    }

    // Tạo chuỗi query động: Đảm bảo số cột luôn khớp số dấu '?'
    const query = `
      INSERT INTO export (
        export_date, 
        ry_number, 
        ${sizeFields.join(', ')}
      ) VALUES (?, ?, ${sizeFields.map(() => '?').join(', ')})
    `;

    // Chuẩn bị mảng values tương ứng
    const values = [
      export_date,
      ry_number,
      ...sizeFields.map(field => parseFloat(req.body[field]) || 0)
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
      const parts = date.split('/');
      if (parts.length === 3) {
        whereClauses.push('DATE(e.export_date) = ?');
        params.push(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      } else if (parts.length === 2) {
        whereClauses.push("DATE_FORMAT(e.export_date, '%d/%m') = ?");
        params.push(`${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`);
      }
    }

    if (ry_number || req.query.any) {
      const val = ry_number || req.query.any;
      whereClauses.push('(e.ry_number LIKE ? OR e.delivery_round LIKE ?)');
      params.push(`%${val}%`, `%${val}%`);
    }

    if (req.query.round) {
      whereClauses.push('e.delivery_round = ?');
      params.push(req.query.round);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
      SELECT 
        e.id,
        DATE_FORMAT(e.export_date, '%d/%m/%Y') AS export_date,
        e.ry_number,
        COALESCE(e.delivery_round, o.delivery_round) AS delivery_round,
        e.shipped_quantity,
        e.remaining_quantity,
        e.accumulated_total,
        o.article,
        o.model_name,
        o.total_order_qty AS total_quantity,
        e.s3, e.s3_5, e.s4, e.s4_5, e.s5, e.s5_5, e.s6, e.s6_5,
        e.s7, e.s7_5, e.s8, e.s8_5, e.s9, e.s9_5, e.s10, e.s10_5,
        e.s11, e.s11_5, e.s12, e.s12_5, e.s13, e.s13_5, e.s14,
        e.s14_5, e.s15, e.s15_5, e.s16, e.s16_5, e.s17, e.s17_5, e.s18,
        e.updated_at
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

    // Tính lại shipped_quantity từ các ô size trong body (nếu có)
    // const sizeKeys = Object.keys(body).filter(k => /^s\d+/.test(k));
    // if (sizeKeys.length > 0) {
    //   body.shipped_quantity = sizeKeys.reduce((sum, k) => sum + (parseFloat(body[k]) || 0), 0);
    // }

    const fields = Object.keys(body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(body), id];

    if (!fields) return res.status(400).json({ error: 'No fields to update.' });

    // Lấy ry_number trước khi update để tính toán lại
    const [rows] = await db.query('SELECT ry_number FROM export WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const ry_number = rows[0].ry_number;

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

    // Lấy ry_number trước khi xóa
    const [rows] = await db.query('SELECT ry_number FROM export WHERE id = ?', [id]);
    if (rows.length > 0) {
      const ry_number = rows[0].ry_number;
      await db.query('DELETE FROM export WHERE id = ?', [id]);
    }

    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error('DELETE /export error:', err.message);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// GET: Lấy dữ liệu hàng còn nợ (Remaining Stock)
app.get('/api/remaining-stock', async (req, res) => {
  try {
    const { date, ry_number, round } = req.query;

    let ordersWhere = [];
    let ordersParams = [];

    // 1. Lọc đơn hàng (Orders)
    if (round) {
      ordersWhere.push('o.delivery_round = ?');
      ordersParams.push(round);
    }

    if (ry_number || req.query.any) {
      const val = ry_number || req.query.any;
      ordersWhere.push('(o.ry_number LIKE ? OR o.delivery_round LIKE ?)');
      ordersParams.push(`%${val}%`, `%${val}%`);
    }

    const ordersSQL = ordersWhere.length > 0 ? 'WHERE ' + ordersWhere.join(' AND ') : '';
    const [orders] = await db.query(`SELECT * FROM orders o ${ordersSQL}`, ordersParams);

    // 2. Lấy tổng số lượng đã xuất (Exports) tích lũy đến ngày được chọn
    let exportWhere = [];
    let exportParams = [];
    if (date) {
      const parts = date.split('/');
      if (parts.length === 3) {
        const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        exportWhere.push('DATE(export_date) <= ?');
        exportParams.push(isoDate);
      }
    }
    const whereExportSQL = exportWhere.length > 0 ? 'WHERE ' + exportWhere.join(' AND ') : '';

    const sizesSumSQL = [];
    for (let i = 3; i <= 18; i += 0.5) {
      const colName = `s${i.toString().replace('.', '_')}`;
      sizesSumSQL.push(`SUM(COALESCE(${colName}, 0)) as ${colName}`);
    }

    const [exports] = await db.query(`
      SELECT ry_number, SUM(COALESCE(shipped_quantity, 0)) as total_shipped, ${sizesSumSQL.join(', ')}
      FROM export
      ${whereExportSQL}
      GROUP BY ry_number
    `, exportParams);

    const exportMap = {};
    exports.forEach(e => exportMap[e.ry_number] = e);

    // 3. Logic tính toán Remaining (Còn lại)
    const finalResults = orders.map(o => {
      const e = exportMap[o.ry_number] || {};
      
      const totalOrder = parseFloat(o.total_order_qty) || 0;
      const totalShipped = parseFloat(e.total_shipped) || 0;

      const result = {
        ry_number: o.ry_number,
        article: o.article,
        model_name: o.model_name,
        delivery_round: o.delivery_round,
        total_quantity: totalOrder,
        accumulated_total: totalShipped,
        remaining_quantity: totalOrder - totalShipped, // SL Còn lại (Tổng)
      };

      // Tính SL còn lại cho từng size
      for (let i = 3; i <= 18; i += 0.5) {
        const sc = `s${i.toString().replace('.', '_')}`;
        const orderSizeQty = parseFloat(o[sc]) || 0;
        const shippedSizeQty = parseFloat(e[sc]) || 0;
        
        result[sc] = orderSizeQty - shippedSizeQty; // Giá trị còn lại của size
        result[`order_${sc}`] = orderSizeQty; // Lưu lại để Frontend biết size nào có đơn
      }

      return result;
    });

    res.json(finalResults);
  } catch (err) {
    console.error('GET /remaining-stock error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stock data: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
