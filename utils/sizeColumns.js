const buildSizes = () => {
  const result = [];
  for (let size = 3; size <= 18; size += 0.5) {
    result.push(size);
  }
  return result;
};

const sizes = buildSizes();

const sizeColumnFromValue = (size) => `s${size.toString().replace('.', '_')}`;

const sizeColumns = sizes.map(sizeColumnFromValue);

const sumSizeSelectSql = (tableAlias = '') => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return sizeColumns.map((column) => `SUM(${prefix}${column}) AS ${column}`).join(', ');
};

module.exports = {
  sizes,
  sizeColumns,
  sizeColumnFromValue,
  sumSizeSelectSql
};
