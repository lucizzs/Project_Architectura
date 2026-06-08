/* =====================================================
   Bloom — фронтенд
   Виправлений баг створення задачі: payload зібрано
   з нуля, додаються тільки валідні поля.
   ===================================================== */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const VALID_STATUSES   = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

/* ─── State ─── */
const state = {
  user: null,
  projects: [],
  currentProject: null,
  currentTasks: [],
  currentTask: null,
  viewMode: 'list',         // list | board | calendar
  filterPriority: '',
  filterStatus: '',
  projectCalCursor: new Date(),
  globalCalCursor: new Date(),
};

/* ─── Utils ─── */
function $(id) { return document.getElementById(id); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateShort(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });
}
function isOverdue(d) {
  if (!d) return false;
  const due = new Date(d); due.setHours(23, 59, 59, 999);
  return due < new Date();
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
function avatar(name) { return ((name || '?').trim()[0] || '?').toUpperCase(); }

function showToast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), 3000);
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = $('view-' + id);
  if (v) v.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-link[data-view="${id}"]`);
  if (navItem) navItem.classList.add('active');
}
function toArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const k of ['items', 'projects', 'tasks', 'comments', 'data']) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

/* ─── Modal ─── */
function openModal(title, bodyHTML) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHTML;
  $('modal-overlay').classList.remove('hidden');
}
function closeModal() { $('modal-overlay').classList.add('hidden'); }
$('modal-close').onclick = closeModal;
$('modal-overlay').onclick = e => { if (e.target === $('modal-overlay')) closeModal(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('modal-overlay').classList.contains('hidden')) closeModal();
});

/* =====================================================
   AUTH
   ===================================================== */
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    $('form-' + tab.dataset.tab).classList.add('active');
  };
});

$('form-login').onsubmit = async e => {
  e.preventDefault();
  const err = $('login-error');
  err.classList.add('hidden');
  try {
    const data = await api.login($('login-email').value, $('login-password').value);
    api.setToken(data.accessToken);
    state.user = data.user;
    await initApp();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
};

$('form-register').onsubmit = async e => {
  e.preventDefault();
  const err = $('reg-error');
  err.classList.add('hidden');
  try {
    const data = await api.register($('reg-email').value, $('reg-password').value, $('reg-name').value);
    api.setToken(data.accessToken);
    state.user = data.user;
    await initApp();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
};

$('btn-logout').onclick = () => {
  api.setToken(null);
  state.user = null;
  state.projects = [];
  showScreen('screen-auth');
};

/* =====================================================
   INIT
   ===================================================== */
async function initApp() {
  showScreen('screen-app');
  $('user-name').textContent = state.user.name;
  $('user-email').textContent = state.user.email;
  $('user-avatar').textContent = avatar(state.user.name);
  await loadProjects();
  showDashboard();
}

async function loadProjects() {
  try {
    const data = await api.getProjects();
    state.projects = toArray(data);
  } catch {
    state.projects = [];
  }
}

/* =====================================================
   DASHBOARD
   ===================================================== */
function greetingByHour() {
  const h = new Date().getHours();
  if (h < 5)  return 'Доброї ночі';
  if (h < 12) return 'Доброго ранку';
  if (h < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

async function showDashboard() {
  showView('dashboard');
  await loadProjects();

  $('greeting').textContent = `${greetingByHour()}, ${state.user?.name || 'друже'}`;
  $('today-label').textContent = new Date().toLocaleDateString('uk-UA',
    { weekday: 'long', day: 'numeric', month: 'long' });

  $('stat-projects').textContent = state.projects.length;

  // Збираємо стати + сьогоднішні задачі по всіх проектах (до 10)
  let totalActive = 0, totalDone = 0, totalOverdue = 0;
  const todayTasks = [];
  const today = startOfDay(new Date());

  for (const p of state.projects.slice(0, 10)) {
    try {
      const data = await api.getTasks(p.id, { pageSize: 100 });
      const tasks = toArray(data.tasks !== undefined ? data.tasks : data);
      tasks.forEach(t => {
        if (t.status === 'DONE') totalDone++;
        else totalActive++;
        if (isOverdue(t.dueDate) && t.status !== 'DONE') totalOverdue++;
        if (t.dueDate) {
          const due = startOfDay(t.dueDate);
          if (due.getTime() === today.getTime() && t.status !== 'DONE') {
            todayTasks.push({ ...t, projectName: p.name });
          }
        }
      });
    } catch {}
  }

  $('stat-tasks-active').textContent = totalActive;
  $('stat-tasks-done').textContent = totalDone;
  $('stat-tasks-overdue').textContent = totalOverdue;

  // Сьогодні
  const todayList = $('dashboard-today');
  todayList.innerHTML = '';
  $('today-count').textContent = todayTasks.length ? `${todayTasks.length} зад.` : 'нічого';
  if (!todayTasks.length) {
    todayList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">☀</div><div class="empty-state-text">На сьогодні нічого не запланованo.</div></div>`;
  } else {
    todayTasks.slice(0, 8).forEach(t => todayList.appendChild(taskRow(t, true)));
  }

  // Нещодавні проєкти
  const grid = $('dashboard-projects');
  grid.innerHTML = '';
  if (!state.projects.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">·</div><div class="empty-state-text">Немає проєктів. Створи перший.</div></div>`;
  } else {
    state.projects.slice(0, 5).forEach(p => grid.appendChild(projectCard(p)));
  }
}

