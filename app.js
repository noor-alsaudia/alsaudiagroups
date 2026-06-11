/* ============================================================
   AL SAUDIA TRAVEL AGENCY  —  app.js  (v2: full booking suite)
   Login + Admin/Agent Dashboard + Group Booking + Schedule
   ============================================================ */

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc,
  onSnapshot, serverTimestamp, query, orderBy, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCp364VAhNK46cR_waiVfVJog8boSaFUTc",
  authDomain:        "alsaudia-e8ecb.firebaseapp.com",
  projectId:         "alsaudia-e8ecb",
  storageBucket:     "alsaudia-e8ecb.firebasestorage.app",
  messagingSenderId: "749046407094",
  appId:             "1:749046407094:web:366ba14432cc40daa56b17",
  measurementId:     "G-22Y2B7S69X"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const $ = id => document.getElementById(id);
let currentRole = 'agent', currentProfile = {};
let allAgents = [], allGroups = [], allReservations = [], myReservations = [];

/* ---- reference maps ---- */
const AIRLINES = { PK:'PIA', SV:'Saudia', EK:'Emirates', QR:'Qatar Airways', EY:'Etihad Airways', FZ:'Fly Dubai', G9:'Air Arabia', GF:'Gulf Air', TK:'Turkish Airlines', PA:'Airblue', ER:'SereneAir', WY:'Oman Air', J9:'Jazeera', XY:'Flynas', KU:'Kuwait Airways' };
const MONTHS = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12 };
const DEST = {
  JED:{n:'Jeddah',f:'🇸🇦'}, RUH:{n:'Riyadh',f:'🇸🇦'}, MED:{n:'Madinah',f:'🇸🇦'}, DMM:{n:'Dammam',f:'🇸🇦'},
  DXB:{n:'Dubai',f:'🇦🇪'}, AUH:{n:'Abu Dhabi',f:'🇦🇪'}, SHJ:{n:'Sharjah',f:'🇦🇪'},
  DOH:{n:'Doha',f:'🇶🇦'}, IST:{n:'Istanbul',f:'🇹🇷'}, KWI:{n:'Kuwait',f:'🇰🇼'}, BAH:{n:'Bahrain',f:'🇧🇭'},
  MCT:{n:'Muscat',f:'🇴🇲'}, LHR:{n:'London',f:'🇬🇧'}, MAN:{n:'Manchester',f:'🇬🇧'}, KUL:{n:'Kuala Lumpur',f:'🇲🇾'}
};
const destInfo = code => DEST[(code||'').toUpperCase()] || { n:(code||'Other').toUpperCase(), f:'✈️' };

document.addEventListener('DOMContentLoaded', () => {
  const preloader = document.querySelector('.preloader');
  window.addEventListener('load', () => { setTimeout(() => { preloader?.classList.add('fade-out'); setTimeout(() => { if (preloader) preloader.style.display = 'none'; }, 500); }, 700); });
  if (window.AOS) AOS.init({ duration: 1000, once: true, offset: 100 });

  const mobileToggle = $('mobileToggle'); const mainNav = $('mainNav');
  mobileToggle?.addEventListener('click', () => { mainNav.classList.toggle('active'); const i = mobileToggle.querySelector('i'); i?.classList.toggle('fa-bars'); i?.classList.toggle('fa-times'); });
  document.querySelectorAll('.dropdown').forEach(dd => dd.querySelector('a')?.addEventListener('click', e => { if (window.innerWidth <= 992) { e.preventDefault(); dd.classList.toggle('active'); } }));

  const tp = $('togglePassword'); const pf = $('password');
  tp?.addEventListener('click', () => { const t = pf.getAttribute('type') === 'password' ? 'text' : 'password'; pf.setAttribute('type', t); const i = tp.querySelector('i'); i?.classList.toggle('fa-eye-slash'); i?.classList.toggle('fa-eye'); });

  const marq = [{n:'Saudia Airlines',c:'#6c4ab6'},{n:'Emirates',c:'#d4a53a'},{n:'Qatar Airways',c:'#8B1E3F'},{n:'Etihad Airways',c:'#2B5B2B'},{n:'Turkish Airlines',c:'#E30A17'},{n:'Fly Dubai',c:'#FF6600'},{n:'Air Arabia',c:'#003366'},{n:'Gulf Air',c:'#C00000'}];
  const mc = $('marqueeContent'); if (mc) mc.innerHTML = [...marq, ...marq].map(a => `<div class="partner-item"><i class="fas fa-plane" style="color:${a.c}"></i><span>${a.n}</span></div>`).join('');

  $('loginForm')?.addEventListener('submit', onLogin);
  $('forgotPassword')?.addEventListener('click', onForgot);
  $('registerBtn')?.addEventListener('click', e => { e.preventDefault(); onRegister(); });
  $('registerNow')?.addEventListener('click', e => { e.preventDefault(); onRegister(); });

  $('logoutBtn')?.addEventListener('click', onLogout);
  $('headerLogout')?.addEventListener('click', e => { e.preventDefault(); onLogout(); });
  $('addAgentBtn')?.addEventListener('click', onAddAgent);
  $('searchInput')?.addEventListener('input', onSearch);
  $('agentsTableBody')?.addEventListener('click', onAgentTableAction);

  $('addGroupBtn')?.addEventListener('click', () => toggleGroupForm(true));
  $('cancelGroupBtn')?.addEventListener('click', () => toggleGroupForm(false));
  $('saveGroupBtn')?.addEventListener('click', onSaveGroup);
  $('pnrParseBtn')?.addEventListener('click', onParsePNR);
  $('groupsList')?.addEventListener('click', onGroupListAction);
  $('availableGroupsList')?.addEventListener('click', onAvailableAction);
  $('reservationsList')?.addEventListener('click', onReservationAction);
  $('scheduleGrid')?.addEventListener('click', onScheduleClick);

  $('dashTabs')?.addEventListener('click', e => { const b = e.target.closest('.dash-tab'); if (b) switchTab(b.dataset.tab); });

  const rem = localStorage.getItem('rememberedUser');
  if (rem) { const ei = $('email'); const rc = $('rememberMe'); if (ei) ei.value = rem; if (rc) rc.checked = true; }

  onAuthStateChanged(auth, handleAuth);
});

