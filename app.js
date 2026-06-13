/* ============================================================
   AL SAUDIA TRAVEL AGENCY  —  app.js  v3
   Login + Sidebar Dashboard + Group Booking + Firebase
   ============================================================ */
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, serverTimestamp, query, orderBy, increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

/* helpers */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtMoney = n => 'PKR ' + Number(n || 0).toLocaleString();
const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const initials = (n = '') => n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() || 'A';
function firebaseMsg(code) {
  const m = {'auth/invalid-email':'Invalid email.','auth/user-disabled':'Account disabled.','auth/user-not-found':'No account found.','auth/wrong-password':'Incorrect password.','auth/invalid-credential':'Incorrect email or password.','auth/too-many-requests':'Too many attempts.','auth/email-already-in-use':'Email already in use.','auth/weak-password':'Password too short (min 6).'};
  return m[code] || 'Something went wrong.';
}

const AIRLINES = {PK:'PIA',SV:'Saudia',EK:'Emirates',QR:'Qatar Airways',EY:'Etihad',FZ:'Fly Dubai',G9:'Air Arabia',GF:'Gulf Air',TK:'Turkish',PA:'Airblue',ER:'SereneAir'};
const MONTHS = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
const DEST = {JED:{n:'Jeddah',f:'🇸🇦'},RUH:{n:'Riyadh',f:'🇸🇦'},MED:{n:'Madinah',f:'🇸🇦'},DMM:{n:'Dammam',f:'🇸🇦'},DXB:{n:'Dubai',f:'🇦🇪'},AUH:{n:'Abu Dhabi',f:'🇦🇪'},SHJ:{n:'Sharjah',f:'🇦🇪'},DOH:{n:'Doha',f:'🇶🇦'},IST:{n:'Istanbul',f:'🇹🇷'},KWI:{n:'Kuwait',f:'🇰🇼'},BAH:{n:'Bahrain',f:'🇧🇭'},MCT:{n:'Muscat',f:'🇴🇲'},LHR:{n:'London',f:'🇬🇧'},MAN:{n:'Manchester',f:'🇬🇧'}};
const destInfo = code => DEST[(code||'').toUpperCase()] || {n:(code||'Other').toUpperCase(),f:'✈️'};

/* ============================================================ INIT */
document.addEventListener('DOMContentLoaded', () => {

  /* preloader */
  const pre = $('preloader');
  window.addEventListener('load', () => { setTimeout(() => { pre?.classList.add('hide'); setTimeout(() => { if(pre) pre.style.display='none'; },500); },600); });

  /* login */
  $('loginForm')?.addEventListener('submit', onLogin);
  $('forgotPassword')?.addEventListener('click', onForgot);
  $('registerBtn')?.addEventListener('click', onRegister);
  $('togglePassword')?.addEventListener('click', () => {
    const p=$('password'), i=$('togglePassword').querySelector('i');
    const t=p.getAttribute('type')==='password'?'text':'password'; p.setAttribute('type',t);
    i?.classList.toggle('fa-eye-slash'); i?.classList.toggle('fa-eye');
  });

  /* sidebar nav */
  $('sideNav')?.addEventListener('click', e => { const a=e.target.closest('a[data-tab]'); if(a){e.preventDefault(); switchTab(a.dataset.tab);} });
  $('logoutBtn')?.addEventListener('click', doLogout);
  $('mobileLogoutBtn')?.addEventListener('click', doLogout);
  $('mobileMenuBtn')?.addEventListener('click', () => $('sidebar')?.classList.toggle('open'));

  /* group form */
  $('addGroupBtn')?.addEventListener('click', () => showGroupForm(true));
  $('addGroupBtnTop')?.addEventListener('click', () => { switchTab('tabGroups'); showGroupForm(true); });
  $('cancelGroupBtn')?.addEventListener('click', () => showGroupForm(false));
  $('saveGroupBtn')?.addEventListener('click', onSaveGroup);
  $('pnrParseBtn')?.addEventListener('click', onParsePNR);
  $('groupsList')?.addEventListener('click', onGroupAction);
  $('quickGroupsList')?.addEventListener('click', onGroupAction);
  $('scheduleList')?.addEventListener('click', onScheduleClick);
  $('reservationsList')?.addEventListener('click', onResAction);
  $('agentsTableBody')?.addEventListener('click', onAgentAction);
  $('addAgentBtn')?.addEventListener('click', onAddAgent);
  $('searchInput')?.addEventListener('input', e => renderAgents(allAgents.filter(a=>(a.name||'').toLowerCase().includes(e.target.value.toLowerCase())||(a.email||'').toLowerCase().includes(e.target.value.toLowerCase()))));

  /* remember me */
  const rem = localStorage.getItem('remUser');
  if(rem){ const ei=$('email'); if(ei) ei.value=rem; const rc=$('rememberMe'); if(rc) rc.checked=true; }

  onAuthStateChanged(auth, handleAuth);
});

