let tasks = loadData('tasks', []);
let events = loadData('events', []);
// Historical counter. Rule: a task counts the FIRST time it is completed and never
// decreases (un-checking or deleting does not change it). completionRecorded prevents double counting.
let completedTaskCount = loadData('completedTaskCount', 0);
let taskTab = 'tasks', taskSearch = '', taskFilter = 'all';

function saveTasks() {
  saveData('tasks', tasks); saveData('events', events); saveData('completedTaskCount', completedTaskCount);
}
function dueLabel(item) {
  if (!item.date) return 'No date';
  const t = new Date();
  const label = item.date === getTodayKey() ? 'Today' : item.date === dateKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) ? 'Tomorrow' : formatDate(item.date);
  return label + (item.time ? ' • ' + formatTime(item.time) : '');
}
function byDate(a, b) { return ((a.date || '9999') + (a.time || '')).localeCompare((b.date || '9999') + (b.time || '')); }

// ----- Tasks -----
function openTaskModal(id) {
  const t = tasks.find(x => x.id === id) || { title: '', description: '', date: '', time: '', duration: '', priority: 'medium' };
  const pr = ['low', 'medium', 'high'].map(p => '<option value="' + p + '"' + ((t.priority || 'medium') === p ? ' selected' : '') + '>' + p[0].toUpperCase() + p.slice(1) + '</option>').join('');
  openModal(id ? 'Edit task' : 'Add task',
    '<label for="f_title">Title</label><input id="f_title" name="title" maxlength="80" value="' + esc(t.title) + '">' +
    '<label for="f_desc">Description (optional)</label><textarea id="f_desc" name="description" rows="2" maxlength="200">' + esc(t.description) + '</textarea>' +
    '<div class="row2"><div><label for="f_date">Date</label><input id="f_date" type="date" name="date" value="' + esc(t.date) + '"></div>' +
    '<div><label for="f_time">Time</label><input id="f_time" type="time" name="time" value="' + esc(t.time) + '"></div></div>' +
    '<div class="row2"><div><label for="f_dur">Study minutes</label><input id="f_dur" type="number" name="duration" min="1" placeholder="e.g. 45" value="' + esc(t.duration) + '"></div>' +
    '<div><label for="f_pr">Priority</label><select id="f_pr" name="priority">' + pr + '</select></div></div>',
    fd => {
      const title = fd.get('title').trim(), dur = fd.get('duration');
      if (!title) return modalError('Please enter a task title.');
      if (dur !== '' && !(Number(dur) > 0)) return modalError('Study duration must be greater than zero.');
      const data = { title, description: fd.get('description').trim(), date: fd.get('date'), time: fd.get('time'), duration: dur === '' ? '' : Math.round(Number(dur)), priority: fd.get('priority') };
      const existing = tasks.find(x => x.id === id);
      if (existing) Object.assign(existing, data);   // edit: update, don't duplicate
      else tasks.push(Object.assign({ id: uid(), completed: false, completionRecorded: false, createdAt: new Date().toISOString() }, data));
      saveTasks(); toast(existing ? 'Task updated' : 'Task added'); renderAll();
    });
}
function toggleTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  t.completed = !t.completed;
  if (t.completed && !t.completionRecorded) { t.completionRecorded = true; completedTaskCount++; }
  saveTasks(); renderAll();
}
function deleteTask(id) {
  confirmBox('Delete this task?', 'Delete', () => {
    tasks = tasks.filter(x => x.id !== id); // completedTaskCount stays as is
    saveTasks(); toast('Task deleted'); renderAll();
  });
}
function startTask(id) {
  const t = tasks.find(x => x.id === id);
  if (t) startStudy(t.title, Number(t.duration) > 0 ? Number(t.duration) : 0);
}

