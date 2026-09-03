import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDatabase, ref, set, push, update, remove, get, onValue
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* ======================================================================
   1. FIREBASE CONFIG  —  paste yours here
   Firebase console → Project settings → Your apps → Web app → Config
   ====================================================================== */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC33my_HhQu_y33DvEM0tamtBywDqoZxWI",
  authDomain: "trading-53d15.firebaseapp.com",
  // Agar aap ne database banate waqt United States (us-central1) chuna hai to yeh line theek hai.
  // Koi aur region chuna ho to Realtime Database page par jo URL likha hai woh yahan paste karein.
  databaseURL: "https://trading-53d15-default-rtdb.firebaseio.com",
  projectId: "trading-53d15",
  storageBucket: "trading-53d15.firebasestorage.app",
  messagingSenderId: "498944328847",
  appId: "1:498944328847:web:5a0f56352cd1e74289dcfa"
};

/* Business settings you can edit freely */
const BRAND = "Signal Desk";
const TIERS = {
  basic:  { name:"Signals",  fee:2500,  order:1, for:"Follow the calls on your own account",
            perks:["3–6 signals a week","Entry, stop-loss and two targets","Signal closed with result posted","WhatsApp alert when a call goes out"] },
  pro:    { name:"Signals + Analysis", fee:6000, order:2, for:"Understand why each call was taken",
            perks:["Everything in Signals","Pre-market analysis each session","Written reasoning on every trade","Position-size guidance for your capital"] },
  mentor: { name:"Mentoring", fee:15000, order:3, for:"Learn to find your own setups",
            perks:["Everything above","Weekly 1-on-1 call","Your trading journal reviewed","Direct message access"] }
};
const TIER_KEYS = ["basic","pro","mentor"];

/* ====================================================================== */

const $ = s => document.querySelector(s);
const el = (t,c,h) => { const n=document.createElement(t); if(c)n.className=c; if(h!=null)n.innerHTML=h; return n; };
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money = n => "Rs " + Number(n||0).toLocaleString("en-PK");
const num = n => Number(n).toLocaleString("en-PK",{maximumFractionDigits:6});

function ago(ts){
  if(!ts) return "";
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return "just now";
  if(s<3600) return Math.floor(s/60)+"m ago";
  if(s<86400) return Math.floor(s/3600)+"h ago";
  if(s<604800) return Math.floor(s/86400)+"d ago";
  return new Date(ts).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
}
function dateStr(ts){ return ts ? new Date(ts).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "—"; }

