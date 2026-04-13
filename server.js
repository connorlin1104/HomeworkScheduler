'use strict';

const express = require('express');
const path    = require('path');

const tabRoutes      = require('./src/routes/tabs');
const classRoutes    = require('./src/routes/classes');
const homeworkRoutes = require('./src/routes/homework');
const errorHandler   = require('./src/middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes — structured as a REST adapter layer.
// To integrate an external API (Google Classroom, Canvas, etc.), replace the
// route handlers in src/routes/ while keeping the same URL structure so the
// frontend requires zero changes.
app.use('/api/tabs',     tabRoutes);
app.use('/api/classes',  classRoutes);
app.use('/api/homework', homeworkRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`StudyFlow running at http://localhost:${PORT}`);
});
