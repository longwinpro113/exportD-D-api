const express = require('express');
const cors = require('cors');
require('dotenv').config();

const orderRoutes = require('./routes/orderRoutes');
const exportRoutes = require('./routes/exportRoutes');
const remainingStockRoutes = require('./routes/remainingStockRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL;

app.use(cors({
  origin: CLIENT_ORIGIN || true
}));
app.use(express.json());

// Routes
app.use('/api/orders', orderRoutes);
app.use('/api/history-export', exportRoutes);
app.use('/api/daily', exportRoutes);
app.use('/api/remaining-stock', remainingStockRoutes);

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
