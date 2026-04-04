const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/clients', orderController.getClients);
router.get('/', orderController.getAllOrders);
router.post('/', orderController.createOrder);
router.patch('/:ry_number', orderController.updateOrder);

module.exports = router;
