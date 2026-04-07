const buildInsertParts = (data) => {
  const keys = Object.keys(data);
  return {
    keys,
    columnsSql: keys.join(', '),
    placeholdersSql: keys.map(() => '?').join(', '),
    values: keys.map((key) => data[key])
  };
};

const buildUpdateParts = (updates) => {
  const keys = Object.keys(updates);
  return {
    keys,
    fieldsSql: keys.map((key) => `${key} = ?`).join(', '),
    values: keys.map((key) => updates[key])
  };
};

module.exports = {
  buildInsertParts,
  buildUpdateParts
};
