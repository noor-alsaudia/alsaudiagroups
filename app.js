/* ============================================================
   AL SAUDIA TRAVEL AGENCY - LOGIN PAGE SCRIPT (Firebase)
   ============================================================ */

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- PRELOADER ---------- */
  const preloader = document.querySelector('.preloader');
  window.addEventListener('load', () => {
    setTimeout(() => {
      preloader?.classList.add('fade-out');
      setTimeout(() => { if (preloader) preloader.style.display = 'none'; }, 500);
    }, 800);
  });

  /* ---------- AOS ---------- */
  if (window.AOS) AOS.init({ duration: 1000, once: true, offset: 100 });

  /* ---------- MOBILE MENU ---------- */
  const mobileToggle = document.getElementById('mobileToggle');
  const mainNav = document.getElementById('mainNav');
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', () => {
      mainNav.classList.toggle('active');
      const icon = mobileToggle.querySelector('i');
      icon?.classList.toggle('fa-bars');
      icon?.classList.toggle('fa-times');
    });
  }

  /* ---------- DROPDOWN (mobile) ---------- */
  document.querySelectorAll('.dropdown').forEach(dd => {
    dd.querySelector('a')?.addEventListener('click', e => {
      if (window.innerWidth <= 992) { e.preventDefault(); dd.classList.toggle('active'); }
    });
  });

  /* ---------- PASSWORD TOGGLE ---------- */
  const togglePassword = document.getElementById('togglePassword');
  const passwordField = document.getElementById('password');
  togglePassword?.addEventListener('click', () => {
    const t = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', t);
    const icon = togglePassword.querySelector('i');
    icon?.classList.toggle('fa-eye-slash');
    icon?.classList.toggle('fa-eye');
  });

  /* ---------- ALERT HELPER ---------- */
  function showAlert(message, type = 'info', duration = 3500) {
    const box = document.getElementById('alertContainer');
    if (!box) return;
    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
    div.innerHTML = `${icon} ${message}`;
    box.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, duration);
  }

  const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  /* Turn Firebase error codes into friendly messages */
  function firebaseMsg(code) {
    const map = {
      'auth/invalid-email': 'Email address is not valid.',
      'auth/user-disabled': 'This account has been disabled. Contact admin.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/too-many-requests': 'Too many attempts. Try again later.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/network-request-failed': 'Network error. Check your connection.'
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  /* If already logged in, skip straight to dashboard */
  onAuthStateChanged(auth, (user) => {
    if (user && !sessionStorage.getItem('justLoggingOut')) {
      // optional auto-redirect — comment this block if you don't want it
      // window.location.href = 'dashboard.html';
    }
  });

  /* ---------- LOGIN ---------- */
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;

    if (!email || !password) return showAlert('Please enter both email and password', 'error');
    if (!isValidEmail(email)) return showAlert('Please enter a valid email address', 'error');

    const btnText = loginBtn?.querySelector('.btn-text');
    const original = btnText ? btnText.textContent : 'Login';
    if (loginBtn) { loginBtn.disabled = true; if (btnText) btnText.textContent = 'Logging in...'; }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Read the agent profile to check status / role
      const snap = await getDoc(doc(db, 'agents', uid));
      if (!snap.exists()) {
        await signOut(auth);
        showAlert('Account profile not found. Please contact admin.', 'error');
        return;
      }
      const data = snap.data();
      if (data.active === false) {
        await signOut(auth);
        showAlert('Your account is pending approval / disabled. Contact admin.', 'error');
        return;
      }

      if (rememberMe) localStorage.setItem('rememberedUser', email);
      else localStorage.removeItem('rememberedUser');

      Swal.fire({ icon: 'success', title: 'Welcome Back!', text: 'Redirecting to dashboard...', timer: 1500, showConfirmButton: false });
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);

    } catch (err) {
      showAlert(firebaseMsg(err.code), 'error');
    } finally {
      if (loginBtn) { loginBtn.disabled = false; if (btnText) btnText.textContent = original; }
    }
  });

  /* ---------- REMEMBER ME ---------- */
  const remembered = localStorage.getItem('rememberedUser');
  if (remembered) {
    const ei = document.getElementById('email');
    const rc = document.getElementById('rememberMe');
    if (ei) ei.value = remembered;
    if (rc) rc.checked = true;
  }

  /* ---------- FORGOT PASSWORD (real reset email) ---------- */
  document.getElementById('forgotPassword')?.addEventListener('click', (e) => {
    e.preventDefault();
    Swal.fire({
      title: 'Reset Password',
      text: 'Enter your email to receive a reset link',
      input: 'email',
      inputPlaceholder: 'agent@alsaudiatravel.com',
      showCancelButton: true,
      confirmButtonColor: '#0a5c7e',
      confirmButtonText: 'Send Reset Link'
    }).then(async (r) => {
      if (r.isConfirmed && r.value) {
        try {
          await sendPasswordResetEmail(auth, r.value);
          Swal.fire('Email Sent!', 'Password reset link sent to ' + r.value, 'success');
        } catch (err) {
          Swal.fire('Error!', firebaseMsg(err.code), 'error');
        }
      }
    });
  });

  /* ---------- REGISTER (creates a PENDING account, admin approves) ---------- */
  function handleRegister() {
    Swal.fire({
      title: 'Create Agent Account',
      html: `
        <input type="text"  id="regName"    class="swal2-input" placeholder="Full Name">
        <input type="email" id="regEmail"   class="swal2-input" placeholder="Email Address">
        <input type="tel"   id="regPhone"   class="swal2-input" placeholder="Phone Number">
        <input type="text"  id="regAgency"  class="swal2-input" placeholder="Agency Name">
        <input type="password" id="regPassword" class="swal2-input" placeholder="Password (min 8 chars)">
      `,
      confirmButtonText: 'Register',
      confirmButtonColor: '#0a5c7e',
      showCancelButton: true,
      preConfirm: () => {
        const name = document.getElementById('regName')?.value.trim();
        const email = document.getElementById('regEmail')?.value.trim();
        const phone = document.getElementById('regPhone')?.value.trim();
        const agency = document.getElementById('regAgency')?.value.trim();
        const password = document.getElementById('regPassword')?.value;
        if (!name || !email || !phone || !agency || !password) { Swal.showValidationMessage('Please fill all fields'); return false; }
        if (!isValidEmail(email)) { Swal.showValidationMessage('Please enter a valid email'); return false; }
        if (password.length < 8) { Swal.showValidationMessage('Password must be at least 8 characters'); return false; }
        return { name, email, phone, agency, password };
      }
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const { name, email, phone, agency, password } = result.value;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // store profile as pending (active:false) until admin approves
        await setDoc(doc(db, 'agents', cred.user.uid), {
          name, email, phone, agency,
          role: 'agent',
          active: false,          // pending approval
          createdAt: serverTimestamp()
        });
        await signOut(auth);      // sign out — must wait for approval
        Swal.fire('Registration Submitted!', 'Your account is pending admin approval. You will be able to log in once approved.', 'success');
      } catch (err) {
        Swal.fire('Error!', firebaseMsg(err.code), 'error');
      }
    });
  }
  document.getElementById('registerBtn')?.addEventListener('click', e => { e.preventDefault(); handleRegister(); });
  document.getElementById('registerNow')?.addEventListener('click', e => { e.preventDefault(); handleRegister(); });

  /* ---------- AIRLINE MARQUEE ---------- */
  const airlines = [
    { name: 'Saudia Airlines', color: '#0a5c7e' }, { name: 'Emirates', color: '#d4a53a' },
    { name: 'Qatar Airways', color: '#8B1E3F' }, { name: 'Etihad Airways', color: '#2B5B2B' },
    { name: 'Turkish Airlines', color: '#E30A17' }, { name: 'Fly Dubai', color: '#FF6600' },
    { name: 'Air Arabia', color: '#003366' }, { name: 'Gulf Air', color: '#C00000' }
  ];
  const mc = document.getElementById('marqueeContent');
  if (mc) {
    mc.innerHTML = [...airlines, ...airlines]
      .map(a => `<div class="partner-item"><i class="fas fa-plane" style="color:${a.color}"></i><span>${a.name}</span></div>`)
      .join('');
  }

  /* ---------- SMOOTH SCROLL ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href !== '#home') {
        const target = document.querySelector(href);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
      }
    });
  });

  /* ---------- HEADER SHADOW ---------- */
  const header = document.querySelector('.main-header');
  window.addEventListener('scroll', () => {
    if (header) header.style.boxShadow = window.scrollY > 50 ? '0 10px 30px rgba(0,0,0,0.1)' : '0 4px 20px rgba(0,0,0,0.08)';
  });

  console.log('Al Saudia Travel — login page (Firebase) loaded.');
});
