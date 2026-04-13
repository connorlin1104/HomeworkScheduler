'use strict';

// =============================================================================
// DATA STORE — file-based JSON storage
//
// To swap this for a real database or external API:
//   1. Replace load() / save() with async DB calls (e.g. Mongoose, Prisma)
//   2. Make every exported method async and await accordingly
//   3. The route handlers in src/routes/ will only need `await` keywords added
// The public interface (list, get, create, update, delete) stays the same.
// =============================================================================

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../data/db.json');

function load() {
  try {
    if (!fs.existsSync(DB_PATH)) return { classes: [], homework: [] };
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { classes: [], homework: [] };
  }
}

function save(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const store = {
  classes: {
    list() {
      return load().classes;
    },
    get(id) {
      return load().classes.find(c => c.id === id) ?? null;
    },
    create(fields) {
      const db = load();
      const record = { id: uuidv4(), ...fields, createdAt: new Date().toISOString() };
      db.classes.push(record);
      save(db);
      return record;
    },
    update(id, fields) {
      const db = load();
      const i = db.classes.findIndex(c => c.id === id);
      if (i === -1) return null;
      db.classes[i] = { ...db.classes[i], ...fields };
      save(db);
      return db.classes[i];
    },
    delete(id) {
      const db = load();
      const i = db.classes.findIndex(c => c.id === id);
      if (i === -1) return false;
      db.classes.splice(i, 1);
      // Cascade-delete associated homework
      db.homework = db.homework.filter(h => h.classId !== id);
      save(db);
      return true;
    }
  },

  homework: {
    list(classId) {
      const hw = load().homework;
      return classId ? hw.filter(h => h.classId === classId) : hw;
    },
    get(id) {
      return load().homework.find(h => h.id === id) ?? null;
    },
    create(fields) {
      const db = load();
      const record = { id: uuidv4(), ...fields, completed: false, createdAt: new Date().toISOString() };
      db.homework.push(record);
      save(db);
      return record;
    },
    update(id, fields) {
      const db = load();
      const i = db.homework.findIndex(h => h.id === id);
      if (i === -1) return null;
      db.homework[i] = { ...db.homework[i], ...fields };
      save(db);
      return db.homework[i];
    },
    delete(id) {
      const db = load();
      const i = db.homework.findIndex(h => h.id === id);
      if (i === -1) return false;
      db.homework.splice(i, 1);
      save(db);
      return true;
    }
  }
};

module.exports = store;
