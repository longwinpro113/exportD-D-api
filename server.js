const express = require('express');
const cors = require('cors');
require('dotenv').config();

const orderRoutes = require('./routes/orderRoutes');
const exportRoutes = require('./routes/exportRoutes');
const remainingStockRoutes = require('./routes/remainingStockRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/orders', orderRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/remaining-stock', remainingStockRoutes);

app.listen(PORT, () => {
  console.log(`Server running on ${process.env.HOST}:${PORT}`);
});
