// alerts.js — handles the notification system for the dashboard
// when AQI exceeds the threshold set by the user, this sends an email and/or SMS alert
// it also manages the bell icon unread count, alert history (stored in localStorage),
// the settings panel, and the toast notification popups

// ─────────────────────────────────────────────────────────────────────────────
// API KEY SETUP
// EmailJS lets us send emails directly from the frontend (no backend needed)
// Fast2SMS sends SMS to Indian numbers — sign up to get a free API key
// ─────────────────────────────────────────────────────────────────────────────

/* ▼▼▼ PASTE YOUR KEYS HERE ▼▼▼ */
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';   // from emailjs.com dashboard → Email Services
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // from emailjs.com → Email Templates
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';    // from emailjs.com → Account → Public Key
const FAST2SMS_API_KEY = 'YOUR_FAST2SMS_KEY';  // from fast2sms.com → Dev API → Auth key
/* ▲▲▲ KEYS END ▲▲▲ */

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes between consecutive alerts so inbox doesn't flood
const MAX_HISTORY = 50;                    // keep at most 50 past alerts in localStorage
const STORAGE_KEY = 'envcore_alert_settings';  // key used to persist settings in localStorage
const HISTORY_KEY = 'envcore_alert_history';   // key used to store the alert log

// alert settings — defaults, gets overwritten by whatever was saved in localStorage
let alertSettings = {
  email: '',
  phone: '',
  aqiThreshold: 150,       // below this AQI → no alert. Default is 150 (Unhealthy for Sensitive)
  customThreshold: '',
  emailjsServiceId: '',
  emailjsTemplateId: '',
  emailjsPublicKey: '',
  fast2smsApiKey: '',
  emailEnabled: true,
  smsEnabled: true,
};

let lastAlertTime = 0;  // epoch ms of last sent alert — used for the cooldown check
let unreadCount = 0;    // tracks how many alerts have fired since user last opened the panel

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — load from / save to localStorage
// ─────────────────────────────────────────────────────────────────────────────

// on page load, read saved settings so the user doesn't have to enter their email every time
function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(alertSettings, JSON.parse(saved));  // merge saved values on top of defaults
  } catch (_) { }
  applySettingsToUI();  // fill in the input fields with the loaded values
}

// reads all the form fields in the alert panel and saves them to localStorage + alertSettings
function saveSettings() {
  alertSettings.email = document.getElementById('alertEmail')?.value?.trim() || alertSettings.email;
  alertSettings.phone = document.getElementById('alertPhone')?.value?.trim() || alertSettings.phone;
  alertSettings.emailMsg = document.getElementById('emailMsgTemplate')?.value?.trim() || alertSettings.emailMsg;
  alertSettings.smsMsg = document.getElementById('smsMsgTemplate')?.value?.trim() || alertSettings.smsMsg;
  alertSettings.emailEnabled = document.getElementById('toggleEmail')?.checked ?? true;
  alertSettings.smsEnabled = document.getElementById('toggleSms')?.checked ?? true;

  // check if a custom threshold was typed in, otherwise fall back to the preset buttons
  const threshSel = document.querySelector('.thresh-btn.active');
  const customVal = parseInt(document.getElementById('customThreshold')?.value);
  if (!isNaN(customVal) && customVal > 0) {
    alertSettings.aqiThreshold = customVal;
    alertSettings.customThreshold = customVal;
  } else if (threshSel) {
    alertSettings.aqiThreshold = parseInt(threshSel.dataset.val);
    alertSettings.customThreshold = '';
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(alertSettings));
  showToast('✅ Alert settings saved!', '#00ff88');
}

// fills the UI form fields with whatever is currently in alertSettings
function applySettingsToUI() {
  const safe = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  safe('alertEmail', alertSettings.email);
  safe('alertPhone', alertSettings.phone);
  safe('emailMsgTemplate', alertSettings.emailMsg || '');
  safe('smsMsgTemplate', alertSettings.smsMsg || '');

  const emailToggle = document.getElementById('toggleEmail');
  if (emailToggle) emailToggle.checked = alertSettings.emailEnabled;
  const smsToggle = document.getElementById('toggleSms');
  if (smsToggle) smsToggle.checked = alertSettings.smsEnabled;

  // highlight whichever threshold preset button matches the saved value
  document.querySelectorAll('.thresh-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.val) === alertSettings.aqiThreshold);
  });
  if (alertSettings.customThreshold) {
    const el = document.getElementById('customThreshold');
    if (el) el.value = alertSettings.customThreshold;
  }

  renderAlertHistory();
}

