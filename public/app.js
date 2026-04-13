'use strict';

/* =============================================================================
   API LAYER — all fetch() calls live here and nowhere else.
   To integrate an external API or SDK, replace the fetch calls inside each
   method while keeping the same method signatures. The rest of the app is
   completely unaffected.
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
    list:   ()        => api._req('GET',    '/api/classes'),
    create: (body)    => api._req('POST',   '/api/classes', body),
    update: (id, b)   => api._req('PUT',    `/api/classes/${id}`, b),
    remove: (id)      => api._req('DELETE', `/api/classes/${id}`)
  },

  homework: {
    list:   ()        => api._req('GET',    '/api/homework'),
    create: (body)    => api._req('POST',   '/api/homework', body),
    update: (id, b)   => api._req('PUT',    `/api/homework/${id}`, b),
    remove: (id)      => api._req('DELETE', `/api/homework/${id}`)
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
   CONSTANTS
   ============================================================================= */
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'
];

/* =============================================================================
   UTILITIES
   ============================================================================= */

/** Sanitise a string for use inside innerHTML */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Returns { label, diff } for a deadline date string (YYYY-MM-DD).
 * diff = days from today (negative = overdue).
 */
function parseDeadline(dateStr) {
  if (!dateStr) return null;
  const due  = new Date(dateStr + 'T00:00:00');
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
  if (diff <  0) return 'deadline--overdue';
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
  }, 3000);
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
    const allHw     = state.homework.filter(h => h.classId === cls.id);
    const pending   = allHw.filter(h => !h.completed);
    const visible   = state.showCompleted ? allHw : pending;
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
        <button class="btn btn-sm btn-secondary edit-class-btn" data-class-id="${cls.id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-class-btn"  data-class-id="${cls.id}">Delete</button>
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
    const sw  = document.createElement('button');
    sw.type   = 'button';
    sw.className   = 'color-swatch';
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
    // Deselect all swatches when a custom color is entered
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
  document.getElementById('edit-class-id').value       = '';
  document.getElementById('class-form-title').textContent = 'Add New Class';
  document.getElementById('class-form-submit').textContent = 'Add Class';
  document.getElementById('cancel-edit-class').classList.add('hidden');
  selectSwatch(PRESET_COLORS[4]); // default blue
}

function startEditClass(cls) {
  document.getElementById('edit-class-id').value        = cls.id;
  document.getElementById('class-name').value           = cls.name    || '';
  document.getElementById('class-teacher').value        = cls.teacher || '';
  document.getElementById('class-room').value           = cls.room    || '';
  document.getElementById('class-period').value         = cls.period  || '';
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
    toast('Assignment added!', 'success');
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
    period:  document.getElementById('class-period').value.trim()  || undefined
  };
  if (!data.name) return;

  try {
    if (id) {
      const updated = await api.classes.update(id, data);
      const i = state.classes.findIndex(c => c.id === id);
      if (i !== -1) state.classes[i] = updated;
      toast('Class updated!', 'success');
    } else {
      const created = await api.classes.create(data);
      state.classes.push(created);
      toast('Class added!', 'success');
    }
    resetClassForm();
    renderSettingsClassList();
    renderSchedule();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function handleToggleComplete(hwId, completed) {
  try {
    const updated = await api.homework.update(hwId, { completed });
    const i = state.homework.findIndex(h => h.id === hwId);
    if (i !== -1) state.homework[i] = updated;
    renderSchedule();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function handleDeleteHw(hwId) {
  if (!confirm('Delete this assignment?')) return;
  try {
    await api.homework.remove(hwId);
    state.homework = state.homework.filter(h => h.id !== hwId);
    renderSchedule();
    toast('Assignment deleted.', 'info');
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function handleDeleteClass(classId) {
  const cls     = state.classes.find(c => c.id === classId);
  if (!cls) return;
  const hwCount = state.homework.filter(h => h.classId === classId).length;
  const msg     = hwCount > 0
    ? `Delete "${cls.name}" and its ${hwCount} assignment(s)?`
    : `Delete "${cls.name}"?`;
  if (!confirm(msg)) return;

  try {
    await api.classes.remove(classId);
    state.classes  = state.classes.filter(c => c.id !== classId);
    state.homework = state.homework.filter(h => h.classId !== classId);
    renderSettingsClassList();
    renderSchedule();
    toast('Class deleted.', 'info');
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

  // Settings class list (delegated clicks)
  document.getElementById('settings-classes-list').addEventListener('click', e => {
    const editBtn   = e.target.closest('.edit-class-btn');
    const deleteBtn = e.target.closest('.delete-class-btn');
    if (editBtn) {
      const cls = state.classes.find(c => c.id === editBtn.dataset.classId);
      if (cls) startEditClass(cls);
    }
    if (deleteBtn) {
      handleDeleteClass(deleteBtn.dataset.classId);
    }
  });

  // Main schedule — delegated checkbox + delete
  document.getElementById('classes-container').addEventListener('change', e => {
    const cb = e.target.closest('.hw-check');
    if (cb) handleToggleComplete(cb.dataset.hwId, cb.checked);
  });
  document.getElementById('classes-container').addEventListener('click', e => {
    const del = e.target.closest('.hw-delete');
    if (del) handleDeleteHw(del.dataset.hwId);
  });

  // Close any open modal with Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeHwModal();
    closeSettings();
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
