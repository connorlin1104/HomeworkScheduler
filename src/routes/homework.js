'use strict';

const express = require('express');
const router  = express.Router();
const store   = require('../store/dataStore');

router.get('/', (req, res) => {
  res.json(store.homework.list(req.query.classId));
});

router.post('/', (req, res) => {
  const { classId, description, notes, deadline } = req.body;
  if (!classId || !description?.trim()) {
    return res.status(400).json({ error: 'classId and description are required' });
  }
  if (!store.classes.get(classId)) {
    return res.status(404).json({ error: 'Class not found' });
  }
  res.status(201).json(store.homework.create({
    classId,
    description: description.trim(),
    notes:    notes    || undefined,
    deadline: deadline || undefined
  }));
});

router.put('/:id', (req, res) => {
  const { description, notes, deadline, completed } = req.body;
  const updated = store.homework.update(req.params.id, { description, notes, deadline, completed });
  if (!updated) return res.status(404).json({ error: 'Homework not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!store.homework.delete(req.params.id)) {
    return res.status(404).json({ error: 'Homework not found' });
  }
  res.json({ ok: true });
});

module.exports = router;