// ----- Events -----
function openEventModal(id) {
  const e = events.find(x => x.id === id) || { title: '', description: '', date: '', time: '' };
  openModal(id ? 'Edit event' : 'Add event',
    '<label for="f_title">Title</label><input id="f_title" name="title" maxlength="80" value="' + esc(e.title) + '">' +
    '<label for="f_desc">Description</label><textarea id="f_desc" name="description" rows="2" maxlength="200">' + esc(e.description) + '</textarea>' +
    '<div class="row2"><div><label for="f_date">Date</label><input id="f_date" type="date" name="date" value="' + esc(e.date) + '"></div>' +
    '<div><label for="f_time">Time</label><input id="f_time" type="time" name="time" value="' + esc(e.time) + '"></div></div>',
    fd => {
      const title = fd.get('title').trim(), date = fd.get('date');
      if (!title) return modalError('Please enter an event title.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parseKey(date))) return modalError('Please choose a valid date.');
      const data = { title, description: fd.get('description').trim(), date, time: fd.get('time') };
      const existing = events.find(x => x.id === id);
      if (existing) Object.assign(existing, data);
      else events.push(Object.assign({ id: uid(), createdAt: new Date().toISOString() }, data));
      saveTasks(); toast(existing ? 'Event updated' : 'Event added'); renderAll();
    });
}
function deleteEvent(id) {
  confirmBox('Delete this event?', 'Delete', () => { events = events.filter(x => x.id !== id); saveTasks(); toast('Event deleted'); renderAll(); });
}

// ----- Rendering -----
function actionBtns(editFn, delFn, id) {
  return '<button class="btn sm" onclick="' + editFn + '(\'' + id + '\')" aria-label="Edit">' + icon('edit') + '</button>' +
    '<button class="btn sm" onclick="' + delFn + '(\'' + id + '\')" aria-label="Delete">' + icon('trash') + '</button>';
}
function taskCard(t) {
  const p = t.priority || 'medium';
  return '<article class="item pr-' + p + (t.completed ? ' done' : '') + '"><input type="checkbox" ' + (t.completed ? 'checked' : '') + ' onchange="toggleTask(\'' + t.id + '\')" aria-label="Mark complete">' +
    '<div class="item-body"><h3>' + esc(t.title) + (t.demo ? ' <span class="badge medium">Demo</span>' : '') + '</h3>' + (t.description ? '<p>' + esc(t.description) + '</p>' : '') +
    '<div class="meta"><span>' + dueLabel(t) + '</span>' + (t.duration ? '<span>' + t.duration + ' min study</span>' : '') + '<span class="badge ' + p + '">' + p + '</span></div></div>' +
    '<div class="item-actions"><button class="btn sm" onclick="startTask(\'' + t.id + '\')">' + icon('play') + ' Start Study</button>' + actionBtns('openTaskModal', 'deleteTask', t.id) + '</div></article>';
}
function eventCard(e, past) {
  return '<article class="item' + (past ? ' past' : '') + '"><div class="item-body"><h3>📅 ' + esc(e.title) + (e.demo ? ' <span class="badge medium">Demo</span>' : '') + '</h3>' +
    (e.description ? '<p>' + esc(e.description) + '</p>' : '') + '<div class="meta"><span>' + dueLabel(e) + '</span></div></div><div class="item-actions">' + actionBtns('openEventModal', 'deleteEvent', e.id) + '</div></article>';
}
function emptyBox(title, text) { return '<div class="empty"><strong>' + title + '</strong>' + text + '</div>'; }

function renderTasks() {
  const isT = taskTab === 'tasks';
  $('tasks').innerHTML = '<h1>Task Manager</h1>' +
    '<div class="tabs"><button class="' + (isT ? 'active' : '') + '" onclick="setTaskTab(\'tasks\')">Tasks</button><button class="' + (isT ? '' : 'active') + '" onclick="setTaskTab(\'events\')">Events</button></div>' +
    '<div class="toolbar"><input type="search" placeholder="Search…" aria-label="Search" value="' + esc(taskSearch) + '" oninput="taskSearch=this.value;renderTaskList()">' +
    (isT ? '<select aria-label="Filter by priority" onchange="taskFilter=this.value;renderTaskList()">' + ['all', 'high', 'medium', 'low'].map(p => '<option value="' + p + '"' + (taskFilter === p ? ' selected' : '') + '>' + (p === 'all' ? 'All priorities' : p[0].toUpperCase() + p.slice(1)) + '</option>').join('') + '</select>' : '') +
    '<button class="btn primary" onclick="' + (isT ? 'openTaskModal()' : 'openEventModal()') + '">' + icon('plus') + (isT ? ' Add Task' : ' Add Event') + '</button></div><div id="taskList"></div>';
  renderTaskList();
}
function setTaskTab(t) { taskTab = t; renderTasks(); }

function renderTaskList() {
  const q = taskSearch.trim().toLowerCase(), match = x => (x.title + ' ' + (x.description || '')).toLowerCase().includes(q);
  let html = '';
  if (taskTab === 'tasks') {
    const list = tasks.filter(t => match(t) && (taskFilter === 'all' || (t.priority || 'medium') === taskFilter)).sort(byDate);
    const pending = list.filter(t => !t.completed), done = list.filter(t => t.completed);
    html = '<h2 class="section-title">Pending (' + pending.length + ')</h2>' +
      (pending.length ? pending.map(taskCard).join('') : emptyBox(tasks.length ? 'Nothing pending' : 'No tasks yet', tasks.length ? 'No pending tasks match your filters.' : 'Add your first task to get started.')) +
      (done.length ? '<h2 class="section-title">Completed (' + done.length + ')</h2>' + done.map(taskCard).join('') : '');
  } else {
    const today = getTodayKey(), list = events.filter(match).sort(byDate);
    const up = list.filter(e => e.date >= today), past = list.filter(e => e.date < today).reverse();
    html = '<h2 class="section-title">Upcoming (' + up.length + ')</h2>' +
      (up.length ? up.map(e => eventCard(e, false)).join('') : emptyBox('No upcoming events', 'Add an exam, deadline or class to see it here.')) +
      (past.length ? '<h2 class="section-title">Past</h2>' + past.map(e => eventCard(e, true)).join('') : '');
  }
  $('taskList').innerHTML = html;
}