/* ============================================================ AUTH */
async function handleAuth(user) {
  if (!user) { showPage('login'); return; }
  let snap;
  try { snap = await getDoc(doc(db,'agents',user.uid)); }
  catch(e) { showPage('login'); showAlert('Could not load profile. Check connection.','error'); return; }
  if (!snap.exists()) { await signOut(auth); showPage('login'); showAlert('Account profile not found. Contact admin.','error'); return; }
  const data = snap.data();
  if (data.active===false) { await signOut(auth); showPage('login'); showAlert('Account pending approval / disabled.','error'); return; }
  currentRole = data.role || 'agent';
  currentProfile = { id: user.uid, ...data };
  setupDashboard(data);
}

async function onLogin(e) {
  e.preventDefault();
  const email=$('email').value.trim(), pw=$('password').value;
  const rem=$('rememberMe')?.checked||false;
  if(!email||!pw) return showAlert('Please fill email and password','error');
  const btn=$('loginBtn'), txt=$('loginBtnText'), orig=txt?txt.textContent:'Sign In';
  if(btn){btn.disabled=true; if(txt) txt.textContent='Signing in...';}
  try { await signInWithEmailAndPassword(auth,email,pw); if(rem) localStorage.setItem('remUser',email); else localStorage.removeItem('remUser'); }
  catch(err) { showAlert(firebaseMsg(err.code),'error'); }
  finally { if(btn){btn.disabled=false; if(txt) txt.textContent=orig;} }
}

async function doLogout() { await signOut(auth); showPage('login'); }

function onForgot(e) {
  e.preventDefault();
  Swal.fire({title:'Reset Password',text:'Enter your email',input:'email',inputPlaceholder:'agent@alsaudia.com',showCancelButton:true,confirmButtonColor:'#7c5cff',confirmButtonText:'Send Link'})
  .then(async r => { if(r.isConfirmed&&r.value){try{await sendPasswordResetEmail(auth,r.value); Swal.fire('Sent!','Reset link sent to '+r.value,'success');}catch(err){Swal.fire('Error',firebaseMsg(err.code),'error');}} });
}

function onRegister() {
  Swal.fire({
    title:'Create Agent Account',
    html:`<input type="text" id="rn" class="swal2-input" placeholder="Full Name">
      <input type="email" id="re" class="swal2-input" placeholder="Email">
      <input type="tel" id="rp" class="swal2-input" placeholder="Phone">
      <input type="text" id="ra" class="swal2-input" placeholder="Agency Name">
      <input type="password" id="rpw" class="swal2-input" placeholder="Password (min 8)">`,
    confirmButtonText:'Register',confirmButtonColor:'#7c5cff',showCancelButton:true,
    preConfirm:()=>{
      const name=$('rn')?.value.trim(),email=$('re')?.value.trim(),phone=$('rp')?.value.trim(),agency=$('ra')?.value.trim(),password=$('rpw')?.value;
      if(!name||!email||!phone||!agency||!password){Swal.showValidationMessage('Fill all fields');return false;}
      if(!isValidEmail(email)){Swal.showValidationMessage('Invalid email');return false;}
      if(password.length<8){Swal.showValidationMessage('Password min 8 chars');return false;}
      return {name,email,phone,agency,password};
    }
  }).then(async r=>{
    if(!r.isConfirmed) return;
    const {name,email,phone,agency,password}=r.value;
    try { const cred=await createUserWithEmailAndPassword(auth,email,password);
      await setDoc(doc(db,'agents',cred.user.uid),{name,email,phone,agency,role:'agent',active:false,createdAt:serverTimestamp()});
      await signOut(auth); Swal.fire('Submitted!','Account pending admin approval.','success');
    } catch(err){Swal.fire('Error',firebaseMsg(err.code),'error');}
  });
}

