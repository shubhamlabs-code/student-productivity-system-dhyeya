// Timing uses Date.now() timestamps, never "subtract 1 each second", so it can't drift
// and can be restored after a refresh.
let timerSettings = Object.assign({ normalSec: 1500, focus: 25, short: 5, long: 15 }, loadData('timerSettings', {}));
let focusHistory = loadData('focusHistory', {});   // { "2026-09-28": secondsFocused }
let T = Object.assign({ mode: 'normal', running: false, startedAt: 0, elapsed: 0, recorded: 0, label: '', phase: 'focus', cycle: 1 }, loadData('timerState', {}));
['normalSec', 'focus', 'short', 'long'].forEach(k => { if (!(timerSettings[k] > 0)) timerSettings[k] = { normalSec: 1500, focus: 25, short: 5, long: 15 }[k]; });

function saveTimer() { saveData('timerState', T); }
function saveTimerSettings() { saveData('timerSettings', timerSettings); }
// elapsed = time from earlier runs + time since the latest Start/Resume
function elapsedMs() { return T.elapsed + (T.running ? Date.now() - T.startedAt : 0); }
function targetSec() {
  if (T.mode === 'normal') return timerSettings.normalSec;
  if (T.mode === 'pomodoro') return timerSettings[T.phase] * 60;
  return 0; // stopwatch counts up
}
function countsAsFocus() { return T.mode !== 'pomodoro' || T.phase === 'focus'; }

// Adds only the time NOT yet recorded (T.recorded), so nothing is counted twice.
function recordFocusTime() {
  if (!countsAsFocus()) return;
  let ms = elapsedMs();
  if (targetSec()) ms = Math.min(ms, targetSec() * 1000);
  const add = Math.floor((ms - T.recorded) / 1000);
  if (add <= 0) return;
  T.recorded += add * 1000;
  const k = getTodayKey();
  focusHistory[k] = (focusHistory[k] || 0) + add;
  saveData('focusHistory', focusHistory);
}

function startTimer() {
  if (T.running) return;
  if (T.mode !== 'stopwatch' && targetSec() <= 0) return toast('Timer must be longer than zero.', true);
  T.running = true; T.startedAt = Date.now(); saveTimer(); renderTimer();
}
function pauseTimer() {
  if (!T.running) return;
  recordFocusTime();           // paused time is never counted
  T.elapsed = elapsedMs(); T.running = false; saveTimer(); renderTimer();
}
function resetTimer() {
  recordFocusTime();
  T.running = false; T.elapsed = 0; T.recorded = 0; T.label = '';
  if (T.mode === 'pomodoro') { T.phase = 'focus'; T.cycle = 1; }
  saveTimer(); renderTimer();
}
function nextPhase(keepRunning) {
  recordFocusTime();
  if (T.phase === 'focus') T.phase = (T.cycle % 4 === 0) ? 'long' : 'short';
  else { T.cycle = T.phase === 'long' ? 1 : T.cycle + 1; T.phase = 'focus'; }
  T.elapsed = 0; T.recorded = 0; T.startedAt = Date.now(); T.running = keepRunning;
  saveTimer(); renderTimer();
}
function skipPhase() { nextPhase(T.running); }

function completeTimer() {
  beep();
  if (T.mode === 'pomodoro') { toast(T.phase === 'focus' ? 'Focus done — time for a break' : 'Break over — back to focus'); nextPhase(true); return; }
  recordFocusTime();
  T.running = false; T.elapsed = 0; T.recorded = 0; T.label = '';
  saveTimer(); toast('Study session completed'); renderTimer(); renderDashboard();
}

function setMode(m) {
  if (T.mode === m) return;
  resetTimer(); T.mode = m; saveTimer(); renderTimer();
}
// Used by the dashboard and by each task's "Start Study" button
function startStudy(label, minutes) {
  if (T.running || T.elapsed > 0) resetTimer();
  T.mode = 'normal';
  if (minutes > 0) { timerSettings.normalSec = Math.round(minutes * 60); saveTimerSettings(); }
  T.label = label || ''; T.running = true; T.startedAt = Date.now(); saveTimer();
  showSection('timer');
}
function setDefaultMinutes(v) {
  const m = Number(v);
  if (!(m > 0)) { toast('Duration must be greater than zero.', true); return renderDashboard(); }
  timerSettings.normalSec = Math.round(m * 60); saveTimerSettings(); renderTimer();
}
function setNormalTime() {
  const sec = (+$('in_h').value || 0) * 3600 + (+$('in_m').value || 0) * 60 + (+$('in_s').value || 0);
  if (sec <= 0) { toast('Enter a time greater than zero.', true); return renderTimer(); }
  timerSettings.normalSec = sec; saveTimerSettings(); renderTimer();
}
function setPomodoro() {
  const f = +$('in_f').value, s = +$('in_sb').value, l = +$('in_lb').value;
  if (!(f > 0 && s > 0 && l > 0)) { toast('Pomodoro durations must be greater than zero.', true); return renderTimer(); }
  Object.assign(timerSettings, { focus: f, short: s, long: l }); saveTimerSettings(); renderTimer();
}

