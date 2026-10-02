// ===== Storage utility: the ONLY place that touches localStorage =====
const PREFIX = 'studentDashboard_';

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback; // corrupted JSON -> use safe default
  }
}
function saveData(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {}
}
function removeData(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (e) {}
}

// ===== Small helpers =====
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
// Escape user text before putting it into innerHTML
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== Date helpers (local time, never UTC) =====
function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function getTodayKey() { return dateKey(new Date()); }
function parseKey(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function formatDate(k) { return parseKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function formatTime(t) {
  if (!t) return '';
  const p = t.split(':').map(Number);
  return ((p[0] % 12) || 12) + ':' + pad(p[1]) + ' ' + (p[0] < 12 ? 'AM' : 'PM');
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  return h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
}

// ===== Icons (inline SVG, feather style) =====
const ICONS = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  cal: 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18',
  check: 'M20 6L9 17l-5-5',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
  play: 'M5 3l14 9-14 9z',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  plus: 'M12 5v14 M5 12h14',
  gear: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'
};
function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[name] + '"/></svg>'; }

// ===== Toast =====
function toast(msg, isError) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' err' : '');
  t.textContent = (isError ? '' : '✓ ') + msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ===== One reusable modal =====
// onSave(formData) may return false to keep the modal open (e.g. validation error)
function openModal(title, bodyHtml, onSave, saveText) {
  $('modalRoot').innerHTML =
    '<div class="overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    '<h2>' + esc(title) + '</h2><form id="modalForm" novalidate>' + bodyHtml +
    '<p class="error" id="modalError" role="alert"></p>' +
    '<div class="modal-actions"><button type="button" class="btn" onclick="closeModal()">Cancel</button>' +
    (onSave ? '<button type="submit" class="btn primary">' + (saveText || 'Save') + '</button>' : '') +
    '</div></form></div></div>';
  $('modalForm').onsubmit = e => {
    e.preventDefault();
    if (onSave && onSave(new FormData(e.target)) !== false) closeModal();
  };
  const first = $('modalRoot').querySelector('input,select,textarea');
  if (first) first.focus();
}
function closeModal() { $('modalRoot').innerHTML = ''; }
function modalError(msg) { $('modalError').textContent = msg; return false; }
function confirmBox(message, yesText, onYes) {
  openModal('Are you sure?', '<p>' + message + '</p>', () => { onYes(); }, yesText);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