// builds the message text for the alert — supports custom templates with {aqi}, {threshold}, etc.
// falls back to a default message if the user hasn't set a custom template
function buildMessage(template, aqi, threshold, level) {
  const time = new Date().toLocaleString('en-IN');
  const defaults = {
    email: `⚠️ ENVCORE Air Quality Alert!\n\nCurrent AQI: ${aqi}\nAlert Threshold: ${threshold}\nLevel: ${level}\nTime: ${time}\n\n— ENVCORE IoT Dashboard`,
    sms: `ENVCORE Alert: AQI ${aqi} exceeded ${threshold}. Level: ${level}. Time: ${new Date().toLocaleTimeString('en-IN')}`,
  };
  if (!template || template.trim() === '') return defaults;
  const msg = template
    .replace(/\{aqi\}/gi, aqi)
    .replace(/\{threshold\}/gi, threshold)
    .replace(/\{level\}/gi, level)
    .replace(/\{time\}/gi, time);
  return { email: msg, sms: msg };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND EMAIL — via EmailJS (frontend-only email, no backend server needed)
// emailjs.send() makes a request to EmailJS's servers which forward it as a real email
// ─────────────────────────────────────────────────────────────────────────────
async function sendEmail(aqi, threshold, level) {
  if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
    showToast('⚠️ EmailJS keys not set in alerts.js', '#ffcc00'); return false;
  }
  const { email } = alertSettings;
  if (!email) { showToast('⚠️ No recipient email entered', '#ffcc00'); return false; }
  const tmpl = alertSettings.emailMsg || '';
  const msgs = buildMessage(tmpl, aqi, threshold, level);
  const subject = `🚨 ENVCORE AQI Alert: ${aqi} (threshold ${threshold})`;
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: email,
      subject: subject,
      message: msgs.email,
      from_name: 'ENVCORE Alert System',
      reply_to: email,
    }, EMAILJS_PUBLIC_KEY);
    showToast('📧 Email alert sent!', '#00e5ff');
    return true;
  } catch (err) {
    console.error('EmailJS error:', err);
    showToast('❌ Email failed: ' + (err?.text || err), '#ff4d4d');
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND SMS — via Fast2SMS (Indian mobile numbers, free credits on signup)
// note: CORS may block this in some browsers if the key is invalid
// ─────────────────────────────────────────────────────────────────────────────
async function sendSMS(aqi, threshold, level) {
  if (FAST2SMS_API_KEY === 'YOUR_FAST2SMS_KEY') {
    showToast('⚠️ Fast2SMS key not set in alerts.js', '#ffcc00'); return false;
  }
  const { phone } = alertSettings;
  if (!phone) { showToast('⚠️ No phone number entered', '#ffcc00'); return false; }
  const tmpl = alertSettings.smsMsg || '';
  const msgs = buildMessage(tmpl, aqi, threshold, level);
  try {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { 'authorization': FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'q', message: msgs.sms, language: 'english', flash: 0, numbers: phone }),
    });
    const data = await res.json();
    if (data.return === true) { showToast('📱 SMS alert sent!', '#00e5ff'); return true; }
    showToast('❌ SMS failed: ' + (data.message?.[0] || JSON.stringify(data)), '#ff4d4d');
    return false;
  } catch (err) {
    showToast('❌ SMS error: ' + err.message, '#ff4d4d'); return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE ALERT CHECKER
// called externally (from script.js) after every fetch with the latest AQI value
// if AQI > threshold and cooldown has passed → send alerts and log to history
// ─────────────────────────────────────────────────────────────────────────────
window.checkAlerts = async function (aqi) {
  const threshold = alertSettings.aqiThreshold || 150;
  if (aqi <= threshold) return;  // AQI is fine, no alert needed

  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;  // still in cooldown window
  lastAlertTime = now;

  const level = getAlertLevel(aqi);
  addAlertHistory(aqi, threshold, level);  // save to localStorage history
  incrementBell();  // bump the unread badge on the bell icon

  if (alertSettings.emailEnabled) sendEmail(aqi, threshold, level);
  if (alertSettings.smsEnabled) sendSMS(aqi, threshold, level);
};

// returns a human-readable severity label for a given AQI value
function getAlertLevel(aqi) {
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT HISTORY — stored in localStorage so it persists across page reloads
// ─────────────────────────────────────────────────────────────────────────────

// adds a new alert entry to the history list and saves it
function addAlertHistory(aqi, threshold, level) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { }
  const entry = {
    ts: new Date().toLocaleString('en-IN'),  // timestamp in Indian locale
    aqi,
    threshold,
    level,
    id: Date.now(),
  };
  history.unshift(entry);  // add to the front so newest appears first
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);  // cap at 50
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderAlertHistory();
}

