require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Pull and bind our segmented functional routing box maps cleanly
const appRouter = require('./routes/index');
app.use('/', appRouter);

app.listen(PORT, () => {
  console.log(`Server running smoothly on http://localhost:${PORT}`);
});