/* ============================================================ PAGE / TAB SWITCH */
function showPage(which) {
  $('loginPage').style.display  = which==='login'  ? '' : 'none';
  $('dashPage').style.display   = which==='dash'   ? '' : 'none';
}
function switchTab(tabId) {
  document.querySelectorAll('.tab-section').forEach(s=>s.style.display='none');
  const s=$(tabId); if(s) s.style.display='';
  document.querySelectorAll('#sideNav a').forEach(a=>a.classList.toggle('active',a.dataset.tab===tabId));
  $('sidebar')?.classList.remove('open');
}
function showGroupForm(show) {
  const f=$('groupFormCard'); if(!f) return;
  f.style.display=show?'':'none';
  if(!show) ['gAirline','gFlightNo','gReturnFlight','gPnr','gFrom','gTo','gDepDate','gDepTime','gArrTime','gReturnDate','gReturnDepTime','gReturnArrTime','gSeats','gCost','gSale','pnrText'].forEach(id=>{const el=$(id);if(el)el.value='';});
}
function setupDashboard(profile) {
  showPage('dash');
  const nm=profile.name||'Agent';
  const av=$('sideAvatar'); if(av){av.textContent=initials(nm);}
  const pn=$('sideProfileName'); if(pn) pn.textContent=nm;
  $('dashHeading').textContent = currentRole==='admin' ? 'Agency Overview' : 'Welcome, '+nm;
  $('dashSubtext').textContent = currentRole==='admin' ? 'Monitoring performance across all regional flight hubs.' : 'Browse available groups and manage your bookings.';

  if(currentRole==='admin'){
    $('navAgents').style.display='';
    $('kpi2lbl').textContent='Active Groups'; $('kpi3lbl').textContent='Sold Seats'; $('kpi4lbl').textContent='Remaining'; $('kpi5lbl').textContent='Pending Bookings';
    listenGroups(); listenResAdmin(); listenAgents();
    switchTab('tabDashboard');
  } else {
    $('navAgents').style.display='none';
    $('kpi2lbl').textContent='Open Groups'; $('kpi3lbl').textContent='My Bookings'; $('kpi4lbl').textContent='Pending'; $('kpi5lbl').textContent='Confirmed';
    const addBtns=['addGroupBtn','addGroupBtnTop']; addBtns.forEach(id=>{const b=$(id);if(b)b.style.display='none';});
    listenGroups(); listenMyRes();
    switchTab('tabDashboard');
  }
}

/* ============================================================ KPI */
function renderKpi() {
  if(currentRole==='admin'){
    const live=allReservations.filter(r=>r.status!=='rejected');
    $('kpi1').textContent=live.reduce((s,r)=>s+(r.seats||0),0).toLocaleString();
    $('kpi2').textContent=allGroups.length;
    $('kpi3').textContent=allGroups.reduce((s,g)=>s+((g.totalSeats||0)-(g.availableSeats||0)),0).toLocaleString();
    $('kpi4').textContent=allGroups.reduce((s,g)=>s+(g.availableSeats||0),0).toLocaleString();
    const pend=allReservations.filter(r=>r.status==='pending').length;
    $('kpi5').textContent=pend;
    const nb=$('navBadge'); if(nb){nb.style.display=pend>0?'':'none'; nb.textContent=pend;}
  } else {
    $('kpi1').textContent=allGroups.filter(g=>(g.availableSeats||0)>0).length;
    $('kpi2').textContent=myReservations.length;
    $('kpi3').textContent=myReservations.filter(r=>r.status==='pending').length;
    $('kpi4').textContent=myReservations.filter(r=>r.status==='accepted').length;
    $('kpi5').textContent='';
  }
}

/* ============================================================ GROUPS */
function listenGroups(){
  const q=query(collection(db,'groups'),orderBy('createdAt','desc'));
  onSnapshot(q,snap=>{allGroups=[];snap.forEach(d=>allGroups.push({id:d.id,...d.data()})); renderKpi(); renderSchedule(); if(currentRole==='admin'){renderGroupsAdmin();renderQuickGroups();}else{renderGroupsAgent();renderQuickGroups();}},err=>console.error(err));
}

function groupByDest(list){const m={};list.forEach(g=>{const k=(g.to||'OTHER').toUpperCase();(m[k]=m[k]||[]).push(g);});return m;}

