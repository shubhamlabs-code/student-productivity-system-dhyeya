// Each date maps to how many classes were held that day and how many were attended:
// { holiday: false, total: 4, attended: 3 }. A holiday day has holiday:true and no counts.
let attendance = loadData('attendance', {});
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let attSettings = Object.assign({ defaultClasses: 1, targetPct: 75 }, loadData('attendanceSettings', {}));

// One-time migration from the old "present"/"absent"/"holiday" string format
(function migrateAttendance() {
  let changed = false;
  Object.keys(attendance).forEach(k => {
    const v = attendance[k];
    if (typeof v === 'string') {
      attendance[k] = v === 'holiday' ? { holiday: true, total: 0, attended: 0 }
        : v === 'present' ? { holiday: false, total: attSettings.defaultClasses, attended: attSettings.defaultClasses }
        : { holiday: false, total: attSettings.defaultClasses, attended: 0 };
      changed = true;
    }
  });
  if (changed) saveData('attendance', attendance);
})();

function saveAttendance() { saveData('attendance', attendance); }
function saveAttSettings() { saveData('attendanceSettings', attSettings); }

function dayStatusClass(rec) {
  if (!rec) return '';
  if (rec.holiday) return 'holiday';
  if (!rec.total) return '';
  if (rec.attended <= 0) return 'absent';
  if (rec.attended >= rec.total) return 'present';
  return 'partial';
}

function markHoliday(key) {
  attendance[key] = { holiday: true, total: 0, attended: 0 };
  saveAttendance(); toast('Marked holiday'); closeModal(); renderAll();
}
function clearAttendance(key) {
  delete attendance[key]; saveAttendance(); toast('Status cleared'); closeModal(); renderAll();
}
function saveClassAttendance(key, total, attended) {
  attendance[key] = { holiday: false, total, attended };
  saveAttendance(); renderAll();
}

function updateDefaultClasses(v) {
  const n = Math.round(Number(v));
  if (!(n > 0)) { toast('Default classes must be at least 1.', true); return renderAttendance(); }
  attSettings.defaultClasses = n; saveAttSettings(); toast('Default classes updated'); renderAttendance();
}
function updateTargetPct(v) {
  const n = Math.round(Number(v));
  if (!(n > 0 && n <= 100)) { toast('Target must be between 1 and 100.', true); return renderAttendance(); }
  attSettings.targetPct = n; saveAttSettings(); toast('Target updated'); renderAttendance();
}

function getAttendanceStats() {
  let totalClasses = 0, attendedClasses = 0, holidays = 0;
  Object.values(attendance).forEach(r => {
    if (r.holiday) { holidays++; return; }
    if (r.total > 0) { totalClasses += r.total; attendedClasses += r.attended; }
  });
  const pct = totalClasses > 0 ? (attendedClasses / totalClasses * 100) : null;
  return { totalClasses, attendedClasses, missed: totalClasses - attendedClasses, holidays, pct };
}

// How many more classes (attended in a row) are needed to reach the target, or how many
// can still be missed while staying at/above it — assuming future classes count 1-for-1.
function classesToTarget() {
  const s = getAttendanceStats(), target = attSettings.targetPct;
  if (s.totalClasses === 0) return { none: true };
  if (s.pct >= target) {
    const canMiss = target >= 100 ? 0 : Math.floor((100 * s.attendedClasses - target * s.totalClasses) / target);
    return { metTarget: true, canMiss: Math.max(0, canMiss) };
  }
  if (target >= 100) return { metTarget: false, need: Infinity };
  const need = Math.ceil((target * s.totalClasses - 100 * s.attendedClasses) / (100 - target));
  return { metTarget: false, need: Math.max(0, need) };
}
function targetMessage(ct) {
  if (ct.none) return '';
  if (ct.metTarget) return ct.canMiss > 0
    ? 'You can miss ' + ct.canMiss + ' more class' + (ct.canMiss === 1 ? '' : 'es') + ' and stay at or above ' + attSettings.targetPct + '%.'
    : 'Missing even one more class will drop you below ' + attSettings.targetPct + '%.';
  return ct.need === Infinity
    ? 'A ' + attSettings.targetPct + '% target can\'t be hit by attending future classes alone.'
    : 'Attend the next ' + ct.need + ' class' + (ct.need === 1 ? '' : 'es') + ' in a row to reach ' + attSettings.targetPct + '%.';
}

