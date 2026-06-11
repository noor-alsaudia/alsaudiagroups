/* ============================================================
   AL SAUDIA TRAVEL AGENCY  —  app.js  (sab kuch ek file mein)
   Login + Dashboard + Firebase
   ------------------------------------------------------------
   👉 NEECHE firebaseConfig mein apni 6 values paste karein.
   ============================================================ */

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, deleteDoc, updateDoc,
  onSnapshot, serverTimestamp, query, orderBy
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
let allAgents = [];

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- PRELOADER ---------- */
  const preloader = document.querySelector('.preloader');
  window.addEventListener('load', () => {
    setTimeout(() => { preloader?.classList.add('fade-out'); setTimeout(() => { if (preloader) preloader.style.display = 'none'; }, 500); }, 700);
  });

  /* ---------- AOS ---------- */
  if (window.AOS) AOS.init({ duration: 1000, once: true, offset: 100 });

  /* ---------- MOBILE MENU ---------- */
  const mobileToggle = $('mobileToggle');
  const mainNav = $('mainNav');
  mobileToggle?.addEventListener('click', () => {
    mainNav.classList.toggle('active');
    const i = mobileToggle.querySelector('i');
    i?.classList.toggle('fa-bars'); i?.classList.toggle('fa-times');
  });
  document.querySelectorAll('.dropdown').forEach(dd => {
    dd.querySelector('a')?.addEventListener('click', e => {
      if (window.innerWidth <= 992) { e.preventDefault(); dd.classList.toggle('active'); }
    });
  });

  /* ---------- PASSWORD TOGGLE ---------- */
  const togglePassword = $('togglePassword');
  const passwordField = $('password');
  togglePassword?.addEventListener('click', () => {
    const t = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', t);
    const i = togglePassword.querySelector('i');
    i?.classList.toggle('fa-eye-slash'); i?.classList.toggle('fa-eye');
  });

  /* ---------- AIRLINE MARQUEE ---------- */
  const airlines = [
    { name: 'Saudia Airlines', color: '#0a5c7e' }, { name: 'Emirates', color: '#d4a53a' },
    { name: 'Qatar Airways', color: '#8B1E3F' }, { name: 'Etihad Airways', color: '#2B5B2B' },
    { name: 'Turkish Airlines', color: '#E30A17' }, { name: 'Fly Dubai', color: '#FF6600' },
    { name: 'Air Arabia', color: '#003366' }, { name: 'Gulf Air', color: '#C00000' }
  ];
  const mc = $('marqueeContent');
  if (mc) mc.innerHTML = [...airlines, ...airlines]
    .map(a => `<div class="partner-item"><i class="fas fa-plane" style="color:${a.color}"></i><span>${a.name}</span></div>`).join('');

  /* ---------- LOGIN FORM ---------- */
  $('loginForm')?.addEventListener('submit', onLogin);
  $('forgotPassword')?.addEventListener('click', onForgot);
  $('registerBtn')?.addEventListener('click', e => { e.preventDefault(); onRegister(); });
  $('registerNow')?.addEventListener('click', e => { e.preventDefault(); onRegister(); });

  /* ---------- DASHBOARD CONTROLS ---------- */
  $('logoutBtn')?.addEventListener('click', onLogout);
  $('headerLogout')?.addEventListener('click', e => { e.preventDefault(); onLogout(); });
  $('addAgentBtn')?.addEventListener('click', onAddAgent);
  $('searchInput')?.addEventListener('input', onSearch);
  $('agentsTableBody')?.addEventListener('click', onTableAction);

  /* ---------- remember-me prefill ---------- */
  const remembered = localStorage.getItem('rememberedUser');
  if (remembered) { const ei = $('email'); const rc = $('rememberMe'); if (ei) ei.value = remembered; if (rc) rc.checked = true; }

  /* ---------- AUTH STATE = view switcher ---------- */
  onAuthStateChanged(auth, handleAuth);
});

/* ============================================================
   VIEW SWITCHING
   ============================================================ */