function flightCardHTML(g, isAdmin, showDelete=true) {
  const a=g.availableSeats||0, t=g.totalSeats||0;
  const soldOut=a===0;
  const code=g.airline?g.airline.slice(0,2).toUpperCase():'?';
  return `<div class="card flight-card ${soldOut?'soldout':''}" data-id="${g.id}">
    <div class="flight-inner">
      <div class="flight-card-header">
        <div class="airline">
          <div class="airline-logo">${esc(code)}</div>
          <div class="airline-info">
            <p>${esc(g.from)} → ${esc(g.to)}</p>
            <p>${esc(g.airline)}${g.flightNo?' · '+esc(g.flightNo):''}${g.depDate?' · '+esc(g.depDate):''}${g.depTime?' · '+esc(g.depTime):''}</p>
          </div>
        </div>
        ${soldOut ? `<span class="soldout-tag">Sold Out</span>` : `<div class="seats-info"><p>Seats Available</p><p>${a} / ${t}</p></div>`}
      </div>
      <div class="flight-meta">
        <div class="meta-box"><p>Sale Price</p><p>${fmtMoney(g.salePrice)}</p></div>
        <div class="meta-box"><p>Agency Cost</p><p>${fmtMoney(g.costPerSeat)}</p></div>
        <div class="meta-box meta-actions">
          ${!isAdmin && !soldOut ? `<button class="btn btn-brand btn-sm" data-act="reserve" data-id="${g.id}"><i class="fas fa-ticket"></i> Reserve</button>` : ''}
          ${isAdmin && showDelete ? `<button class="icon-btn-sm danger" data-act="del" data-id="${g.id}" data-name="${esc(g.from)} → ${esc(g.to)}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
    </div>
    <div class="flight-footer">
      <span>Group ID · ${g.id.slice(0,8).toUpperCase()}${g.pnr?' · PNR '+esc(g.pnr):''}</span>
      ${isAdmin ? `<a data-act="paxlist" data-id="${g.id}">Manage Passengers</a>` : ''}
    </div>
  </div>`;
}

function renderGroupsAdmin(){
  const box=$('groupsList'); if(!box) return;
  if(!allGroups.length){box.innerHTML=`<div class="empty-state"><p>No groups yet. Click "Add New Group".</p></div>`;return;}
  const map=groupByDest(allGroups); let html='';
  Object.keys(map).sort().forEach(dest=>{
    const d=destInfo(dest);
    html+=`<div class="section-divider"><h4>${d.f} ${esc(d.n)} (${esc(dest)})</h4><div class="line"></div><span class="dcount">${map[dest].length} group(s)</span></div>`;
    map[dest].forEach(g=>html+=flightCardHTML(g,true));
  });
  box.innerHTML=html;
}
function renderGroupsAgent(){
  const tabs=document.querySelectorAll('[data-role-tab="groups"]');
  /* rendered by renderQuickGroups on agent dashboard, and groups tab */
  const box=$('groupsList'); if(!box) return;
  if(!allGroups.length){box.innerHTML=`<div class="empty-state"><p>No groups available right now.</p></div>`;return;}
  const map=groupByDest(allGroups); let html='';
  Object.keys(map).sort().forEach(dest=>{
    const d=destInfo(dest);
    html+=`<div class="section-divider"><h4>${d.f} ${esc(d.n)} (${esc(dest)})</h4><div class="line"></div><span class="dcount">${map[dest].length} group(s)</span></div>`;
    map[dest].forEach(g=>html+=flightCardHTML(g,false));
  });
  box.innerHTML=html;
}
function renderQuickGroups(){
  const box=$('quickGroupsList'); if(!box) return;
  const list=allGroups.slice(0,4);
  if(!list.length){box.innerHTML=`<div class="empty-state"><p>No groups yet.</p></div>`;return;}
  box.innerHTML=list.map(g=>flightCardHTML(g,currentRole==='admin',false)).join('');
}

function onGroupAction(e){
  const btn=e.target.closest('[data-act]'); if(!btn) return;
  const id=btn.dataset.id; const g=allGroups.find(x=>x.id===id);
  if(btn.dataset.act==='del'){
    Swal.fire({title:'Delete group?',html:`Remove <b>${btn.dataset.name||id}</b>?`,icon:'warning',showCancelButton:true,confirmButtonColor:'#dc2626',confirmButtonText:'Delete'})
    .then(async r=>{if(r.isConfirmed){try{await deleteDoc(doc(db,'groups',id)); Swal.fire({icon:'success',title:'Deleted',timer:1100,showConfirmButton:false});}catch(err){Swal.fire('Error',err.message,'error');}}});
  }
  if(btn.dataset.act==='reserve' && g) openReserveModal(g);
  if(btn.dataset.act==='paxlist' && g) showPaxList(g);
}

/* ============================================================ SCHEDULE */
function renderSchedule(){
  const box=$('scheduleList'); if(!box) return;
  const today=new Date(); today.setHours(0,0,0,0);
  const sorted=[...allGroups].filter(g=>g.depDate).sort((a,b)=>new Date(a.depDate)-new Date(b.depDate)).slice(0,6);
  if(!sorted.length){box.innerHTML=`<div class="empty-state"><p>No scheduled flights.</p></div>`;return;}
  box.innerHTML=sorted.map(g=>{
    const dt=new Date(g.depDate); const days=Math.round((dt-today)/(24*3600*1000));
    const pax=allReservations.filter(r=>r.groupId===g.id&&r.status!=='rejected').reduce((s,r)=>s+(r.seats||0),0);
    const urgent=days>=0&&days<=5;
    const dayLabel=days<0?'Departed':(days===0?'Today!':days+' days');
    const mn=dt.toLocaleDateString('en-GB',{month:'short'}).toUpperCase();
    const dy=String(dt.getDate()).padStart(2,'0');
    const d=destInfo(g.to);
    return `<div class="card departure-card" data-id="${g.id}">
      <span class="dep-badge ${urgent?'urgent':''}">${dayLabel}</span>
      <div class="departure-body">
        <div class="date-box"><span class="month">${mn}</span><span class="day">${dy}</span></div>
        <div class="dep-meta"><p>${d.f} ${esc(g.from)} → ${esc(g.to)}</p><p>${esc(g.airline)}${g.depTime?' · '+esc(g.depTime):''}</p></div>
      </div>
      <div class="departure-footer"><span>${pax} passenger(s)</span><a data-act="paxlist" data-id="${g.id}">View List →</a></div>
    </div>`;
  }).join('');
}
function onScheduleClick(e){
  const a=e.target.closest('a[data-act="paxlist"]'); if(!a) return;
  const g=allGroups.find(x=>x.id===a.dataset.id); if(g) showPaxList(g);
}

function showPaxList(g){
  const list=allReservations.filter(r=>r.groupId===g.id&&r.status!=='rejected');
  const rows=list.length?list.map((r,i)=>`<tr>
    <td style="text-align:left;padding:8px">${i+1}. ${esc(r.customerName)}</td>
    <td style="padding:8px">${esc(r.passport)}</td>
    <td style="padding:8px">${r.seats}</td>
    <td style="padding:8px">${r.status==='accepted'?'✅ Confirmed':'⏳ Pending'}</td>
    <td style="padding:8px;text-align:left">${esc(r.agentName||'')}</td>
  </tr>`).join(''):`<tr><td colspan="5" style="padding:16px;text-align:center;color:#a1a1aa">No passengers yet.</td></tr>`;
  Swal.fire({title:`${esc(g.from)} → ${esc(g.to)} · ${esc(g.depDate||'')}`,width:720,
    html:`<div style="max-height:60vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f4f4f5"><th style="padding:8px;text-align:left">Passenger</th><th style="padding:8px">Passport</th><th style="padding:8px">Seats</th><th style="padding:8px">Status</th><th style="padding:8px;text-align:left">Agent</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    confirmButtonColor:'#7c5cff',confirmButtonText:'Close'});
}