/* ============================== VIEW SWITCH */
function showLogin() {
  $('loginView').style.display = ''; $('dashboardView').style.display = 'none';
  $('headerGuest').style.display = ''; $('headerUser').style.display = 'none';
  const nav = document.querySelector('.main-nav'); if (nav) nav.style.removeProperty('display');
}
function showDashboard(profile) {
  $('loginView').style.display = 'none'; $('dashboardView').style.display = '';
  $('headerGuest').style.display = 'none'; $('headerUser').style.display = '';
  const nav = document.querySelector('.main-nav'); if (nav) nav.style.display = 'none';

  $('userName').textContent = profile.name || 'Agent';
  $('userRoleLine').textContent = currentRole === 'admin' ? 'Administrator — groups, bookings & agents' : 'Travel Agent — book group seats for your customers';
  document.querySelectorAll('.dash-tab').forEach(b => b.style.display = (b.dataset.for === currentRole) ? '' : 'none');

  const card5 = $('card5');
  if (currentRole === 'admin') {
    setLabels('Total Passengers','Total Groups','Sold Seats','Remaining Seats');
    if (card5) card5.style.display = '';
    $('schedulePanel').style.display = '';
    listenGroups(); listenReservationsAdmin(); listenAgents();
    switchTab('panelGroups');
  } else {
    setLabels('Open Groups','My Bookings','Pending','Confirmed');
    if (card5) card5.style.display = 'none';
    $('schedulePanel').style.display = 'none';
    listenGroups(); listenMyReservations();
    switchTab('panelAvailable');
  }
}
function setLabels(a,b,c,d){ $('lbl1').textContent=a; $('lbl2').textContent=b; $('lbl3').textContent=c; $('lbl4').textContent=d; }
function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  const panel = $(tabId); if (panel) panel.style.display = '';
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
}
async function handleAuth(user) {
  if (!user) { showLogin(); return; }
  let snap;
  try { snap = await getDoc(doc(db, 'agents', user.uid)); }
  catch (e) { showLogin(); showAlert('Could not load profile. Check internet / config.', 'error'); return; }
  if (!snap.exists()) { await signOut(auth); showLogin(); showAlert('Account profile not found. Contact admin.', 'error'); return; }
  const data = snap.data();
  if (data.active === false) { await signOut(auth); showLogin(); showAlert('Account pending approval / disabled.', 'error'); return; }
  currentRole = data.role || 'agent'; currentProfile = { id: user.uid, ...data };
  showDashboard(data);
}