function projectCard(p) {
  const card = el('div', 'project-card');
  card.innerHTML = `
    <div class="project-card-main">
      <div class="project-card-name">${esc(p.name)}</div>
      <div class="project-card-desc">${esc(p.description || 'Без опису')}</div>
    </div>
    <div class="project-card-meta">
      <span>${formatDate(p.createdAt)}</span>
      <span class="project-card-badge">${p._count?.tasks ?? 0} зад.</span>
    </div>`;
  card.onclick = () => openProject(p.id);
  return card;
}

/* =====================================================
   PROJECTS VIEW
   ===================================================== */
async function showProjects() {
  showView('projects');
  await loadProjects();
  const list = $('projects-list');
  list.innerHTML = '';
  if (!state.projects.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">·</div><div class="empty-state-text">Немає проєктів</div></div>`;
    return;
  }
  state.projects.forEach(p => list.appendChild(projectCard(p)));
}

function modalNewProject() {
  openModal('Новий проєкт', `
    <div class="field"><label>Назва</label><input id="m-proj-name" placeholder="Назва проєкту" /></div>
    <div class="field"><label>Опис</label><textarea id="m-proj-desc" placeholder="Що це за проєкт?"></textarea></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="m-proj-cancel">Скасувати</button>
      <button class="btn-primary" id="m-proj-submit">Створити</button>
    </div>`);
  $('m-proj-name').focus();
  $('m-proj-cancel').onclick = closeModal;
  $('m-proj-submit').onclick = async () => {
    const name = $('m-proj-name').value.trim();
    if (!name) return showToast('Введи назву', 'error');
    const payload = { name };
    const desc = $('m-proj-desc').value.trim();
    if (desc) payload.description = desc;
    try {
      await api.createProject(payload);
      closeModal();
      showToast('Проєкт створено');
      await loadProjects();
      showProjects();
    } catch (ex) { showToast(ex.message, 'error'); }
  };
}
$('btn-new-project').onclick = modalNewProject;

/* =====================================================
   PROJECT DETAIL
   ===================================================== */
async function openProject(id) {
  showView('project-detail');
  // Reset filters and mode
  state.filterPriority = '';
  state.filterStatus = '';
  state.viewMode = 'list';
  $('filter-priority').value = '';
  $('filter-status').value = '';
  setMode('list');

  try {
    const p = await api.getProject(id);
    state.currentProject = p;
    $('project-detail-title').textContent = p.name;
    $('project-detail-meta').innerHTML = `
      ${p.description ? `<div class="meta-chip">${esc(p.description)}</div>` : ''}
      <div class="meta-chip">створено ${formatDate(p.createdAt)}</div>`;
    await loadTasks(id);
  } catch (ex) { showToast(ex.message, 'error'); }
}

async function loadTasks(projectId) {
  try {
    const data = await api.getTasks(projectId, { pageSize: 100 });
    state.currentTasks = toArray(data.tasks !== undefined ? data.tasks : data);
    renderMode();
  } catch (ex) { showToast(ex.message, 'error'); }
}

function filteredTasks() {
  return state.currentTasks.filter(t => {
    if (state.filterPriority && t.priority !== state.filterPriority) return false;
    if (state.filterStatus && t.status !== state.filterStatus) return false;
    return true;
  });
}