let toastTimer;
function toast(msg, bad){
  const t=$("#toast"); t.textContent=msg; t.classList.toggle("bad",!!bad); t.classList.add("on");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("on"),2600);
}
function openSheet(html){
  $("#sheet").innerHTML=html; $("#sheet").classList.add("on"); $("#scrim").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeSheet(){
  $("#sheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
}
$("#scrim").onclick = closeSheet;

/* ---------------- boot ---------------- */
if (String(FIREBASE_CONFIG.apiKey).startsWith("PASTE")) {
  $("#boot").classList.add("hide");
  $("#setup").classList.remove("hide");
  throw new Error("Firebase not configured");
}
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

const S = { uid:null, me:null, tab:"home", signals:[], requests:[], members:[], perf:[], pay:null, subs:[] };

function stopAll(){ S.subs.forEach(u=>{try{u()}catch(e){}}); S.subs=[]; }
function listen(path, cb){
  const un = onValue(ref(db,path), snap=>{
    const v = snap.val()||{};
    cb(Object.entries(v).map(([id,o])=>({id,...o})));
  }, err=>console.warn(path,err.message));
  S.subs.push(un);
}

/* ---------------- auth screen ---------------- */
let mode="in";

/* 03001234567 / +923001234567 / 3001234567  ->  923001234567 */
function normPhone(raw){
  let d = String(raw||"").replace(/\D/g,"");
  if(d.startsWith("00")) d = d.slice(2);
  if(d.startsWith("0")) d = "92"+d.slice(1);
  else if(d.length===10) d = "92"+d;
  return d;
}
const phoneOK = d => /^92\d{10}$/.test(d);
const phoneEmail = d => d + "@" + FIREBASE_CONFIG.authDomain;
const pretty = d => "+"+d;

function paintAuth(){
  const up = mode==="up";
  $("#authTitle").textContent = up ? "Create an account" : "Sign in";
  $("#authGo").textContent = up ? "Create account" : "Sign in";
  $("#signupOnly").classList.toggle("hide",!up);
  $("#switchText").textContent = up ? "Already a member?" : "New here?";
  $("#switchBtn").textContent = up ? "Sign in" : "Create an account";
  $("#auPass").autocomplete = up ? "new-password" : "current-password";
  $("#authSub").textContent = up
    ? "Your number is your login. Pick a password you'll remember."
    : "Signals, trade breakdowns, and mentoring for your own account.";
  $("#authErr").classList.add("hide");
}

$("#switchBtn").onclick = () => { mode = mode==="up"?"in":"up"; paintAuth(); };
paintAuth();

function authErr(m){ const e=$("#authErr"); e.textContent=m; e.classList.remove("hide"); }
const ERRS = {
  "auth/invalid-credential":"Number or password is wrong.",
  "auth/user-not-found":"No account with that number. Create one first.",
  "auth/wrong-password":"That password doesn't match.",
  "auth/email-already-in-use":"This number already has an account. Sign in instead.",
  "auth/weak-password":"Use at least 6 characters for the password.",
  "auth/invalid-verification-code":"That code isn't right. Check the SMS and try again.",
  "auth/code-expired":"The code expired. Request a new one.",
  "auth/too-many-requests":"Too many attempts. Wait a few minutes and try again.",
  "auth/quota-exceeded":"The daily SMS limit is used up. Try again tomorrow.",
  "auth/network-request-failed":"No connection. Check your internet and try again.",
  "auth/operation-not-allowed":"Phone sign-in isn't switched on in Firebase yet.",
  "auth/invalid-app-credential":"This page must run on a hosted domain, not a local file."
};
const say = e => ERRS[e.code] || e.message;

$("#authGo").onclick = async () => {
  const digits = normPhone($("#auPhone").value), pass = $("#auPass").value;
  if(!phoneOK(digits)) return authErr("Enter a Pakistani mobile number, like 0300 1234567.");
  if(!pass) return authErr("Enter your password.");
  $("#authErr").classList.add("hide");
  $("#authGo").disabled = true;

  try{
    if(mode==="up"){
      const name = $("#suName").value.trim();
      if(!name){ $("#authGo").disabled=false; return authErr("Enter your name."); }
      if(pass.length<6){ $("#authGo").disabled=false; return authErr("Use at least 6 characters for the password."); }
      const cred = await createUserWithEmailAndPassword(auth, phoneEmail(digits), pass);
      await set(ref(db,"users/"+cred.user.uid), {
        name, phone: pretty(digits), email: phoneEmail(digits),
        role:"member", plan:"none", expiresAt:0, createdAt:Date.now()
      });
    } else {
      await signInWithEmailAndPassword(auth, phoneEmail(digits), pass);
    }
  }catch(e){ authErr(say(e)); }
  $("#authGo").disabled = false;
};
$("#logoutBtn").onclick = () => signOut(auth);

/* ---------------- session ---------------- */
onAuthStateChanged(auth, async user => {
  stopAll();
  $("#boot").classList.add("hide");
  if(!user){
    S.uid=null; S.me=null;
    $("#app").classList.add("hide"); $("#authView").classList.remove("hide");
    return;
  }
  S.uid = user.uid;
  $("#authView").classList.add("hide"); $("#app").classList.remove("hide");
  $("#brandName").textContent = BRAND;

  S.subs.push(onValue(ref(db,"users/"+user.uid), snap=>{
    S.me = snap.val() || { name:user.email, role:"member", plan:"none", expiresAt:0 };
    $("#brandRole").textContent = isAdmin() ? "Admin" : (activeTier() ? TIERS[S.me.plan].name : "Member");
    if(isAdmin() && !["queue","post","people","record"].includes(S.tab)) S.tab="queue";
    if(!isAdmin() && !["home","plans","record","me"].includes(S.tab)) S.tab="home";
    buildNav(); render();
  }));

  listen("signals", rows => { S.signals = rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); render(); });
  listen("performance", rows => { S.perf = rows.sort((a,b)=>String(b.month).localeCompare(String(a.month))); render(); });
  S.subs.push(onValue(ref(db,"settings/payment"), s=>{ S.pay=s.val(); render(); }, ()=>{}));

  // admin-only feeds
  const g = await get(ref(db,"users/"+user.uid+"/role")).catch(()=>null);
  if(g && g.val()==="admin"){
    S.subs.push(onValue(ref(db,"requests"), s=>{
      const byUser = s.val()||{};
      S.requests = Object.entries(byUser)
        .flatMap(([uid,items]) => Object.entries(items||{}).map(([id,o])=>({id,uid,...o})))
        .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      render();
    }, err=>console.warn("requests",err.message)));
    listen("users", rows => { S.members = rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); render(); });
  } else {
    listen("requests/"+user.uid, rows => {
      S.requests = rows.map(r=>({...r,uid:user.uid})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      render();
    });
  }
});

const isAdmin = () => S.me?.role === "admin";
const activeTier = () => {
  if(!S.me) return null;
  const p = S.me.plan;
  if(!p || p==="none" || !TIERS[p]) return null;
  return (S.me.expiresAt||0) > Date.now() ? p : null;
};
const canSee = sigTier => {
  const t = activeTier();
  if(!t) return false;
  return TIERS[t].order >= TIERS[sigTier||"basic"].order;
};
const daysLeft = () => Math.max(0, Math.ceil(((S.me?.expiresAt||0)-Date.now())/86400000));

/* ---------------- nav ---------------- */
function buildNav(){
  const tabs = isAdmin()
    ? [["queue","◫","Requests"],["post","✎","New signal"],["people","♦","Members"],["record","▤","Record"]]
    : [["home","▲","Signals"],["plans","◈","Plans"],["record","▤","Record"],["me","●","Account"]];
  const bar=$("#navBar"); bar.innerHTML="";
  tabs.forEach(([k,ic,label])=>{
    const b=el("button",null,`<i>${ic}</i>${label}`);
    b.setAttribute("aria-current", S.tab===k ? "true":"false");
    b.onclick=()=>{ S.tab=k; buildNav(); render(); window.scrollTo({top:0}); };
    bar.appendChild(b);
  });
}

/* ---------------- render ---------------- */
function render(){
  if(!S.me) return;
  const v=$("#view"); v.innerHTML="";
  const map = isAdmin()
    ? { queue:adminQueue, post:adminPost, people:adminPeople, record:adminRecord }
    : { home:memberHome, plans:memberPlans, record:memberRecord, me:memberAccount };
  (map[S.tab] || memberHome)(v);
}

/* ======================= MEMBER ======================= */
function memberHome(v){
  const t = activeTier();
  v.appendChild(el("h2","page","Signals"));

  const strip = el("div","status "+(t?"live":"off"));
  strip.innerHTML = t
    ? `<div><div class="status-plan"><span class="dot on"></span>${esc(TIERS[t].name)}</div>
        <div class="status-meta">${daysLeft()} days left · renews ${dateStr(S.me.expiresAt)}</div></div>`
    : `<div><div class="status-plan"><span class="dot offd"></span>No active plan</div>
        <div class="status-meta">Pick a plan to unlock the calls</div></div>`;
  const cta = el("button","btn sm"+(t?" ghost":""), t?"Extend":"See plans");
  cta.onclick=()=>{ S.tab="plans"; buildNav(); render(); };
  strip.appendChild(cta);
  v.appendChild(strip);

  const open = S.signals.filter(s=>s.status==="open");
  const closed = S.signals.filter(s=>s.status!=="open").slice(0,12);

  v.appendChild(sec("Open calls", open.length ? open.length+" running" : ""));
  if(!open.length) v.appendChild(el("div","empty","<b>Nothing running right now</b>New calls appear here the moment they're posted."));
  else { const st=el("div","stack"); open.forEach(s=>st.appendChild(signalCard(s))); v.appendChild(st); }

  if(closed.length){
    v.appendChild(sec("Closed", "last "+closed.length));
    const st=el("div","stack"); closed.forEach(s=>st.appendChild(signalCard(s))); v.appendChild(st);
  }
}

function sec(title, right){
  const s=el("div","sec"); s.appendChild(el("h3",null,esc(title)));
  if(right) s.appendChild(el("span",null,esc(right)));
  return s;
}

function signalCard(s){
  const unlocked = canSee(s.tier);
  const c = el("article","signal"+(unlocked?"":" locked"));
  const side = (s.side||"buy").toLowerCase();

  const head = el("div","sig-head");
  head.innerHTML = `<div><div class="sig-pair">${esc(s.pair||"—")}</div>
    <div class="sig-when">${esc(ago(s.createdAt))}${s.tier&&s.tier!=="basic"?" · "+esc(TIERS[s.tier].name):""}</div></div>
    <div class="side ${side==="sell"?"sell":"buy"}">${side==="sell"?"SELL":"BUY"}</div>`;
  c.appendChild(head);

  const rungs = [
    { k:"tp", label:"Target 2", val:s.tp2 },
    { k:"tp", label:"Target 1", val:s.tp1 },
    { k:"entry", label:"Entry", val:s.entry },
    { k:"sl", label:"Stop loss", val:s.sl }
  ].filter(r=>r.val!=null && r.val!=="").sort((a,b)=>Number(b.val)-Number(a.val));

  const lad = el("div","ladder");
  rungs.forEach(r=>{
    lad.appendChild(el("div","rung "+r.k,
      `<div class="rail"><span class="pip ${r.k}"></span></div>
       <div class="rung-label">${r.label}</div>
       <div class="rung-val num">${esc(num(r.val))}</div>`));
  });
  c.appendChild(lad);

  if(s.note) c.appendChild(el("p","sig-note",esc(s.note)));

  const foot = el("div","sig-foot");
  const st = s.status==="open" ? `<span class="chip open">Running</span>`
    : s.result==="win" ? `<span class="chip win">Target hit</span>`
    : s.result==="loss" ? `<span class="chip loss">Stopped out</span>`
    : `<span class="chip">Closed flat</span>`;
  foot.innerHTML = st + `<span>${s.status==="open"?"":esc(dateStr(s.closedAt||s.createdAt))}</span>`;
  c.appendChild(foot);

  if(!unlocked){
    const lb = el("div","lockbar");
    const need = TIERS[s.tier||"basic"].name;
    lb.innerHTML = `<p>${activeTier()?"Included in "+esc(need):"Levels are hidden until your plan is active"}</p>`;
    const b = el("button",null,"Unlock");
    b.onclick=()=>{ S.tab="plans"; buildNav(); render(); window.scrollTo({top:0}); };
    lb.appendChild(b); c.appendChild(lb);
  }
  return c;
}

function memberPlans(v){
  v.appendChild(el("h2","page","Plans"));
  v.appendChild(el("p","lede","Every plan is a monthly access fee for analysis. Your money stays in your own broker account — we never take deposits or trade on your behalf."));

  const pending = S.requests.find(r=>r.status==="pending");
  if(pending){
    v.appendChild(el("div","ok",`Your request for ${esc(TIERS[pending.plan]?.name||pending.plan)} is with the admin. You'll see access open up here once it's approved.`));
  }

  const cur = activeTier();
  const st = el("div","stack");
  TIER_KEYS.forEach(k=>{
    const t=TIERS[k];
    const card = el("article","tier"+(cur===k?" pick":""));
    card.innerHTML = `<div class="tier-top">
        <div><div class="tier-name">${esc(t.name)}</div><div class="tier-for">${esc(t.for)}</div></div>
        <div class="tier-fee"><b class="num">${esc(money(t.fee))}</b><small>per month</small></div>
      </div>
      <ul>${t.perks.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>`;
    const b = el("button","btn sm ghost", cur===k ? "Extend this plan" : "Request access");
    b.style.marginTop="14px"; b.style.width="100%";
    if(pending){ b.disabled=true; b.textContent="Request pending"; }
    b.onclick=()=>requestSheet(k);
    card.appendChild(b);
    st.appendChild(card);
  });
  v.appendChild(st);
}

function requestSheet(planKey){
  const t=TIERS[planKey];
  const p=S.pay||{};
  const lines = [
    p.easypaisa ? ["EasyPaisa", p.easypaisa] : null,
    p.jazzcash ? ["JazzCash", p.jazzcash] : null,
    p.bank ? ["Bank", p.bank] : null
  ].filter(Boolean);

  openSheet(`
    <div class="sheet-head"><h3>${esc(t.name)}</h3><button class="iconbtn" id="xSheet">✕</button></div>
    <div class="card" style="margin-bottom:14px">
      <div class="kv"><span>Fee</span><b class="num">${esc(money(t.fee))} / month</b></div>
      <div class="kv"><span>Months</span><span id="mView" class="num">1</span></div>
      <div class="kv"><span>Total to send</span><b class="num" id="tView">${esc(money(t.fee))}</b></div>
    </div>
    <div class="field"><label for="mSel">How many months</label>
      <select id="mSel"><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option></select></div>
    ${lines.length ? `<div class="card" style="margin-bottom:14px">
        <h3 style="font-size:13px;color:var(--muted);margin-bottom:8px">Send the fee to</h3>
        ${lines.map(([k,v2])=>`<div class="kv"><span>${esc(k)}</span><b class="num">${esc(v2)}</b></div>`).join("")}
      </div>` : `<div class="err">Payment details haven't been added yet. Message the admin before sending anything.</div>`}
    <div class="field"><label for="refIn">Transaction ID from your receipt</label><input id="refIn" placeholder="e.g. 91827364523"></div>
    <button class="btn" id="sendReq">Submit for approval</button>
    <p class="disclaimer">This fee buys access to analysis. It is not an investment, it is not pooled with anyone else's money, and it does not earn a return.</p>
  `);
  $("#xSheet").onclick=closeSheet;
  const recalc=()=>{
    const m=Number($("#mSel").value);
    $("#mView").textContent=m; $("#tView").textContent=money(t.fee*m);
  };
  $("#mSel").onchange=recalc;

  $("#sendReq").onclick = async () => {
    const months=Number($("#mSel").value), ref2=$("#refIn").value.trim();
    if(!ref2) return toast("Add the transaction ID from your receipt.",true);
    $("#sendReq").disabled=true;
    try{
      await push(ref(db,"requests/"+S.uid),{
        name:S.me.name||"", phone:S.me.phone||"", email:S.me.email||"",
        plan:planKey, months, amount:t.fee*months, ref:ref2,
        status:"pending", createdAt:Date.now()
      });
      closeSheet(); toast("Sent. The admin will confirm shortly.");
    }catch(e){ toast(e.message,true); $("#sendReq").disabled=false; }
  };
}

function memberRecord(v){
  v.appendChild(el("h2","page","Track record"));
  v.appendChild(el("p","lede","Monthly results, posted after each month closes. Past results don't predict future ones."));
  v.appendChild(perfList());

  const done = S.signals.filter(s=>s.status!=="open");
  const wins = done.filter(s=>s.result==="win").length;
  if(done.length){
    const c=el("div","card"); c.style.marginTop="18px";
    c.innerHTML=`<div class="kv"><span>Calls closed</span><b class="num">${done.length}</b></div>
      <div class="kv"><span>Targets hit</span><b class="num">${wins}</b></div>
      <div class="kv"><span>Hit rate</span><b class="num">${Math.round(wins/done.length*100)}%</b></div>`;
    v.appendChild(c);
  }
}

function perfList(){
  if(!S.perf.length) return el("div","empty","<b>No months posted yet</b>Results go up at the end of each month.");
  const box=el("div","card");
  const max=Math.max(...S.perf.map(p=>Math.abs(Number(p.returnPct)||0)),1);
  S.perf.forEach(p=>{
    const val=Number(p.returnPct)||0, pos=val>=0;
    const r=el("div","perf");
    r.innerHTML=`<div class="perf-m">${esc(p.month||"")}</div>
      <div class="perf-bar"><i style="width:${Math.abs(val)/max*100}%;background:${pos?"var(--long)":"var(--short)"}"></i></div>
      <div class="perf-v num" style="color:${pos?"#4FC192":"#E8776F"}">${pos?"+":""}${val}%</div>`;
    box.appendChild(r);
  });
  return box;
}

