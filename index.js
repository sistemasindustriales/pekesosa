const express = require('express');
const serverless = require('./serverless');

const app = express();

// Middleware para logs
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(serverless);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Addon running on http://localhost:${PORT}`);
});