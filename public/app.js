'use strict';

/* =============================================================================
   API LAYER — all fetch() calls live here and nowhere else.
   To integrate an external API or SDK, replace the fetch calls inside each
   method while keeping the same method signatures.
   ============================================================================= */
const api = {
  async _req(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res  = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  classes: {
    list:   ()       => api._req('GET',    '/api/classes'),
    create: (body)   => api._req('POST',   '/api/classes', body),
    update: (id, b)  => api._req('PUT',    `/api/classes/${id}`, b),
    remove: (id)     => api._req('DELETE', `/api/classes/${id}`)
  },

  homework: {
    list:   ()       => api._req('GET',    '/api/homework'),
    create: (body)   => api._req('POST',   '/api/homework', body),
    update: (id, b)  => api._req('PUT',    `/api/homework/${id}`, b),
    remove: (id)     => api._req('DELETE', `/api/homework/${id}`)
  }
};

/* =============================================================================
   STATE
   ============================================================================= */
const state = {
  classes:       [],
  homework:      [],
  showCompleted: false
};

/* =============================================================================
   UNDO / REDO HISTORY
   Each action has an async undo() and async redo() method.
   Max 30 entries kept to avoid unbounded memory growth.
   ============================================================================= */
const history = {
  past:   [],
  future: [],

  push(action) {
    this.past.push(action);
    if (this.past.length > 30) this.past.shift();
    this.future = [];
    updateHistoryBtns();
  },

  async undo() {
    if (!this.past.length) return;
    const action = this.past.pop();
    try {
      await action.undo();
    } catch (err) {
      toast(`Undo failed: ${err.message}`, 'error');
    }
    this.future.push(action);
    updateHistoryBtns();
  },

  async redo() {
    if (!this.future.length) return;
    const action = this.future.pop();
    try {
      await action.redo();
    } catch (err) {
      toast(`Redo failed: ${err.message}`, 'error');
    }
    this.past.push(action);
    updateHistoryBtns();
  }
};

function updateHistoryBtns() {
  document.getElementById('undo-btn').disabled = history.past.length === 0;
  document.getElementById('redo-btn').disabled = history.future.length === 0;
}

/* =============================================================================
   CONSTANTS
   ============================================================================= */
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'
];

/* =============================================================================
   UTILITIES
   ============================================================================= */

/** Sanitise a value for use inside innerHTML */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Normalize a period string so that "1", "one", "first", "1st" etc.
 * all become "1st Period". Unrecognisable values are returned unchanged.
 */
function normalizePeriod(raw) {
  if (!raw?.trim()) return raw;
  const s = raw.trim();

  const WORD_MAP = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
    seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12
  };

  function ordinal(n) {
    if ([11, 12, 13].includes(n % 100)) return `${n}th`;
    const r = n % 10;
    if (r === 1) return `${n}st`;
    if (r === 2) return `${n}nd`;
    if (r === 3) return `${n}rd`;
    return `${n}th`;
  }

  // Strip surrounding "period" word before trying to parse the number/word
  const stripped = s
    .replace(/^\bperiod\b\s*/i, '')
    .replace(/\s*\bperiod\b$/i, '')
    .trim();

  // Pure number with optional ordinal suffix: "1", "3rd", "11th" …
  const numMatch = stripped.match(/^(\d+)(st|nd|rd|th)?$/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 20) return `${ordinal(n)} Period`;
  }

  // English word form: "one", "second", "third" …
  const lower = stripped.toLowerCase();
  if (WORD_MAP[lower] !== undefined) {
    return `${ordinal(WORD_MAP[lower])} Period`;
  }

  // Unrecognised (e.g. "Block A", "AP") — return as typed
  return s;
}

/**
 * Returns { label, diff } for a deadline date string (YYYY-MM-DD).
 * diff = days from today; negative = overdue.
 */
function parseDeadline(dateStr) {
  if (!dateStr) return null;
  const due   = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((due - today) / 86_400_000);
  const label = due.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    ...(due.getFullYear() !== today.getFullYear() && { year: 'numeric' })
  });
  return { label: `Due ${label}`, diff };
}