function setMode(mode) {
  state.viewMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.querySelectorAll('.mode-pane').forEach(p => p.classList.remove('active'));
  const pane = $('mode-' + mode);
  if (pane) pane.classList.add('active');
  renderMode();
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.onclick = () => setMode(btn.dataset.mode);
});
$('filter-priority').onchange = e => { state.filterPriority = e.target.value; renderMode(); };
$('filter-status').onchange   = e => { state.filterStatus   = e.target.value; renderMode(); };

function renderMode() {
  if (state.viewMode === 'list') renderList();
  else if (state.viewMode === 'board') renderBoard();
  else if (state.viewMode === 'calendar') renderProjectCalendar();
}

/* ─── List mode ─── */
function renderList() {
  const body = $('task-list-body');
  body.innerHTML = '';
  const tasks = filteredTasks();
  if (!tasks.length) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-text">Немає задач за обраними фільтрами</div></div>`;
    return;
  }
  // Сортуємо: невиконані за пріоритетом, потім done
  const prioOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  tasks.sort((a, b) => {
    if ((a.status === 'DONE') !== (b.status === 'DONE')) return a.status === 'DONE' ? 1 : -1;
    return (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9);
  });
  tasks.forEach(t => body.appendChild(taskRow(t)));
}

function taskRow(t, compact = false) {
  const row = el('div', 'task-row' + (t.status === 'DONE' ? ' done' : ''));
  const overdue = isOverdue(t.dueDate) && t.status !== 'DONE';
  const checked = t.status === 'DONE' ? 'checked' : '';
  row.innerHTML = `
    <div class="task-check ${checked}" data-act="toggle"></div>
    <div class="task-row-title">${esc(t.title)}${t.projectName ? ` <span style="color:var(--ink-3);font-size:var(--fs-xs)">· ${esc(t.projectName)}</span>` : ''}</div>
    ${compact ? '' : `<div><span class="priority-badge priority-${t.priority}">${priorityLabel(t.priority)}</span></div>`}
    ${compact ? '' : `<div class="task-row-meta">${t.assignee ? `<span class="assignee-avatar">${avatar(t.assignee.name)}</span>${esc(t.assignee.name)}` : '—'}</div>`}
    <div class="task-row-meta ${overdue ? 'overdue' : ''}">${t.dueDate ? formatDateShort(t.dueDate) : '—'}</div>
    ${compact ? '' : `<div><span class="status-badge status-${t.status}">${statusLabel(t.status)}</span></div>`}`;
  // Click toggle
  row.querySelector('[data-act="toggle"]').onclick = async (e) => {
    e.stopPropagation();
    const newStatus = t.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      await api.updateTask(t.id, { status: newStatus });
      // Refresh in place
      t.status = newStatus;
      if (state.currentProject) await loadTasks(state.currentProject.id);
      else showDashboard();
    } catch (ex) { showToast(ex.message, 'error'); }
  };
  row.onclick = () => openTask(t.id);
  return row;
}

function priorityLabel(p) { return { LOW: 'Низький', MEDIUM: 'Середній', HIGH: 'Високий', URGENT: 'Терміновий' }[p] || p; }
function statusLabel(s)   { return { TODO: 'Todo', IN_PROGRESS: 'В процесі', IN_REVIEW: 'На перевірці', DONE: 'Готово' }[s] || s; }

/* ─── Quick add ─── */
$('quick-task-input').addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  const title = e.target.value.trim();
  if (!title || !state.currentProject) return;
  const payload = { title };
  try {
    await api.createTask(state.currentProject.id, payload);
    e.target.value = '';
    showToast('Задачу додано');
    await loadTasks(state.currentProject.id);
  } catch (ex) { showToast(ex.message, 'error'); }
});

/* ─── Board mode ─── */
function renderBoard() {
  VALID_STATUSES.forEach(s => {
    $('col-' + s).innerHTML = '';
    $('count-' + s).textContent = '0';
  });
  const tasks = filteredTasks();
  const counts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  tasks.forEach(t => {
    const col = $('col-' + t.status);
    if (col) { col.appendChild(taskCard(t)); counts[t.status]++; }
  });
  Object.entries(counts).forEach(([s, c]) => { $('count-' + s).textContent = c; });
  setupDragDrop();
}

