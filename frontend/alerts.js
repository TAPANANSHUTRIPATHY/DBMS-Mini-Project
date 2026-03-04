/* ================================================================
   alerts.js — ENVCORE Alert System
   • Bell icon + dropdown panel
   • EmailJS integration (real email)
   • Fast2SMS integration (real SMS, India)
   • AQI threshold customization (120 / 150 / 200 / custom)
   • Alert history panel (last 50 entries, localStorage)
   • 5-minute cooldown between alerts

   ══════════════════════════════════════════════════════════════
   🔑 STEP 1 — ADD YOUR API KEYS HERE (do not share publicly):

   EmailJS setup:
     1. Sign up at https://www.emailjs.com (free – 200 emails/month)
     2. Go to Email Services → Add Service (connect your Gmail/Outlook)
     3. Go to Email Templates → Create Template
        Add template variables: {{to_email}}, {{subject}}, {{message}}, {{from_name}}
     4. Copy your Service ID, Template ID, Public Key from the dashboard
     5. Paste below:

   Fast2SMS setup (for Indian mobile numbers):
     1. Sign up at https://www.fast2sms.com
     2. Go to Dev API → copy your Authorization key (free ₹50 credit on signup)
     3. Paste below:
   ══════════════════════════════════════════════════════════════ */

/* ▼▼▼ PASTE YOUR KEYS HERE ▼▼▼ */
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';   // e.g. 'service_abc123'
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // e.g. 'template_xyz789'
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';    // e.g. 'AbCdEf1234567890'
const FAST2SMS_API_KEY = 'YOUR_FAST2SMS_KEY';  // e.g. 'aBcDeFgHiJkL...'
/* ▲▲▲ KEYS END ▲▲▲ */

/* ── Constants ── */
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY = 50;
const STORAGE_KEY = 'envcore_alert_settings';
const HISTORY_KEY = 'envcore_alert_history';

/* ── State ── */
let alertSettings = {
    email: '',
    phone: '',
    aqiThreshold: 150,
    customThreshold: '',
    emailjsServiceId: '',
    emailjsTemplateId: '',
    emailjsPublicKey: '',
    fast2smsApiKey: '',
    emailEnabled: true,
    smsEnabled: true,
};

let lastAlertTime = 0;
let unreadCount = 0;

/* ── Load settings from localStorage ── */
function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) Object.assign(alertSettings, JSON.parse(saved));
    } catch (_) { }
    applySettingsToUI();
}

/* ── Save settings to localStorage ── */
function saveSettings() {
    alertSettings.email = document.getElementById('alertEmail')?.value?.trim() || alertSettings.email;
    alertSettings.phone = document.getElementById('alertPhone')?.value?.trim() || alertSettings.phone;
    alertSettings.emailMsg = document.getElementById('emailMsgTemplate')?.value?.trim() || alertSettings.emailMsg;
    alertSettings.smsMsg = document.getElementById('smsMsgTemplate')?.value?.trim() || alertSettings.smsMsg;
    alertSettings.emailEnabled = document.getElementById('toggleEmail')?.checked ?? true;
    alertSettings.smsEnabled = document.getElementById('toggleSms')?.checked ?? true;

    // Threshold
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

/* ── Apply saved settings back to UI fields ── */
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

    // Threshold buttons
    document.querySelectorAll('.thresh-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.val) === alertSettings.aqiThreshold);
    });
    if (alertSettings.customThreshold) {
        const el = document.getElementById('customThreshold');
        if (el) el.value = alertSettings.customThreshold;
    }

    renderAlertHistory();
}

/* ── Build message from template (replace {aqi} {threshold} {level} {time}) ── */
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

/* ================================================================
   SEND EMAIL via EmailJS
================================================================ */
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

/* ================================================================
   SEND SMS via Fast2SMS
================================================================ */
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