/* ============================================================ RESERVE */
function openReserveModal(g){
  Swal.fire({
    title:'Reserve Seats',
    html:`<div style="text-align:left;font-size:13px;color:#71717a;margin-bottom:8px"><b>${esc(g.from)} → ${esc(g.to)}</b> · ${esc(g.airline)}<br>${esc(g.depDate||'')} · ${fmtMoney(g.salePrice)}/seat · ${g.availableSeats} seats left</div>
      <input type="text" id="rCust" class="swal2-input" placeholder="Customer Full Name">
      <input type="text" id="rPass" class="swal2-input" placeholder="Passport Number">
      <input type="number" id="rSeats" class="swal2-input" value="1" min="1" max="${g.availableSeats}" placeholder="No. of seats">`,
    confirmButtonText:'Confirm Reservation',confirmButtonColor:'#7c5cff',showCancelButton:true,
    preConfirm:()=>{
      const cn=$('rCust').value.trim(),pp=$('rPass').value.trim(),seats=parseInt($('rSeats').value);
      if(!cn||!pp){Swal.showValidationMessage('Enter customer name and passport');return false;}
      if(!seats||seats<1){Swal.showValidationMessage('Enter valid seats');return false;}
      if(seats>(g.availableSeats||0)){Swal.showValidationMessage('Only '+g.availableSeats+' left');return false;}
      return {customerName:cn,passport:pp,seats};
    }
  }).then(async r=>{
    if(!r.isConfirmed) return;
    try {
      await runTransaction(db,async tx=>{
        const gRef=doc(db,'groups',g.id); const gs=await tx.get(gRef);
        if(!gs.exists()) throw new Error('Group not found');
        const avail=gs.data().availableSeats??0;
        if(r.value.seats>avail) throw new Error('Only '+avail+' seats left');
        tx.update(gRef,{availableSeats:avail-r.value.seats});
        const resRef=doc(collection(db,'reservations'));
        tx.set(resRef,{groupId:g.id,airline:g.airline,route:g.from+' → '+g.to,from:g.from,to:g.to,date:g.depDate||'',price:g.salePrice||0,agentId:auth.currentUser.uid,agentName:currentProfile.name||'',agentAgency:currentProfile.agency||'',customerName:r.value.customerName,passport:r.value.passport,seats:r.value.seats,status:'pending',createdAt:serverTimestamp()});
      });
      Swal.fire({icon:'success',title:'Reserved!',text:'Sent to admin for approval.',timer:1700,showConfirmButton:false});
    } catch(err){Swal.fire('Could not reserve',err.message,'error');}
  });
}

