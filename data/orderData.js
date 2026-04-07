const db = require('../config/db');
const { buildInsertParts, buildUpdateParts } = require('../utils/sqlBuilder');
const { sizeColumns } = require('../utils/sizeColumns');

const ORDER_SELECT_COLUMNS = [
  'ry_number',
  'article',
  'model_name',
  'delivery_round',
  'CRD',
  'client_export_date',
  'client_import_date',
  'client',
  'total_order_qty',
  ...sizeColumns
];

const getAll = async (client) => {
  let query = `SELECT ${ORDER_SELECT_COLUMNS.join(', ')} FROM orders`;
  const params = [];

  if (client) {
    query += ' WHERE client = ?';
    params.push(client);
  }

  query += ' ORDER BY ry_number DESC';
  const [rows] = await db.query(query, params);
  return rows;
};

const getClients = async () => {
  const [rows] = await db.query(
    'SELECT DISTINCT client FROM orders WHERE client IS NOT NULL ORDER BY client ASC'
  );
  return rows;
};

const getOrderQuantityByRyNumber = async (ryNumber) => {
  const [rows] = await db.query(
    'SELECT ry_number, total_order_qty FROM orders WHERE ry_number = ? LIMIT 1',
    [ryNumber]
  );
  return rows[0] || null;
};

const create = async (data) => {
  const { columnsSql, placeholdersSql, values } = buildInsertParts(data);
  const [result] = await db.query(
    `INSERT INTO orders (${columnsSql}) VALUES (${placeholdersSql})`,
    values
  );
  return result;
};

const update = async (ryNumber, updates) => {
  const { fieldsSql, values } = buildUpdateParts(updates);
  if (!fieldsSql) return null;

  values.push(ryNumber);
  await db.query(`UPDATE orders SET ${fieldsSql} WHERE ry_number = ?`, values);
  return true;
};

module.exports = {
  getAll,
  getClients,
  getOrderQuantityByRyNumber,
  create,
  update
};