function deadlineCssClass(diff) {
  if (diff === null || diff === undefined) return '';
  if (diff < 0)   return 'deadline--overdue';
  if (diff === 0) return 'deadline--today';
  if (diff <= 3)  return 'deadline--soon';
  return 'deadline--ok';
}

/* =============================================================================
   TOAST NOTIFICATIONS
   ============================================================================= */
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--show'));
  setTimeout(() => {
    el.classList.remove('toast--show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3500);
}

/* =============================================================================
   RENDER — MAIN SCHEDULE
   ============================================================================= */
function renderSchedule() {
  const container  = document.getElementById('classes-container');
  const emptyState = document.getElementById('empty-state');

  if (state.classes.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  container.innerHTML = '';
  state.classes.forEach(cls => {
    const allHw   = state.homework.filter(h => h.classId === cls.id);
    const pending = allHw.filter(h => !h.completed);
    const visible = state.showCompleted ? allHw : pending;
    container.appendChild(buildClassRow(cls, visible, pending.length));
  });
}

function buildClassRow(cls, visibleHw, pendingCount) {
  const row = document.createElement('div');
  row.className = 'class-row';
  row.dataset.classId = cls.id;
  row.style.setProperty('--color', cls.color || '#94a3b8');

  const details = [cls.teacher, cls.room, cls.period].filter(Boolean).join(' · ');
  const badgeHtml = pendingCount > 0
    ? `<span class="badge badge--pending">${pendingCount} pending</span>`
    : `<span class="badge badge--done">All done ✓</span>`;

  row.innerHTML = `
    <div class="class-header">
      <div class="class-meta">
        <span class="class-name-text">${esc(cls.name)}</span>
        ${details ? `<span class="class-details-text">${esc(details)}</span>` : ''}
      </div>
      <div class="class-badge-area">${badgeHtml}</div>
    </div>
    <div class="hw-list" id="hw-list-${cls.id}"></div>
  `;

  const hwList = row.querySelector('.hw-list');
  if (visibleHw.length === 0) {
    const label = state.showCompleted ? 'No assignments' : 'No pending assignments';
    hwList.innerHTML = `<div class="hw-empty">${label} ✓</div>`;
  } else {
    visibleHw.forEach(hw => hwList.appendChild(buildHwItem(hw)));
  }
  return row;
}

function buildHwItem(hw) {
  const item = document.createElement('div');
  item.className = `hw-item${hw.completed ? ' hw-item--done' : ''}`;
  item.dataset.hwId = hw.id;

  const dl      = parseDeadline(hw.deadline);
  const dlClass = dl ? deadlineCssClass(dl.diff) : '';
  const dlHtml  = dl
    ? `<span class="deadline-badge ${dlClass}">${esc(dl.label)}</span>`
    : '';
  const notesHtml = hw.notes
    ? `<span class="hw-notes">${esc(hw.notes)}</span>`
    : '';

  item.innerHTML = `
    <label class="hw-check-label" title="${hw.completed ? 'Mark incomplete' : 'Mark complete'}">
      <input type="checkbox" class="hw-check" data-hw-id="${hw.id}" ${hw.completed ? 'checked' : ''}>
      <span class="custom-check"></span>
    </label>
    <div class="hw-body">
      <span class="hw-desc">${esc(hw.description)}</span>
      ${notesHtml}
    </div>
    <div class="hw-right">
      ${dlHtml}
      <button class="btn-icon-sm hw-delete" data-hw-id="${hw.id}" aria-label="Delete assignment">&#x2715;</button>
    </div>
  `;
  return item;
}

/* =============================================================================
   RENDER — SETTINGS CLASS LIST
   ============================================================================= */
function renderSettingsClassList() {
  const list = document.getElementById('settings-classes-list');
  if (state.classes.length === 0) {
    list.innerHTML = '<p class="settings-empty">No classes added yet.</p>';
    return;
  }
  list.innerHTML = '';
  state.classes.forEach(cls => {
    const item = document.createElement('div');
    item.className = 'settings-class-item';
    const details = [cls.teacher, cls.room, cls.period].filter(Boolean).join(' · ');
    item.innerHTML = `
      <div class="settings-class-dot" style="background:${esc(cls.color || '#3b82f6')}"></div>
      <div class="settings-class-info">
        <span class="settings-class-name">${esc(cls.name)}</span>
        ${details ? `<span class="settings-class-details">${esc(details)}</span>` : ''}
      </div>
      <div class="settings-class-actions">
        <button class="btn btn-sm btn-secondary edit-class-btn"  data-class-id="${cls.id}">Edit</button>
        <button class="btn btn-sm btn-danger   delete-class-btn" data-class-id="${cls.id}">Delete</button>
      </div>
    `;
    list.appendChild(item);
  });
}

/* =============================================================================
   COLOR SWATCHES
   ============================================================================= */
function initColorSwatches() {
  const container  = document.getElementById('color-swatches');
  const colorInput = document.getElementById('class-color');

  PRESET_COLORS.forEach(color => {
    const sw = document.createElement('button');
    sw.type  = 'button';
    sw.className     = 'color-swatch';
    sw.dataset.color = color;
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener('click', () => {
      selectSwatch(color);
      colorInput.value = color;
    });
    container.appendChild(sw);
  });

  colorInput.addEventListener('input', () => {
    container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  });
}

function selectSwatch(color) {
  const container  = document.getElementById('color-swatches');
  const colorInput = document.getElementById('class-color');
  colorInput.value = color;
  container.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === color);
  });
}