function memberAccount(v){
  v.appendChild(el("h2","page","Account"));
  const t=activeTier();
  const c=el("div","card");
  c.innerHTML=`<div class="kv"><span>Name</span><b>${esc(S.me.name||"—")}</b></div>
    <div class="kv"><span>Phone</span><b class="num">${esc(S.me.phone||"—")}</b></div>
    <div class="kv"><span>Plan</span><b>${t?esc(TIERS[t].name):"None"}</b></div>
    <div class="kv"><span>Valid until</span><b>${t?esc(dateStr(S.me.expiresAt)):"—"}</b></div>`;
  v.appendChild(c);

  if(S.requests.length){
    v.appendChild(sec("Your requests"));
    const st=el("div","stack");
    S.requests.forEach(r=>{
      const i=el("div","item");
      i.innerHTML=`<div class="item-top">
        <div><b>${esc(TIERS[r.plan]?.name||r.plan)}</b>
        <div class="meta">${r.months} month${r.months>1?"s":""} · ${esc(money(r.amount))} · ${esc(ago(r.createdAt))}</div></div>
        <span class="chip ${r.status==="approved"?"win":r.status==="rejected"?"loss":"open"}">${esc(r.status)}</span></div>`;
      st.appendChild(i);
    });
    v.appendChild(st);
  }

  const out=el("button","btn ghost","Sign out"); out.style.marginTop="18px";
  out.onclick=()=>signOut(auth); v.appendChild(out);

  v.appendChild(el("p","disclaimer","We do not hold client funds, manage accounts, or guarantee returns. Every trade you place is your own decision on your own account."));
}

