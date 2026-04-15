const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportApiController');

router.get('/max-month', exportController.getMaxMonth);
router.get('/dates', exportController.getAvailableDates);
router.get('/', exportController.getExports);
router.post('/', exportController.createExport);
router.patch('/:id', exportController.updateExport);
router.delete('/:id', exportController.deleteExport);

module.exports = router;