/* =============================================================================
   MODAL HELPERS
   ============================================================================= */
function openHwModal() {
  if (state.classes.length === 0) {
    toast('Add some classes in Settings first.', 'warning');
    return;
  }
  const select = document.getElementById('hw-class');
  select.innerHTML = state.classes
    .map(c => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join('');
  document.getElementById('hw-form').reset();
  document.getElementById('hw-modal').classList.add('modal--open');
  document.getElementById('hw-desc').focus();
}

function closeHwModal() {
  document.getElementById('hw-modal').classList.remove('modal--open');
}

function openSettings() {
  resetClassForm();
  renderSettingsClassList();
  document.getElementById('settings-modal').classList.add('modal--open');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('modal--open');
}

function resetClassForm() {
  document.getElementById('class-form').reset();
  document.getElementById('edit-class-id').value          = '';
  document.getElementById('class-form-title').textContent = 'Add New Class';
  document.getElementById('class-form-submit').textContent = 'Add Class';
  document.getElementById('cancel-edit-class').classList.add('hidden');
  selectSwatch(PRESET_COLORS[4]); // default blue
}

function startEditClass(cls) {
  document.getElementById('edit-class-id').value   = cls.id;
  document.getElementById('class-name').value      = cls.name    || '';
  document.getElementById('class-teacher').value   = cls.teacher || '';
  document.getElementById('class-room').value      = cls.room    || '';
  document.getElementById('class-period').value    = cls.period  || '';
  document.getElementById('class-form-title').textContent  = 'Edit Class';
  document.getElementById('class-form-submit').textContent = 'Save Changes';
  document.getElementById('cancel-edit-class').classList.remove('hidden');
  selectSwatch(cls.color || PRESET_COLORS[4]);
  document.getElementById('class-name').focus();
}

/* =============================================================================
   EVENT HANDLERS
   ============================================================================= */
async function handleAddHomework(e) {
  e.preventDefault();
  const classId     = document.getElementById('hw-class').value;
  const description = document.getElementById('hw-desc').value.trim();
  const notes       = document.getElementById('hw-notes').value.trim();
  const deadline    = document.getElementById('hw-deadline').value;
  if (!classId || !description) return;

  try {
    const hw = await api.homework.create({
      classId,
      description,
      ...(notes    && { notes }),
      ...(deadline && { deadline })
    });
    state.homework.push(hw);
    renderSchedule();
    closeHwModal();
    toast(`Added "${description}"`, 'success');
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function handleClassFormSubmit(e) {
  e.preventDefault();
  const id   = document.getElementById('edit-class-id').value;
  const data = {
    name:    document.getElementById('class-name').value.trim(),
    color:   document.getElementById('class-color').value,
    teacher: document.getElementById('class-teacher').value.trim() || undefined,
    room:    document.getElementById('class-room').value.trim()    || undefined,
    period:  normalizePeriod(document.getElementById('class-period').value) || undefined
  };
  if (!data.name) return;

  try {
    if (id) {
      const updated = await api.classes.update(id, data);
      const i = state.classes.findIndex(c => c.id === id);
      if (i !== -1) state.classes[i] = updated;
      toast(`Updated "${data.name}"`, 'success');
    } else {
      const created = await api.classes.create(data);
      state.classes.push(created);
      toast(`Added class "${data.name}"`, 'success');
    }
    resetClassForm();
    renderSettingsClassList();
    renderSchedule();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function handleToggleComplete(hwId, completed) {
  const hw = state.homework.find(h => h.id === hwId);
  if (!hw) return;

  try {
    const updated = await api.homework.update(hwId, { completed });
    const i = state.homework.findIndex(h => h.id === hwId);
    if (i !== -1) state.homework[i] = updated;
    renderSchedule();

    if (completed) toast(`Completed "${hw.description}"`, 'success');

    // Push undoable action
    history.push({
      label: `${completed ? 'Complete' : 'Uncomplete'} "${hw.description}"`,
      async undo() {
        const upd = await api.homework.update(hwId, { completed: !completed });
        const j = state.homework.findIndex(h => h.id === hwId);
        if (j !== -1) state.homework[j] = upd;
        renderSchedule();
        toast(`Undone — "${hw.description}" marked ${!completed ? 'complete' : 'incomplete'}`, 'info');
      },
      async redo() {
        const upd = await api.homework.update(hwId, { completed });
        const j = state.homework.findIndex(h => h.id === hwId);
        if (j !== -1) state.homework[j] = upd;
        renderSchedule();
        toast(`"${hw.description}" marked ${completed ? 'complete' : 'incomplete'}`, 'info');
      }
    });
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function handleDeleteHw(hwId) {
  const hw = state.homework.find(h => h.id === hwId);
  if (!hw) return;
  if (!confirm(`Delete "${hw.description}"?`)) return;

  try {
    await api.homework.remove(hwId);
    state.homework = state.homework.filter(h => h.id !== hwId);
    renderSchedule();
    toast(`Deleted "${hw.description}"`, 'info');

    // Snapshot the fields needed to restore (id and createdAt will be new on restore)
    const { id: _id, createdAt: _ca, completed: _co, ...restoreFields } = hw;

    const action = {
      restoredId: null,
      async undo() {
        const restored = await api.homework.create(restoreFields);
        this.restoredId = restored.id;
        state.homework.push(restored);
        renderSchedule();
        toast(`Restored "${hw.description}"`, 'success');
      },
      async redo() {
        if (!this.restoredId) return;
        await api.homework.remove(this.restoredId);
        state.homework = state.homework.filter(h => h.id !== this.restoredId);
        renderSchedule();
        toast(`Deleted "${hw.description}"`, 'info');
      }
    };
    history.push(action);
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function handleDeleteClass(classId) {
  const cls   = state.classes.find(c => c.id === classId);
  if (!cls) return;
  const clsHw = state.homework.filter(h => h.classId === classId);
  const msg   = clsHw.length > 0
    ? `Delete "${cls.name}" and its ${clsHw.length} assignment(s)?`
    : `Delete "${cls.name}"?`;
  if (!confirm(msg)) return;

  try {
    await api.classes.remove(classId);
    state.classes  = state.classes.filter(c => c.id !== classId);
    state.homework = state.homework.filter(h => h.classId !== classId);
    renderSettingsClassList();
    renderSchedule();
    toast(`Deleted class "${cls.name}"`, 'info');

    // Snapshot class fields and all its homework for restoration
    const { id: _id, createdAt: _ca, ...classFields } = cls;
    const hwSnapshots = clsHw.map(({ id: _i, classId: _c, createdAt: _c2, completed: _co, ...f }) => f);

    const action = {
      restoredClassId: null,
      async undo() {
        const restoredCls = await api.classes.create(classFields);
        this.restoredClassId = restoredCls.id;
        state.classes.push(restoredCls);
        const restoredHw = await Promise.all(
          hwSnapshots.map(f => api.homework.create({ ...f, classId: restoredCls.id }))
        );
        state.homework.push(...restoredHw);
        renderSettingsClassList();
        renderSchedule();
        toast(`Restored class "${cls.name}"`, 'success');
      },
      async redo() {
        if (!this.restoredClassId) return;
        await api.classes.remove(this.restoredClassId);
        state.classes  = state.classes.filter(c => c.id !== this.restoredClassId);
        state.homework = state.homework.filter(h => h.classId !== this.restoredClassId);
        renderSettingsClassList();
        renderSchedule();
        toast(`Deleted class "${cls.name}"`, 'info');
      }
    };
    history.push(action);
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

/* =============================================================================
   WIRE EVENTS
   ============================================================================= */
function wireEvents() {
  // Header
  document.getElementById('add-hw-btn').addEventListener('click', openHwModal);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('empty-settings-btn').addEventListener('click', openSettings);
  document.getElementById('show-completed-toggle').addEventListener('change', e => {
    state.showCompleted = e.target.checked;
    renderSchedule();
  });

  // Undo / Redo buttons
  document.getElementById('undo-btn').addEventListener('click', () => history.undo());
  document.getElementById('redo-btn').addEventListener('click', () => history.redo());

  // Homework modal
  document.getElementById('hw-form').addEventListener('submit', handleAddHomework);
  document.getElementById('close-hw-modal').addEventListener('click', closeHwModal);
  document.getElementById('cancel-hw').addEventListener('click', closeHwModal);
  document.getElementById('hw-backdrop').addEventListener('click', closeHwModal);

  // Settings modal
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('settings-backdrop').addEventListener('click', closeSettings);
  document.getElementById('class-form').addEventListener('submit', handleClassFormSubmit);
  document.getElementById('cancel-edit-class').addEventListener('click', resetClassForm);

  // Settings class list — delegated clicks
  document.getElementById('settings-classes-list').addEventListener('click', e => {
    const editBtn   = e.target.closest('.edit-class-btn');
    const deleteBtn = e.target.closest('.delete-class-btn');
    if (editBtn)   { const cls = state.classes.find(c => c.id === editBtn.dataset.classId);   if (cls) startEditClass(cls); }
    if (deleteBtn) { handleDeleteClass(deleteBtn.dataset.classId); }
  });

  // Main schedule — delegated checkbox toggles and delete clicks
  document.getElementById('classes-container').addEventListener('change', e => {
    const cb = e.target.closest('.hw-check');
    if (cb) handleToggleComplete(cb.dataset.hwId, cb.checked);
  });
  document.getElementById('classes-container').addEventListener('click', e => {
    const del = e.target.closest('.hw-delete');
    if (del) handleDeleteHw(del.dataset.hwId);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;

    // Undo: Ctrl/Cmd+Z
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      history.undo();
      return;
    }
    // Redo: Ctrl/Cmd+Y  or  Ctrl/Cmd+Shift+Z
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      history.redo();
      return;
    }
    // Close any open modal
    if (e.key === 'Escape') {
      closeHwModal();
      closeSettings();
    }
  });
}

/* =============================================================================
   INIT
   ============================================================================= */
async function init() {
  initColorSwatches();
  wireEvents();

  try {
    const [classes, homework] = await Promise.all([
      api.classes.list(),
      api.homework.list()
    ]);
    state.classes  = classes;
    state.homework = homework;
    renderSchedule();
  } catch (err) {
    toast(`Failed to load data: ${err.message}`, 'error');
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
