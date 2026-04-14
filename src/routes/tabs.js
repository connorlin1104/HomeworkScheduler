'use strict';

const express = require('express');
const router  = express.Router();
const store   = require('../store/dataStore');

router.get('/', (req, res) => {
  res.json(store.tabs.list());
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(store.tabs.create({ name: name.trim(), type: 'custom' }));
});

router.put('/:id', (req, res) => {
  const { name } = req.body;
  const updated = store.tabs.update(req.params.id, { name });
  if (!updated) return res.status(404).json({ error: 'Tab not found or cannot be modified' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!store.tabs.delete(req.params.id)) {
    return res.status(404).json({ error: 'Tab not found' });
  }
  res.json({ ok: true });
});

module.exports = router;
