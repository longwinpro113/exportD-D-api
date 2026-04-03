const OrderModel = require('../models/orderModel');

exports.getAllOrders = async (req, res) => {
  try {
    const rows = await OrderModel.getAll();
    res.json(rows);
  } catch (err) {
    console.error('GET /orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { ry_number } = req.params;
    const updates = req.body;
    const success = await OrderModel.update(ry_number, updates);
    if (!success) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    res.json({ message: 'Updated', ry_number });
  } catch (err) {
    console.error('PATCH /orders error:', err.message);
    res.status(500).json({ error: 'Failed to update order.' });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { orderCode, article, modelName } = req.body;
    const result = await OrderModel.create(orderCode, article, modelName);
    res.json({ id: result.insertId, orderCode, article, modelName });
  } catch (err) {
    console.error('POST /orders error:', err.message);
    res.status(500).json({ error: 'Failed to create order.' });
  }
};