/* ======================= ADMIN ======================= */
function adminQueue(v){
  v.appendChild(el("h2","page","Requests"));
  const pend = S.requests.filter(r=>r.status==="pending");
  const rest = S.requests.filter(r=>r.status!=="pending").slice(0,15);

  v.appendChild(sec("Waiting on you", pend.length?pend.length+" pending":""));
  if(!pend.length) v.appendChild(el("div","empty","<b>Queue is clear</b>New subscription requests land here."));
  else{
    const st=el("div","stack");
    pend.forEach(r=>{
      const i=el("div","item");
      i.innerHTML=`<div class="item-top">
          <div><b>${esc(r.name||r.email)}</b>
          <div class="meta">${esc(TIERS[r.plan]?.name||r.plan)} · ${r.months}mo · ${esc(ago(r.createdAt))}</div></div>
          <b class="num">${esc(money(r.amount))}</b></div>
        <div class="kv" style="margin-top:10px"><span>Transaction ID</span><b class="num">${esc(r.ref||"—")}</b></div>
        <div class="kv"><span>WhatsApp</span><b class="num">${esc(r.phone||"—")}</b></div>`;
      const row=el("div","row"); row.style.marginTop="12px";
      const ok=el("button","btn sm","Approve & activate");
      const no=el("button","btn sm danger","Reject");
      ok.onclick=()=>approve(r,ok); no.onclick=()=>decide(r,"rejected");
      row.append(ok,no); i.appendChild(row); st.appendChild(i);
    });
    v.appendChild(st);
  }

  if(rest.length){
    v.appendChild(sec("Handled"));
    const st=el("div","stack");
    rest.forEach(r=>{
      const i=el("div","item");
      i.innerHTML=`<div class="item-top"><div><b>${esc(r.name||r.email)}</b>
        <div class="meta">${esc(TIERS[r.plan]?.name||r.plan)} · ${esc(ago(r.createdAt))}</div></div>
        <span class="chip ${r.status==="approved"?"win":"loss"}">${esc(r.status)}</span></div>`;
      st.appendChild(i);
    });
    v.appendChild(st);
  }
}