/* ============================================================ RESERVATIONS admin */
function listenResAdmin(){
  const q=query(collection(db,'reservations'),orderBy('createdAt','desc'));
  onSnapshot(q,snap=>{allReservations=[];snap.forEach(d=>allReservations.push({id:d.id,...d.data()})); renderKpi(); renderResAdmin(); renderSchedule();},err=>console.error(err));
}
function badge(s){
  if(s==='accepted') return `<span class="badge badge-accepted">✓ Accepted</span>`;
  if(s==='rejected') return `<span class="badge badge-rejected">✕ Rejected</span>`;
  return `<span class="badge badge-pending">⏳ Pending</span>`;
}
function renderResAdmin(){
  const box=$('reservationsList'); if(!box) return;
  $('resSubtext').textContent=`${allReservations.length} total · ${allReservations.filter(r=>r.status==='pending').length} pending`;
  if(!allReservations.length){box.innerHTML=`<div class="empty-state"><p>No reservations yet.</p></div>`;return;}
  box.innerHTML=allReservations.map(r=>`
    <div class="card res-card ${r.status==='accepted'?'ticket-card':''}">
      ${r.status==='accepted'?`<div class="ticket-head-strip"><div class="ticket-airline"><i class="fas fa-plane-circle-check"></i> ${esc(r.airline)}</div><span class="ticket-ref">REF: ${r.id.slice(0,8).toUpperCase()}</span></div>`:''}
      <div class="res-card-inner">
        <div class="rc-top">
          <div><div class="rc-name">${esc(r.customerName)}</div><div class="rc-sub">by ${esc(r.agentName||'agent')}${r.agentAgency?' · '+esc(r.agentAgency):''}</div></div>
          ${badge(r.status)}
        </div>
        <div class="rc-route"><i class="fas fa-plane"></i> ${esc(r.route)} · ${esc(r.airline)} · ${esc(r.date)}</div>
        <div class="rc-meta">
          <div class="rc-meta-item"><span>Passport</span><b>${esc(r.passport)}</b></div>
          <div class="rc-meta-item"><span>Seats</span><b>${r.seats}</b></div>
          <div class="rc-meta-item"><span>Amount</span><b>${fmtMoney((r.price||0)*(r.seats||1))}</b></div>
        </div>
        ${r.status==='pending'?`<div class="rc-actions">
          <button class="btn btn-green btn-sm" data-act="accept" data-id="${r.id}"><i class="fas fa-check"></i> Accept</button>
          <button class="btn btn-red btn-sm" data-act="reject" data-id="${r.id}"><i class="fas fa-xmark"></i> Reject</button>
        </div>`:''}
      </div>
    </div>`).join('');
}
async function onResAction(e){
  const btn=e.target.closest('button[data-act]'); if(!btn) return;
  const id=btn.dataset.id; const r=allReservations.find(x=>x.id===id); if(!r) return;
  if(btn.dataset.act==='accept'){try{await updateDoc(doc(db,'reservations',id),{status:'accepted'}); Swal.fire({icon:'success',title:'Accepted',timer:1100,showConfirmButton:false});}catch(err){Swal.fire('Error',err.message,'error');}}
  if(btn.dataset.act==='reject'){
    const c=await Swal.fire({title:'Reject?',text:'Seats will be returned.',icon:'warning',showCancelButton:true,confirmButtonColor:'#dc2626',confirmButtonText:'Reject'});
    if(!c.isConfirmed) return;
    try{await updateDoc(doc(db,'reservations',id),{status:'rejected'});try{await updateDoc(doc(db,'groups',r.groupId),{availableSeats:increment(r.seats||0)});}catch(_){}Swal.fire({icon:'success',title:'Rejected',timer:1100,showConfirmButton:false});}
    catch(err){Swal.fire('Error',err.message,'error');}
  }
}

/* ============================================================ MY RESERVATIONS agent */
function listenMyRes(){
  const q=query(collection(db,'reservations'));
  onSnapshot(q,snap=>{
    myReservations=[];
    snap.forEach(d=>{const data=d.data();if(data.agentId===auth.currentUser.uid)myReservations.push({id:d.id,...data});});
    myReservations.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderKpi(); renderMyRes();
  },err=>console.error(err));
}
function renderMyRes(){
  const box=$('reservationsList'); if(!box) return;
  if(!myReservations.length){box.innerHTML=`<div class="empty-state"><p>No bookings yet. Reserve a seat from "Flight Groups".</p></div>`;return;}
  box.innerHTML=myReservations.map(r=>{
    if(r.status==='accepted') return `<div class="card res-card ticket-card">
      <div class="ticket-head-strip"><div class="ticket-airline"><i class="fas fa-plane-circle-check"></i> ${esc(r.airline)}</div><span class="ticket-ref">REF: ${r.id.slice(0,8).toUpperCase()}</span></div>
      <div class="res-card-inner">
        <div class="rc-meta" style="margin-bottom:10px">
          <div class="rc-meta-item"><span>Passenger</span><b>${esc(r.customerName)}</b></div>
          <div class="rc-meta-item"><span>Passport</span><b>${esc(r.passport)}</b></div>
          <div class="rc-meta-item"><span>Route</span><b>${esc(r.route)}</b></div>
          <div class="rc-meta-item"><span>Date</span><b>${esc(r.date)}</b></div>
          <div class="rc-meta-item"><span>Seats</span><b>${r.seats}</b></div>
          <div class="rc-meta-item"><span>Total</span><b>${fmtMoney((r.price||0)*(r.seats||1))}</b></div>
        </div>
      </div>
    </div>`;
    return `<div class="card res-card">
      <div class="res-card-inner">
        <div class="rc-top"><div><div class="rc-name">${esc(r.customerName)}</div><div class="rc-sub"><i class="fas fa-plane"></i> ${esc(r.route)} · ${esc(r.date)}</div></div>${badge(r.status)}</div>
        <div class="rc-meta">
          <div class="rc-meta-item"><span>Passport</span><b>${esc(r.passport)}</b></div>
          <div class="rc-meta-item"><span>Seats</span><b>${r.seats}</b></div>
          <div class="rc-meta-item"><span>Amount</span><b>${fmtMoney((r.price||0)*(r.seats||1))}</b></div>
        </div>
        ${r.status==='pending'?`<p style="font-size:12px;color:#71717a;margin-top:10px"><i class="fas fa-clock"></i> Waiting for admin approval...</p>`:''}
      </div>
    </div>`;
  }).join('');
}

