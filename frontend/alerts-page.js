// alerts-page.js — this is for the dedicated alerts.html page
// unlike alerts.js (which is the bell icon panel on index.html),
// this page has its own full-page layout for configuring and viewing alerts
// it polls AQI every 5 seconds and shows live status, history, and manual send buttons

// ─────────────────────────────────────────────────────────────────────────────
// API KEYS — paste your own keys here to make the email and SMS sending work
// EmailJS: sign up at emailjs.com → create a service + template → paste the IDs below
// SMS works via an email-to-SMS gateway (no API key needed — just use the carrier's gateway address)
// ─────────────────────────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID = 'service_yx0ey3b';
const EMAILJS_TEMPLATE_ID = 'template_y1l9mmt';
const EMAILJS_PUBLIC_KEY = 'ECftLHDahALaBy8jt';

const API_URL = 'https://dbms-mini-project-vgp4.onrender.com/api';   // our backend
const STORAGE_KEY = 'envcore_alert_settings_v2';  // localStorage key for settings (v2 to avoid conflicts with the old one)
const HISTORY_KEY = 'envcore_alert_history';       // localStorage key for alert history log
const MAX_HISTORY = 50;                            // keep at most 50 past alerts

// default settings — will get overwritten by whatever was saved in localStorage
let settings = {
  email: '',
  phone: '',
  emailSubject: '🚨 ENVCORE Alert — AQI {aqi} exceeded {threshold}',
  emailBody: '⚠️ Air Quality Alert!\n\nCurrent AQI: {aqi}\nThreshold: {threshold}\nLevel: {level}\nTime: {time}\n\n— ENVCORE IoT Dashboard',
  smsBody: 'ENVCORE: AQI {aqi} exceeded {threshold}. Level: {level}. Time: {time}',
  aqiThreshold: 150,
  emailEnabled: true,
  smsEnabled: true,
};

let lastAlertTime = 0;
const COOLDOWN = 5 * 60 * 1000;  // 5 minute cooldown between automatic history entries

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — load from / save to localStorage
// ─────────────────────────────────────────────────────────────────────────────

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(settings, JSON.parse(saved));  // merge on top of defaults
  } catch (_) { }
  applyToUI();
}

