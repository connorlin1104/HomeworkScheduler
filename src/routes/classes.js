'use strict';

const express = require('express');
const router  = express.Router();
const store   = require('../store/dataStore');

router.get('/', (req, res) => {
  res.json(store.classes.list());
});

router.post('/', (req, res) => {
  const { name, color, teacher, room, period } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  res.status(201).json(store.classes.create({
    name:    name.trim(),
    color:   color   || '#3b82f6',
    teacher: teacher || undefined,
    room:    room    || undefined,
    period:  period  || undefined
  }));
});

router.put('/:id', (req, res) => {
  const { name, color, teacher, room, period } = req.body;
  const updated = store.classes.update(req.params.id, { name, color, teacher, room, period });
  if (!updated) return res.status(404).json({ error: 'Class not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!store.classes.delete(req.params.id)) {
    return res.status(404).json({ error: 'Class not found' });
  }
  res.json({ ok: true });
});

module.exports = router;