async function approve(r, btn){
  btn.disabled=true;
  try{
    const snap = await get(ref(db,"users/"+r.uid));
    const u = snap.val()||{};
    const from = Math.max(Number(u.expiresAt)||0, Date.now());
    const until = from + r.months*30*86400000;
    await update(ref(db,"users/"+r.uid), { plan:r.plan, expiresAt:until });
    await update(ref(db,`requests/${r.uid}/${r.id}`), { status:"approved", handledAt:Date.now() });
    toast(`${u.name||"Member"} active until ${dateStr(until)}`);
  }catch(e){ toast(e.message,true); btn.disabled=false; }
}
async function decide(r,status){
  try{ await update(ref(db,`requests/${r.uid}/${r.id}`),{status,handledAt:Date.now()}); toast("Marked "+status); }
  catch(e){ toast(e.message,true); }
}

function adminPost(v){
  v.appendChild(el("h2","page","New signal"));
  const f=el("div","card");
  f.innerHTML=`
    <div class="field"><label for="fPair">Instrument</label><input id="fPair" placeholder="EURUSD, BTCUSDT, OGDC"></div>
    <div class="grid2">
      <div class="field"><label for="fSide">Direction</label><select id="fSide"><option value="buy">Buy</option><option value="sell">Sell</option></select></div>
      <div class="field"><label for="fTier">Visible to</label><select id="fTier">${TIER_KEYS.map(k=>`<option value="${k}">${esc(TIERS[k].name)}</option>`).join("")}</select></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="fEntry">Entry</label><input id="fEntry" inputmode="decimal"></div>
      <div class="field"><label for="fSl">Stop loss</label><input id="fSl" inputmode="decimal"></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="fTp1">Target 1</label><input id="fTp1" inputmode="decimal"></div>
      <div class="field"><label for="fTp2">Target 2</label><input id="fTp2" inputmode="decimal"></div>
    </div>
    <div class="field"><label for="fNote">Reasoning shown to members</label><textarea id="fNote" placeholder="Why this setup, and how to manage it."></textarea></div>`;
  const go=el("button","btn","Post signal");
  go.onclick=async()=>{
    const pair=$("#fPair").value.trim(), entry=$("#fEntry").value.trim(), sl=$("#fSl").value.trim();
    if(!pair||!entry||!sl) return toast("Instrument, entry and stop loss are required.",true);
    go.disabled=true;
    try{
      await push(ref(db,"signals"),{
        pair, side:$("#fSide").value, tier:$("#fTier").value,
        entry, sl, tp1:$("#fTp1").value.trim()||null, tp2:$("#fTp2").value.trim()||null,
        note:$("#fNote").value.trim()||null, status:"open", createdAt:Date.now(), by:S.me.name||""
      });
      toast("Signal posted"); ["fPair","fEntry","fSl","fTp1","fTp2","fNote"].forEach(i=>$("#"+i).value="");
    }catch(e){ toast(e.message,true); }
    go.disabled=false;
  };
  f.appendChild(go); v.appendChild(f);

  const open=S.signals.filter(s=>s.status==="open");
  v.appendChild(sec("Running", open.length?open.length+" open":""));
  if(!open.length) v.appendChild(el("div","empty","<b>No open calls</b>Anything you post shows up here to close later."));
  else{
    const st=el("div","stack");
    open.forEach(s=>{
      const box=el("div","stack");
      box.appendChild(signalCard(s));
      const row=el("div","row");
      const w=el("button","btn sm ghost","Target hit");
      const l=el("button","btn sm danger","Stopped out");
      const fl=el("button","btn sm ghost","Closed flat");
      w.onclick=()=>close_(s,"win"); l.onclick=()=>close_(s,"loss"); fl.onclick=()=>close_(s,"flat");
      row.append(w,l,fl); box.appendChild(row);
      st.appendChild(box);
    });
    v.appendChild(st);
  }
}
async function close_(s,result){
  try{ await update(ref(db,"signals/"+s.id),{status:"closed",result,closedAt:Date.now()}); toast("Signal closed"); }
  catch(e){ toast(e.message,true); }
}

