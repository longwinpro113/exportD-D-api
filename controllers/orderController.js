const orderService = require('../services/orderService');

exports.getAllOrders = async (req, res) => {
  try {
    const rows = await orderService.getAllOrders(req.query);
    res.json(rows);
  } catch (err) {
    console.error('GET /orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { ry_number } = req.params;
    const success = await orderService.updateOrder(ry_number, req.body);
    if (!success) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    res.json({ message: 'Updated', ry_number });
  } catch (err) {
    console.error('PATCH /orders error:', err.message);
    res.status(500).json({ error: 'Failed to update order.' });
  }
};

exports.getClients = async (req, res) => {
  try {
    const rows = await orderService.getClients();
    res.json(rows);
  } catch (err) {
    console.error('GET /clients error:', err.message);
    res.status(500).json({ error: 'Failed to fetch clients.' });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const result = await orderService.createOrder(req.body);
    res.json({ id: result.insertId, message: 'Order created successfully.' });
  } catch (err) {
    console.error('POST /orders error:', err.message);
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
};