function showLogin() {
  $('loginView').style.display = '';
  $('dashboardView').style.display = 'none';
  $('headerGuest').style.display = '';
  $('headerUser').style.display = 'none';
  document.querySelector('.main-nav')?.style.removeProperty('display');
}
function showDashboard(profile) {
  $('loginView').style.display = 'none';
  $('dashboardView').style.display = '';
  $('headerGuest').style.display = 'none';
  $('headerUser').style.display = '';
  const nav = document.querySelector('.main-nav'); if (nav) nav.style.display = 'none';

  $('userName').textContent = profile.name || 'Agent';
  $('userRoleLine').textContent = currentRole === 'admin' ? 'Administrator — manage all agents' : 'Agent account';

  if (currentRole === 'admin') {
    $('adminPanel').style.display = '';
    $('agentPanel').style.display = 'none';
    listenToAgents();
  } else {
    $('adminPanel').style.display = 'none';
    $('agentPanel').style.display = '';
  }
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
  showDashboard(data);
}

/* ============================================================
   AUTH ACTIONS
   ============================================================ */
async function onLogin(e) {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const rememberMe = $('rememberMe')?.checked || false;

  if (!email || !password) return showAlert('Please enter both email and password', 'error');
  if (!isValidEmail(email)) return showAlert('Please enter a valid email address', 'error');

  const btn = $('loginBtn'); const txt = btn?.querySelector('.btn-text');
  const original = txt ? txt.textContent : 'Login';
  if (btn) { btn.disabled = true; if (txt) txt.textContent = 'Logging in...'; }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    if (rememberMe) localStorage.setItem('rememberedUser', email); else localStorage.removeItem('rememberedUser');
    // onAuthStateChanged will switch the view (and run active-check)
  } catch (err) {
    showAlert(firebaseMsg(err.code), 'error');
  } finally {
    if (btn) { btn.disabled = false; if (txt) txt.textContent = original; }
  }
}

async function onLogout() {
  await signOut(auth);
  showLogin();
}

function onForgot(e) {
  e.preventDefault();
  Swal.fire({
    title: 'Reset Password', text: 'Enter your email to receive a reset link',
    input: 'email', inputPlaceholder: 'agent@alsaudiatravel.com',
    showCancelButton: true, confirmButtonColor: '#0a5c7e', confirmButtonText: 'Send Reset Link'
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
    html: `
      <input type="text"  id="regName"   class="swal2-input" placeholder="Full Name">
      <input type="email" id="regEmail"  class="swal2-input" placeholder="Email Address">
      <input type="tel"   id="regPhone"  class="swal2-input" placeholder="Phone Number">
      <input type="text"  id="regAgency" class="swal2-input" placeholder="Agency Name">
      <input type="password" id="regPassword" class="swal2-input" placeholder="Password (min 8 chars)">`,
    confirmButtonText: 'Register', confirmButtonColor: '#0a5c7e', showCancelButton: true,
    preConfirm: () => {
      const name = $('regName')?.value.trim(), email = $('regEmail')?.value.trim(),
            phone = $('regPhone')?.value.trim(), agency = $('regAgency')?.value.trim(),
            password = $('regPassword')?.value;
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
      await setDoc(doc(db, 'agents', cred.user.uid), {
        name, email, phone, agency, role: 'agent', active: false, createdAt: serverTimestamp()
      });
      await signOut(auth);
      Swal.fire('Registration Submitted!', 'Account pending admin approval. You can log in once approved.', 'success');
    } catch (err) { Swal.fire('Error!', firebaseMsg(err.code), 'error'); }
  });
}

/* ============================================================
   AGENT MANAGEMENT (admin)
   ============================================================ */
function listenToAgents() {
  const q = query(collection(db, 'agents'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allAgents = []; snap.forEach(d => allAgents.push({ id: d.id, ...d.data() }));
    renderStats(); renderTable(allAgents);
  }, err => {
    console.error(err);
    $('agentsTableBody').innerHTML = `<tr><td colspan="6" class="loading-row">Error loading data. Check Firestore rules.</td></tr>`;
  });
}

function renderStats() {
  $('statTotal').textContent   = allAgents.length;
  $('statActive').textContent  = allAgents.filter(a => a.active !== false).length;
  $('statPending').textContent = allAgents.filter(a => a.active === false).length;
  $('statAdmins').textContent  = allAgents.filter(a => a.role === 'admin').length;
}

