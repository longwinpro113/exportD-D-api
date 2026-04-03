const ExportModel = require('../models/exportModel');
const OrderModel = require('../models/orderModel');

// Helper: Tính toán lại toàn bộ accumulated_total và remaining_quantity cho một RY_NUMBER
async function recalculateExportTotals(ry_number) {
  const orders = await OrderModel.getByRyNumber(ry_number);
  if (orders.length === 0) return;
  const total_order_qty = parseFloat(orders[0].total_order_qty) || 0;

  const exports = await ExportModel.getExportsByRyNumber(ry_number);

  let runningTotal = 0;
  for (const row of exports) {
    runningTotal += parseFloat(row.shipped_quantity) || 0;
    const remaining = total_order_qty - runningTotal;
    await ExportModel.updateExportTotals(row.id, runningTotal, remaining);
  }
}

exports.createExport = async (req, res) => {
  try {
    const {
      export_date, ry_number, delivery_round,
      s3, s3_5, s4, s4_5, s5, s5_5, s6, s6_5,
      s7, s7_5, s8, s8_5, s9, s9_5, s10, s10_5,
      s11, s11_5, s12, s12_5, s13, s13_5, s14,
      s14_5, s15, s15_5, s16, s16_5, s17, s17_5, s18
    } = req.body;

    const shipped_quantity = Object.keys(req.body)
      .filter(k => /^s\d+/.test(k))
      .reduce((sum, k) => sum + (parseFloat(req.body[k]) || 0), 0);

    const values = [
      export_date, ry_number, delivery_round || null, shipped_quantity,
      s3||0, s3_5||0, s4||0, s4_5||0, s5||0, s5_5||0, s6||0, s6_5||0,
      s7||0, s7_5||0, s8||0, s8_5||0, s9||0, s9_5||0, s10||0, s10_5||0,
      s11||0, s11_5||0, s12||0, s12_5||0, s13||0, s13_5||0, s14||0,
      s14_5||0, s15||0, s15_5||0, s16||0, s16_5||0, s17||0, s17_5||0, s18||0
    ];

    const result = await ExportModel.createExport(values);
    await recalculateExportTotals(ry_number);

    res.json({ id: result.insertId, message: 'Export saved.' });
  } catch (err) {
    console.error('POST /export error:', err.message);
    res.status(500).json({ error: 'Failed to save export: ' + err.message });
  }
};

exports.getExports = async (req, res) => {
  try {
    let { date, ry_number, round, any, q } = req.query;
    
    if (q) {
      const trimmed = q.trim();
      const isDateSearch = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(trimmed);
      if (isDateSearch) date = trimmed;
      else if (trimmed.toLowerCase().startsWith('d:')) round = trimmed.slice(2).trim();
      else { ry_number = trimmed; any = trimmed; }
    }

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

    if (ry_number || any) {
      const val = ry_number || any;
      whereClauses.push('(e.ry_number LIKE ? OR e.delivery_round LIKE ?)');
      params.push(`%${val}%`, `%${val}%`);
    }

    if (round) {
      whereClauses.push('e.delivery_round = ?');
      params.push(round);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const rows = await ExportModel.getFilteredExports(whereSQL, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /export error:', err.message);
    res.status(500).json({ error: 'Failed to fetch export data: ' + err.message });
  }
};

exports.updateExport = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const sizeKeys = Object.keys(body).filter(k => /^s\d+/.test(k));
    if (sizeKeys.length > 0) {
      body.shipped_quantity = sizeKeys.reduce((sum, k) => sum + (parseFloat(body[k]) || 0), 0);
    }

    const fields = Object.keys(body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(body), id];

    if (!fields) return res.status(400).json({ error: 'No fields to update.' });

    const rows = await ExportModel.getExportById(id);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const ry_number = rows[0].ry_number;

    await ExportModel.updateExport(id, fields, values);
    await recalculateExportTotals(ry_number);

    res.json({ message: 'Updated.' });
  } catch (err) {
    console.error('PATCH /export error:', err.message);
    res.status(500).json({ error: 'Failed to update export: ' + err.message });
  }
};

exports.deleteExport = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await ExportModel.getExportById(id);
    if (rows.length > 0) {
      const ry_number = rows[0].ry_number;
      await ExportModel.deleteExport(id);
      await recalculateExportTotals(ry_number);
    }
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error('DELETE /export error:', err.message);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
};

exports.getRemainingStock = async (req, res) => {
  try {
    let { date, ry_number, round, any, q } = req.query;

    if (q) {
      const trimmed = q.trim();
      const isDateSearch = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(trimmed);
      if (isDateSearch) date = trimmed;
      else if (trimmed.toLowerCase().startsWith('d:')) round = trimmed.slice(2).trim();
      else { ry_number = trimmed; any = trimmed; }
    }

    let ordersWhere = [];
    let ordersParams = [];

    if (round) {
      ordersWhere.push('o.delivery_round = ?');
      ordersParams.push(round);
    }
    if (ry_number || any) {
      const val = ry_number || any;
      ordersWhere.push('(o.ry_number LIKE ? OR o.delivery_round LIKE ?)');
      ordersParams.push(`%${val}%`, `%${val}%`);
    }

    const ordersSQL = ordersWhere.length > 0 ? 'WHERE ' + ordersWhere.join(' AND ') : '';
    const orders = await ExportModel.getFilteredOrders(ordersSQL, ordersParams);

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
    
    const exportsData = await ExportModel.getExportTotalsGroupedByRy(whereExportSQL, exportParams);

    const exportMap = {};
    exportsData.forEach(e => exportMap[e.ry_number] = e);

    const sizeCols = [];
    for (let i = 3; i <= 18; i += 0.5) sizeCols.push(i.toString().replace('.', '_'));

    const finalResults = orders.map(o => {
      const e = exportMap[o.ry_number] || {};
      const result = {
        ry_number: o.ry_number,
        article: o.article,
        model_name: o.model_name,
        delivery_round: o.delivery_round,
        total_quantity: o.total_order_qty,
        accumulated_total: e.total_shipped || 0,
        shipped_quantity: 0,
        remaining_quantity: (parseFloat(o.total_order_qty) || 0) - (parseFloat(e.total_shipped) || 0)
      };

      sizeCols.forEach(sc => {
        const orderVal = parseFloat(o[`s${sc}`]) || 0;
        const shippedVal = parseFloat(e[`s${sc}`]) || 0;
        result[`s${sc}`] = orderVal - shippedVal;
        result[`os${sc}`] = orderVal;
      });

      return result;
    });

    res.json(finalResults);
  } catch (err) {
    console.error('GET /remaining-stock error:', err.message);
    res.status(500).json({ error: 'Failed to fetch remaining stock: ' + err.message });
  }
};