function taskCard(t) {
  const card = el('div', 'task-card');
  const overdue = isOverdue(t.dueDate) && t.status !== 'DONE';
  card.setAttribute('draggable', 'true');
  card.dataset.taskId = t.id;
  card.innerHTML = `
    <div class="task-card-title">${esc(t.title)}</div>
    <div class="task-card-meta">
      <span class="priority-badge priority-${t.priority}">${priorityLabel(t.priority)}</span>
      ${t.dueDate
        ? `<span class="due-date ${overdue ? 'overdue' : ''}">${overdue ? '⚠ ' : ''}${formatDateShort(t.dueDate)}</span>`
        : '<span class="due-date no-date">без дати</span>'}
    </div>
    ${t.assignee ? `<div class="task-card-assignee"><span class="assignee-avatar">${avatar(t.assignee.name)}</span>${esc(t.assignee.name)}</div>` : ''}`;
  card.onclick = () => openTask(t.id);
  return card;
}

function setupDragDrop() {
  let draggedId = null;
  document.querySelectorAll('#kanban-board .task-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
    });
  });
  document.querySelectorAll('#kanban-board .kanban-cards').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const newStatus = col.closest('.kanban-col').dataset.status;
      if (!draggedId || !newStatus) return;
      try {
        await api.updateTask(draggedId, { status: newStatus });
        showToast('Статус оновлено');
        await loadTasks(state.currentProject.id);
      } catch (ex) { showToast(ex.message, 'error'); }
    });
  });
}

/* ─── Calendar (project) ─── */
function renderProjectCalendar() {
  renderCalendar('project-calendar', 'cal-month', state.projectCalCursor, state.currentTasks);
}
$('cal-prev').onclick = () => {
  state.projectCalCursor = new Date(state.projectCalCursor.getFullYear(), state.projectCalCursor.getMonth() - 1, 1);
  renderProjectCalendar();
};
$('cal-next').onclick = () => {
  state.projectCalCursor = new Date(state.projectCalCursor.getFullYear(), state.projectCalCursor.getMonth() + 1, 1);
  renderProjectCalendar();
};

function renderCalendar(gridId, monthId, cursor, tasks) {
  const root = $(gridId);
  const monthLabel = $(monthId);
  root.innerHTML = '';
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  monthLabel.textContent = cursor.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

  // Header weekdays
  const wd = el('div', 'cal-weekdays');
  ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].forEach(d => {
    const c = el('div', 'cal-weekday', d);
    wd.appendChild(c);
  });
  root.appendChild(wd);

  const grid = el('div', 'cal-grid');

  const first = new Date(y, m, 1);
  // ISO: 0 = Mon. JS getDay: 0 = Sun. Корекція.
  let offset = first.getDay() - 1; if (offset < 0) offset = 6;
  const start = new Date(y, m, 1 - offset);
  const today = startOfDay(new Date());

  // 6 тижнів = 42 комірки
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const outOfMonth = d.getMonth() !== m;
    const isToday = sameDay(d, today);
    const cell = el('div', 'cal-day' + (outOfMonth ? ' out' : '') + (isToday ? ' today' : ''));
    const num = el('div', 'cal-day-num', String(d.getDate()));
    cell.appendChild(num);

    const dayTasks = tasks.filter(t => t.dueDate && sameDay(t.dueDate, d));
    dayTasks.slice(0, 3).forEach(t => {
      const tag = el('div', 'cal-task' + (t.status === 'DONE' ? ' done' : '') + (t.priority === 'URGENT' ? ' urgent' : ''), esc(t.title));
      tag.onclick = (e) => { e.stopPropagation(); openTask(t.id); };
      cell.appendChild(tag);
    });
    if (dayTasks.length > 3) {
      const more = el('div', 'cal-task', `+${dayTasks.length - 3} ще…`);
      more.style.background = 'var(--cream-deep)';
      more.style.color = 'var(--ink-3)';
      more.style.borderLeftColor = 'var(--ink-3)';
      cell.appendChild(more);
    }
    grid.appendChild(cell);
  }
  root.appendChild(grid);
}

/* =====================================================
   PAYLOAD BUILDERS — фікс "Невірні дані запиту"
   ===================================================== */
function buildTaskPayload(form, { isUpdate = false } = {}) {
  const payload = {};
  const title = (form.title || '').trim();
  if (title) payload.title = title;

  if (form.description !== undefined) {
    const d = (form.description || '').trim();
    if (d) payload.description = d;
    else if (isUpdate) payload.description = null;
  }
  if (form.priority && VALID_PRIORITIES.includes(form.priority)) {
    payload.priority = form.priority;
  }
  if (form.status && VALID_STATUSES.includes(form.status)) {
    payload.status = form.status;
  }
  if (form.dueDate) {
    payload.dueDate = form.dueDate;     // YYYY-MM-DD → Zod coerce
  } else if (isUpdate && form.dueDate === null) {
    payload.dueDate = null;
  }
  if (form.assigneeId === null && isUpdate) {
    payload.assigneeId = null;
  } else if (form.assigneeId && UUID_RE.test(form.assigneeId)) {
    payload.assigneeId = form.assigneeId;
  }
  return payload;
}