function adminPeople(v){
  v.appendChild(el("h2","page","Members"));
  const active=S.members.filter(m=>(m.expiresAt||0)>Date.now()).length;
  const c=el("div","card");
  c.innerHTML=`<div class="kv"><span>Total accounts</span><b class="num">${S.members.length}</b></div>
    <div class="kv"><span>Active subscriptions</span><b class="num">${active}</b></div>
    <div class="kv"><span>Expired or never subscribed</span><b class="num">${S.members.length-active}</b></div>`;
  v.appendChild(c);

  const search=el("div","field"); search.style.margin="16px 0 0";
  search.innerHTML=`<input id="mSearch" placeholder="Search name, email or number">`;
  v.appendChild(search);

  const list=el("div","stack"); list.style.marginTop="12px"; v.appendChild(list);
  const draw=(q="")=>{
    list.innerHTML="";
    const rows=S.members.filter(m=>{
      if(!q) return true;
      return [m.name,m.email,m.phone].join(" ").toLowerCase().includes(q.toLowerCase());
    });
    if(!rows.length){ list.appendChild(el("div","empty","<b>No one matches that</b>Try a shorter search.")); return; }
    rows.forEach(m=>{
      const live=(m.expiresAt||0)>Date.now();
      const i=el("div","item");
      i.innerHTML=`<div class="item-top">
        <div><b>${esc(m.name||m.email||"Member")}</b>
        <div class="meta">${esc(m.phone||m.email||"")}</div></div>
        <span class="chip ${live?"win":""}">${live?esc(TIERS[m.plan]?.name||m.plan):"inactive"}</span></div>
        ${live?`<div class="kv" style="margin-top:9px"><span>Valid until</span><b>${esc(dateStr(m.expiresAt))}</b></div>`:""}`;
      const row=el("div","row"); row.style.marginTop="10px";
      const ext=el("button","btn sm ghost","+30 days");
      ext.onclick=async()=>{
        const from=Math.max(m.expiresAt||0,Date.now());
        await update(ref(db,"users/"+m.id),{expiresAt:from+30*86400000, plan:m.plan&&m.plan!=="none"?m.plan:"basic"});
        toast("Extended 30 days");
      };
      const rev=el("button","btn sm danger","End access");
      rev.onclick=async()=>{ await update(ref(db,"users/"+m.id),{expiresAt:0,plan:"none"}); toast("Access ended"); };
      row.append(ext,rev); i.appendChild(row);
      list.appendChild(i);
    });
  };
  draw();
  $("#mSearch").oninput=e=>draw(e.target.value);
}