// reads the history from localStorage and renders it into the panel as colored list items
function renderAlertHistory() {
  const container = document.getElementById('alertHistoryList');
  if (!container) return;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { }

  if (!history.length) {
    container.innerHTML = '<div class="ah-empty">No alerts triggered yet</div>';
    return;
  }
  container.innerHTML = history.slice(0, 20).map(h => {
    const color = h.aqi > 200 ? '#ff4d4d' : h.aqi > 150 ? '#ff9900' : '#ffcc00';
    return `
      <div class="ah-item">
        <div class="ah-left">
          <span class="ah-dot" style="background:${color};box-shadow:0 0 5px ${color}"></span>
          <div>
            <div class="ah-level">${h.level}</div>
            <div class="ah-ts">${h.ts}</div>
          </div>
        </div>
        <div class="ah-aqi" style="color:${color}">AQI ${h.aqi}</div>
      </div>`;
  }).join('');
}

// clears all alert history from localStorage
function clearAlertHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderAlertHistory();
  showToast('🗑️ Alert history cleared', '#00e5ff');
}

// ─────────────────────────────────────────────────────────────────────────────
// BELL ICON — unread counter badge
// ─────────────────────────────────────────────────────────────────────────────

// increments the unread badge count on the bell icon
function incrementBell() {
  unreadCount++;
  const badge = document.getElementById('bellBadge');
  if (badge) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;  // cap display at 9+
    badge.classList.remove('hidden');
  }
}

// resets badge to 0 — called when user opens the alert panel
function resetBell() {
  unreadCount = 0;
  const badge = document.getElementById('bellBadge');
  if (badge) badge.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT PANEL — the slide-in panel that opens when bell is clicked
// ─────────────────────────────────────────────────────────────────────────────
let panelOpen = false;

function toggleAlertPanel() {
  const panel = document.getElementById('alertPanel');
  if (!panel) return;
  panelOpen = !panelOpen;
  panel.classList.toggle('open', panelOpen);
  if (panelOpen) {
    resetBell();        // clear unread count when panel opens
    renderAlertHistory();
  }
}

// close the alert panel if user clicks anywhere outside of it
document.addEventListener('click', (e) => {
  if (!panelOpen) return;
  const panel = document.getElementById('alertPanel');
  const bell = document.getElementById('bellBtn');
  if (panel && !panel.contains(e.target) && !bell?.contains(e.target)) {
    panelOpen = false;
    panel.classList.remove('open');
  }
});

// when a preset threshold button is clicked, mark it active and update alertSettings
function selectThreshold(val) {
  document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.thresh-btn').forEach(b => {
    if (parseInt(b.dataset.val) === val) b.classList.add('active');
  });
  alertSettings.aqiThreshold = val;
  const custom = document.getElementById('customThreshold');
  if (custom) custom.value = '';  // clear custom input when a preset is selected
  alertSettings.customThreshold = '';
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST BUTTONS — lets the user verify their email/SMS is working before relying on it
// ─────────────────────────────────────────────────────────────────────────────
async function testEmail() {
  saveSettings();  // make sure we're using the latest form values
  await sendEmail(
    '🧪 ENVCORE Test Alert — Email Working!',
    `This is a test email from ENVCORE Alert System.\n\nYour email alerts are configured correctly.\nAQI Threshold: ${alertSettings.aqiThreshold}\n\nTime: ${new Date().toLocaleString('en-IN')}`
  );
}

async function testSMS() {
  saveSettings();
  await sendSMS(`ENVCORE TEST: SMS alerts working! Threshold: AQI ${alertSettings.aqiThreshold}. Time: ${new Date().toLocaleTimeString('en-IN')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST — small notification pop-up at the corner of the screen
// auto-disappears after 3.5 seconds
// ─────────────────────────────────────────────────────────────────────────────
function showToast(msg, color = '#00e5ff') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast-msg';
  t.style.cssText = `border-left: 3px solid ${color}; color: ${color};`;
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));  // trigger the CSS slide-in animation
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);  // wait for CSS fade-out before removing from DOM
  }, 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — wire up all the buttons once the DOM is ready
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();  // restore saved alert settings on page load

  document.getElementById('bellBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();  // prevent the document click listener from immediately closing it
    toggleAlertPanel();
  });

  document.getElementById('alertSaveBtn')?.addEventListener('click', saveSettings);
  document.getElementById('clearHistoryBtn')?.addEventListener('click', clearAlertHistory);
  document.getElementById('testEmailBtn')?.addEventListener('click', testEmail);
  document.getElementById('testSmsBtn')?.addEventListener('click', testSMS);

  // wire up the preset threshold buttons (120 / 150 / 200 default options)
  document.querySelectorAll('.thresh-btn').forEach(btn => {
    btn.addEventListener('click', () => selectThreshold(parseInt(btn.dataset.val)));
  });

  // expose showToast globally so other scripts (like charts.js) can show alert toasts too
  window._alertShowToast = showToast;
});
