const DATE_SEARCH_REGEX = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;

const normalizeReportQuery = (query = {}) => {
  let { date, from, to, ry_number, round, any, q, client } = query;

  if (q) {
    const trimmed = q.trim();
    if (DATE_SEARCH_REGEX.test(trimmed)) {
      date = trimmed;
    } else if (trimmed.toLowerCase().startsWith('d:')) {
      round = trimmed.slice(2).trim();
    } else {
      ry_number = trimmed;
      any = trimmed;
    }
  }

  return { date, from, to, ry_number, round, any, q, client };
};

const toIsoDate = (date) => {
  const parts = String(date || '').split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const buildExportFilter = ({ date, from, to, ry_number, any, round, client }) => {
  const whereClauses = [];
  const params = [];

  if (client) {
    whereClauses.push('o.client = ?');
    params.push(client);
  }

  if (date) {
    const parts = date.split('/');
    if (parts.length === 3) {
      whereClauses.push('DATE(e.export_date) = ?');
      params.push(toIsoDate(date));
    } else if (parts.length === 2) {
      whereClauses.push("DATE_FORMAT(e.export_date, '%d/%m') = ?");
      params.push(`${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`);
    }
  }

  if (from || to) {
    if (from && to) {
      whereClauses.push('DATE(e.export_date) BETWEEN ? AND ?');
      params.push(from, to);
    } else if (from) {
      whereClauses.push('DATE(e.export_date) >= ?');
      params.push(from);
    } else if (to) {
      whereClauses.push('DATE(e.export_date) <= ?');
      params.push(to);
    }
  }

  if (ry_number || any) {
    const value = ry_number || any;
    whereClauses.push('(e.ry_number LIKE ? OR e.delivery_round LIKE ?)');
    params.push(`%${value}%`, `%${value}%`);
  }

  if (round) {
    whereClauses.push('e.delivery_round = ?');
    params.push(round);
  }

  return {
    whereSQL: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params
  };
};

const buildRemainingOrderFilter = ({ round, ry_number, any, client }) => {
  const whereClauses = [];
  const params = [];

  if (client) {
    whereClauses.push('o.client = ?');
    params.push(client);
  }

  if (round) {
    whereClauses.push('o.delivery_round = ?');
    params.push(round);
  }

  if (ry_number || any) {
    const value = ry_number || any;
    whereClauses.push('(o.ry_number LIKE ? OR o.delivery_round LIKE ?)');
    params.push(`%${value}%`, `%${value}%`);
  }

  return {
    whereSQL: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params
  };
};

const buildRemainingExportFilter = ({ date }) => {
  if (!date) {
    return { whereSQL: '', params: [] };
  }

  const parts = date.split('/');
  if (parts.length !== 3) {
    return { whereSQL: '', params: [] };
  }

  return {
    whereSQL: 'WHERE DATE(export_date) <= ?',
    params: [toIsoDate(date)]
  };
};

module.exports = {
  DATE_SEARCH_REGEX,
  normalizeReportQuery,
  toIsoDate,
  buildExportFilter,
  buildRemainingOrderFilter,
  buildRemainingExportFilter
};