function openAttendanceModal(key) {
  const rec = attendance[key], def = attSettings.defaultClasses;
  const total = rec && !rec.holiday ? rec.total : def;
  const attended = rec && !rec.holiday ? rec.attended : def;
  openModal('Attendance · ' + formatDate(key),
    '<label for="a_total">Classes held</label><input id="a_total" type="number" name="total" min="0" value="' + total + '">' +
    '<label for="a_att">Classes attended</label><input id="a_att" type="number" name="attended" min="0" value="' + attended + '">' +
    '<div class="btn-row"><button type="button" class="btn holiday' + (rec && rec.holiday ? ' active' : '') + '" onclick="markHoliday(\'' + key + '\')">Mark Holiday</button>' +
    (rec ? '<button type="button" class="btn" onclick="clearAttendance(\'' + key + '\')">Clear Status</button>' : '') + '</div>',
    fd => {
      const total = Math.max(0, Math.round(Number(fd.get('total')) || 0));
      const attended = Math.max(0, Math.round(Number(fd.get('attended')) || 0));
      if (attended > total) return modalError('Classes attended can\'t exceed classes held.');
      saveClassAttendance(key, total, attended);
      toast('Attendance saved');
    }, 'Save');
}

function changeMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderAttendance();
}

function renderAttendance() {
  const s = getAttendanceStats(), ct = classesToTarget(), today = getTodayKey();
  const first = new Date(calYear, calMonth, 1);
  const days = new Date(calYear, calMonth + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  let cells = '<span></span>'.repeat(offset);
  for (let d = 1; d <= days; d++) {
    const k = calYear + '-' + pad(calMonth + 1) + '-' + pad(d), rec = attendance[k], cls = dayStatusClass(rec);
    const label = !rec ? 'not marked' : rec.holiday ? 'holiday' : rec.attended + ' of ' + rec.total + ' classes attended';
    cells += '<button class="day ' + cls + (k === today ? ' today' : '') + '" onclick="openAttendanceModal(\'' + k + '\')" aria-label="' + formatDate(k) + ', ' + label + '">' + d + '</button>';
  }
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => '<span class="dow">' + d + '</span>').join('');
  const none = Object.keys(attendance).length === 0;

  $('attendance').innerHTML =
    '<h1>Attendance Overview</h1><p class="muted">Tap any date to log classes held and attended.</p>' +
    '<div class="card"><h2>Attendance settings</h2><div class="row2">' +
    '<div><label for="s_def">Default classes per day</label><input id="s_def" type="number" min="1" value="' + attSettings.defaultClasses + '" onchange="updateDefaultClasses(this.value)"></div>' +
    '<div><label for="s_target">Minimum required attendance %</label><input id="s_target" type="number" min="1" max="100" value="' + attSettings.targetPct + '" onchange="updateTargetPct(this.value)"></div></div>' +
    '<p class="muted">The default fills in new days — change it on any day that had more or fewer classes.</p></div>' +
    '<div class="stats">' +
    '<div class="card stat"><span class="muted">Classes attended</span><strong>' + s.attendedClasses + '</strong></div>' +
    '<div class="card stat"><span class="muted">Classes missed</span><strong>' + s.missed + '</strong></div>' +
    '<div class="card stat"><span class="muted">Holidays</span><strong>' + s.holidays + '</strong></div>' +
    '<div class="card stat"><span class="muted">Attendance</span><strong>' + (s.pct !== null ? s.pct.toFixed(1) + '%' : '–') + '</strong>' + (s.pct === null ? '<span class="muted">No attendance data yet</span>' : '') + '</div></div>' +
    (s.pct !== null ? '<div class="card target-card' + (ct.metTarget ? '' : ' below') + '"><h2>' + (ct.metTarget ? 'On track for ' : 'Below your ') + attSettings.targetPct + '% target</h2><p>' + targetMessage(ct) + '</p></div>' : '') +
    '<div class="card"><div class="cal-head"><button class="btn sm" onclick="changeMonth(-1)" aria-label="Previous month">‹</button><h2 style="margin:0">' +
    first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) +
    '</h2><button class="btn sm" onclick="changeMonth(1)" aria-label="Next month">›</button></div>' +
    '<div class="cal">' + dows + cells + '</div>' +
    '<div class="legend"><span><i class="dot present"></i>Full attendance</span><span><i class="dot partial"></i>Partial</span><span><i class="dot absent"></i>Missed all</span><span><i class="dot holiday"></i>Holiday</span><span><i class="dot"></i>Not marked</span></div>' +
    (none ? '<p class="empty"><strong>No attendance recorded yet.</strong>Mark today from the Home page or tap a date.</p>' : '') + '</div>';
}
