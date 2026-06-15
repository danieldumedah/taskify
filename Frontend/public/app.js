const API = const API = 'https://taskify-fwnj.vercel.app/api';

// ─── State ──────────────────────────────────────────
let tasks = [];
let currentFilter = 'all';
let currentPriority = null;
let currentSearch = '';
let isGridView = true;
let editingId = null;
let deleteTargetId = null;

// ─── DOM ─────────────────────────────────────────────
const taskContainer = document.getElementById('taskContainer');
const emptyState    = document.getElementById('emptyState');
const taskForm      = document.getElementById('taskForm');
const modalOverlay  = document.getElementById('modalOverlay');
const deleteOverlay = document.getElementById('deleteOverlay');
const searchInput   = document.getElementById('searchInput');
const pageTitle     = document.getElementById('pageTitle');
const pageSub       = document.getElementById('pageSub');

// ─── Init ─────────────────────────────────────────────
async function init() {
  await loadTasks();
  setupEventListeners();
}

// ─── API Calls ────────────────────────────────────────
async function loadTasks() {
  try {
    const params = new URLSearchParams();
    if (currentFilter !== 'all') params.set('status', currentFilter);
    if (currentPriority) params.set('priority', currentPriority);
    if (currentSearch) params.set('search', currentSearch);

    const res = await fetch(`${API}/tasks?${params}`);
    const data = await res.json();
    if (data.success) {
      tasks = data.data;
      renderTasks();
      updateStats();
    }
  } catch (e) {
    showToast('Cannot connect to server. Is it running?', 'error');
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const data = await res.json();
    if (data.success) {
      const s = data.data;
      document.getElementById('badge-all').textContent       = s.total;
      document.getElementById('badge-pending').textContent   = s.pending;
      document.getElementById('badge-inprogress').textContent= s.inProgress;
      document.getElementById('badge-completed').textContent = s.completed;
      document.getElementById('stat-completed').textContent  = s.completed;
      document.getElementById('stat-total').textContent      = s.total;

      const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressText').textContent = pct + '% complete';
    }
  } catch {}
}