/* =====================================================
   PROJECT delete
   ===================================================== */
$('btn-back-projects').onclick = showProjects;
$('btn-delete-project').onclick = async () => {
  if (!state.currentProject) return;
  if (!confirm(`Видалити проєкт «${state.currentProject.name}»? Усі задачі будуть втрачені.`)) return;
  try {
    await api.deleteProject(state.currentProject.id);
    showToast('Проєкт видалено');
    state.currentProject = null;
    await loadProjects();
    showProjects();
  } catch (ex) { showToast(ex.message, 'error'); }
};

/* =====================================================
   ASSIGNEE search
   ===================================================== */
function buildAssigneeField(fieldId, currentName = '') {
  return `
    <div class="assignee-search-wrap">
      <input id="${fieldId}" placeholder="Введи нікнейм та обери з підказок…" value="${esc(currentName)}" autocomplete="off" />
      <div class="assignee-hints" id="${fieldId}-hints"></div>
      <div class="assignee-selected" id="${fieldId}-result"></div>
    </div>`;
}

function setupAssigneeSearch(inputId, initialId, onSelect) {
  const input = $(inputId);
  const hints = $(`${inputId}-hints`);
  const result = $(`${inputId}-result`);
  let selectedId = initialId || null;
  let debounceTimer = null;

  if (initialId && input.value) {
    result.innerHTML = `<span class="assignee-chip">✓ ${esc(input.value)}</span>`;
  }

  input.oninput = () => {
    selectedId = null;
    result.innerHTML = '';
    if (onSelect) onSelect(null);
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { hints.innerHTML = ''; return; }
    debounceTimer = setTimeout(async () => {
      try {
        const data = await api.searchUsers(q);
        const users = data.users || [];
        if (!users.length) {
          hints.innerHTML = `<div class="hint-item hint-empty">Користувача не знайдено</div>`;
          return;
        }
        hints.innerHTML = users.map(u =>
          `<div class="hint-item" data-id="${esc(u.id)}" data-name="${esc(u.name)}">${esc(u.name)}</div>`
        ).join('');
        hints.querySelectorAll('.hint-item[data-id]').forEach(item => {
          item.onclick = () => {
            selectedId = item.dataset.id;
            input.value = item.dataset.name;
            hints.innerHTML = '';
            result.innerHTML = `<span class="assignee-chip">✓ ${esc(item.dataset.name)}</span>`;
            if (onSelect) onSelect(selectedId);
          };
        });
      } catch {}
    }, 300);
  };

  return () => selectedId;
}

/* =====================================================
   NEW TASK
   ===================================================== */
function openNewTaskModal(projectId, projectName) {
  openModal(`Нова задача · ${projectName || ''}`, `
    <div class="field"><label>Назва</label><input id="m-task-title" placeholder="Що потрібно зробити?" /></div>
    <div class="field"><label>Опис</label><textarea id="m-task-desc" placeholder="Деталі (необов'язково)"></textarea></div>
    <div class="field"><label>Пріоритет</label>
      <select id="m-task-priority">
        <option value="LOW">Низький</option>
        <option value="MEDIUM" selected>Середній</option>
        <option value="HIGH">Високий</option>
        <option value="URGENT">Терміновий</option>
      </select>
    </div>
    <div class="field"><label>Виконавець</label>${buildAssigneeField('m-task-assignee')}</div>
    <div class="field"><label>Дедлайн</label><input type="date" id="m-task-due" /></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="m-task-cancel">Скасувати</button>
      <button class="btn-primary" id="m-task-submit">Створити</button>
    </div>`);
  $('m-task-title').focus();
  $('m-task-cancel').onclick = closeModal;
  const getAssigneeId = setupAssigneeSearch('m-task-assignee');

  $('m-task-submit').onclick = async () => {
    const title = $('m-task-title').value.trim();
    if (!title) return showToast('Введи назву задачі', 'error');

    // Розв'язуємо assigneeId
    const inputVal = $('m-task-assignee').value.trim();
    let assigneeId = getAssigneeId();
    if (inputVal && !assigneeId) {
      try {
        const data = await api.searchUsers(inputVal);
        const exact = (data.users || []).find(u => u.name.toLowerCase() === inputVal.toLowerCase());
        if (!exact) return showToast('Користувача з таким ніком не знайдено — обери з підказок', 'error');
        assigneeId = exact.id;
      } catch { return showToast('Помилка пошуку виконавця', 'error'); }
    }

    const payload = buildTaskPayload({
      title,
      description: $('m-task-desc').value,
      priority: $('m-task-priority').value,
      dueDate: $('m-task-due').value,
      assigneeId,
    });

    try {
      await api.createTask(projectId, payload);
      closeModal();
      showToast('Задачу створено');
      if (state.currentProject && state.currentProject.id === projectId) {
        await loadTasks(projectId);
      }
    } catch (ex) { showToast(ex.message, 'error'); }
  };
}

