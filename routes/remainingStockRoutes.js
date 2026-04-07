const express = require('express');
const router = express.Router();
const remainingStockController = require('../controllers/remainingStockController');

router.get('/', remainingStockController.getRemainingStock);

module.exports = router;
