/* ============================================================
   AL SAUDIA TRAVEL AGENCY  —  app.js
   Login + Dashboard + Group Booking + Firebase
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

/* Firebase config (Al Saudia project) */
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
let currentRole = 'agent';
let currentProfile = {};
let allAgents = [], allGroups = [], allReservations = [], myReservations = [];

document.addEventListener('DOMContentLoaded', () => {

  /* PRELOADER */
  const preloader = document.querySelector('.preloader');
  window.addEventListener('load', () => {
    setTimeout(() => { preloader?.classList.add('fade-out'); setTimeout(() => { if (preloader) preloader.style.display = 'none'; }, 500); }, 700);
  });

  if (window.AOS) AOS.init({ duration: 1000, once: true, offset: 100 });

  /* MOBILE MENU */
  const mobileToggle = $('mobileToggle'); const mainNav = $('mainNav');
  mobileToggle?.addEventListener('click', () => {
    mainNav.classList.toggle('active');
    const i = mobileToggle.querySelector('i'); i?.classList.toggle('fa-bars'); i?.classList.toggle('fa-times');
  });
  document.querySelectorAll('.dropdown').forEach(dd => {
    dd.querySelector('a')?.addEventListener('click', e => { if (window.innerWidth <= 992) { e.preventDefault(); dd.classList.toggle('active'); } });
  });

  /* PASSWORD TOGGLE */
  const tp = $('togglePassword'); const pf = $('password');
  tp?.addEventListener('click', () => {
    const t = pf.getAttribute('type') === 'password' ? 'text' : 'password'; pf.setAttribute('type', t);
    const i = tp.querySelector('i'); i?.classList.toggle('fa-eye-slash'); i?.classList.toggle('fa-eye');
  });

  /* MARQUEE */
  const airlines = [
    { name: 'Saudia Airlines', color: '#0a5c7e' }, { name: 'Emirates', color: '#d4a53a' },
    { name: 'Qatar Airways', color: '#8B1E3F' }, { name: 'Etihad Airways', color: '#2B5B2B' },
    { name: 'Turkish Airlines', color: '#E30A17' }, { name: 'Fly Dubai', color: '#FF6600' },
    { name: 'Air Arabia', color: '#003366' }, { name: 'Gulf Air', color: '#C00000' }
  ];
  const mc = $('marqueeContent');
  if (mc) mc.innerHTML = [...airlines, ...airlines].map(a => `<div class="partner-item"><i class="fas fa-plane" style="color:${a.color}"></i><span>${a.name}</span></div>`).join('');

  /* LOGIN / AUTH ACTIONS */
  $('loginForm')?.addEventListener('submit', onLogin);
  $('forgotPassword')?.addEventListener('click', onForgot);
  $('registerBtn')?.addEventListener('click', e => { e.preventDefault(); onRegister(); });
  $('registerNow')?.addEventListener('click', e => { e.preventDefault(); onRegister(); });

  /* DASHBOARD CONTROLS */
  $('logoutBtn')?.addEventListener('click', onLogout);
  $('headerLogout')?.addEventListener('click', e => { e.preventDefault(); onLogout(); });
  $('addAgentBtn')?.addEventListener('click', onAddAgent);
  $('addGroupBtn')?.addEventListener('click', onAddGroup);
  $('searchInput')?.addEventListener('input', onSearch);
  $('agentsTableBody')?.addEventListener('click', onAgentTableAction);
  $('groupsTableBody')?.addEventListener('click', onGroupTableAction);
  $('reservationsList')?.addEventListener('click', onReservationAction);
  $('availableGroupsList')?.addEventListener('click', onAvailableAction);

  /* TABS */
  $('dashTabs')?.addEventListener('click', e => {
    const b = e.target.closest('.dash-tab'); if (b) switchTab(b.dataset.tab);
  });

  /* remember me prefill */
  const rem = localStorage.getItem('rememberedUser');
  if (rem) { const ei = $('email'); const rc = $('rememberMe'); if (ei) ei.value = rem; if (rc) rc.checked = true; }

  onAuthStateChanged(auth, handleAuth);
});

/* ============================================================ VIEW SWITCH */
function showLogin() {
  $('loginView').style.display = '';
  $('dashboardView').style.display = 'none';
  $('headerGuest').style.display = '';
  $('headerUser').style.display = 'none';
  const nav = document.querySelector('.main-nav'); if (nav) nav.style.removeProperty('display');
}