function adminRecord(v){
  v.appendChild(el("h2","page","Track record"));
  const f=el("div","card");
  f.innerHTML=`<div class="grid2">
      <div class="field"><label for="pM">Month</label><input id="pM" placeholder="Sep 2026"></div>
      <div class="field"><label for="pR">Return %</label><input id="pR" inputmode="decimal" placeholder="6.4"></div>
    </div>`;
  const add=el("button","btn","Publish month");
  add.onclick=async()=>{
    const m=$("#pM").value.trim(), r=$("#pR").value.trim();
    if(!m||r==="") return toast("Month and return are required.",true);
    await push(ref(db,"performance"),{month:m,returnPct:Number(r),createdAt:Date.now()});
    $("#pM").value=""; $("#pR").value=""; toast("Published");
  };
  f.appendChild(add); v.appendChild(f);

  v.appendChild(sec("Published"));
  v.appendChild(perfList());
  if(S.perf.length){
    const st=el("div","stack"); st.style.marginTop="12px";
    S.perf.forEach(p=>{
      const b=el("button","btn sm danger","Remove "+esc(p.month));
      b.onclick=async()=>{ await remove(ref(db,"performance/"+p.id)); toast("Removed"); };
      st.appendChild(b);
    });
    v.appendChild(st);
  }

  v.appendChild(sec("Payment details members see"));
  const p=S.pay||{};
  const pf=el("div","card");
  pf.innerHTML=`
    <div class="field"><label for="gE">EasyPaisa</label><input id="gE" value="${esc(p.easypaisa||"")}" placeholder="03xx xxxxxxx — Account title"></div>
    <div class="field"><label for="gJ">JazzCash</label><input id="gJ" value="${esc(p.jazzcash||"")}"></div>
    <div class="field"><label for="gB">Bank</label><input id="gB" value="${esc(p.bank||"")}" placeholder="Bank, IBAN, title"></div>`;
  const save=el("button","btn ghost","Save payment details");
  save.onclick=async()=>{
    await set(ref(db,"settings/payment"),{easypaisa:$("#gE").value.trim(),jazzcash:$("#gJ").value.trim(),bank:$("#gB").value.trim()});
    toast("Saved");
  };
  pf.appendChild(save); v.appendChild(pf);
}
