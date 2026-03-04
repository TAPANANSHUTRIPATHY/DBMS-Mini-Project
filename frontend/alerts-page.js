/* ================================================================
   alerts-page.js — ENVCORE Dedicated Alert System Logic

   ══════════════════════════════════════════════════════════════
   🔑 STEP 1 — PASTE YOUR API KEYS HERE:

   EmailJS:
     1. Sign up free → https://www.emailjs.com
     2. Add Email Service → Create Template (use:
        {{to_email}}, {{subject}}, {{message}}, {{from_name}})
     3. Copy Service ID, Template ID, Public Key → paste below

   Fast2SMS (Indian numbers):
     1. Sign up free → https://www.fast2sms.com (₹50 free credit)
     2. Dev API → copy Authorization key → paste below
   ══════════════════════════════════════════════════════════════ */

/* ▼▼▼ PASTE YOUR KEYS HERE ▼▼▼ */
const EMAILJS_SERVICE_ID = 'service_yx0ey3b';   // e.g. 'service_abc123'
const EMAILJS_TEMPLATE_ID = 'template_y1l9mmt';  // e.g. 'template_xyz789'
const EMAILJS_PUBLIC_KEY = 'ECftLHDahALaBy8jt';    // e.g. 'AbCdEfGhIj...'
const FAST2SMS_API_KEY = 'f3gcPA8RnUvowkFLiVduL5PTU8tuUsYvh5Y2PDsRLKUkwQznUSEuyt0IxqzV';  // e.g. 'aBcDeFgHiJ...'
/* ▲▲▲ KEYS END ▲▲▲ */

/* ── Constants ── */
const API_URL = 'https://dbms-mini-project-vgp4.onrender.com/api';
const STORAGE_KEY = 'envcore_alert_settings_v2';
const HISTORY_KEY = 'envcore_alert_history';
const MAX_HISTORY = 50;

/* ── State ── */
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
const COOLDOWN = 5 * 60 * 1000; // 5 min

/* ================================================================
   LOAD / SAVE
================================================================ */
function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) Object.assign(settings, JSON.parse(saved));
    } catch (_) { }
    applyToUI();
}

function saveSettings() {
    settings.email = v('alertEmail');
    settings.phone = v('alertPhone');
    settings.emailSubject = v('emailSubject');
    settings.emailBody = v('emailBody');
    settings.smsBody = v('smsBody');

    const custom = parseInt(document.getElementById('customThreshold')?.value);
    if (!isNaN(custom) && custom > 0) {
        settings.aqiThreshold = custom;
        document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    updateThreshDesc();
    updateBannerThreshold();
    toast('✅ Alert settings saved!', '#00ff88');
}

function applyToUI() {
    set('alertEmail', settings.email);
    set('alertPhone', settings.phone);
    set('emailSubject', settings.emailSubject);
    set('emailBody', settings.emailBody);
    set('smsBody', settings.smsBody);
    document.querySelectorAll('.thresh-btn').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.val) === settings.aqiThreshold));
    updateThreshDesc();
    updateBannerThreshold();
    renderHistory();
}

/* ================================================================
   HELPERS
================================================================ */
const v = id => document.getElementById(id)?.value?.trim() || '';
const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

function buildMsg(template, aqi, threshold, level) {
    const time = new Date().toLocaleString('en-IN');
    return (template || '')
        .replace(/\{aqi\}/gi, aqi)
        .replace(/\{threshold\}/gi, threshold)
        .replace(/\{level\}/gi, level)
        .replace(/\{time\}/gi, time);
}

function getLevel(aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

function getLevelColor(aqi) {
    if (aqi <= 50) return '#00ff88';
    if (aqi <= 100) return '#ffcc00';
    if (aqi <= 150) return '#ff9900';
    if (aqi <= 200) return '#ff4d4d';
    if (aqi <= 300) return '#cc00cc';
    return '#800000';
}

function updateThreshDesc() {
    const el = document.getElementById('threshDesc');
    if (el) el.innerHTML = `Alert fires when AQI exceeds <strong>${settings.aqiThreshold}</strong>`;
}

function updateBannerThreshold() {
    const el = document.getElementById('bannerThreshold');
    if (el) el.textContent = settings.aqiThreshold;
}

/* ================================================================
   SEND EMAIL
================================================================ */
async function sendEmail(aqi, threshold, level, isTest = false) {
    if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
        toast('⚠️ EmailJS keys not set in alerts-page.js', '#ffcc00');
        setStatus('emailStatus', '⚠️ Keys missing', '#ffcc00');
        return;
    }
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
        setTimeout(() => setStatus('emailStatus', '', ''), 3000);
    } catch (err) {
        console.error(err);
        toast('❌ Email failed: ' + (err?.text || err), '#ff4d4d');
        setStatus('emailStatus', '❌ Failed', '#ff4d4d');
    }
}

