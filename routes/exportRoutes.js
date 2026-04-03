const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/', exportController.getExports);
router.post('/', exportController.createExport);
router.patch('/:id', exportController.updateExport);
router.delete('/:id', exportController.deleteExport);

module.exports = router;
