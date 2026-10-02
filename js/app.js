let settings = loadData('settings', { theme: 'light' });

const QUOTES = [
  'Consistency beats intensity.', 'Small progress adds up.', 'Start where you are.', 'Done is better than perfect.',
  'Focus on the next step.', 'Discipline is remembering what you want.', 'One page at a time.', 'Future you will say thanks.',
  'Progress, not perfection.', 'Show up today.', 'Hard work compounds.', 'Difficult does not mean impossible.',
  'Learn something new today.', 'Rest is part of the plan.', 'Begin, and the rest follows.', 'Youre closer than you think.',
  'Make today count.', 'Slow progress is still progress.', 'Study now, relax later.', 'Every expert was once a beginner.',
  'Stay curious.', 'Do it for the version of you who graduates.', 'Fifteen focused minutes beat an hour of distraction.',
  'Mistakes are proof you are trying.', 'Your effort today is tomorrow\'s result.'
];

function showSection(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  renderAll();
  window.scrollTo(0, 0);
}

function applyTheme() {
  const dark = settings.theme === 'dark';
  document.body.classList.toggle('dark-mode', dark);
  $('themeBtn').innerHTML = icon(dark ? 'sun' : 'moon');
}
function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  saveData('settings', settings); applyTheme();
}

function renderDashboard() {
  const now = new Date(), today = getTodayKey(), h = now.getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const todayRec = attendance[today], stats = getAttendanceStats(), ct = classesToTarget();
  const todays = tasks.filter(t => t.date === today).sort(byDate);
  const pending = tasks.filter(t => !t.completed).length;
  const upcoming = events.filter(e => e.date >= today).sort(byDate).slice(0, 4);
  // Same quote all day: the day number picks the array index
  const quote = QUOTES[Math.round(parseKey(today).getTime() / 864e5) % QUOTES.length];

  const attBody = !todayRec
    ? '<div class="btn-row"><button class="btn primary" onclick="openAttendanceModal(\'' + today + '\')">Mark Attendance</button><button class="btn holiday" onclick="markHoliday(\'' + today + '\')">Holiday</button></div>'
    : todayRec.holiday
      ? '<div class="status-big"><span class="pill holiday">Holiday</span></div><div class="btn-row"><button class="btn" onclick="openAttendanceModal(\'' + today + '\')">Change Status</button></div>'
      : '<div class="status-big">' + todayRec.attended + ' / ' + todayRec.total + ' classes</div><div class="btn-row"><button class="btn" onclick="openAttendanceModal(\'' + today + '\')">Change Status</button></div>';

  $('home').innerHTML =
    '<h1>' + greet + ', Student 👋</h1><p class="muted">' + now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + ' · Stay consistent. Small progress adds up.</p>' +
    '<div class="grid3">' +
    '<div class="card"><h2>Today\'s Attendance</h2><p class="muted">' + formatDate(today) + '</p>' + attBody + '</div>' +
    '<div class="card"><h2>Quick Add</h2><p class="muted">Capture something before you forget it.</p><div class="btn-row"><button class="btn primary" onclick="openTaskModal()">' + icon('plus') + ' Add Task</button><button class="btn" onclick="openEventModal()">' + icon('plus') + ' Add Event</button></div>' +
    '<div class="btn-row"><button class="btn sm" onclick="showSection(\'tasks\')">Open Task Manager</button></div></div>' +
    '<div class="card"><h2>Ready to focus?</h2><label for="quickMin" style="margin-top:0">Session length (minutes)</label><input id="quickMin" type="number" min="1" value="' + Math.round(timerSettings.normalSec / 60) + '" onchange="setDefaultMinutes(this.value)">' +
    '<div class="btn-row"><button class="btn primary" onclick="startStudy(\'\',0)">' + icon('play') + ' Start Study Session</button></div></div></div>' +
    '<div class="stats">' +
    '<div class="card stat"><span class="muted">Pending tasks</span><strong>' + pending + '</strong><span class="muted">' + todays.length + ' due today</span></div>' +
    '<div class="card stat"><span class="muted">Today\'s focus</span><strong>' + formatDuration(focusHistory[today] || 0) + '</strong><span class="muted">All time ' + formatDuration(totalFocusSec()) + '</span></div>' +
    '<div class="card stat"><span class="muted">Attendance</span><strong>' + (stats.pct !== null ? stats.pct.toFixed(1) + '%' : '–') + '</strong><span class="muted">' + (stats.pct === null ? 'No attendance data yet' : ct.metTarget ? 'Meeting your ' + attSettings.targetPct + '% target' : 'Need ' + (ct.need === Infinity ? 'more than future classes can give' : ct.need + ' more class' + (ct.need === 1 ? '' : 'es')) + ' for ' + attSettings.targetPct + '%') + '</span></div>' +
    '<div class="card stat"><span class="muted">Total completed</span><strong>' + completedTaskCount + '</strong><span class="muted">Includes deleted tasks</span></div></div>' +
    '<div class="grid2"><div class="card"><h2>Today\'s Tasks</h2>' +
    (todays.length ? todays.map(t => '<div class="item ' + (t.completed ? 'done' : '') + '"><input type="checkbox" ' + (t.completed ? 'checked' : '') + ' onchange="toggleTask(\'' + t.id + '\')" aria-label="Mark complete"><div class="item-body"><h3>' + esc(t.title) + '</h3><div class="meta">' + dueLabel(t) + '</div></div></div>').join('') : emptyBox('Nothing due today', 'Add a task with today\'s date to see it here.')) +
    '</div><div class="card"><h2>Upcoming Events</h2>' +
    (upcoming.length ? upcoming.map(e => '<div class="item"><div class="item-body"><h3>📅 ' + esc(e.title) + '</h3><div class="meta">' + dueLabel(e) + '</div></div></div>').join('') : emptyBox('No upcoming events', 'Exams and deadlines you add will show up here.')) +
    '</div></div><div class="card quote">“' + esc(quote) + '”</div>';
}