/* ============================== AUTH */
async function onLogin(e) {
  e.preventDefault();
  const email = $('email').value.trim(); const password = $('password').value;
  const rememberMe = $('rememberMe')?.checked || false;
  if (!email || !password) return showAlert('Please enter both email and password', 'error');
  if (!isValidEmail(email)) return showAlert('Please enter a valid email address', 'error');
  const btn = $('loginBtn'); const txt = btn?.querySelector('.btn-text'); const orig = txt ? txt.textContent : 'Login';
  if (btn) { btn.disabled = true; if (txt) txt.textContent = 'Logging in...'; }
  try { await signInWithEmailAndPassword(auth, email, password); if (rememberMe) localStorage.setItem('rememberedUser', email); else localStorage.removeItem('rememberedUser'); }
  catch (err) { showAlert(firebaseMsg(err.code), 'error'); }
  finally { if (btn) { btn.disabled = false; if (txt) txt.textContent = orig; } }
}
async function onLogout() { await signOut(auth); showLogin(); }
function onForgot(e) {
  e.preventDefault();
  Swal.fire({ title: 'Reset Password', text: 'Enter your email to receive a reset link', input: 'email', inputPlaceholder: 'agent@alsaudia.com', showCancelButton: true, confirmButtonColor: '#6c4ab6', confirmButtonText: 'Send Reset Link' })
  .then(async r => { if (r.isConfirmed && r.value) { try { await sendPasswordResetEmail(auth, r.value); Swal.fire('Email Sent!', 'Reset link sent to ' + r.value, 'success'); } catch (err) { Swal.fire('Error!', firebaseMsg(err.code), 'error'); } } });
}
function onRegister() {
  Swal.fire({
    title: 'Create Agent Account',
    html: `<input type="text" id="regName" class="swal2-input" placeholder="Full Name">
      <input type="email" id="regEmail" class="swal2-input" placeholder="Email Address">
      <input type="tel" id="regPhone" class="swal2-input" placeholder="Phone Number">
      <input type="text" id="regAgency" class="swal2-input" placeholder="Agency Name">
      <input type="password" id="regPassword" class="swal2-input" placeholder="Password (min 8 chars)">`,
    confirmButtonText: 'Register', confirmButtonColor: '#6c4ab6', showCancelButton: true,
    preConfirm: () => {
      const name=$('regName')?.value.trim(), email=$('regEmail')?.value.trim(), phone=$('regPhone')?.value.trim(), agency=$('regAgency')?.value.trim(), password=$('regPassword')?.value;
      if (!name||!email||!phone||!agency||!password){Swal.showValidationMessage('Please fill all fields');return false;}
      if (!isValidEmail(email)){Swal.showValidationMessage('Valid email required');return false;}
      if (password.length<8){Swal.showValidationMessage('Password min 8 characters');return false;}
      return { name, email, phone, agency, password };
    }
  }).then(async result => {
    if (!result.isConfirmed) return;
    const { name, email, phone, agency, password } = result.value;
    try { const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'agents', cred.user.uid), { name, email, phone, agency, role: 'agent', active: false, createdAt: serverTimestamp() });
      await signOut(auth); Swal.fire('Registration Submitted!', 'Account pending admin approval.', 'success');
    } catch (err) { Swal.fire('Error!', firebaseMsg(err.code), 'error'); }
  });
}

/* ============================== STATS */
function renderStats() {
  if (currentRole === 'admin') {
    const live = allReservations.filter(r => r.status !== 'rejected');
    $('stat1').textContent = live.reduce((s,r)=>s+(r.seats||0),0);
    $('stat2').textContent = allGroups.length;
    $('stat3').textContent = allGroups.reduce((s,g)=>s+((g.totalSeats||0)-(g.availableSeats||0)),0);
    $('stat4').textContent = allGroups.reduce((s,g)=>s+(g.availableSeats||0),0);
    const pend = allReservations.filter(r => r.status === 'pending').length;
    $('stat5').textContent = pend;
    const dot = $('pendingDot'); if (dot) dot.style.display = pend > 0 ? '' : 'none';
  } else {
    $('stat1').textContent = allGroups.filter(g => (g.availableSeats||0) > 0).length;
    $('stat2').textContent = myReservations.length;
    $('stat3').textContent = myReservations.filter(r => r.status === 'pending').length;
    $('stat4').textContent = myReservations.filter(r => r.status === 'accepted').length;
  }
}

/* ============================== GROUPS */
function listenGroups() {
  const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allGroups = []; snap.forEach(d => allGroups.push({ id: d.id, ...d.data() }));
    renderStats();
    if (currentRole === 'admin') { renderGroupsAdmin(); renderSchedule(); } else { renderAvailableGroups(); }
  }, err => console.error(err));
}

function toggleGroupForm(show) {
  const w = $('groupFormWrap'); if (!w) return;
  w.style.display = show ? '' : 'none';
  if (!show) ['gAirline','gFlightNo','gReturnFlight','gPnr','gFrom','gTo','gDepDate','gDepTime','gArrTime','gReturnDate','gReturnDepTime','gReturnArrTime','gSeats','gCost','gSale','pnrText'].forEach(id => { const el = $(id); if (el) el.value = ''; });
}

async function onSaveGroup() {
  const v = id => ($(id)?.value || '').trim();
  const airline = v('gAirline'), from = v('gFrom').toUpperCase(), to = v('gTo').toUpperCase(), depDate = v('gDepDate');
  const seats = parseInt(v('gSeats')), sale = parseInt(v('gSale')) || 0, cost = parseInt(v('gCost')) || 0;
  if (!airline || !from || !to || !depDate) return Swal.fire('Missing info', 'Airline, From, To and Departure Date are required.', 'warning');
  if (!seats || seats < 1) return Swal.fire('Seats', 'Enter valid total seats.', 'warning');
  try {
    await addDoc(collection(db, 'groups'), {
      airline, flightNo: v('gFlightNo'), returnFlight: v('gReturnFlight'), pnr: v('gPnr'),
      from, to, depDate, depTime: v('gDepTime'), arrTime: v('gArrTime'),
      returnDate: v('gReturnDate'), returnDepTime: v('gReturnDepTime'), returnArrTime: v('gReturnArrTime'),
      totalSeats: seats, availableSeats: seats, costPerSeat: cost, salePrice: sale, price: sale,
      createdBy: auth.currentUser.uid, createdAt: serverTimestamp()
    });
    toggleGroupForm(false);
    Swal.fire({ icon: 'success', title: 'Group added!', timer: 1300, showConfirmButton: false });
  } catch (err) { Swal.fire('Error', err.message, 'error'); }
}