/* ============================================================ AGENTS */
function listenAgents(){
  const q=query(collection(db,'agents'),orderBy('createdAt','desc'));
  onSnapshot(q,snap=>{allAgents=[];snap.forEach(d=>allAgents.push({id:d.id,...d.data()})); renderAgents(allAgents);},err=>{$('agentsTableBody').innerHTML=`<tr><td colspan="6" class="loading-row">Error loading agents.</td></tr>`;});
}
function renderAgents(list){
  const body=$('agentsTableBody'); if(!body) return;
  if(!list.length){body.innerHTML=`<tr><td colspan="6" class="loading-row">No agents yet.</td></tr>`;return;}
  body.innerHTML=list.map(a=>{
    const active=a.active!==false;
    const rb=a.role==='admin'?`<span class="badge badge-admin">Admin</span>`:`<span class="badge badge-agent">Agent</span>`;
    const sb=active?`<span class="badge badge-active">Active</span>`:`<span class="badge badge-inactive">Pending</span>`;
    return `<tr>
      <td><div class="agent-cell"><div class="agent-av">${initials(a.name)}</div><div><div class="agent-name">${esc(a.name||'—')}</div><div class="agent-email">${esc(a.email||'')}</div></div></div></td>
      <td>${esc(a.agency||'—')}</td><td>${esc(a.phone||'—')}</td><td>${rb}</td><td>${sb}</td>
      <td style="text-align:right"><div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="icon-btn-tbl" title="${active?'Disable':'Enable'}" data-act="toggle" data-id="${a.id}" data-active="${active}"><i class="fas ${active?'fa-user-slash':'fa-user-check'}"></i></button>
        <button class="icon-btn-tbl danger" title="Delete" data-act="del" data-id="${a.id}" data-name="${esc(a.name||'')}"><i class="fas fa-trash"></i></button>
      </div></td></tr>`;
  }).join('');
}
async function onAgentAction(e){
  const btn=e.target.closest('button[data-act]'); if(!btn) return;
  const id=btn.dataset.id;
  if(btn.dataset.act==='toggle'){const active=btn.dataset.active==='true';try{await updateDoc(doc(db,'agents',id),{active:!active}); Swal.fire({icon:'success',title:active?'Disabled':'Enabled',timer:1000,showConfirmButton:false});}catch(err){Swal.fire('Error',err.message,'error');}}
  if(btn.dataset.act==='del'){const r=await Swal.fire({title:'Delete agent?',html:`Remove <b>${btn.dataset.name||'this agent'}</b>?<br><small>Auth account not auto-deleted.</small>`,icon:'warning',showCancelButton:true,confirmButtonColor:'#dc2626',confirmButtonText:'Delete'});if(r.isConfirmed){try{await deleteDoc(doc(db,'agents',id)); Swal.fire({icon:'success',title:'Removed',timer:1000,showConfirmButton:false});}catch(err){Swal.fire('Error',err.message,'error');}}}
}
function onAddAgent(){
  Swal.fire({
    title:'Add New Agent',
    html:`<input type="text" id="an" class="swal2-input" placeholder="Full Name">
      <input type="email" id="ae" class="swal2-input" placeholder="Email">
      <input type="tel" id="ap" class="swal2-input" placeholder="Phone">
      <input type="text" id="aa" class="swal2-input" placeholder="Agency Name">
      <input type="password" id="apw" class="swal2-input" placeholder="Temp Password (min 6)">
      <select id="ar" class="swal2-input"><option value="agent">Role: Agent</option><option value="admin">Role: Admin</option></select>`,
    confirmButtonText:'Create',confirmButtonColor:'#7c5cff',showCancelButton:true,
    preConfirm:()=>{
      const name=$('an').value.trim(),email=$('ae').value.trim(),phone=$('ap').value.trim(),agency=$('aa').value.trim(),password=$('apw').value,role=$('ar').value;
      if(!name||!email||!phone||!agency||!password){Swal.showValidationMessage('Fill all fields');return false;}
      if(!isValidEmail(email)){Swal.showValidationMessage('Invalid email');return false;}
      if(password.length<6){Swal.showValidationMessage('Password min 6');return false;}
      return {name,email,phone,agency,password,role};
    }
  }).then(async result=>{
    if(!result.isConfirmed) return;
    const {name,email,phone,agency,password,role}=result.value;
    const sec=initializeApp(firebaseConfig,'Sec_'+Date.now()); const sa=getAuth(sec);
    try{const cred=await createUserWithEmailAndPassword(sa,email,password);await setDoc(doc(db,'agents',cred.user.uid),{name,email,phone,agency,role,active:true,createdAt:serverTimestamp()});await signOut(sa); Swal.fire({icon:'success',title:'Agent created!',text:name+' can now log in.',timer:1700,showConfirmButton:false});}
    catch(err){const m={'auth/email-already-in-use':'Email already exists.','auth/weak-password':'Password too weak.','auth/invalid-email':'Invalid email.'};Swal.fire('Error',m[err.code]||err.message,'error');}
    finally{try{await deleteApp(sec);}catch(_){}}
  });
}