function renderAll() { renderDashboard(); renderAttendance(); renderTasks(); renderTimer(); }

// ----- Settings -----
function openSettings() {
  const s = timerSettings;
  openModal('Settings',
    '<label for="s_theme">Theme</label><select id="s_theme" name="theme"><option value="light"' + (settings.theme === 'light' ? ' selected' : '') + '>Light</option><option value="dark"' + (settings.theme === 'dark' ? ' selected' : '') + '>Dark</option></select>' +
    '<label for="s_norm">Default timer (minutes)</label><input id="s_norm" type="number" name="normal" min="1" value="' + Math.round(s.normalSec / 60) + '">' +
    '<div class="row2"><div><label for="s_f">Pomodoro focus</label><input id="s_f" type="number" name="focus" min="1" value="' + s.focus + '"></div><div><label for="s_s">Short break</label><input id="s_s" type="number" name="short" min="1" value="' + s.short + '"></div></div>' +
    '<label for="s_l">Long break</label><input id="s_l" type="number" name="long" min="1" value="' + s.long + '">' +
    '<div class="btn-row"><button type="button" class="btn" onclick="loadDemoData()">Load Demo Data</button><button type="button" class="btn danger" onclick="clearAllData()">Clear All Data</button></div>',
    fd => {
      const n = +fd.get('normal'), f = +fd.get('focus'), sb = +fd.get('short'), l = +fd.get('long');
      if (!(n > 0 && f > 0 && sb > 0 && l > 0)) return modalError('All durations must be greater than zero.');
      if (T.running || T.elapsed > 0) resetTimer();
      Object.assign(timerSettings, { normalSec: Math.round(n * 60), focus: f, short: sb, long: l }); saveTimerSettings();
      settings.theme = fd.get('theme'); saveData('settings', settings); applyTheme();
      toast('Settings saved'); renderAll();
    });
}
function loadDemoData() {
  const t = getTodayKey(), tm = dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2));
  const mk = (title, description, date, time, duration, priority) => ({ id: uid(), title, description, date, time, duration, priority, completed: false, completionRecorded: false, createdAt: new Date().toISOString(), demo: true });
  tasks.push(mk('Complete DBMS assignment', 'Revise normalization and solve previous year questions.', t, '19:00', 45, 'high'), mk('Read chapter 4', 'Operating systems notes.', t, '', 25, 'medium'));
  events.push({ id: uid(), title: 'DBMS mid-semester exam', description: 'Units 1–3', date: tm, time: '10:00', createdAt: new Date().toISOString(), demo: true });
  saveTasks(); closeModal(); toast('Demo data loaded (marked "Demo")'); renderAll();
}
function clearAllData() {
  confirmBox('This will permanently delete all tasks, attendance records, events, and focus history from this browser.', 'Delete everything', () => {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    location.reload();
  });
}

// ----- Start up -----
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => showSection(b.dataset.view)));
applyTheme();
renderAll();