function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); g.gain.value = 0.05; o.frequency.value = 660;
    o.start(); o.stop(c.currentTime + 0.4);
  } catch (e) {}
}

function clockText(sec, forceHours) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h || forceHours ? pad(h) + ':' : '') + pad(m) + ':' + pad(s);
}
function totalFocusSec() { return Object.values(focusHistory).reduce((a, b) => a + b, 0); }

// Runs 4x per second: only updates numbers, so the page isn't re-rendered
function updateClock() {
  const el = elapsedMs(), t = targetSec();
  if (T.running && T.mode !== 'stopwatch' && el >= t * 1000) return completeTimer();
  const sec = T.mode === 'stopwatch' ? Math.floor(el / 1000) : Math.max(0, Math.ceil((t * 1000 - el) / 1000));
  $('clock').textContent = clockText(sec, T.mode === 'stopwatch');
  $('ring').style.setProperty('--p', T.mode === 'stopwatch' ? (el % 60000) / 600 : Math.min(100, el / (t * 10)));
  if (T.running) document.title = clockText(sec) + ' · Study Timer'; else document.title = 'Student Productivity Dashboard';
}

function numField(label, id, val, fn, disabled) {
  return '<div><label for="' + id + '">' + label + '</label><input id="' + id + '" type="number" min="0" value="' + val + '" onchange="' + fn + '"' + (disabled ? ' disabled' : '') + '></div>';
}
function renderTimer() {
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === T.mode));
  const idle = !T.running && T.elapsed === 0, s = timerSettings, isP = T.mode === 'pomodoro';
  $('btnStart').hidden = !idle; $('btnResume').hidden = T.running || idle; $('btnPause').hidden = !T.running; $('btnSkip').hidden = !isP;
  $('sessionLabel').textContent = T.label ? 'Studying: ' + T.label : '';
  $('phaseLabel').textContent = isP ? { focus: 'FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' }[T.phase] : T.mode === 'normal' ? 'TIMER' : 'STOPWATCH';
  $('cycleLabel').textContent = isP ? 'Session ' + (T.phase === 'long' ? 4 : T.cycle) + ' of 4' : '';
  $('timeInputs').innerHTML =
    T.mode === 'normal' ? numField('Hours', 'in_h', Math.floor(s.normalSec / 3600), 'setNormalTime()', !idle) + numField('Minutes', 'in_m', Math.floor(s.normalSec % 3600 / 60), 'setNormalTime()', !idle) + numField('Seconds', 'in_s', s.normalSec % 60, 'setNormalTime()', !idle) :
    isP ? numField('Focus min', 'in_f', s.focus, 'setPomodoro()', !idle) + numField('Short break', 'in_sb', s.short, 'setPomodoro()', !idle) + numField('Long break', 'in_lb', s.long, 'setPomodoro()', !idle) : '';
  $('todayFocus').textContent = formatDuration(focusHistory[getTodayKey()] || 0);
  $('allFocus').textContent = formatDuration(totalFocusSec());
  // last 7 days as simple CSS bars
  const days = [], now = new Date();
  for (let i = 0; i < 7; i++) { const k = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)); days.push([k, focusHistory[k] || 0]); }
  const max = Math.max(1, ...days.map(d => d[1]));
  $('history').innerHTML = totalFocusSec() === 0 ? emptyBox('No study sessions recorded', 'Start a timer and your focus time will appear here.') :
    days.map((d, i) => '<div class="bar-row"><span>' + (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDate(d[0])) + '</span><div class="bar"><i style="width:' + d[1] / max * 100 + '%"></i></div><span>' + formatDuration(d[1]) + '</span></div>').join('');
  updateClock();
}
setInterval(updateClock, 250);