async function createTask(payload) {
  const res = await fetch(`${API}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function updateTask(id, payload) {
  const res = await fetch(`${API}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function patchStatus(id, status) {
  const res = await fetch(`${API}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return res.json();
}

async function deleteTask(id) {
  const res = await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
  return res.json();
}

// ─── Rendering ───────────────────────────────────────
function renderTasks() {
  Array.from(taskContainer.children).forEach(c => {
    if (c !== emptyState) c.remove();
  });

  if (tasks.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  tasks.forEach(task => {
    const card = buildCard(task);
    taskContainer.appendChild(card);
  });
}

function buildCard(task) {
  const el = document.createElement('div');
  el.className = `task-card priority-${task.priority} status-${task.status}`;
  el.dataset.id = task.id;

  const dueInfo = task.dueDate ? getDueInfo(task.dueDate) : null;

  el.innerHTML = `
    <div class="task-card-header">
      <button class="task-status-btn" title="Toggle status" data-id="${task.id}"></button>
      <span class="task-title">${escHtml(task.title)}</span>
      <span class="task-priority-badge ${task.priority}">${task.priority}</span>
    </div>
    ${task.description ? `<p class="task-desc">${escHtml(task.description)}</p>` : ''}
    <div class="task-card-meta">
      <div class="task-meta-row">
        ${task.category ? `<span class="task-tag">${escHtml(task.category)}</span>` : ''}
        ${dueInfo ? `<span class="task-due ${dueInfo.cls}">📅 ${dueInfo.label}</span>` : ''}
        <span class="task-status-pill ${task.status}">${formatStatus(task.status)}</span>
      </div>
    </div>
    <div class="task-card-actions">
      <select class="status-select" data-id="${task.id}" title="Change status">
        <option value="pending"     ${task.status==='pending'?'selected':''}>Pending</option>
        <option value="in-progress" ${task.status==='in-progress'?'selected':''}>In Progress</option>
        <option value="completed"   ${task.status==='completed'?'selected':''}>Completed</option>
      </select>
      <button class="action-btn" data-action="edit" data-id="${task.id}">Edit</button>
      <button class="action-btn danger" data-action="delete" data-id="${task.id}">Delete</button>
    </div>
  `;

  return el;
}

function updateStats() { loadStats(); }

function getDueInfo(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0)  return { label: label + ' (Overdue)', cls: 'overdue' };
  if (diff <= 2) return { label: label + ' (Soon)',    cls: 'soon' };
  return { label, cls: '' };
}

function formatStatus(s) {
  return s === 'in-progress' ? 'In Progress'
       : s === 'completed'   ? 'Completed'
       : 'Pending';
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Filter / Search ──────────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  currentPriority = null;

  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  document.querySelectorAll('.priority-filter').forEach(b => b.classList.remove('active'));

  const labels = {
    all: 'All Tasks', pending: 'Pending Tasks',
    'in-progress': 'In Progress', completed: 'Completed Tasks'
  };
  pageTitle.textContent = labels[filter] || filter;
  pageSub.textContent   = 'Manage and track your work';
  loadTasks();
}

function setPriorityFilter(priority) {
  if (currentPriority === priority) {
    currentPriority = null;
    document.querySelectorAll('.priority-filter').forEach(b => b.classList.remove('active'));
  } else {
    currentPriority = priority;
    document.querySelectorAll('.priority-filter').forEach(b =>
      b.classList.toggle('active', b.dataset.priority === priority)
    );
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    currentFilter = 'all';
  }
  pageTitle.textContent = currentPriority ? `${priority.charAt(0).toUpperCase()+priority.slice(1)} Priority` : 'All Tasks';
  loadTasks();
}

// ─── Modal ────────────────────────────────────────────
function openModal(task = null) {
  editingId = task ? task.id : null;

  document.getElementById('modalTitle').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('submitBtn').textContent  = task ? 'Save Changes' : 'Create Task';
  document.getElementById('taskId').value       = task ? task.id : '';
  document.getElementById('taskTitle').value    = task ? task.title : '';
  document.getElementById('taskDesc').value     = task ? task.description : '';
  document.getElementById('taskPriority').value = task ? task.priority : 'medium';
  document.getElementById('taskStatus').value   = task ? task.status : 'pending';
  document.getElementById('taskCategory').value = task ? task.category : '';
  document.getElementById('taskDue').value      = task ? (task.dueDate || '') : '';

  clearFormErrors();
  updateCharCount();
  modalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  taskForm.reset();
  clearFormErrors();
  editingId = null;
}

function clearFormErrors() {
  document.querySelectorAll('.field-error').forEach(e => {
    e.classList.remove('visible');
    e.textContent = '';
  });
  document.querySelectorAll('.form-input').forEach(e => e.classList.remove('error'));
}

function showFieldError(id, msg) {
  const errEl = document.getElementById(id);
  const inputId = id.replace('Error', '');
  errEl.textContent = msg;
  errEl.classList.add('visible');
  document.getElementById('task' + inputId.charAt(0).toUpperCase() + inputId.slice(1)).classList.add('error');
}

function validateForm() {
  clearFormErrors();
  let valid = true;
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    showFieldError('titleError', 'Task title is required');
    valid = false;
  } else if (title.length > 120) {
    showFieldError('titleError', 'Title must be under 120 characters');
    valid = false;
  }
  return valid;
}

function updateCharCount() {
  const len = document.getElementById('taskTitle').value.length;
  document.getElementById('titleCount').textContent = `${len} / 120`;
}

// ─── Delete Modal ─────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  deleteOverlay.classList.add('open');
}

function closeDeleteModal() {
  deleteOverlay.classList.remove('open');
  deleteTargetId = null;
}

// ─── Toast ────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
  tc.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Event Listeners ──────────────────────────────────
function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(btn =>
    btn.addEventListener('click', () => setFilter(btn.dataset.filter))
  );

  document.querySelectorAll('.priority-filter').forEach(btn =>
    btn.addEventListener('click', () => setPriorityFilter(btn.dataset.priority))
  );

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    currentSearch = searchInput.value.trim();
    searchTimer = setTimeout(loadTasks, 300);
  });

  document.getElementById('openModalBtn').addEventListener('click', () => openModal());

  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  taskForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) return;

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = editingId ? 'Saving…' : 'Creating…';

    const payload = {
      title:       document.getElementById('taskTitle').value.trim(),
      description: document.getElementById('taskDesc').value.trim(),
      priority:    document.getElementById('taskPriority').value,
      status:      document.getElementById('taskStatus').value,
      category:    document.getElementById('taskCategory').value.trim(),
      dueDate:     document.getElementById('taskDue').value || null
    };

    try {
      let result;
      if (editingId) {
        result = await updateTask(editingId, payload);
      } else {
        result = await createTask(payload);
      }

      if (result.success) {
        closeModal();
        await loadTasks();
        showToast(result.message || 'Done!', 'success');
      } else {
        const errs = result.errors || [result.message || 'Error'];
        showToast(errs[0], 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = editingId ? 'Save Changes' : 'Create Task';
    }
  });

  document.getElementById('taskTitle').addEventListener('input', updateCharCount);

  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  deleteOverlay.addEventListener('click', e => {
    if (e.target === deleteOverlay) closeDeleteModal();
  });

  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      const result = await deleteTask(deleteTargetId);
      if (result.success) {
        closeDeleteModal();
        await loadTasks();
        showToast('Task deleted', 'info');
      }
    } catch {
      showToast('Failed to delete task', 'error');
    }
  });

  taskContainer.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    const statusBtn = e.target.closest('.task-status-btn');

    if (btn) {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') {
        const task = tasks.find(t => t.id === id);
        if (task) openModal(task);
      } else if (btn.dataset.action === 'delete') {
        openDeleteModal(id);
      }
    }

    if (statusBtn) {
      const id = statusBtn.dataset.id;
      const task = tasks.find(t => t.id === id);
      if (task) {
        const next = task.status === 'completed' ? 'pending'
                   : task.status === 'pending'   ? 'in-progress'
                   : 'completed';
        const result = await patchStatus(id, next);
        if (result.success) {
          await loadTasks();
          showToast(`Marked as ${formatStatus(next)}`, 'success');
        }
      }
    }
  });

  taskContainer.addEventListener('change', async e => {
    const sel = e.target.closest('.status-select');
    if (sel) {
      const result = await patchStatus(sel.dataset.id, sel.value);
      if (result.success) {
        await loadTasks();
        showToast(`Status updated`, 'success');
      }
    }
  });

  document.getElementById('gridViewBtn').addEventListener('click', () => {
    isGridView = true;
    taskContainer.classList.remove('list-view');
    taskContainer.classList.add('grid-view');
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
  });

  document.getElementById('listViewBtn').addEventListener('click', () => {
    isGridView = false;
    taskContainer.classList.remove('grid-view');
    taskContainer.classList.add('list-view');
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });
}

// ─── Start ─────────────────────────────────────────────
init();