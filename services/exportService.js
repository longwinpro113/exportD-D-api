const exportData = require('../data/exportData');
const orderData = require('../data/orderData');
const { buildExportFilter, normalizeReportQuery } = require('../utils/reportQuery');

const recalculateExportTotals = async (ryNumber) => {
  const order = await orderData.getOrderQuantityByRyNumber(ryNumber);
  if (!order) return;

  const totalOrderQuantity = parseFloat(order.total_order_qty) || 0;
  const exports = await exportData.getExportsByRyNumber(ryNumber);

  let runningTotal = 0;
  for (const row of exports) {
    runningTotal += parseFloat(row.shipped_quantity) || 0;
    const remaining = totalOrderQuantity - runningTotal;
    await exportData.updateExportTotals(row.id, runningTotal, remaining);
  }
};

const createExport = async (payload) => {
  const result = await exportData.createExport({
    ...payload,
    delivery_round: payload.delivery_round || null,
    note: payload.note || null
  });

  await recalculateExportTotals(payload.ry_number);
  return result;
};

const getExports = async (query) => {
  const normalizedQuery = normalizeReportQuery(query);
  const { whereSQL, params } = buildExportFilter(normalizedQuery);
  return exportData.getFilteredExports(whereSQL, params);
};

const updateExport = async (id, payload) => {
  const row = await exportData.getExportById(id);
  if (!row) return { found: false };

  const updated = await exportData.updateExport(id, payload);
  if (!updated) return { found: true, updated: false, ryNumber: row.ry_number };

  await recalculateExportTotals(row.ry_number);
  return { found: true, updated: true, ryNumber: row.ry_number };
};

const deleteExport = async (id) => {
  const row = await exportData.getExportById(id);
  if (!row) return { found: false };

  await exportData.deleteExport(id);
  await recalculateExportTotals(row.ry_number);
  return { found: true, ryNumber: row.ry_number };
};

const getMaxMonth = async (client) => {
  return exportData.getMaxMonth(client);
};

const getAvailableDates = async (client) => {
  const rows = await exportData.getUniqueExportDates(client);
  return rows.map((r) => r.formatted_date);
};

module.exports = {
  createExport,
  getExports,
  updateExport,
  deleteExport,
  recalculateExportTotals,
  getMaxMonth,
  getAvailableDates
};