/* ================================================================
   SEND SMS
================================================================ */
async function sendSMS(aqi, threshold, level, isTest = false) {
    if (FAST2SMS_API_KEY === 'YOUR_FAST2SMS_KEY') {
        toast('⚠️ Fast2SMS key not set in alerts-page.js', '#ffcc00');
        setStatus('smsStatus', '⚠️ Key missing', '#ffcc00');
        return;
    }
    const phone = isTest ? (v('alertPhone') || settings.phone) : settings.phone;
    if (!phone) { toast('⚠️ Enter a phone number first', '#ffcc00'); return; }

    const msg = buildMsg(v('smsBody') || settings.smsBody, aqi, threshold, level);

    try {
        const res = await fetch('https://corsproxy.io/?https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: { 'authorization': FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ route: 'q', message: msg, language: 'english', flash: 0, numbers: phone }),
        });
        const data = await res.json();
        if (data.return) {
            toast('📱 SMS sent to ' + phone, '#00e5ff');
            setStatus('smsStatus', '✅ Sent!', '#00ff88');
            setTimeout(() => setStatus('smsStatus', '', ''), 3000);
        } else {
            toast('❌ SMS failed: ' + (data.message?.[0] || JSON.stringify(data)), '#ff4d4d');
            setStatus('smsStatus', '❌ Failed', '#ff4d4d');
        }
    } catch (err) {
        toast('❌ SMS error: ' + err.message, '#ff4d4d');
        setStatus('smsStatus', '❌ Error', '#ff4d4d');
    }
}

function setStatus(id, msg, color) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.color = color; }
}

/* ================================================================
   ALERT HISTORY
================================================================ */
function addHistory(aqi, threshold, level) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { }
    history.unshift({ ts: new Date().toLocaleString('en-IN'), aqi, threshold, level, id: Date.now() });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('alertHistoryList');
    if (!container) return;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { }

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

/* ================================================================
   LIVE AQI POLLING
================================================================ */
async function pollAQI() {
    try {
        const res = await fetch(`${API_URL}/latest`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error('offline');
        const d = await res.json();
        const aqi = parseFloat(d?.air_quality);
        if (isNaN(aqi)) return;

        const color = getLevelColor(aqi);
        const level = getLevel(aqi);
        const valEl = document.getElementById('liveAqi');
        const statEl = document.getElementById('liveAqiStatus');

        if (valEl) { valEl.textContent = aqi; valEl.style.color = color; valEl.style.textShadow = `0 0 20px ${color}60`; }
        if (statEl) { statEl.textContent = level; statEl.style.color = color; }

        // Log to history when threshold exceeded (no auto email/SMS — user sends manually)
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

/* ================================================================
   TOAST
================================================================ */
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

/* ================================================================
   CLOCK
================================================================ */
function updateClock() {
    const el = document.getElementById('clockDisplay');
    if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
}

/* ================================================================
   THEME TOGGLE
================================================================ */
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

/* ================================================================
   BACKGROUND CANVAS (same particle system as main page)
================================================================ */
function initBg() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 60; i++) particles.push({
        x: Math.random() * 2000, y: Math.random() * 2000,
        r: Math.random() * 1.5 + .3, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
        a: Math.random() * .5 + .1,
    });
    function draw() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,229,255,${p.a})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }
    draw();
}

/* ================================================================
   INIT
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initBg();
    initTheme();
    loadSettings();
    setInterval(updateClock, 1000);
    updateClock();

    // Threshold buttons
    document.querySelectorAll('.thresh-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            settings.aqiThreshold = parseInt(btn.dataset.val);
            document.getElementById('customThreshold').value = '';
            updateThreshDesc();
            updateBannerThreshold();
        });
    });

    // Custom threshold input
    document.getElementById('customThreshold')?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            settings.aqiThreshold = val;
            document.querySelectorAll('.thresh-btn').forEach(b => b.classList.remove('active'));
            updateThreshDesc();
            updateBannerThreshold();
        }
    });

    // Save
    document.getElementById('saveBtn')?.addEventListener('click', saveSettings);

    // Send Email (Manual trigger with live data)
    document.getElementById('sendEmailBtn')?.addEventListener('click', () => {
        saveSettings();
        const currentAqi = parseFloat(document.getElementById('liveAqi')?.textContent) || 0;
        const currentLevel = document.getElementById('liveAqiStatus')?.textContent || 'Unknown';
        sendEmail(currentAqi, settings.aqiThreshold, currentLevel, false);
    });

    // Send SMS (Manual trigger with live data)
    document.getElementById('sendSmsBtn')?.addEventListener('click', () => {
        saveSettings();
        const currentAqi = parseFloat(document.getElementById('liveAqi')?.textContent) || 0;
        const currentLevel = document.getElementById('liveAqiStatus')?.textContent || 'Unknown';
        sendSMS(currentAqi, settings.aqiThreshold, currentLevel, false);
    });

    // Clear history
    document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);

    // Start live AQI polling
    pollAQI();
    setInterval(pollAQI, 5000);
});