$('btn-new-task').onclick = () => {
  if (!state.currentProject) return;
  openNewTaskModal(state.currentProject.id, state.currentProject.name);
};

/* Quick-add з топбару — обираємо проект */
$('btn-quick-add').onclick = async () => {
  if (!state.projects.length) await loadProjects();
  if (!state.projects.length) {
    showToast('Спочатку створи проєкт', 'error');
    return;
  }
  const opts = state.projects.map(p =>
    `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  openModal('Швидке додавання', `
    <div class="field"><label>Проєкт</label><select id="qa-project">${opts}</select></div>
    <div class="field"><label>Назва задачі</label><input id="qa-title" placeholder="Що зробити?" /></div>
    <div class="field"><label>Пріоритет</label>
      <select id="qa-priority">
        <option value="LOW">Низький</option>
        <option value="MEDIUM" selected>Середній</option>
        <option value="HIGH">Високий</option>
        <option value="URGENT">Терміновий</option>
      </select>
    </div>
    <div class="field"><label>Дедлайн</label><input type="date" id="qa-due" /></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="qa-cancel">Скасувати</button>
      <button class="btn-primary" id="qa-submit">Додати</button>
    </div>`);
  $('qa-title').focus();
  $('qa-cancel').onclick = closeModal;
  $('qa-submit').onclick = async () => {
    const title = $('qa-title').value.trim();
    if (!title) return showToast('Введи назву задачі', 'error');
    const payload = buildTaskPayload({
      title,
      priority: $('qa-priority').value,
      dueDate: $('qa-due').value,
    });
    try {
      await api.createTask($('qa-project').value, payload);
      closeModal();
      showToast('Задачу додано');
    } catch (ex) { showToast(ex.message, 'error'); }
  };
};

/* =====================================================
   TASK DETAIL
   ===================================================== */
async function openTask(id) {
  showView('task-detail');
  try {
    const t = await api.getTask(id);
    state.currentTask = t;
    renderTaskDetail(t);
    await loadComments(id);
  } catch (ex) { showToast(ex.message, 'error'); }
}

function renderTaskDetail(t) {
  const overdue = isOverdue(t.dueDate) && t.status !== 'DONE';
  $('task-detail-title').textContent = t.title;
  $('task-detail-desc').textContent = t.description || 'Без опису';
  $('task-status-row').innerHTML = `
    <span class="status-badge status-${t.status}">${statusLabel(t.status)}</span>
    <span class="priority-badge priority-${t.priority}">${priorityLabel(t.priority)}</span>`;
  $('task-detail-meta').innerHTML = `
    <div class="meta-item"><div class="meta-item-label">Дедлайн</div><div class="meta-item-value ${overdue ? 'overdue-text' : ''}">${overdue ? '⚠ ' : ''}${formatDate(t.dueDate)}</div></div>
    <div class="meta-item"><div class="meta-item-label">Статус</div><div class="meta-item-value">${statusLabel(t.status)}</div></div>
    <div class="meta-item"><div class="meta-item-label">Виконавець</div><div class="meta-item-value">${esc(t.assignee?.name || '—')}</div></div>
    <div class="meta-item"><div class="meta-item-label">Автор</div><div class="meta-item-value">${esc(t.createdBy?.name || t.creator?.name || '—')}</div></div>`;

  // Status buttons
  const row = $('status-change-row');
  row.innerHTML = '<div class="status-change-label">Перевести у:</div>';
  VALID_STATUSES.forEach(s => {
    const btn = el('button', `status-btn${t.status === s ? ' active' : ''}`);
    btn.textContent = statusLabel(s);
    btn.onclick = async () => {
      if (t.status === s) return;
      try {
        const updated = await api.updateTask(t.id, { status: s });
        state.currentTask = { ...t, ...updated };
        renderTaskDetail(state.currentTask);
        showToast('Статус оновлено');
      } catch (ex) { showToast(ex.message, 'error'); }
    };
    row.appendChild(btn);
  });
}

$('btn-back-project').onclick = () => {
  if (state.currentProject) openProject(state.currentProject.id);
  else showProjects();
};
$('btn-delete-task').onclick = async () => {
  if (!state.currentTask) return;
  if (!confirm('Видалити задачу?')) return;
  try {
    await api.deleteTask(state.currentTask.id);
    showToast('Задачу видалено');
    if (state.currentProject) await openProject(state.currentProject.id);
    else showProjects();
  } catch (ex) { showToast(ex.message, 'error'); }
};
$('btn-edit-task-static').onclick = () => { if (state.currentTask) modalEditTask(); };

async function modalEditTask() {
  const t = state.currentTask;
  if (!t) return;
  const dueVal = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';
  const currentAssigneeName = t.assignee?.name || '';
  openModal('Редагувати задачу', `
    <div class="field"><label>Назва</label><input id="m-edit-title" value="${esc(t.title)}" /></div>
    <div class="field"><label>Опис</label><textarea id="m-edit-desc">${esc(t.description || '')}</textarea></div>
    <div class="field"><label>Пріоритет</label>
      <select id="m-edit-priority">
        ${VALID_PRIORITIES.map(p => `<option value="${p}"${t.priority === p ? ' selected' : ''}>${priorityLabel(p)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Виконавець</label>${buildAssigneeField('m-edit-assignee', currentAssigneeName)}</div>
    <div class="field"><label>Дедлайн</label><input type="date" id="m-edit-due" value="${dueVal}" /></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="m-edit-cancel">Скасувати</button>
      <button class="btn-primary" id="m-edit-submit">Зберегти</button>
    </div>`);
  $('m-edit-cancel').onclick = closeModal;
  const getEditAssigneeId = setupAssigneeSearch('m-edit-assignee', t.assigneeId);

  $('m-edit-submit').onclick = async () => {
    const title = $('m-edit-title').value.trim();
    if (!title) return showToast('Введи назву', 'error');

    const inputVal = $('m-edit-assignee').value.trim();
    let assigneeId = getEditAssigneeId();
    if (!inputVal) {
      assigneeId = null;            // явно прибрали виконавця
    } else if (!assigneeId && inputVal !== currentAssigneeName) {
      try {
        const data = await api.searchUsers(inputVal);
        const exact = (data.users || []).find(u => u.name.toLowerCase() === inputVal.toLowerCase());
        if (!exact) return showToast('Користувача з таким ніком не знайдено', 'error');
        assigneeId = exact.id;
      } catch { return showToast('Помилка пошуку виконавця', 'error'); }
    } else if (!assigneeId && inputVal === currentAssigneeName) {
      assigneeId = t.assigneeId;
    }

    const dueRaw = $('m-edit-due').value;
    const payload = buildTaskPayload({
      title,
      description: $('m-edit-desc').value,
      priority: $('m-edit-priority').value,
      dueDate: dueRaw || null,
      assigneeId,
    }, { isUpdate: true });

    try {
      const updated = await api.updateTask(t.id, payload);
      state.currentTask = { ...t, ...updated };
      closeModal();
      renderTaskDetail(state.currentTask);
      showToast('Задачу оновлено');
    } catch (ex) { showToast(ex.message, 'error'); }
  };
}

/* =====================================================
   COMMENTS
   ===================================================== */
async function loadComments(taskId) {
  const list = $('comments-list');
  list.innerHTML = '';
  try {
    const data = await api.getComments(taskId);
    const comments = toArray(data.comments !== undefined ? data.comments : data);
    if (!comments.length) {
      list.innerHTML = `<div class="empty-state" style="padding:18px 0"><div class="empty-state-text">Поки що тиша. Будь першим.</div></div>`;
      return;
    }
    comments.forEach(c => {
      const item = el('div', 'comment-item');
      item.innerHTML = `
        <div class="comment-avatar">${avatar(c.author?.name)}</div>
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">${esc(c.author?.name || '?')}</span>
            <span class="comment-date">${formatDate(c.createdAt)}</span>
          </div>
          <div class="comment-text">${esc(c.content)}</div>
        </div>`;
      list.appendChild(item);
    });
  } catch {}
}

$('btn-add-comment').onclick = async () => {
  const text = $('comment-text').value.trim();
  if (!text || !state.currentTask) return;
  try {
    await api.createComment(state.currentTask.id, text);
    $('comment-text').value = '';
    await loadComments(state.currentTask.id);
    showToast('Коментар додано');
  } catch (ex) { showToast(ex.message, 'error'); }
};

/* =====================================================
   MY TASKS — згрупований список
   ===================================================== */
async function showMyTasks() {
  showView('my-tasks');
  const root = $('my-tasks-groups');
  root.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    await loadProjects();
    const allTasks = [];
    for (const p of state.projects) {
      try {
        const data = await api.getTasks(p.id, { pageSize: 100 });
        const tasks = toArray(data.tasks !== undefined ? data.tasks : data);
        tasks.forEach(t => allTasks.push({ ...t, projectName: p.name }));
      } catch {}
    }

    // Групування
    const groups = {
      overdue:   { title: 'Прострочено',  tasks: [] },
      today:     { title: 'Сьогодні',     tasks: [] },
      thisWeek:  { title: 'Цього тижня',  tasks: [] },
      later:     { title: 'Пізніше',      tasks: [] },
      noDate:    { title: 'Без дати',     tasks: [] },
      done:      { title: 'Виконано',     tasks: [] },
    };
    const today = startOfDay(new Date());
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

    allTasks.forEach(t => {
      if (t.status === 'DONE') { groups.done.tasks.push(t); return; }
      if (!t.dueDate) { groups.noDate.tasks.push(t); return; }
      const due = startOfDay(t.dueDate);
      if (due < today) groups.overdue.tasks.push(t);
      else if (due.getTime() === today.getTime()) groups.today.tasks.push(t);
      else if (due <= weekEnd) groups.thisWeek.tasks.push(t);
      else groups.later.tasks.push(t);
    });

    root.innerHTML = '';
    let hasAny = false;
    Object.values(groups).forEach(g => {
      if (!g.tasks.length) return;
      hasAny = true;
      const block = el('div', 'task-group');
      block.innerHTML = `
        <div class="task-group-head">
          <span class="task-group-title">${esc(g.title)}</span>
          <span class="task-group-count">${g.tasks.length}</span>
        </div>
        <div class="task-group-body"></div>`;
      const body = block.querySelector('.task-group-body');
      g.tasks.forEach(t => body.appendChild(taskRow(t)));
      root.appendChild(block);
    });
    if (!hasAny) {
      root.innerHTML = `<div class="empty-state"><div class="empty-state-icon">·</div><div class="empty-state-text">Немає задач</div></div>`;
    }
  } catch (ex) {
    showToast(ex.message, 'error');
    root.innerHTML = '';
  }
}

/* =====================================================
   GLOBAL CALENDAR
   ===================================================== */
async function showCalendar() {
  showView('calendar');
  await loadProjects();
  const allTasks = [];
  for (const p of state.projects) {
    try {
      const data = await api.getTasks(p.id, { pageSize: 100 });
      const tasks = toArray(data.tasks !== undefined ? data.tasks : data);
      tasks.forEach(t => allTasks.push({ ...t, projectName: p.name }));
    } catch {}
  }
  state.globalAllTasks = allTasks;
  renderCalendar('global-calendar', 'gcal-month', state.globalCalCursor, allTasks);
}
$('gcal-prev').onclick = () => {
  state.globalCalCursor = new Date(state.globalCalCursor.getFullYear(), state.globalCalCursor.getMonth() - 1, 1);
  renderCalendar('global-calendar', 'gcal-month', state.globalCalCursor, state.globalAllTasks || []);
};
$('gcal-next').onclick = () => {
  state.globalCalCursor = new Date(state.globalCalCursor.getFullYear(), state.globalCalCursor.getMonth() + 1, 1);
  renderCalendar('global-calendar', 'gcal-month', state.globalCalCursor, state.globalAllTasks || []);
};

/* =====================================================
   NAV
   ===================================================== */
document.querySelectorAll('.nav-link').forEach(item => {
  item.onclick = () => {
    const view = item.dataset.view;
    if (view === 'dashboard') showDashboard();
    else if (view === 'projects') showProjects();
    else if (view === 'my-tasks') showMyTasks();
    else if (view === 'calendar') showCalendar();
  };
});

/* =====================================================
   AUTO-LOGIN
   ===================================================== */
(async () => {
  if (api.getToken()) {
    try {
      const data = await api.me();
      state.user = data.user || data;
      await initApp();
    } catch { api.setToken(null); }
  }
})();