function showDashboard(profile) {
  $('loginView').style.display = 'none';
  $('dashboardView').style.display = '';
  $('headerGuest').style.display = 'none';
  $('headerUser').style.display = '';
  const nav = document.querySelector('.main-nav'); if (nav) nav.style.display = 'none';

  $('userName').textContent = profile.name || 'Agent';
  $('userRoleLine').textContent = currentRole === 'admin' ? 'Administrator — manage groups, bookings & agents' : 'Travel Agent — book group seats for your customers';

  // show only this role's tabs
  document.querySelectorAll('.dash-tab').forEach(b => b.style.display = (b.dataset.for === currentRole) ? '' : 'none');

  // stat labels per role
  if (currentRole === 'admin') {
    setLabels('Groups', 'Seats Available', 'Pending', 'Agents');
    listenGroups(); listenReservationsAdmin(); listenAgents();
    switchTab('panelGroups');
  } else {
    setLabels('Open Groups', 'My Bookings', 'Pending', 'Confirmed');
    listenGroups(); listenMyReservations();
    switchTab('panelAvailable');
  }
}

function setLabels(a, b, c, d) { $('lbl1').textContent = a; $('lbl2').textContent = b; $('lbl3').textContent = c; $('lbl4').textContent = d; }

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
  currentRole = data.role || 'agent';
  currentProfile = { id: user.uid, ...data };
  showDashboard(data);
}

/* ============================================================ AUTH */
async function onLogin(e) {
  e.preventDefault();
  const email = $('email').value.trim(); const password = $('password').value;
  const rememberMe = $('rememberMe')?.checked || false;
  if (!email || !password) return showAlert('Please enter both email and password', 'error');
  if (!isValidEmail(email)) return showAlert('Please enter a valid email address', 'error');
  const btn = $('loginBtn'); const txt = btn?.querySelector('.btn-text'); const original = txt ? txt.textContent : 'Login';
  if (btn) { btn.disabled = true; if (txt) txt.textContent = 'Logging in...'; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    if (rememberMe) localStorage.setItem('rememberedUser', email); else localStorage.removeItem('rememberedUser');
  } catch (err) { showAlert(firebaseMsg(err.code), 'error'); }
  finally { if (btn) { btn.disabled = false; if (txt) txt.textContent = original; } }
}

async function onLogout() { await signOut(auth); showLogin(); }

function onForgot(e) {
  e.preventDefault();
  Swal.fire({ title: 'Reset Password', text: 'Enter your email to receive a reset link', input: 'email',
    inputPlaceholder: 'agent@alsaudia.com', showCancelButton: true, confirmButtonColor: '#0a5c7e', confirmButtonText: 'Send Reset Link'
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      try { await sendPasswordResetEmail(auth, r.value); Swal.fire('Email Sent!', 'Reset link sent to ' + r.value, 'success'); }
      catch (err) { Swal.fire('Error!', firebaseMsg(err.code), 'error'); }
    }
  });
}

function onRegister() {
  Swal.fire({
    title: 'Create Agent Account',
    html: `<input type="text" id="regName" class="swal2-input" placeholder="Full Name">
      <input type="email" id="regEmail" class="swal2-input" placeholder="Email Address">
      <input type="tel" id="regPhone" class="swal2-input" placeholder="Phone Number">
      <input type="text" id="regAgency" class="swal2-input" placeholder="Agency Name">
      <input type="password" id="regPassword" class="swal2-input" placeholder="Password (min 8 chars)">`,
    confirmButtonText: 'Register', confirmButtonColor: '#0a5c7e', showCancelButton: true,
    preConfirm: () => {
      const name = $('regName')?.value.trim(), email = $('regEmail')?.value.trim(), phone = $('regPhone')?.value.trim(),
            agency = $('regAgency')?.value.trim(), password = $('regPassword')?.value;
      if (!name || !email || !phone || !agency || !password) { Swal.showValidationMessage('Please fill all fields'); return false; }
      if (!isValidEmail(email)) { Swal.showValidationMessage('Valid email required'); return false; }
      if (password.length < 8) { Swal.showValidationMessage('Password min 8 characters'); return false; }
      return { name, email, phone, agency, password };
    }
  }).then(async result => {
    if (!result.isConfirmed) return;
    const { name, email, phone, agency, password } = result.value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'agents', cred.user.uid), { name, email, phone, agency, role: 'agent', active: false, createdAt: serverTimestamp() });
      await signOut(auth);
      Swal.fire('Registration Submitted!', 'Account pending admin approval. You can log in once approved.', 'success');
    } catch (err) { Swal.fire('Error!', firebaseMsg(err.code), 'error'); }
  });
}