function renderTable(list) {
  const body = $('agentsTableBody');
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-user-slash"></i><div>No agents yet. Click "Add Agent" to create one.</div></div></td></tr>`;
    return;
  }
  body.innerHTML = list.map(a => {
    const active = a.active !== false;
    const roleBadge = a.role === 'admin'
      ? `<span class="badge badge-admin"><i class="fas fa-shield"></i> Admin</span>`
      : `<span class="badge badge-agent"><i class="fas fa-user"></i> Agent</span>`;
    const statusBadge = active ? `<span class="badge badge-active">Active</span>` : `<span class="badge badge-inactive">Pending</span>`;
    const tIcon = active ? 'fa-user-slash' : 'fa-user-check';
    const tTitle = active ? 'Disable account' : 'Approve / enable';
    return `<tr>
      <td><div class="agent-cell"><div class="agent-avatar">${initials(a.name)}</div>
        <div><div class="agent-name">${esc(a.name || '—')}</div><div class="agent-mail">${esc(a.email || '')}</div></div></div></td>
      <td>${esc(a.agency || '—')}</td>
      <td>${esc(a.phone || '—')}</td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td><div class="row-actions" style="justify-content:flex-end">
        <button class="icon-btn toggle" title="${tTitle}" data-act="toggle" data-id="${a.id}" data-active="${active}"><i class="fas ${tIcon}"></i></button>
        <button class="icon-btn del" title="Delete" data-act="del" data-id="${a.id}" data-name="${esc(a.name || '')}"><i class="fas fa-trash"></i></button>
      </div></td></tr>`;
  }).join('');
}

function onSearch(e) {
  const t = e.target.value.toLowerCase();
  renderTable(allAgents.filter(a =>
    (a.name || '').toLowerCase().includes(t) ||
    (a.email || '').toLowerCase().includes(t) ||
    (a.agency || '').toLowerCase().includes(t)));
}

async function onTableAction(e) {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.act === 'toggle') {
    const active = btn.dataset.active === 'true';
    try { await updateDoc(doc(db, 'agents', id), { active: !active });
      Swal.fire({ icon: 'success', title: active ? 'Disabled' : 'Enabled', timer: 1100, showConfirmButton: false }); }
    catch (err) { Swal.fire('Error', err.message, 'error'); }
  }

  if (btn.dataset.act === 'del') {
    const r = await Swal.fire({
      title: 'Delete agent?',
      html: `Remove <b>${btn.dataset.name || 'this agent'}</b> from the list.<br><small>Login account in Firebase Auth is not auto-deleted.</small>`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete'
    });
    if (r.isConfirmed) {
      try { await deleteDoc(doc(db, 'agents', id)); Swal.fire({ icon: 'success', title: 'Removed', timer: 1100, showConfirmButton: false }); }
      catch (err) { Swal.fire('Error', err.message, 'error'); }
    }
  }
}

/* Add agent via SECONDARY app so admin stays logged in */
function onAddAgent() {
  Swal.fire({
    title: 'Add New Agent',
    html: `
      <input type="text"  id="aName"   class="swal2-input" placeholder="Full Name">
      <input type="email" id="aEmail"  class="swal2-input" placeholder="Email Address">
      <input type="tel"   id="aPhone"  class="swal2-input" placeholder="Phone Number">
      <input type="text"  id="aAgency" class="swal2-input" placeholder="Agency Name">
      <input type="password" id="aPass" class="swal2-input" placeholder="Temp Password (min 6)">
      <select id="aRole" class="swal2-input">
        <option value="agent">Role: Agent</option>
        <option value="admin">Role: Admin</option>
      </select>`,
    confirmButtonText: 'Create Account', confirmButtonColor: '#0a5c7e', showCancelButton: true,
    preConfirm: () => {
      const name = $('aName').value.trim(), email = $('aEmail').value.trim(),
            phone = $('aPhone').value.trim(), agency = $('aAgency').value.trim(),
            password = $('aPass').value, role = $('aRole').value;
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

/* ============================================================
   HELPERS
   ============================================================ */
function showAlert(message, type = 'info', duration = 3500) {
  const box = $('alertContainer'); if (!box) return;
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
  div.innerHTML = `${icon} ${message}`;
  box.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, duration);
}
const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const initials = (n = '') => n.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'A';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function firebaseMsg(code) {
  const map = {
    'auth/invalid-email': 'Email address is not valid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}
