const orderData = require('../data/orderData');

const getAllOrders = async (query) => {
  return orderData.getAll(query.client);
};

const getClients = async () => {
  return orderData.getClients();
};

const createOrder = async (payload) => {
  return orderData.create(payload);
};

const updateOrder = async (ryNumber, updates) => {
  return orderData.update(ryNumber, updates);
};

module.exports = {
  getAllOrders,
  getClients,
  createOrder,
  updateOrder
};