/* ============================================================ STATS */
function renderStats() {
  if (currentRole === 'admin') {
    $('stat1').textContent = allGroups.length;
    $('stat2').textContent = allGroups.reduce((s, g) => s + (g.availableSeats || 0), 0);
    const pend = allReservations.filter(r => r.status === 'pending').length;
    $('stat3').textContent = pend;
    $('stat4').textContent = allAgents.length;
    const dot = $('pendingDot'); if (dot) dot.style.display = pend > 0 ? '' : 'none';
  } else {
    $('stat1').textContent = allGroups.filter(g => (g.availableSeats || 0) > 0).length;
    $('stat2').textContent = myReservations.length;
    $('stat3').textContent = myReservations.filter(r => r.status === 'pending').length;
    $('stat4').textContent = myReservations.filter(r => r.status === 'accepted').length;
  }
}

/* ============================================================ GROUPS */
function listenGroups() {
  const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allGroups = []; snap.forEach(d => allGroups.push({ id: d.id, ...d.data() }));
    renderStats();
    if (currentRole === 'admin') renderGroupsAdmin(); else renderAvailableGroups();
  }, err => { console.error(err); });
}

function onAddGroup() {
  Swal.fire({
    title: 'Add Flight Group',
    html: `<input type="text" id="gAirline" class="swal2-input" placeholder="Airline (e.g. Saudia)">
      <input type="text" id="gFrom" class="swal2-input" placeholder="From (e.g. Karachi)">
      <input type="text" id="gTo" class="swal2-input" placeholder="To (e.g. Jeddah)">
      <input type="date" id="gDate" class="swal2-input">
      <input type="number" id="gSeats" class="swal2-input" placeholder="Total Seats (e.g. 50)">
      <input type="number" id="gPrice" class="swal2-input" placeholder="Price per seat (PKR)">`,
    confirmButtonText: 'Add Group', confirmButtonColor: '#0a5c7e', showCancelButton: true,
    preConfirm: () => {
      const airline = $('gAirline').value.trim(), from = $('gFrom').value.trim(), to = $('gTo').value.trim(),
            date = $('gDate').value, seats = parseInt($('gSeats').value), price = parseInt($('gPrice').value);
      if (!airline || !from || !to || !date) { Swal.showValidationMessage('Fill airline, route and date'); return false; }
      if (!seats || seats < 1) { Swal.showValidationMessage('Enter valid seats'); return false; }
      if (!price || price < 1) { Swal.showValidationMessage('Enter valid price'); return false; }
      return { airline, from, to, date, seats, price };
    }
  }).then(async r => {
    if (!r.isConfirmed) return;
    const { airline, from, to, date, seats, price } = r.value;
    try {
      await addDoc(collection(db, 'groups'), {
        airline, from, to, date, price, totalSeats: seats, availableSeats: seats,
        createdBy: auth.currentUser.uid, createdAt: serverTimestamp()
      });
      Swal.fire({ icon: 'success', title: 'Group added!', timer: 1300, showConfirmButton: false });
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
  });
}

function seatPill(g) {
  const a = g.availableSeats || 0, t = g.totalSeats || 0;
  const cls = a === 0 ? 'none' : (a <= 5 ? 'low' : '');
  return `<span class="seats-pill ${cls}"><i class="fas fa-chair"></i> ${a}/${t}</span>`;
}

function renderGroupsAdmin() {
  const body = $('groupsTableBody'); if (!body) return;
  if (!allGroups.length) { body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-layer-group"></i><div>No groups yet. Click "Add Group".</div></div></td></tr>`; return; }
  body.innerHTML = allGroups.map(g => `<tr>
    <td><b>${esc(g.from)} → ${esc(g.to)}</b></td>
    <td>${esc(g.airline)}</td>
    <td>${esc(g.date)}</td>
    <td>${fmtMoney(g.price)}</td>
    <td>${seatPill(g)}</td>
    <td><div class="row-actions" style="justify-content:flex-end">
      <button class="icon-btn del" title="Delete group" data-act="del" data-id="${g.id}" data-name="${esc(g.from)} → ${esc(g.to)}"><i class="fas fa-trash"></i></button>
    </div></td></tr>`).join('');
}

function onGroupTableAction(e) {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  if (btn.dataset.act === 'del') {
    Swal.fire({ title: 'Delete group?', html: `Remove <b>${btn.dataset.name}</b>?<br><small>Existing bookings stay in records.</small>`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete'
    }).then(async r => {
      if (r.isConfirmed) { try { await deleteDoc(doc(db, 'groups', btn.dataset.id)); Swal.fire({ icon: 'success', title: 'Deleted', timer: 1100, showConfirmButton: false }); } catch (err) { Swal.fire('Error', err.message, 'error'); } }
    });
  }
}

/* ---- Agent: available groups ---- */
function renderAvailableGroups() {
  const box = $('availableGroupsList'); if (!box) return;
  const list = allGroups;
  if (!list.length) { box.innerHTML = `<div class="empty-state"><i class="fas fa-plane-slash"></i><div>No groups available right now.</div></div>`; return; }
  box.innerHTML = list.map(g => {
    const a = g.availableSeats || 0;
    const sold = a === 0;
    return `<div class="group-card">
      <div class="gc-route"><i class="fas fa-plane"></i> ${esc(g.from)} → ${esc(g.to)}</div>
      <div class="gc-airline">${esc(g.airline)}</div>
      <div class="gc-meta">
        <div><span>Date</span><b>${esc(g.date)}</b></div>
        <div><span>Price/seat</span><b>${fmtMoney(g.price)}</b></div>
      </div>
      ${seatPill(g)}
      <div class="gc-actions">
        <button class="btn-sm btn-reserve" data-id="${g.id}" ${sold ? 'disabled' : ''}>
          <i class="fas fa-ticket"></i> ${sold ? 'Sold Out' : 'Reserve Seat'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function onAvailableAction(e) {
  const btn = e.target.closest('.btn-reserve'); if (!btn || btn.disabled) return;
  const g = allGroups.find(x => x.id === btn.dataset.id); if (!g) return;
  Swal.fire({
    title: 'Reserve Seats',
    html: `<div style="text-align:left;font-size:13px;color:#64748b;margin-bottom:8px">
        <b>${esc(g.from)} → ${esc(g.to)}</b> · ${esc(g.airline)}<br>${esc(g.date)} · ${fmtMoney(g.price)}/seat · ${g.availableSeats} left</div>
      <input type="text" id="rCust" class="swal2-input" placeholder="Customer Full Name">
      <input type="text" id="rPass" class="swal2-input" placeholder="Passport Number">
      <input type="number" id="rSeats" class="swal2-input" placeholder="Number of seats" value="1" min="1" max="${g.availableSeats}">`,
    confirmButtonText: 'Confirm Reservation', confirmButtonColor: '#0a5c7e', showCancelButton: true,
    preConfirm: () => {
      const customerName = $('rCust').value.trim(), passport = $('rPass').value.trim(), seats = parseInt($('rSeats').value);
      if (!customerName || !passport) { Swal.showValidationMessage('Enter customer name and passport'); return false; }
      if (!seats || seats < 1) { Swal.showValidationMessage('Enter valid seats'); return false; }
      if (seats > (g.availableSeats || 0)) { Swal.showValidationMessage('Only ' + g.availableSeats + ' seat(s) left'); return false; }
      return { customerName, passport, seats };
    }
  }).then(async r => {
    if (!r.isConfirmed) return;
    try { await doReserve(g, r.value.customerName, r.value.passport, r.value.seats);
      Swal.fire({ icon: 'success', title: 'Reserved!', text: 'Sent to admin for approval.', timer: 1700, showConfirmButton: false });
    } catch (err) { Swal.fire('Could not reserve', err.message, 'error'); }
  });
}

async function doReserve(group, customerName, passport, seats) {
  const resRef = doc(collection(db, 'reservations'));
  await runTransaction(db, async tx => {
    const gRef = doc(db, 'groups', group.id);
    const g = await tx.get(gRef);
    if (!g.exists()) throw new Error('Group no longer exists');
    const avail = g.data().availableSeats ?? 0;
    if (seats > avail) throw new Error('Only ' + avail + ' seat(s) left');
    tx.update(gRef, { availableSeats: avail - seats });
    tx.set(resRef, {
      groupId: group.id, airline: g.data().airline, route: g.data().from + ' → ' + g.data().to,
      date: g.data().date, price: g.data().price,
      agentId: auth.currentUser.uid, agentName: currentProfile.name || '', agentAgency: currentProfile.agency || '',
      customerName, passport, seats, status: 'pending', createdAt: serverTimestamp()
    });
  });
}

/* ============================================================ RESERVATIONS (admin) */
function listenReservationsAdmin() {
  const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allReservations = []; snap.forEach(d => allReservations.push({ id: d.id, ...d.data() }));
    renderStats(); renderReservationsAdmin();
  }, err => console.error(err));
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

  if (btn.dataset.act === 'accept') {
    try { await updateDoc(doc(db, 'reservations', id), { status: 'accepted' });
      Swal.fire({ icon: 'success', title: 'Accepted', text: 'Ticket issued to agent.', timer: 1300, showConfirmButton: false });
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
  }

  if (btn.dataset.act === 'reject') {
    const c = await Swal.fire({ title: 'Reject reservation?', text: 'Seats will be returned to the group.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Reject' });
    if (!c.isConfirmed) return;
    try {
      await updateDoc(doc(db, 'reservations', id), { status: 'rejected' });
      try { await updateDoc(doc(db, 'groups', r.groupId), { availableSeats: increment(r.seats || 0) }); } catch (_) {}
      Swal.fire({ icon: 'success', title: 'Rejected', timer: 1100, showConfirmButton: false });
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
  }
}

/* ============================================================ MY RESERVATIONS (agent) */
function listenMyReservations() {
  // no orderBy here to avoid needing a composite index; we sort client-side
  const q = query(collection(db, 'reservations'));
  onSnapshot(q, snap => {
    myReservations = [];
    snap.forEach(d => { const data = d.data(); if (data.agentId === auth.currentUser.uid) myReservations.push({ id: d.id, ...data }); });
    myReservations.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderStats(); renderMyReservations();
  }, err => console.error(err));
}

function renderMyReservations() {
  const box = $('myResList'); if (!box) return;
  if (!myReservations.length) { box.innerHTML = `<div class="empty-state"><i class="fas fa-ticket"></i><div>No bookings yet. Reserve a seat from "Available Groups".</div></div>`; return; }
  box.innerHTML = myReservations.map(r => {
    if (r.status === 'accepted') {
      return `<div class="ticket">
        <div class="ticket-head">
          <div class="t-air"><i class="fas fa-plane-circle-check"></i> ${esc(r.airline)}</div>
          <div class="t-ref">REF: ${r.id.slice(0, 8).toUpperCase()}</div>
        </div>
        <div class="ticket-body">
          <div class="t-col"><span>Passenger</span><b>${esc(r.customerName)}</b></div>
          <div class="t-col"><span>Passport</span><b>${esc(r.passport)}</b></div>
          <div class="t-col"><span>Route</span><b>${esc(r.route)}</b></div>
          <div class="t-col"><span>Date</span><b>${esc(r.date)}</b></div>
          <div class="t-col"><span>Seats</span><b>${r.seats}</b></div>
        </div>
        <div class="ticket-foot"><span><i class="fas fa-circle-check" style="color:#10b981"></i> Confirmed · Total ${fmtMoney((r.price || 0) * (r.seats || 1))}</span><span>Al Saudia Travel</span></div>
      </div>`;
    }
    return `<div class="res-card ${r.status}">
      <div class="res-top">
        <div><div class="res-cust">${esc(r.customerName)}</div><div class="res-sub"><i class="fas fa-plane"></i> ${esc(r.route)} · ${esc(r.date)}</div></div>
        ${statusBadge(r.status)}
      </div>
      <div class="res-grid">
        <div><span>Passport</span><b>${esc(r.passport)}</b></div>
        <div><span>Seats</span><b>${r.seats}</b></div>
        <div><span>Amount</span><b>${fmtMoney((r.price || 0) * (r.seats || 1))}</b></div>
      </div>
      ${r.status === 'pending' ? `<div class="res-sub" style="margin-top:6px"><i class="fas fa-clock"></i> Waiting for admin approval...</div>` : ''}
    </div>`;
  }).join('');
}

/* ============================================================ AGENTS (admin) */
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
    const statusBadge = active ? `<span class="badge badge-active">Active</span>` : `<span class="badge badge-inactive">Pending</span>`;
    const tIcon = active ? 'fa-user-slash' : 'fa-user-check';
    return `<tr>
      <td><div class="agent-cell"><div class="agent-avatar">${initials(a.name)}</div><div><div class="agent-name">${esc(a.name || '—')}</div><div class="agent-mail">${esc(a.email || '')}</div></div></div></td>
      <td>${esc(a.agency || '—')}</td><td>${esc(a.phone || '—')}</td><td>${roleBadge}</td><td>${statusBadge}</td>
      <td><div class="row-actions" style="justify-content:flex-end">
        <button class="icon-btn toggle" title="${active ? 'Disable' : 'Approve'}" data-act="toggle" data-id="${a.id}" data-active="${active}"><i class="fas ${tIcon}"></i></button>
        <button class="icon-btn del" title="Delete" data-act="del" data-id="${a.id}" data-name="${esc(a.name || '')}"><i class="fas fa-trash"></i></button>
      </div></td></tr>`;
  }).join('');
}

function onSearch(e) {
  const t = e.target.value.toLowerCase();
  renderAgents(allAgents.filter(a => (a.name || '').toLowerCase().includes(t) || (a.email || '').toLowerCase().includes(t) || (a.agency || '').toLowerCase().includes(t)));
}

async function onAgentTableAction(e) {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'toggle') {
    const active = btn.dataset.active === 'true';
    try { await updateDoc(doc(db, 'agents', id), { active: !active }); Swal.fire({ icon: 'success', title: active ? 'Disabled' : 'Enabled', timer: 1000, showConfirmButton: false }); }
    catch (err) { Swal.fire('Error', err.message, 'error'); }
  }
  if (btn.dataset.act === 'del') {
    const r = await Swal.fire({ title: 'Delete agent?', html: `Remove <b>${btn.dataset.name || 'this agent'}</b>?<br><small>Login account in Firebase Auth is not auto-deleted.</small>`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete' });
    if (r.isConfirmed) { try { await deleteDoc(doc(db, 'agents', id)); Swal.fire({ icon: 'success', title: 'Removed', timer: 1000, showConfirmButton: false }); } catch (err) { Swal.fire('Error', err.message, 'error'); } }
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
    confirmButtonText: 'Create Account', confirmButtonColor: '#0a5c7e', showCancelButton: true,
    preConfirm: () => {
      const name = $('aName').value.trim(), email = $('aEmail').value.trim(), phone = $('aPhone').value.trim(),
            agency = $('aAgency').value.trim(), password = $('aPass').value, role = $('aRole').value;
      if (!name || !email || !phone || !agency || !password) { Swal.showValidationMessage('Fill all fields'); return false; }
      if (!isValidEmail(email)) { Swal.showValidationMessage('Invalid email'); return false; }
      if (password.length < 6) { Swal.showValidationMessage('Password min 6'); return false; }
      return { name, email, phone, agency, password, role };
    }
  }).then(async result => {
    if (!result.isConfirmed) return;
    const { name, email, phone, agency, password, role } = result.value;
    const secondary = initializeApp(firebaseConfig, 'Secondary_' + Date.now());
    const secAuth = getAuth(secondary);
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, email, password);
      await setDoc(doc(db, 'agents', cred.user.uid), { name, email, phone, agency, role, active: true, createdAt: serverTimestamp() });
      await signOut(secAuth);
      Swal.fire({ icon: 'success', title: 'Agent created!', text: name + ' can now log in.', timer: 1700, showConfirmButton: false });
    } catch (err) {
      const map = { 'auth/email-already-in-use': 'Email already exists.', 'auth/weak-password': 'Password too weak (min 6).', 'auth/invalid-email': 'Invalid email.' };
      Swal.fire('Error', map[err.code] || err.message, 'error');
    } finally { try { await deleteApp(secondary); } catch (_) {} }
  });
}

/* ============================================================ HELPERS */
function showAlert(message, type = 'info', duration = 3500) {
  const box = $('alertContainer'); if (!box) return;
  const div = document.createElement('div'); div.className = `alert alert-${type}`;
  const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
  div.innerHTML = `${icon} ${message}`; box.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, duration);
}
const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const initials = (n = '') => n.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'A';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = n => 'PKR ' + Number(n || 0).toLocaleString();
function firebaseMsg(code) {
  const map = {
    'auth/invalid-email': 'Email address is not valid.', 'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.', 'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.', 'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/email-already-in-use': 'An account with this email already exists.', 'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}
