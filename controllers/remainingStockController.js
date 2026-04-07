const remainingStockService = require('../services/remainingStockService');

exports.getRemainingStock = async (req, res) => {
  try {
    const rows = await remainingStockService.getRemainingStock(req.query);
    res.json(rows);
  } catch (err) {
    console.error('GET /remaining-stock error:', err.message);
    res.status(500).json({ error: `Failed to fetch remaining stock: ${err.message}` });
  }
};