function saveSettings() {
  settings.email = v('alertEmail');
  settings.phone = v('alertPhone');
  settings.emailSubject = v('emailSubject');
  settings.emailBody = v('emailBody');
  settings.smsBody = v('smsBody');

  // check if a custom threshold was typed, otherwise use the preset button value
  const custom = parseInt(document.getElementById('customThreshold')?.value);
  if (!isNaN(custom) && custom > 0) {
    settings.aqiThreshold = custom;
    document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  updateThreshDesc();        // update the description text below the threshold selector
  updateBannerThreshold();   // update the threshold number shown in the alert banner
  toast('✅ Alert settings saved!', '#00ff88');
}

// fills the form fields with whatever is stored in settings
function applyToUI() {
  set('alertEmail', settings.email);
  set('alertPhone', settings.phone);
  set('emailSubject', settings.emailSubject);
  set('emailBody', settings.emailBody);
  set('smsBody', settings.smsBody);
  // highlight the correct threshold preset button
  document.querySelectorAll('.thresh-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.val) === settings.aqiThreshold));
  updateThreshDesc();
  updateBannerThreshold();
  renderHistory();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// shorthand to get the trimmed value of an input by its ID
const v = id => document.getElementById(id)?.value?.trim() || '';

// shorthand to set the value of an input by its ID
const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

// replaces {aqi}, {threshold}, {level}, {time} placeholders in message templates
function buildMsg(template, aqi, threshold, level) {
  const time = new Date().toLocaleString('en-IN');
  return (template || '')
    .replace(/\{aqi\}/gi, aqi)
    .replace(/\{threshold\}/gi, threshold)
    .replace(/\{level\}/gi, level)
    .replace(/\{time\}/gi, time);
}

// converts an AQI number into a category label
function getLevel(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// maps AQI to a color — green (safe) to dark red (hazardous)
function getLevelColor(aqi) {
  if (aqi <= 50) return '#00ff88';
  if (aqi <= 100) return '#ffcc00';
  if (aqi <= 150) return '#ff9900';
  if (aqi <= 200) return '#ff4d4d';
  if (aqi <= 300) return '#cc00cc';
  return '#800000';
}

// updates the small description text that shows the current threshold value
function updateThreshDesc() {
  const el = document.getElementById('threshDesc');
  if (el) el.innerHTML = `Alert fires when AQI exceeds <strong>${settings.aqiThreshold}</strong>`;
}

// updates the threshold badge shown in the "current status" banner
function updateBannerThreshold() {
  const el = document.getElementById('bannerThreshold');
  if (el) el.textContent = settings.aqiThreshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND EMAIL
// uses EmailJS to send a real email directly from the browser (no backend needed)
// ─────────────────────────────────────────────────────────────────────────────
async function sendEmail(aqi, threshold, level, isTest = false) {
  if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
    toast('⚠️ EmailJS keys not set in alerts-page.js', '#ffcc00');
    setStatus('emailStatus', '⚠️ Keys missing', '#ffcc00');
    return;
  }
  // if it's a manual send, read the email from the form — otherwise use saved settings
  const to = isTest ? (v('alertEmail') || settings.email) : settings.email;
  if (!to) { toast('⚠️ Enter a recipient email first', '#ffcc00'); return; }

  const subj = buildMsg(v('emailSubject') || settings.emailSubject, aqi, threshold, level);
  const body = buildMsg(v('emailBody') || settings.emailBody, aqi, threshold, level);

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: to,
      subject: subj,
      message: body,
      from_name: 'ENVCORE Alert System',
      reply_to: to,
    }, EMAILJS_PUBLIC_KEY);
    toast('📧 Email sent to ' + to, '#00e5ff');
    setStatus('emailStatus', '✅ Sent!', '#00ff88');
    setTimeout(() => setStatus('emailStatus', '', ''), 3000);  // clear status after 3s
  } catch (err) {
    console.error(err);
    toast('❌ Email failed: ' + (err?.text || err), '#ff4d4d');
    setStatus('emailStatus', '❌ Failed', '#ff4d4d');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND SMS
// uses an email-to-SMS gateway — the phone number is formatted as number@carrier-gateway.com
// then sent via EmailJS just like a normal email, the carrier converts it to an SMS
// example: 9876543210@airtelap.com, 9876543210@textmsg.vodafone.net.in
// ─────────────────────────────────────────────────────────────────────────────
async function sendSMS(aqi, threshold, level, isTest = false) {
  if (EMAILJS_SERVICE_ID === 'service_xxxxx') {
    toast('⚠️ EmailJS keys not configured yet.', '#ffcc00');
    setStatus('smsStatus', '⚠️ Keys Missing', '#ffcc00');
    return;
  }

  const phoneGateway = isTest ? (v('alertPhone') || settings.phone) : settings.phone;
  // the phone field must be a gateway address (contains @), not just a phone number
  if (!phoneGateway || !phoneGateway.includes('@')) {
    toast('⚠️ Enter a valid SMS Gateway address (e.g. 12485551212@txt.att.net)', '#ffcc00');
    return;
  }

  const msg = buildMsg(v('smsBody') || settings.smsBody, aqi, threshold, level);

  try {
    // we send it as an email to the gateway address — the carrier delivers it as SMS
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: phoneGateway,
      subject: 'ENVCORE ALERT',
      message: msg,
      from_name: 'ENVCORE System',
      reply_to: 'no-reply@envcore.local',
    }, EMAILJS_PUBLIC_KEY);

    toast('📱 SMS dispatched via Gateway to ' + phoneGateway.split('@')[0], '#00e5ff');
    setStatus('smsStatus', '✅ Sent!', '#00ff88');
    setTimeout(() => setStatus('smsStatus', '', ''), 3000);
  } catch (err) {
    console.error(err);
    toast('❌ SMS Gateway failed: ' + (err?.text || err), '#ff4d4d');
    setStatus('smsStatus', '❌ Failed', '#ff4d4d');
  }
}

// helper to set the text and color of a status indicator element
function setStatus(id, msg, color) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.color = color; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT HISTORY — stored in localStorage, shared with the main page's alerts.js
// ─────────────────────────────────────────────────────────────────────────────

// adds a new entry to the history when an alert fires
function addHistory(aqi, threshold, level) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { }
  history.unshift({ ts: new Date().toLocaleString('en-IN'), aqi, threshold, level, id: Date.now() });
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

// reads the history from localStorage and renders it as a list of colored items
function renderHistory() {
  const container = document.getElementById('alertHistoryList');
  if (!container) return;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { }

  // update the count badge ("5 alerts")
  const countEl = document.getElementById('historyCount');
  if (countEl) countEl.textContent = history.length + ' alert' + (history.length !== 1 ? 's' : '');

  if (!history.length) {
    container.innerHTML = `<div class="ah-empty"><div class="ah-empty-icon">🔔</div><div>No alerts triggered yet</div><div class="ah-empty-sub">Alerts appear here when AQI exceeds your threshold</div></div>`;
    return;
  }

  container.innerHTML = history.map(h => {
    const color = getLevelColor(h.aqi);
    return `
      <div class="ah-item">
        <div class="ah-dot-wrap">
          <div class="ah-dot" style="background:${color}"></div>
          <div class="ah-dot-pulse" style="background:${color};opacity:.3"></div>
        </div>
        <div class="ah-body">
          <div class="ah-level">${h.level}</div>
          <div class="ah-ts">${h.ts}</div>
        </div>
        <div class="ah-aqi-badge" style="color:${color};background:${color}18;border:1px solid ${color}40">AQI ${h.aqi}</div>
        <div class="ah-threshold-info">/ ${h.threshold}</div>
      </div>`;
  }).join('');
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  toast('🗑️ Alert history cleared', '#00e5ff');
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE AQI POLLING — runs every 5 seconds
// shows the current AQI from the sensor on this page
// if AQI > threshold and cooldown passed → add to history automatically
// ─────────────────────────────────────────────────────────────────────────────
async function pollAQI() {
  try {
    const res = await fetch(`${API_URL}/latest`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('offline');
    const d = await res.json();
    const aqi = parseFloat(d?.air_quality);
    const valEl = document.getElementById('liveAqi');
    const statEl = document.getElementById('liveAqiStatus');

    // check if the reading is from today — stale data from yesterday shouldn't show as live
    const isToday = d?.created_at && (new Date(d.created_at).setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0));

    if (isNaN(aqi) || !isToday) {
      if (valEl) { valEl.textContent = '--'; valEl.style.color = 'var(--text-dim)'; valEl.style.textShadow = 'none'; }
      if (statEl) { statEl.textContent = 'No Data Today'; statEl.style.color = 'var(--text-dim)'; }
      return;
    }

    const color = getLevelColor(aqi);
    const level = getLevel(aqi);

    if (valEl) { valEl.textContent = aqi; valEl.style.color = color; valEl.style.textShadow = `0 0 20px ${color}60`; }
    if (statEl) { statEl.textContent = level; statEl.style.color = color; }

    // auto-log to history if threshold exceeded and cooldown has passed
    // note: email/SMS on this page are sent manually — there's no auto-send here
    const threshold = settings.aqiThreshold;
    if (aqi > threshold && Date.now() - lastAlertTime > COOLDOWN) {
      lastAlertTime = Date.now();
      addHistory(aqi, threshold, level);
    }
  } catch (_) {
    const statEl = document.getElementById('liveAqiStatus');
    if (statEl) { statEl.textContent = 'Backend offline'; statEl.style.color = 'var(--text-dim)'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST — small notification popup
// ─────────────────────────────────────────────────────────────────────────────
function toast(msg, color = '#00e5ff') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast-msg';
  t.style.borderLeft = `3px solid ${color}`;
  t.style.color = color;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// live clock in the header — ticks every second
function updateClock() {
  const el = document.getElementById('clockDisplay');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
}

// restores the dark/light theme preference from localStorage
function initTheme() {
  const btn = document.getElementById('themeToggle');
  const saved = localStorage.getItem('envcore_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  if (saved === 'light') btn?.classList.add('light-mode');
  btn?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const next = isLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('envcore_theme', next);
    btn.classList.toggle('light-mode', next === 'light');
  });
}

// charts.js handles the animated background canvas on this page too — nothing to do here
function initBg() { /* handled by charts.js */ }

// ─────────────────────────────────────────────────────────────────────────────
// INIT — wire everything up once the DOM is loaded
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initBg();
  initTheme();
  loadSettings();         // restore saved settings from localStorage
  setInterval(updateClock, 1000);
  updateClock();

  // preset threshold buttons (e.g. AQI 120 / 150 / 200)
  document.querySelectorAll('.thresh-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      settings.aqiThreshold = parseInt(btn.dataset.val);
      document.getElementById('customThreshold').value = '';  // clear custom input when using a preset
      updateThreshDesc();
      updateBannerThreshold();
    });
  });

  // custom threshold text box — updates immediately as user types
  document.getElementById('customThreshold')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      settings.aqiThreshold = val;
      document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
      updateThreshDesc();
      updateBannerThreshold();
    }
  });

  document.getElementById('saveBtn')?.addEventListener('click', saveSettings);

  // manual email send — reads the current live AQI from the page and sends an email
  document.getElementById('sendEmailBtn')?.addEventListener('click', () => {
    saveSettings();
    const currentAqi = parseFloat(document.getElementById('liveAqi')?.textContent) || 0;
    const currentLevel = document.getElementById('liveAqiStatus')?.textContent || 'Unknown';
    sendEmail(currentAqi, settings.aqiThreshold, currentLevel, false);
  });

  // manual SMS send — same idea
  document.getElementById('sendSmsBtn')?.addEventListener('click', () => {
    saveSettings();
    const currentAqi = parseFloat(document.getElementById('liveAqi')?.textContent) || 0;
    const currentLevel = document.getElementById('liveAqiStatus')?.textContent || 'Unknown';
    sendSMS(currentAqi, settings.aqiThreshold, currentLevel, false);
  });

  document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);

  // start polling AQI every 5 seconds to keep the live display fresh
  pollAQI();
  setInterval(pollAQI, 5000);

  // footer scrolling ticker — duplicated so the CSS marquee animation loops seamlessly
  const footerTicker = document.getElementById('footerTickerInner');
  if (footerTicker) {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    const dateStr = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const seg = `<div class="ft-segment">Made with <span class="ft-heart">❤</span><span class="ft-sep"></span><span class="ft-author">Tapananshu Tripathy</span><span class="ft-sep"></span><span class="ft-date">❆ ${dateStr} ❆</span><span class="ft-sep"></span>ENVCORE — Smart Environmental Monitoring<span class="ft-sep"></span>B.Tech CSE · KIIT University · Bhubaneswar</div>`;
    footerTicker.innerHTML = seg + seg;
  }

  // custom cursor — neon dot + ring, same as all other pages
  const cursor = document.getElementById('customCursor');
  const cursorRing = document.getElementById('customCursorRing');
  if (cursor && cursorRing) {
    document.addEventListener('mousemove', e => {
      requestAnimationFrame(() => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        cursorRing.style.left = `${e.clientX}px`;
        cursorRing.style.top = `${e.clientY}px`;
      });
    });
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-clicking'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-clicking'));
    const sel = 'a, button, input, textarea, .clickable';
    document.body.addEventListener('mouseover', e => { if (e.target.closest(sel)) document.body.classList.add('cursor-hovering'); });
    document.body.addEventListener('mouseout', e => { if (e.target.closest(sel)) document.body.classList.remove('cursor-hovering'); });
  }
});
