const exportService = require('../services/exportService');
const { sizeColumns } = require('../utils/sizeColumns');

const buildWritableExportPayload = (body) => {
  const writable = {
    export_date: body.export_date || null,
    ry_number: typeof body.ry_number === 'string' ? body.ry_number.trim() || null : body.ry_number || null,
    delivery_round: body.delivery_round || null,
    note: body.note || null
  };

  sizeColumns.forEach((column) => {
    if (body[column] !== undefined) {
      writable[column] = body[column];
    }
  });

  return writable;
};

exports.createExport = async (req, res) => {
  try {
    console.log('POST /export body:', req.body);
    const payload = buildWritableExportPayload(req.body);

    if (!payload.ry_number) {
      return res.status(400).json({ error: 'ry_number is required.' });
    }

    const result = await exportService.createExport(payload);
    res.json({ id: result.insertId, message: 'Export saved.' });
  } catch (err) {
    console.error('POST /export error:', err.message);
    res.status(500).json({ error: `Failed to save export: ${err.message}` });
  }
};

exports.getExports = async (req, res) => {
  try {
    const rows = await exportService.getExports(req.query);
    res.json(rows);
  } catch (err) {
    console.error('GET /export error:', err.message);
    res.status(500).json({ error: `Failed to fetch export data: ${err.message}` });
  }
};

exports.updateExport = async (req, res) => {
  try {
    const result = await exportService.updateExport(req.params.id, buildWritableExportPayload(req.body));

    if (!result.found) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!result.updated) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    res.json({ message: 'Updated.' });
  } catch (err) {
    console.error('PATCH /export error:', err.message);
    res.status(500).json({ error: `Failed to update export: ${err.message}` });
  }
};

exports.deleteExport = async (req, res) => {
  try {
    await exportService.deleteExport(req.params.id);
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error('DELETE /export error:', err.message);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
};
exports.getMaxMonth = async (req, res) => {
  try {
    const maxInfo = await exportService.getMaxMonth(req.query.client);
    res.json(maxInfo);
  } catch (err) {
    console.error('GET /max-month error:', err.message);
    res.status(500).json({ error: 'Failed to fetch max month.' });
  }
};

exports.getAvailableDates = async (req, res) => {
  try {
    const dates = await exportService.getAvailableDates(req.query.client);
    res.json(dates);
  } catch (err) {
    console.error('GET /dates error:', err.message);
    res.status(500).json({ error: 'Failed to fetch available dates.' });
  }
};