/* Galileo / Travelport PNR best-effort parser */
function onParsePNR() {
  const text = ($('pnrText')?.value || '').toUpperCase();
  if (!text.trim()) return;
  const set = (id, val) => { if (val && $(id)) $(id).value = val; };
  // airline + flight no  (e.g. PK 754 / PK0754)
  const fm = text.match(/\b([A-Z]{2})\s?0?(\d{2,4})\b/);
  if (fm) { set('gAirline', AIRLINES[fm[1]] || fm[1]); set('gFlightNo', fm[1] + '-' + fm[2]); }
  // date DDMMM
  const dm = text.match(/\b(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/);
  if (dm) {
    const day = +dm[1], mon = MONTHS[dm[2]]; const today = new Date();
    let yr = today.getFullYear(); const cand = new Date(yr, mon - 1, day);
    if (cand < new Date(today.getFullYear(), today.getMonth(), today.getDate())) yr++;
    set('gDepDate', `${yr}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
  }
  // route ORG DST (two 3-letter codes near each other)
  const rm = text.match(/\b([A-Z]{3})\s?([A-Z]{3})\b/);
  if (rm) { set('gFrom', rm[1]); set('gTo', rm[2]); }
  // times: first two 4-digit groups
  const times = text.match(/\b(\d{4})\b/g);
  if (times && times.length >= 1) set('gDepTime', times[0].slice(0,2) + ':' + times[0].slice(2));
  if (times && times.length >= 2) set('gArrTime', times[1].slice(0,2) + ':' + times[1].slice(2));
  Swal.fire({ icon: 'info', title: 'Parsed (please verify)', text: 'Fields auto-filled from PNR. Check them before saving.', timer: 2200, showConfirmButton: false });
}

function groupByDest(list) {
  const map = {};
  list.forEach(g => { const k = (g.to || 'OTHER').toUpperCase(); (map[k] = map[k] || []).push(g); });
  return map;
}

function renderGroupsAdmin() {
  const box = $('groupsList'); if (!box) return;
  if (!allGroups.length) { box.innerHTML = `<div class="empty-state"><i class="fas fa-layer-group"></i><div>No groups yet. Click "Add Group".</div></div>`; return; }
  const map = groupByDest(allGroups); let html = '';
  Object.keys(map).sort().forEach(dest => {
    const d = destInfo(dest);
    html += `<div class="dest-head"><span class="flag">${d.f}</span> ${esc(d.n)} (${esc(dest)}) <span class="count">${map[dest].length} group(s)</span></div><div class="card-grid">`;
    html += map[dest].map(g => `<div class="group-card">
      <div class="gc-route"><i class="fas fa-plane"></i> ${esc(g.from)} → ${esc(g.to)}</div>
      <div class="gc-airline">${esc(g.airline)}${g.flightNo ? ' · ' + esc(g.flightNo) : ''}${g.pnr ? ' · PNR ' + esc(g.pnr) : ''}</div>
      <div class="gc-tags"><span class="gc-tag"><i class="fas fa-calendar"></i> ${esc(g.depDate)}</span>${g.depTime ? `<span class="gc-tag"><i class="fas fa-clock"></i> ${esc(g.depTime)}</span>` : ''}</div>
      <div class="gc-meta"><div><span>Sale Price</span><b>${fmtMoney(g.salePrice)}</b></div><div><span>Cost</span><b>${fmtMoney(g.costPerSeat)}</b></div></div>
      ${seatPill(g)}
      <div class="gc-actions"><button class="btn-sm btn-reject" data-act="del" data-id="${g.id}" data-name="${esc(g.from)} → ${esc(g.to)}"><i class="fas fa-trash"></i> Delete</button></div>
    </div>`).join('');
    html += `</div>`;
  });
  box.innerHTML = html;
}

function renderAvailableGroups() {
  const box = $('availableGroupsList'); if (!box) return;
  if (!allGroups.length) { box.innerHTML = `<div class="empty-state"><i class="fas fa-plane-slash"></i><div>No groups available right now.</div></div>`; return; }
  const map = groupByDest(allGroups); let html = '';
  Object.keys(map).sort().forEach(dest => {
    const d = destInfo(dest);
    html += `<div class="dest-head"><span class="flag">${d.f}</span> ${esc(d.n)} (${esc(dest)}) <span class="count">${map[dest].length} group(s)</span></div><div class="card-grid">`;
    html += map[dest].map(g => {
      const sold = (g.availableSeats || 0) === 0;
      return `<div class="group-card">
        <div class="gc-route"><i class="fas fa-plane"></i> ${esc(g.from)} → ${esc(g.to)}</div>
        <div class="gc-airline">${esc(g.airline)}${g.flightNo ? ' · ' + esc(g.flightNo) : ''}</div>
        <div class="gc-tags"><span class="gc-tag"><i class="fas fa-calendar"></i> ${esc(g.depDate)}</span>${g.depTime ? `<span class="gc-tag"><i class="fas fa-clock"></i> ${esc(g.depTime)}</span>` : ''}</div>
        <div class="gc-meta"><div><span>Price/seat</span><b>${fmtMoney(g.salePrice)}</b></div></div>
        ${seatPill(g)}
        <div class="gc-actions"><button class="btn-sm btn-reserve" data-id="${g.id}" ${sold ? 'disabled' : ''}><i class="fas fa-ticket"></i> ${sold ? 'Sold Out' : 'Reserve Seat'}</button></div>
      </div>`;
    }).join('');
    html += `</div>`;
  });
  box.innerHTML = html;
}

function seatPill(g) { const a = g.availableSeats || 0, t = g.totalSeats || 0; const cls = a === 0 ? 'none' : (a <= 5 ? 'low' : ''); return `<span class="seats-pill ${cls}"><i class="fas fa-chair"></i> ${a}/${t} seats</span>`; }

function onGroupListAction(e) {
  const btn = e.target.closest('button[data-act="del"]'); if (!btn) return;
  Swal.fire({ title: 'Delete group?', html: `Remove <b>${btn.dataset.name}</b>?<br><small>Existing bookings stay in records.</small>`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete' })
  .then(async r => { if (r.isConfirmed) { try { await deleteDoc(doc(db, 'groups', btn.dataset.id)); Swal.fire({ icon: 'success', title: 'Deleted', timer: 1000, showConfirmButton: false }); } catch (err) { Swal.fire('Error', err.message, 'error'); } } });
}

/* ============================== SCHEDULE (admin) */
function renderSchedule() {
  const box = $('scheduleGrid'); if (!box) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const sorted = [...allGroups].filter(g => g.depDate).sort((a,b) => new Date(a.depDate) - new Date(b.depDate));
  if (!sorted.length) { box.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-xmark"></i><div>No scheduled flights.</div></div>`; return; }
  box.innerHTML = sorted.map(g => {
    const dt = new Date(g.depDate); const days = Math.round((dt - today) / (24*3600*1000));
    const pax = allReservations.filter(r => r.groupId === g.id && r.status !== 'rejected').reduce((s,r)=>s+(r.seats||0),0);
    const d = destInfo(g.to); const urgent = days >= 0 && days <= 3;
    const dayName = dt.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = dt.toLocaleDateString('en-GB');
    const daysLabel = days < 0 ? 'Departed' : (days === 0 ? 'Today' : days + ' DAYS');
    return `<div class="sched-card ${urgent ? 'soon' : ''}" data-id="${g.id}">
      <div class="sc-top"><div class="sc-date">${dateStr}</div><div class="sc-days ${urgent ? 'urgent' : ''}">${daysLabel}</div></div>
      <div class="sc-day">${dayName}</div>
      <div class="sc-dest">${d.f} ${esc(g.from)} → ${esc(g.to)} · ${esc(g.airline)}</div>
      <div class="sc-pax">${pax} <small>passenger(s)</small></div>
      <div class="sc-link"><i class="fas fa-users"></i> Click to view passenger list</div>
    </div>`;
  }).join('');
}

function onScheduleClick(e) {
  const card = e.target.closest('.sched-card'); if (!card) return;
  const g = allGroups.find(x => x.id === card.dataset.id); if (!g) return;
  const list = allReservations.filter(r => r.groupId === g.id && r.status !== 'rejected');
  const rows = list.length ? list.map((r,i) => `<tr>
      <td style="text-align:left">${i+1}. ${esc(r.customerName)}</td>
      <td>${esc(r.passport)}</td><td>${r.seats}</td>
      <td>${r.status === 'accepted' ? '✅' : '⏳'}</td>
      <td style="text-align:left">${esc(r.agentName || '')}</td></tr>`).join('')
    : `<tr><td colspan="5" style="padding:14px;color:#888">No passengers yet.</td></tr>`;
  Swal.fire({
    title: `${esc(g.from)} → ${esc(g.to)} · ${esc(g.depDate)}`,
    width: 720,
    html: `<div style="max-height:60vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f0ebfa">
      <th style="padding:8px;text-align:left">Passenger</th><th style="padding:8px">Passport</th><th style="padding:8px">Seats</th><th style="padding:8px">Status</th><th style="padding:8px;text-align:left">Agent</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`,
    confirmButtonColor: '#6c4ab6', confirmButtonText: 'Close'
  });
}

/* ============================== RESERVE (agent) */
function onAvailableAction(e) {
  const btn = e.target.closest('.btn-reserve'); if (!btn || btn.disabled) return;
  const g = allGroups.find(x => x.id === btn.dataset.id); if (!g) return;
  Swal.fire({
    title: 'Reserve Seats',
    html: `<div style="text-align:left;font-size:13px;color:#64748b;margin-bottom:8px"><b>${esc(g.from)} → ${esc(g.to)}</b> · ${esc(g.airline)}<br>${esc(g.depDate)} · ${fmtMoney(g.salePrice)}/seat · ${g.availableSeats} left</div>
      <input type="text" id="rCust" class="swal2-input" placeholder="Customer Full Name">
      <input type="text" id="rPass" class="swal2-input" placeholder="Passport Number">
      <input type="number" id="rSeats" class="swal2-input" placeholder="Number of seats" value="1" min="1" max="${g.availableSeats}">`,
    confirmButtonText: 'Confirm Reservation', confirmButtonColor: '#6c4ab6', showCancelButton: true,
    preConfirm: () => {
      const customerName=$('rCust').value.trim(), passport=$('rPass').value.trim(), seats=parseInt($('rSeats').value);
      if (!customerName||!passport){Swal.showValidationMessage('Enter customer name and passport');return false;}
      if (!seats||seats<1){Swal.showValidationMessage('Enter valid seats');return false;}
      if (seats > (g.availableSeats||0)){Swal.showValidationMessage('Only '+g.availableSeats+' seat(s) left');return false;}
      return { customerName, passport, seats };
    }
  }).then(async r => {
    if (!r.isConfirmed) return;
    try { await doReserve(g, r.value); Swal.fire({ icon: 'success', title: 'Reserved!', text: 'Sent to admin for approval.', timer: 1700, showConfirmButton: false }); }
    catch (err) { Swal.fire('Could not reserve', err.message, 'error'); }
  });
}
async function doReserve(group, v) {
  const resRef = doc(collection(db, 'reservations'));
  await runTransaction(db, async tx => {
    const gRef = doc(db, 'groups', group.id); const g = await tx.get(gRef);
    if (!g.exists()) throw new Error('Group no longer exists');
    const avail = g.data().availableSeats ?? 0;
    if (v.seats > avail) throw new Error('Only ' + avail + ' seat(s) left');
    tx.update(gRef, { availableSeats: avail - v.seats });
    tx.set(resRef, {
      groupId: group.id, airline: g.data().airline, route: g.data().from + ' → ' + g.data().to,
      from: g.data().from, to: g.data().to, date: g.data().depDate, price: g.data().salePrice || 0,
      agentId: auth.currentUser.uid, agentName: currentProfile.name || '', agentAgency: currentProfile.agency || '',
      customerName: v.customerName, passport: v.passport, seats: v.seats,
      status: 'pending', createdAt: serverTimestamp()
    });
  });
}

/* ============================== RESERVATIONS (admin) */
function listenReservationsAdmin() {
  const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => { allReservations = []; snap.forEach(d => allReservations.push({ id: d.id, ...d.data() })); renderStats(); renderReservationsAdmin(); if (currentRole==='admin') renderSchedule(); }, err => console.error(err));
}
function statusBadge(s) {
  if (s === 'accepted') return `<span class="badge badge-accepted"><i class="fas fa-check"></i> Accepted</span>`;
  if (s === 'rejected') return `<span class="badge badge-rejected"><i class="fas fa-xmark"></i> Rejected</span>`;
  return `<span class="badge badge-pending"><i class="fas fa-clock"></i> Pending</span>`;
}
function renderReservationsAdmin() {
  const box = $('reservationsList'); if (!box) return;
  if (!allReservations.length) { box.innerHTML = `<div class="empty-state"><i class="fas fa-bell-slash"></i><div>No reservations yet.</div></div>`; return; }
  box.innerHTML = allReservations.map(r => `<div class="res-card ${r.status}">
    <div class="res-top">
      <div><div class="res-cust">${esc(r.customerName)}</div><div class="res-sub">by ${esc(r.agentName || 'agent')}${r.agentAgency ? ' · ' + esc(r.agentAgency) : ''}</div></div>
      ${statusBadge(r.status)}
    </div>
    <div class="res-sub"><i class="fas fa-plane"></i> ${esc(r.route)} · ${esc(r.airline)} · ${esc(r.date)}</div>
    <div class="res-grid">
      <div><span>Passport</span><b>${esc(r.passport)}</b></div>
      <div><span>Seats</span><b>${r.seats}</b></div>
      <div><span>Amount</span><b>${fmtMoney((r.price || 0) * (r.seats || 1))}</b></div>
    </div>
    ${r.status === 'pending' ? `<div class="res-actions">
      <button class="btn-sm btn-accept" data-act="accept" data-id="${r.id}"><i class="fas fa-check"></i> Accept</button>
      <button class="btn-sm btn-reject" data-act="reject" data-id="${r.id}"><i class="fas fa-xmark"></i> Reject</button>
    </div>` : ''}
  </div>`).join('');
}
async function onReservationAction(e) {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const id = btn.dataset.id; const r = allReservations.find(x => x.id === id); if (!r) return;
  if (btn.dataset.act === 'accept') { try { await updateDoc(doc(db,'reservations',id), { status: 'accepted' }); Swal.fire({ icon:'success', title:'Accepted', text:'Ticket issued to agent.', timer:1300, showConfirmButton:false }); } catch (err) { Swal.fire('Error', err.message, 'error'); } }
  if (btn.dataset.act === 'reject') {
    const c = await Swal.fire({ title:'Reject reservation?', text:'Seats will be returned to the group.', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444', confirmButtonText:'Reject' });
    if (!c.isConfirmed) return;
    try { await updateDoc(doc(db,'reservations',id), { status:'rejected' }); try { await updateDoc(doc(db,'groups',r.groupId), { availableSeats: increment(r.seats||0) }); } catch(_){} Swal.fire({ icon:'success', title:'Rejected', timer:1000, showConfirmButton:false }); }
    catch (err) { Swal.fire('Error', err.message, 'error'); }
  }
}

/* ============================== MY BOOKINGS (agent) */
function listenMyReservations() {
  const q = query(collection(db, 'reservations'));
  onSnapshot(q, snap => {
    myReservations = []; snap.forEach(d => { const data = d.data(); if (data.agentId === auth.currentUser.uid) myReservations.push({ id: d.id, ...data }); });
    myReservations.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderStats(); renderMyReservations();
  }, err => console.error(err));
}
function renderMyReservations() {
  const box = $('myResList'); if (!box) return;
  if (!myReservations.length) { box.innerHTML = `<div class="empty-state"><i class="fas fa-ticket"></i><div>No bookings yet. Reserve a seat from "Available Groups".</div></div>`; return; }
  box.innerHTML = myReservations.map(r => {
    if (r.status === 'accepted') {
      return `<div class="ticket">
        <div class="ticket-head"><div class="t-air"><i class="fas fa-plane-circle-check"></i> ${esc(r.airline)}</div><div class="t-ref">REF: ${r.id.slice(0,8).toUpperCase()}</div></div>
        <div class="ticket-body">
          <div class="t-col"><span>Passenger</span><b>${esc(r.customerName)}</b></div>
          <div class="t-col"><span>Passport</span><b>${esc(r.passport)}</b></div>
          <div class="t-col"><span>Route</span><b>${esc(r.route)}</b></div>
          <div class="t-col"><span>Date</span><b>${esc(r.date)}</b></div>
          <div class="t-col"><span>Seats</span><b>${r.seats}</b></div>
        </div>
        <div class="ticket-foot"><span><i class="fas fa-circle-check" style="color:#16a34a"></i> Confirmed · Total ${fmtMoney((r.price||0)*(r.seats||1))}</span><span>Al Saudia Travel</span></div>
      </div>`;
    }
    return `<div class="res-card ${r.status}">
      <div class="res-top"><div><div class="res-cust">${esc(r.customerName)}</div><div class="res-sub"><i class="fas fa-plane"></i> ${esc(r.route)} · ${esc(r.date)}</div></div>${statusBadge(r.status)}</div>
      <div class="res-grid"><div><span>Passport</span><b>${esc(r.passport)}</b></div><div><span>Seats</span><b>${r.seats}</b></div><div><span>Amount</span><b>${fmtMoney((r.price||0)*(r.seats||1))}</b></div></div>
      ${r.status === 'pending' ? `<div class="res-sub" style="margin-top:6px"><i class="fas fa-clock"></i> Waiting for admin approval...</div>` : ''}
    </div>`;
  }).join('');
}

/* ============================== AGENTS (admin) */
function listenAgents() {
  const q = query(collection(db, 'agents'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => { allAgents = []; snap.forEach(d => allAgents.push({ id: d.id, ...d.data() })); renderStats(); renderAgents(allAgents); },
    err => { $('agentsTableBody').innerHTML = `<tr><td colspan="6" class="loading-row">Error loading data.</td></tr>`; });
}
function renderAgents(list) {
  const body = $('agentsTableBody'); if (!body) return;
  if (!list.length) { body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-user-slash"></i><div>No agents yet.</div></div></td></tr>`; return; }
  body.innerHTML = list.map(a => {
    const active = a.active !== false;
    const roleBadge = a.role === 'admin' ? `<span class="badge badge-admin"><i class="fas fa-shield"></i> Admin</span>` : `<span class="badge badge-agent"><i class="fas fa-user"></i> Agent</span>`;
    const stBadge = active ? `<span class="badge badge-active">Active</span>` : `<span class="badge badge-inactive">Pending</span>`;
    const tIcon = active ? 'fa-user-slash' : 'fa-user-check';
    return `<tr>
      <td><div class="agent-cell"><div class="agent-avatar">${initials(a.name)}</div><div><div class="agent-name">${esc(a.name || '—')}</div><div class="agent-mail">${esc(a.email || '')}</div></div></div></td>
      <td>${esc(a.agency || '—')}</td><td>${esc(a.phone || '—')}</td><td>${roleBadge}</td><td>${stBadge}</td>
      <td><div class="row-actions" style="justify-content:flex-end">
        <button class="icon-btn toggle" title="${active ? 'Disable' : 'Approve'}" data-act="toggle" data-id="${a.id}" data-active="${active}"><i class="fas ${tIcon}"></i></button>
        <button class="icon-btn del" title="Delete" data-act="del" data-id="${a.id}" data-name="${esc(a.name || '')}"><i class="fas fa-trash"></i></button>
      </div></td></tr>`;
  }).join('');
}
function onSearch(e) { const t = e.target.value.toLowerCase(); renderAgents(allAgents.filter(a => (a.name||'').toLowerCase().includes(t) || (a.email||'').toLowerCase().includes(t) || (a.agency||'').toLowerCase().includes(t))); }
async function onAgentTableAction(e) {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'toggle') { const active = btn.dataset.active === 'true'; try { await updateDoc(doc(db,'agents',id), { active: !active }); Swal.fire({ icon:'success', title: active ? 'Disabled' : 'Enabled', timer:1000, showConfirmButton:false }); } catch (err) { Swal.fire('Error', err.message, 'error'); } }
  if (btn.dataset.act === 'del') {
    const r = await Swal.fire({ title:'Delete agent?', html:`Remove <b>${btn.dataset.name || 'this agent'}</b>?<br><small>Login account in Firebase Auth is not auto-deleted.</small>`, icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444', confirmButtonText:'Delete' });
    if (r.isConfirmed) { try { await deleteDoc(doc(db,'agents',id)); Swal.fire({ icon:'success', title:'Removed', timer:1000, showConfirmButton:false }); } catch (err) { Swal.fire('Error', err.message, 'error'); } }
  }
}
function onAddAgent() {
  Swal.fire({
    title: 'Add New Agent',
    html: `<input type="text" id="aName" class="swal2-input" placeholder="Full Name">
      <input type="email" id="aEmail" class="swal2-input" placeholder="Email Address">
      <input type="tel" id="aPhone" class="swal2-input" placeholder="Phone Number">
      <input type="text" id="aAgency" class="swal2-input" placeholder="Agency Name">
      <input type="password" id="aPass" class="swal2-input" placeholder="Temp Password (min 6)">
      <select id="aRole" class="swal2-input"><option value="agent">Role: Agent</option><option value="admin">Role: Admin</option></select>`,
    confirmButtonText: 'Create Account', confirmButtonColor: '#6c4ab6', showCancelButton: true,
    preConfirm: () => {
      const name=$('aName').value.trim(), email=$('aEmail').value.trim(), phone=$('aPhone').value.trim(), agency=$('aAgency').value.trim(), password=$('aPass').value, role=$('aRole').value;
      if (!name||!email||!phone||!agency||!password){Swal.showValidationMessage('Fill all fields');return false;}
      if (!isValidEmail(email)){Swal.showValidationMessage('Invalid email');return false;}
      if (password.length<6){Swal.showValidationMessage('Password min 6');return false;}
      return { name, email, phone, agency, password, role };
    }
  }).then(async result => {
    if (!result.isConfirmed) return;
    const { name, email, phone, agency, password, role } = result.value;
    const secondary = initializeApp(firebaseConfig, 'Secondary_' + Date.now()); const secAuth = getAuth(secondary);
    try { const cred = await createUserWithEmailAndPassword(secAuth, email, password);
      await setDoc(doc(db, 'agents', cred.user.uid), { name, email, phone, agency, role, active: true, createdAt: serverTimestamp() });
      await signOut(secAuth); Swal.fire({ icon:'success', title:'Agent created!', text: name + ' can now log in.', timer:1700, showConfirmButton:false });
    } catch (err) { const map = { 'auth/email-already-in-use':'Email already exists.', 'auth/weak-password':'Password too weak (min 6).', 'auth/invalid-email':'Invalid email.' }; Swal.fire('Error', map[err.code] || err.message, 'error'); }
    finally { try { await deleteApp(secondary); } catch (_) {} }
  });
}

/* ============================== HELPERS */
function showAlert(message, type = 'info', duration = 3500) {
  const box = $('alertContainer'); if (!box) return;
  const div = document.createElement('div'); div.className = `alert alert-${type}`;
  const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
  div.innerHTML = `${icon} ${message}`; box.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, duration);
}
const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const initials = (n = '') => n.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase() || 'A';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtMoney = n => 'PKR ' + Number(n || 0).toLocaleString();
function firebaseMsg(code) {
  const map = { 'auth/invalid-email':'Email address is not valid.', 'auth/user-disabled':'This account has been disabled.', 'auth/user-not-found':'No account found with this email.', 'auth/wrong-password':'Incorrect password.', 'auth/invalid-credential':'Incorrect email or password.', 'auth/too-many-requests':'Too many attempts. Try again later.', 'auth/email-already-in-use':'An account with this email already exists.', 'auth/weak-password':'Password should be at least 6 characters.', 'auth/network-request-failed':'Network error. Check your connection.' };
  return map[code] || 'Something went wrong. Please try again.';
}
