const db = require('../config/db');
const { buildInsertParts, buildUpdateParts } = require('../utils/sqlBuilder');
const { sizeColumns, sumSizeSelectSql } = require('../utils/sizeColumns');
const RY_NUMBER_COLLATION = 'utf8mb4_unicode_ci';

const EXPORT_INSERT_COLUMNS = [
  'export_date',
  'ry_number',
  'delivery_round',
  ...sizeColumns,
  'note'
];

const EXPORT_UPDATE_COLUMNS = [
  'export_date',
  'delivery_round',
  ...sizeColumns,
  'note'
];

const stripGeneratedColumns = (data) => {
  const { shipped_quantity, accumulated_total, remaining_quantity, ...writable } = data;
  return writable;
};

const getExportsByRyNumber = async (ryNumber) => {
  const [rows] = await db.query(
    'SELECT id, shipped_quantity FROM export WHERE ry_number = ? ORDER BY export_date ASC, id ASC',
    [ryNumber]
  );
  return rows;
};

const updateExportTotals = async (id, runningTotal, remaining) => {
  await db.query(
    'UPDATE export SET accumulated_total = ?, remaining_quantity = ? WHERE id = ?',
    [runningTotal, remaining, id]
  );
};

const createExport = async (data) => {
  const payload = {};
  const safeData = stripGeneratedColumns(data);

  EXPORT_INSERT_COLUMNS.forEach((column) => {
    payload[column] = safeData[column] ?? (sizeColumns.includes(column) ? 0 : null);
  });

  const { columnsSql, placeholdersSql, values } = buildInsertParts(payload);
  const [result] = await db.query(
    `INSERT INTO export (${columnsSql}) VALUES (${placeholdersSql})`,
    values
  );
  return result;
};

const updateExport = async (id, updates) => {
  const safeUpdates = stripGeneratedColumns(updates);
  const writableUpdates = {};

  EXPORT_UPDATE_COLUMNS.forEach((column) => {
    if (safeUpdates[column] !== undefined) {
      writableUpdates[column] = safeUpdates[column];
    }
  });
  const { fieldsSql, values } = buildUpdateParts(writableUpdates);
  if (!fieldsSql) return null;

  values.push(id);
  await db.query(`UPDATE export SET ${fieldsSql} WHERE id = ?`, values);
  return true;
};

const getExportById = async (id) => {
  const [rows] = await db.query(
    'SELECT id, ry_number, export_date, note FROM export WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
};

const deleteExport = async (id) => {
  await db.query('DELETE FROM export WHERE id = ?', [id]);
};

const getFilteredExports = async (whereSQL, params) => {
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
      o.product,
      o.client,
      o.total_order_qty AS total_quantity,
      ${sizeColumns.map((column) => `e.${column}`).join(', ')}
    FROM export e
    LEFT JOIN orders o
      ON e.ry_number COLLATE ${RY_NUMBER_COLLATION} = o.ry_number COLLATE ${RY_NUMBER_COLLATION}
    ${whereSQL}
    ORDER BY e.export_date DESC, e.id ASC
  `;

  const [rows] = await db.query(query, params);
  return rows;
};

const getRemainingBaseOrders = async (whereSQL, params) => {
  const query = `
    SELECT
      o.ry_number,
      o.article,
      o.model_name,
      o.product,
      o.delivery_round,
      o.total_order_qty,
      ${sizeColumns.map((column) => `o.${column}`).join(', ')}
    FROM orders o
    ${whereSQL}
  `;

  const [rows] = await db.query(query, params);
  return rows;
};

const getExportTotalsGroupedByRy = async (whereSQL, params) => {
  const [rows] = await db.query(
    `
      SELECT
        ry_number,
        SUM(shipped_quantity) AS total_shipped,
        ${sumSizeSelectSql()}
      FROM export
      ${whereSQL}
      GROUP BY ry_number
    `,
    params
  );

  return rows;
};

const getMaxMonth = async (client) => {
  let query = `
    SELECT DATE_FORMAT(MAX(e.export_date), '%Y-%m') AS max_month, 
           DATE_FORMAT(MAX(e.export_date), '%Y-%m-%d') AS max_date 
    FROM export e
  `;
  const params = [];

  if (client) {
    query += `
      LEFT JOIN orders o 
        ON e.ry_number COLLATE ${RY_NUMBER_COLLATION} = o.ry_number COLLATE ${RY_NUMBER_COLLATION}
      WHERE o.client = ?
    `;
    params.push(client);
  }

  const [rows] = await db.query(query, params);
  return {
    max_month: rows[0]?.max_month || null,
    max_date: rows[0]?.max_date || null
  };
};

module.exports = {
  getExportsByRyNumber,
  updateExportTotals,
  createExport,
  updateExport,
  getExportById,
  deleteExport,
  getFilteredExports,
  getRemainingBaseOrders,
  getExportTotalsGroupedByRy,
  getMaxMonth
};
