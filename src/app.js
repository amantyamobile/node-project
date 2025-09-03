// src/app.js
const express = require('express');
const apiRoutes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Static assets
app.use('/static', express.static('public'));


// Health check
app.get('/health', (req, res) => {
res.json({ status: 'ok', uptime: process.uptime() });
});

//pase JSON
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// 404 + centralized error handling
app.use(notFound);
app.use(errorHandler);


module.exports = app;