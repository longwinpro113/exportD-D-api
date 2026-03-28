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

// Helper: Tính toán lại toàn bộ accumulated_total và remaining_quantity cho một RY_NUMBER
async function recalculateExportTotals(ry_number) {
  // 1. Lấy tổng cần giao (total_order_qty) từ bảng orders
  const [orders] = await db.query('SELECT total_order_qty FROM orders WHERE ry_number = ?', [ry_number]);
  if (orders.length === 0) return;
  const total_order_qty = parseFloat(orders[0].total_order_qty) || 0;

  // 2. Lấy tất cả bản ghi xuất của RY này, sắp xếp theo ngày và ID
  const [exports] = await db.query(
    'SELECT id, shipped_quantity FROM export WHERE ry_number = ? ORDER BY export_date ASC, id ASC',
    [ry_number]
  );

  let runningTotal = 0;
  for (const row of exports) {
    runningTotal += parseFloat(row.shipped_quantity) || 0;
    const remaining = total_order_qty - runningTotal;
    await db.query(
      'UPDATE export SET accumulated_total = ?, remaining_quantity = ? WHERE id = ?',
      [runningTotal, remaining, row.id]
    );
  }
}

// POST: Lưu một bản ghi xuất kho mới
app.post('/api/export', async (req, res) => {
  try {
    const {
      export_date, ry_number,
      s3, s3_5, s4, s4_5, s5, s5_5, s6, s6_5,
      s7, s7_5, s8, s8_5, s9, s9_5, s10, s10_5,
      s11, s11_5, s12, s12_5, s13, s13_5, s14,
      s14_5, s15, s15_5, s16, s16_5, s17, s17_5, s18
    } = req.body;

    const shipped_quantity = Object.keys(req.body)
      .filter(k => /^s\d+/.test(k))
      .reduce((sum, k) => sum + (parseFloat(req.body[k]) || 0), 0);

    const query = `
      INSERT INTO export (
        export_date, ry_number, shipped_quantity,
        s3, s3_5, s4, s4_5, s5, s5_5, s6, s6_5,
        s7, s7_5, s8, s8_5, s9, s9_5, s10, s10_5,
        s11, s11_5, s12, s12_5, s13, s13_5, s14,
        s14_5, s15, s15_5, s16, s16_5, s17, s17_5, s18
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const values = [
      export_date, ry_number, shipped_quantity,
      s3||0, s3_5||0, s4||0, s4_5||0, s5||0, s5_5||0, s6||0, s6_5||0,
      s7||0, s7_5||0, s8||0, s8_5||0, s9||0, s9_5||0, s10||0, s10_5||0,
      s11||0, s11_5||0, s12||0, s12_5||0, s13||0, s13_5||0, s14||0,
      s14_5||0, s15||0, s15_5||0, s16||0, s16_5||0, s17||0, s17_5||0, s18||0
    ];

    const [result] = await db.query(query, values);
    
    // Tự động tính lại tích lũy cho cả lịch sử của Ry Number này
    await recalculateExportTotals(ry_number);

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
        // Full date: DD/MM/YYYY
        const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        whereClauses.push('DATE(e.export_date) = ?');
        params.push(isoDate);
      } else if (parts.length === 2) {
        // Short date: DD/MM (any year)
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        whereClauses.push("DATE_FORMAT(e.export_date, '%d/%m') = ?");
        params.push(`${day}/${month}`);
      }
    }

    if (ry_number) {
      whereClauses.push('e.ry_number LIKE ?');
      params.push(`%${ry_number}%`);
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

    // Tính lại shipped_quantity từ các ô size trong body (nếu có)
    const sizeKeys = Object.keys(body).filter(k => /^s\d+/.test(k));
    if (sizeKeys.length > 0) {
      body.shipped_quantity = sizeKeys.reduce((sum, k) => sum + (parseFloat(body[k]) || 0), 0);
    }

    const fields = Object.keys(body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(body), id];

    if (!fields) return res.status(400).json({ error: 'No fields to update.' });

    // Lấy ry_number trước khi update để tính toán lại
    const [rows] = await db.query('SELECT ry_number FROM export WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const ry_number = rows[0].ry_number;

    await db.query(`UPDATE export SET ${fields} WHERE id = ?`, values);
    
    // Tính lại toàn bộ tích lũy
    await recalculateExportTotals(ry_number);

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
      await recalculateExportTotals(ry_number);
    }

    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error('DELETE /export error:', err.message);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// GET: Lấy dữ liệu hàng còn nợ (Remaining Stock)
// Tính toán nợ của từng size tại từng thời điểm
app.get('/api/remaining-stock', async (req, res) => {
  try {
    const { date, ry_number } = req.query;

    let whereClauses = [];
    let params = [];
    if (date) {
      const parts = date.split('/');
      if (parts.length === 3) {
        const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        whereClauses.push('DATE(e.export_date) = ?');
        params.push(isoDate);
      } else if (parts.length === 2) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        whereClauses.push("DATE_FORMAT(e.export_date, '%d/%m') = ?");
        params.push(`${day}/${month}`);
      }
    }
    if (ry_number) {
      whereClauses.push('e.ry_number LIKE ?');
      params.push(`%${ry_number}%`);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Lấy tất cả exports cùng với thông tin size từ orders
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
        -- Cột size từ export (số lượng thực xuất)
        e.s3, e.s3_5, e.s4, e.s4_5, e.s5, e.s5_5, e.s6, e.s6_5,
        e.s7, e.s7_5, e.s8, e.s8_5, e.s9, e.s9_5, e.s10, e.s10_5,
        e.s11, e.s11_5, e.s12, e.s12_5, e.s13, e.s13_5, e.s14,
        e.s14_5, e.s15, e.s15_5, e.s16, e.s16_5, e.s17, e.s17_5, e.s18,
        -- Cột size từ orders (tổng cần giao)
        o.s3 as os3, o.s3_5 as os3_5, o.s4 as os4, o.s4_5 as os4_5, o.s5 as os5, o.s5_5 as os5_5, o.s6 as os6, o.s6_5 as os6_5,
        o.s7 as os7, o.s7_5 as os7_5, o.s8 as os8, o.s8_5 as os8_5, o.s9 as os9, o.s9_5 as os9_5, o.s10 as os10, o.s10_5 as os10_5,
        o.s11 as os11, o.s11_5 as os11_5, o.s12 as os12, o.s12_5 as os12_5, o.s13 as os13, o.s13_5 as os13_5, o.s14 as os14,
        o.s14_5 as os14_5, o.s15 as os15, o.s15_5 as os15_5, o.s16 as os16, o.s16_5 as os16_5, o.s17 as os17, o.s17_5 as os17_5, o.s18 as os18
      FROM export e
      LEFT JOIN orders o ON e.ry_number = o.ry_number
      ${whereSQL}
      ORDER BY e.export_date ASC, e.id ASC
    `;

    const [rows] = await db.query(query, params);

    // Tính toán lại nợ từng size cho mỗi mã đơn hàng
    // Vì ta lấy theo ORDER BY export_date ASC, id ASC, ta có thể tính tích lũy
    const ryMap = {}; // Lưu tích lũy từng size của từng mã đơn hàng
    const sizeCols = [];
    for (let i = 3; i <= 18; i += 0.5) sizeCols.push(i.toString().replace('.', '_'));

    const debtRows = rows.map(row => {
      if (!ryMap[row.ry_number]) {
        ryMap[row.ry_number] = {};
        sizeCols.forEach(sc => ryMap[row.ry_number][sc] = 0);
      }

      const debtRecord = { ...row };
      sizeCols.forEach(sc => {
        const colName = `s${sc}`;
        const orderColName = `os${sc}`;
        ryMap[row.ry_number][sc] += parseFloat(row[colName]) || 0;
        const remainingForSize = (parseFloat(row[orderColName]) || 0) - ryMap[row.ry_number][sc];
        debtRecord[colName] = remainingForSize;
      });
      return debtRecord;
    });

    // CHỈ GIỮ LẠI BẢN GHI MỚI NHẤT CỦA MỖI MÃ ĐƠN HÀNG
    // (Vì Hàng Còn Nợ là báo cáo trạng thái hiện tại, không phải lịch sử)
    const latestMap = {};
    debtRows.forEach(row => {
      // Vì debtRows được lấy theo ORDER BY export_date ASC, id ASC
      // nên bản ghi sau cùng sẽ ghi đè bản ghi trước đó của cùng ry_number
      latestMap[row.ry_number] = row;
    });

    // Lọc lấy những mã đơn vẫn còn nợ (remaining_quantity > 0)
    const finalResults = Object.values(latestMap)
      .filter(r => (parseFloat(r.remaining_quantity) || 0) > 0)
      .sort((a, b) => {
        // Sắp xếp ngày mới nhất lên đầu
        const dateA = a.export_date.split('/').reverse().join('-');
        const dateB = b.export_date.split('/').reverse().join('-');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return b.id - a.id;
      });

    res.json(finalResults);
  } catch (err) {
    console.error('GET /remaining-stock error:', err.message);
    res.status(500).json({ error: 'Failed to fetch remaining stock.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
