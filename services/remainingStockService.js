const exportData = require('../data/exportData');
const {
  buildRemainingExportFilter,
  buildRemainingOrderFilter,
  normalizeReportQuery
} = require('../utils/reportQuery');
const { sizeColumns } = require('../utils/sizeColumns');

const getRemainingStock = async (query) => {
  const normalizedQuery = normalizeReportQuery(query);
  const { whereSQL: ordersWhereSQL, params: ordersParams } = buildRemainingOrderFilter(normalizedQuery);
  const { whereSQL: exportWhereSQL, params: exportParams } = buildRemainingExportFilter(normalizedQuery);

  const [orders, exportsData] = await Promise.all([
    exportData.getRemainingBaseOrders(ordersWhereSQL, ordersParams),
    exportData.getExportTotalsGroupedByRy(exportWhereSQL, exportParams)
  ]);

  const exportMap = new Map(exportsData.map((item) => [item.ry_number, item]));

  return orders.map((order) => {
    const exported = exportMap.get(order.ry_number) || {};
    const totalQuantity = parseFloat(order.total_order_qty) || 0;
    const totalShipped = parseFloat(exported.total_shipped) || 0;

    const result = {
      ry_number: order.ry_number,
      article: order.article,
      model_name: order.model_name,
      delivery_round: order.delivery_round,
      total_quantity: order.total_order_qty,
      accumulated_total: exported.total_shipped || 0,
      shipped_quantity: 0,
      remaining_quantity: totalQuantity - totalShipped
    };

    sizeColumns.forEach((column) => {
      const orderValue = parseFloat(order[column]) || 0;
      const exportedValue = parseFloat(exported[column]) || 0;
      result[column] = orderValue - exportedValue;
      result[`o${column}`] = orderValue;
    });

    return result;
  });
};

module.exports = {
  getRemainingStock
};