/* ============================================================ SAVE GROUP */
async function onSaveGroup(){
  const v=id=>($(id)?.value||'').trim();
  const airline=v('gAirline'),from=v('gFrom').toUpperCase(),to=v('gTo').toUpperCase(),depDate=v('gDepDate');
  const seats=parseInt(v('gSeats')),sale=parseInt(v('gSale'))||0,cost=parseInt(v('gCost'))||0;
  if(!airline||!from||!to||!depDate) return Swal.fire('Missing','Airline, From, To and Departure Date are required.','warning');
  if(!seats||seats<1) return Swal.fire('Seats','Enter valid total seats.','warning');
  const btn=$('saveGroupBtn'); if(btn){btn.disabled=true; btn.textContent='Saving...';}
  try{
    await addDoc(collection(db,'groups'),{airline,flightNo:v('gFlightNo'),returnFlight:v('gReturnFlight'),pnr:v('gPnr'),from,to,depDate,depTime:v('gDepTime'),arrTime:v('gArrTime'),returnDate:v('gReturnDate'),returnDepTime:v('gReturnDepTime'),returnArrTime:v('gReturnArrTime'),totalSeats:seats,availableSeats:seats,costPerSeat:cost,salePrice:sale,price:sale,createdBy:auth.currentUser.uid,createdAt:serverTimestamp()});
    showGroupForm(false);
    Swal.fire({icon:'success',title:'Group added!',timer:1300,showConfirmButton:false});
  } catch(err){Swal.fire('Error',err.message,'error');}
  finally{if(btn){btn.disabled=false; btn.innerHTML='<i class="fas fa-floppy-disk"></i> Save Group';}}
}

/* ============================================================ PNR PARSER */
function onParsePNR(){
  const text=($('pnrText')?.value||'').toUpperCase(); if(!text.trim()) return;
  const set=(id,val)=>{if(val&&$(id))$(id).value=val;};
  const fm=text.match(/\b([A-Z]{2})\s?0?(\d{2,4})\b/);
  if(fm){set('gAirline',AIRLINES[fm[1]]||fm[1]);set('gFlightNo',fm[1]+'-'+fm[2]);}
  const dm=text.match(/\b(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/);
  if(dm){const day=+dm[1],mon=MONTHS[dm[2]];let yr=new Date().getFullYear();const cand=new Date(yr,mon-1,day);if(cand<new Date())yr++;set('gDepDate',`${yr}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`);}
  const rm=text.match(/\b([A-Z]{3})\s?([A-Z]{3})\b/);
  if(rm){set('gFrom',rm[1]);set('gTo',rm[2]);}
  const times=text.match(/\b(\d{4})\b/g);
  if(times&&times.length>=1)set('gDepTime',times[0].slice(0,2)+':'+times[0].slice(2));
  if(times&&times.length>=2)set('gArrTime',times[1].slice(0,2)+':'+times[1].slice(2));
  Swal.fire({icon:'info',title:'Auto-parsed',text:'Fields filled — please verify before saving.',timer:2000,showConfirmButton:false});
}

/* ============================================================ ALERT (login page) */
function showAlert(msg,type='info'){
  const box=$('alertContainer'); if(!box) return;
  const div=document.createElement('div'); div.className='alert-msg '+type;
  div.innerHTML=`<i class="fas ${type==='success'?'fa-check-circle':'fa-exclamation-circle'}"></i> ${msg}`;
  box.appendChild(div); setTimeout(()=>div.remove(),3500);
}