/* ================================================================
   CORE ALERT CHECKER — called from script.js after every fetch
================================================================ */
window.checkAlerts = async function (aqi) {
    const threshold = alertSettings.aqiThreshold || 150;
    if (aqi <= threshold) return;

    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;
    lastAlertTime = now;

    const level = getAlertLevel(aqi);
    addAlertHistory(aqi, threshold, level);
    incrementBell();

    if (alertSettings.emailEnabled) sendEmail(aqi, threshold, level);
    if (alertSettings.smsEnabled) sendSMS(aqi, threshold, level);
};

function getAlertLevel(aqi) {
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

/* ================================================================
   ALERT HISTORY
================================================================ */
function addAlertHistory(aqi, threshold, level) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { }
    const entry = {
        ts: new Date().toLocaleString('en-IN'),
        aqi,
        threshold,
        level,
        id: Date.now(),
    };
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderAlertHistory();
}

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

function clearAlertHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderAlertHistory();
    showToast('🗑️ Alert history cleared', '#00e5ff');
}

/* ================================================================
   BELL COUNTER
================================================================ */
function incrementBell() {
    unreadCount++;
    const badge = document.getElementById('bellBadge');
    if (badge) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.classList.remove('hidden');
    }
}

function resetBell() {
    unreadCount = 0;
    const badge = document.getElementById('bellBadge');
    if (badge) badge.classList.add('hidden');
}

/* ================================================================
   PANEL TOGGLE
================================================================ */
let panelOpen = false;

function toggleAlertPanel() {
    const panel = document.getElementById('alertPanel');
    if (!panel) return;
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) {
        resetBell();
        renderAlertHistory();
    }
}

/* close panel when clicking outside */
document.addEventListener('click', (e) => {
    if (!panelOpen) return;
    const panel = document.getElementById('alertPanel');
    const bell = document.getElementById('bellBtn');
    if (panel && !panel.contains(e.target) && !bell?.contains(e.target)) {
        panelOpen = false;
        panel.classList.remove('open');
    }
});

/* ================================================================
   THRESHOLD BUTTON WIRING
================================================================ */
function selectThreshold(val) {
    document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.thresh-btn').forEach(b => {
        if (parseInt(b.dataset.val) === val) b.classList.add('active');
    });
    alertSettings.aqiThreshold = val;
    const custom = document.getElementById('customThreshold');
    if (custom) custom.value = '';
    alertSettings.customThreshold = '';
}

/* ================================================================
   TEST BUTTONS
================================================================ */
async function testEmail() {
    saveSettings();
    await sendEmail(
        '🧪 ENVCORE Test Alert — Email Working!',
        `This is a test email from ENVCORE Alert System.\n\nYour email alerts are configured correctly.\nAQI Threshold: ${alertSettings.aqiThreshold}\n\nTime: ${new Date().toLocaleString('en-IN')}`
    );
}

async function testSMS() {
    saveSettings();
    await sendSMS(`ENVCORE TEST: SMS alerts working! Threshold: AQI ${alertSettings.aqiThreshold}. Time: ${new Date().toLocaleTimeString('en-IN')}`);
}

/* ================================================================
   TOAST
================================================================ */
function showToast(msg, color = '#00e5ff') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'toast-msg';
    t.style.cssText = `border-left: 3px solid ${color}; color: ${color};`;
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 400);
    }, 3500);
}

/* ================================================================
   INIT
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    /* Bell button */
    document.getElementById('bellBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAlertPanel();
    });

    /* Save button */
    document.getElementById('alertSaveBtn')?.addEventListener('click', saveSettings);

    /* Clear history */
    document.getElementById('clearHistoryBtn')?.addEventListener('click', clearAlertHistory);

    /* Test buttons */
    document.getElementById('testEmailBtn')?.addEventListener('click', testEmail);
    document.getElementById('testSmsBtn')?.addEventListener('click', testSMS);

    /* Threshold preset buttons */
    document.querySelectorAll('.thresh-btn').forEach(btn => {
        btn.addEventListener('click', () => selectThreshold(parseInt(btn.dataset.val)));
    });

    /* Expose globally */
    window._alertShowToast = showToast;
});
