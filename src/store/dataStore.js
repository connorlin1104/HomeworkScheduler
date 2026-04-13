'use strict';

// =============================================================================
// DATA STORE — file-based JSON storage
// To swap for a real DB: make load()/save() async, await them in each method,
// and add `await` in the route handlers. The interface stays the same.
// =============================================================================

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../data/db.json');

const DEFAULT_CLASSES_TAB = {
  id: 'classes', name: 'Classes', type: 'classes',
  createdAt: new Date().toISOString()
};

function defaultDb() {
  return { tabs: [DEFAULT_CLASSES_TAB], classes: [], homework: [] };
}

// Migrate older data that predates the tabs system
function migrate(db) {
  if (!db.tabs) db.tabs = [DEFAULT_CLASSES_TAB];
  else if (!db.tabs.find(t => t.id === 'classes')) db.tabs.unshift(DEFAULT_CLASSES_TAB);

  // Ensure every class has a tabId
  db.classes = (db.classes || []).map(c => c.tabId ? c : { tabId: 'classes', ...c });
  db.homework = db.homework || [];
  return db;
}

function load() {
  try {
    if (!fs.existsSync(DB_PATH)) return defaultDb();
    return migrate(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
  } catch {
    return defaultDb();
  }
}

function save(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const store = {
  tabs: {
    list() { return load().tabs; },
    get(id) { return load().tabs.find(t => t.id === id) ?? null; },
    create(fields) {
      const db = load();
      const record = { id: uuidv4(), ...fields, createdAt: new Date().toISOString() };
      db.tabs.push(record);
      save(db);
      return record;
    },
    update(id, fields) {
      if (id === 'classes') return null; // default tab is immutable
      const db = load();
      const i = db.tabs.findIndex(t => t.id === id);
      if (i === -1) return null;
      db.tabs[i] = { ...db.tabs[i], ...fields };
      save(db);
      return db.tabs[i];
    },
    delete(id) {
      if (id === 'classes') return false;
      const db = load();
      const i = db.tabs.findIndex(t => t.id === id);
      if (i === -1) return false;
      db.tabs.splice(i, 1);
      const classIds = db.classes.filter(c => c.tabId === id).map(c => c.id);
      db.classes  = db.classes.filter(c => c.tabId !== id);
      db.homework = db.homework.filter(h => !classIds.includes(h.classId));
      save(db);
      return true;
    }
  },

  classes: {
    list() { return load().classes; },
    get(id) { return load().classes.find(c => c.id === id) ?? null; },
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
    get(id) { return load().homework.find(h => h.id === id) ?? null; },
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
