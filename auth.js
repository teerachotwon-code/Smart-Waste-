/* =====================================================================
   auth.js · สมัครสมาชิก / เข้าสู่ระบบแยก 3 บทบาท / โปรไฟล์ ของ Smart Waste

   วิธีใช้: ใส่ <script src="auth.js"></script> ต่อจากบรรทัด <script src="app.js"></script> ใน index.html
   ไม่ต้องแก้ app.js และ ai.js

   ข้อควรรู้ (ต้นแบบ): บัญชีทั้งหมดเก็บใน localStorage ของเบราว์เซอร์เครื่องนี้ รหัสผ่านเก็บแบบ
   แฮช SHA-256 + salt แต่ผู้ที่เปิด DevTools ก็ยังแก้ข้อมูลได้ จึงยังไม่ใช่ความปลอดภัยระดับระบบจริง
   ระบบจริงต้องให้เซิร์ฟเวอร์ยืนยันตัวตน (เช่น Firebase Auth, Supabase Auth)

   ตัวเลือกใน index.html (แก้ window.SW_CONFIG):
     staffCode / supervisorCode : ถ้าตั้งค่า จะต้องกรอกรหัสนี้ตอนสมัครเป็นเจ้าหน้าที่ / ผู้ดูแลพื้นที่
     demoAccounts:false         : ซ่อนปุ่มสร้างบัญชีทดลอง
   ===================================================================== */
(function () {
  'use strict';
  if (typeof state === 'undefined' || typeof window.render !== 'function') {
    console.error('auth.js ต้องถูกโหลดหลัง app.js');
    return;
  }

  const USERS_KEY = 'smartwaste.users', SESSION_KEY = 'smartwaste.session';
  const DEMO_PW = 'demo1234';
  const SC = window.SW_CONFIG || {};
  const ROLES = {
    reporter: { label: 'ผู้แจ้ง', desc: 'แจ้งถังขยะล้น ติดตามสถานะเรื่องที่แจ้ง', color: '#0b7a74', home: 'home' },
    staff: { label: 'เจ้าหน้าที่', desc: 'รับงาน เก็บขยะ และอัปเดตสถานะงานในโซนของตน', color: '#9a6200', home: 'jobs' },
    supervisor: { label: 'ผู้ดูแลพื้นที่', desc: 'ดูภาพรวมทุกโซน งานเกินเวลา และมอบหมายงานใหม่', color: '#6d4fc2', home: 'jobs' },
  };
  const ROLE_ICON = { reporter: 'camera', staff: 'tasks', supervisor: 'chart' };
  const ZONES = { 'Z-A': 'โซน A (อาคาร 1-2 · ที่จอดรถ)', 'Z-B': 'โซน B (อาคาร 3-4 · สนามกีฬา)' };
  const DEMO = {
    reporter: { email: 'reporter@demo.test', name: 'ผู้แจ้ง ทดลอง', dept: 'คณะเทคโนโลยีสารสนเทศ' },
    staff: { email: 'staff@demo.test', name: 'เจ้าหน้าที่ ทดลอง', dept: 'ฝ่ายอาคารสถานที่' },
    supervisor: { email: 'supervisor@demo.test', name: 'ผู้ดูแล ทดลอง', dept: 'ฝ่ายอาคารสถานที่' },
  };

  /* ---------- พื้นที่เก็บข้อมูล ---------- */
  const lsGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (_) { /* ไม่ทำอะไร */ } };
  function getUsers() { try { const a = JSON.parse(lsGet(USERS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  const setUsers = a => lsSet(USERS_KEY, JSON.stringify(a));

  /* ---------- รหัสผ่าน (แฮช + salt) ---------- */
  async function sha(s) {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;   /* เบราว์เซอร์ที่ไม่มี crypto.subtle (เช่นเปิดผ่าน http ธรรมดา) */
    return 'x' + (h >>> 0).toString(16);
  }
  function rnd() {
    const a = new Uint8Array(8);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  const hashPw = (pw, salt) => sha(salt + ':' + pw);
  const normEmail = s => String(s || '').trim().toLowerCase();
  const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  const validPhone = s => !s || /^[0-9+\-\s()]{8,20}$/.test(s);
  const initial = n => ([...String(n || '').trim()].find(c => !/[เแโใไ]/.test(c)) || '?').toUpperCase();
  const displayName = u => u.name + ' (' + (u.role === 'supervisor' ? 'ผู้ดูแลพื้นที่' : 'เจ้าหน้าที่โซน ' + (u.zone === 'Z-B' ? 'B' : 'A')) + ')';
  const requiredCode = role => role === 'staff' ? String(SC.staffCode || '') : role === 'supervisor' ? String(SC.supervisorCode || '') : '';
  const thaiDate = t => { const d = new Date(t); return d.getDate() + ' ' + THAI_M[d.getMonth()] + ' ' + (d.getFullYear() + 543); };

  /* ---------- สถานะ ---------- */
  const blankAuth = () => ({ mode: 'login', role: 'reporter', name: '', email: '', pw: '', pw2: '', phone: '', dept: '', zone: 'Z-A', code: '', agree: false, err: '', busy: false });
  const profFrom = u => ({ name: u.name, phone: u.phone || '', dept: u.dept || '', zone: u.zone || 'Z-A', pwOld: '', pwNew: '', pwNew2: '', err: '', msg: '', perr: '', pmsg: '' });
  state.user = null; state.auth = blankAuth(); state.prof = null;
  let lastTab = '';

  /* ---------- สไตล์และโครงหน้า (สร้างเองจาก JS ไม่ต้องแก้ index.html) ---------- */
  document.body.classList.add('noauth');
  const css = document.createElement('style');
  css.textContent = `
body.noauth .tabs,body.noauth .rolebar,body.noauth main#app,body.noauth .userbox,body.noauth #skip,
body.noauth .foot [data-act="demo"],body.noauth .foot [data-act="reset"]{display:none}
.authwrap{max-width:560px;margin:0 auto;padding-block:26px 56px}
.rolepick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px}
@media(max-width:560px){.rolepick{grid-template-columns:minmax(0,1fr)}}
.rcard{display:flex;flex-direction:column;gap:4px;text-align:left;background:var(--surface);border:2px solid var(--line);border-radius:14px;padding:12px;cursor:pointer;min-height:44px}
.rcard svg{width:24px;height:24px;color:var(--rc)}
.rcard b{font-size:15px}
.rcard small{color:var(--muted);font-size:12px;line-height:1.4}
.rcard:hover{border-color:var(--rc)}
.rcard[aria-pressed="true"]{border-color:var(--rc);background:var(--surface2);box-shadow:0 0 0 1px var(--rc)}
.rpill{display:inline-flex;align-items:center;gap:7px;border-radius:99px;padding:3px 14px 3px 10px;font-weight:700;color:#fff;background:var(--rc);font-size:14px}
.rpill svg{width:16px;height:16px}
.chk{display:flex;gap:10px;align-items:flex-start;font-size:14px;cursor:pointer}
.chk input{width:20px;height:20px;margin-top:2px;flex:none}
.demo{border-top:1px dashed var(--line);margin-top:18px;padding-top:14px;display:grid;gap:8px}
.userbox{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.userbtn{display:flex;align-items:center;gap:8px;text-align:left}
.av{flex:none;width:30px;height:30px;border-radius:50%;background:var(--rc,var(--teal));color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px}
.av.lg{width:72px;height:72px;font-size:30px}
.userbtn .un{display:grid;line-height:1.2;max-width:150px}
.userbtn .un b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.userbtn .un small{opacity:.75;font-size:11px}
.rolebar{background:var(--surface);border-bottom:1px solid var(--line)}
.rolebar .wrap{display:flex;gap:10px 14px;align-items:center;padding-block:9px;flex-wrap:wrap}
.pfhead{display:flex;gap:16px;align-items:center}
.greet{display:flex;gap:14px;align-items:center}
.input[readonly],.input:disabled{background:var(--surface2);color:var(--muted)}
`;
  document.head.appendChild(css);

  const rolesEl = $('.roles');
  const userbox = document.createElement('div'); userbox.className = 'userbox'; userbox.id = 'userbox';
  if (rolesEl) rolesEl.replaceWith(userbox); else $('.bar .wrap').appendChild(userbox);
  const rolebar = document.createElement('div'); rolebar.className = 'rolebar'; rolebar.id = 'rolebar';
  $('nav.tabs').insertAdjacentElement('afterend', rolebar);
  const authRoot = document.createElement('section'); authRoot.className = 'wrap'; authRoot.id = 'authRoot'; authRoot.hidden = true;
  $('#app').insertAdjacentElement('beforebegin', authRoot);

  /* ปรับข้อความความยินยอม PDPA ให้ตรงกับการเก็บข้อมูลบัญชี */
  $$('#consent li').forEach(li => {
    const t = li.textContent;
    if (t.indexOf('ข้อมูลที่เก็บ') === 0) li.innerHTML = '<b>ข้อมูลที่เก็บ:</b> ข้อมูลบัญชี (ชื่อ อีเมล บทบาท และเบอร์โทร/หน่วยงานถ้าคุณกรอก รหัสผ่านเก็บแบบแฮช) รูปถ่ายที่คุณแนบ ข้อความรายละเอียด ประเภทปัญหา ถังที่เลือก และเวลาที่แจ้ง';
    else if (t.indexOf('ไม่เก็บ') === 0) li.innerHTML = '<b>ไม่เก็บ:</b> ตำแหน่ง GPS ของคุณ';
  });

  /* ---------- หน้า Login / สมัครสมาชิก ---------- */
  function authHtml() {
    const a = state.auth, reg = a.mode === 'register', R = ROLES[a.role], need = requiredCode(a.role);
    const picks = Object.keys(ROLES).map(k => `<button type="button" class="rcard" data-act="authrole" data-r="${k}" aria-pressed="${a.role === k}" style="--rc:${ROLES[k].color}">${ico(ROLE_ICON[k])}<b>${ROLES[k].label}</b><small>${ROLES[k].desc}</small></button>`).join('');
    const field = (id, label, type, val, attrs) => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(val)}" ${attrs || ''}></div>`;
    const zone = reg && a.role === 'staff'
      ? `<div class="field"><label for="aZone">โซนที่รับผิดชอบ</label><select class="input" id="aZone">${Object.keys(ZONES).map(z => `<option value="${z}" ${a.zone === z ? 'selected' : ''}>${ZONES[z]}</option>`).join('')}</select></div>`
      : reg && a.role === 'supervisor' ? `<p class="small muted" style="margin-bottom:14px">ผู้ดูแลพื้นที่เห็นงานของทุกโซน</p>` : '';
    const regTop = reg ? field('aName', 'ชื่อ-นามสกุล (หรือชื่อที่ใช้แสดง)', 'text', a.name, 'autocomplete="name" maxlength="60"') : '';
    const regMid = reg ? `${field('aPhone', 'เบอร์โทร (ไม่บังคับ)', 'tel', a.phone, 'autocomplete="tel" inputmode="tel" maxlength="20"')}
      ${field('aDept', a.role === 'reporter' ? 'คณะ / หน่วยงาน (ไม่บังคับ)' : 'หน่วยงาน / ตำแหน่ง (ไม่บังคับ)', 'text', a.dept, 'maxlength="80"')}
      ${zone}
      ${need ? field('aCode', 'รหัสยืนยันสำหรับ' + R.label, 'password', a.code, 'autocomplete="off" data-pw') : ''}` : '';
    const pw2 = reg ? field('aPw2', 'ยืนยันรหัสผ่าน', 'password', a.pw2, 'autocomplete="new-password" data-pw') : '';
    const agree = reg ? `<div class="field"><label class="chk"><input type="checkbox" id="aAgree" ${a.agree ? 'checked' : ''}><span>ฉันอ่านและยอมรับการเก็บข้อมูลตามนโยบายความเป็นส่วนตัว (PDPA)</span></label>
        <button type="button" class="linkbtn small" style="justify-self:start" data-act="privacy">อ่านนโยบาย</button></div>` : '';
    const demo = !reg && SC.demoAccounts !== false ? `<div class="demo"><span class="small muted">ทดลองใช้งานเร็ว ๆ : กดเพื่อสร้างและกรอกบัญชีตัวอย่างในเครื่องนี้ (รหัสผ่าน ${DEMO_PW})</span>
        <div class="chips">${Object.keys(ROLES).map(k => `<button type="button" class="chip" data-act="demofill" data-r="${k}">บัญชี${ROLES[k].label}ทดลอง</button>`).join('')}</div></div>` : '';
    return `<div class="authwrap" id="authBox">
      <div style="text-align:center;margin-bottom:16px"><div class="small muted">SMART WASTE · SPU ขอนแก่น</div>
        <h1 class="title" style="font-size:24px;margin-top:4px">${reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h1>
        <p class="muted small">เลือกบทบาทของคุณก่อน ระบบจะพาไปยังหน้าของบทบาทนั้น</p></div>
      <div class="rolepick" role="group" aria-label="เลือกบทบาท">${picks}</div>
      <form class="card" id="${reg ? 'regForm' : 'loginForm'}" novalidate>
        <div class="row" style="margin-bottom:14px"><h2 class="title" style="font-size:18px">${reg ? 'สมัครสมาชิกเป็น' : 'เข้าสู่ระบบเป็น'}</h2><span class="rpill" style="--rc:${R.color}">${ico(ROLE_ICON[a.role])}${R.label}</span></div>
        ${regTop}
        ${field('aEmail', 'อีเมล', 'email', a.email, 'autocomplete="username" inputmode="email" placeholder="you@example.com"')}
        ${regMid}
        ${field('aPw', 'รหัสผ่าน' + (reg ? ' (อย่างน้อย 6 ตัวอักษร)' : ''), 'password', a.pw, 'autocomplete="' + (reg ? 'new-password' : 'current-password') + '" data-pw')}
        ${pw2}
        <label class="chk" style="margin-bottom:14px"><input type="checkbox" id="aShow"><span class="small">แสดงรหัสผ่าน</span></label>
        ${agree}
        <p class="err" id="aErr" role="alert">${esc(a.err)}</p>
        <button type="submit" class="btn primary lg">${reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button>
        <p class="small" style="margin-top:14px;text-align:center">${reg
          ? 'มีบัญชีแล้ว? <button type="button" class="linkbtn" data-act="authmode" data-m="login">เข้าสู่ระบบ</button>'
          : 'ยังไม่มีบัญชี? <button type="button" class="linkbtn" data-act="authmode" data-m="register">สมัครสมาชิก</button>'}</p>
        ${demo}
      </form>
      <p class="small muted" style="margin-top:12px;text-align:center">ต้นแบบเพื่อการเรียน บัญชีเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ซิงก์ข้ามอุปกรณ์</p></div>`;
  }
  function showAuth() {
    document.body.classList.add('noauth'); authRoot.hidden = false;
    const ae = document.activeElement, keep = ae && ae.id && authRoot.contains(ae) ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
    authRoot.innerHTML = authHtml();
    if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (_) { /* บาง input ไม่รองรับ */ } } }
  }
  function hideAuth() { authRoot.hidden = true; authRoot.innerHTML = ''; document.body.classList.remove('noauth'); }
  function authErr(msg) { state.auth.err = msg; state.auth.busy = false; showAuth(); const el = $('#aErr'); if (el) el.scrollIntoView({ block: 'nearest' }); }

  /* ---------- เข้าสู่ระบบ / สมัคร / ออก ---------- */
  function startSession(u, msg) {
    state.user = u; lsSet(SESSION_KEY, u.id); state.auth = blankAuth();
    state.role = u.role; state.zone = u.role === 'supervisor' ? 'all' : (u.zone || 'Z-A');
    state.tab = ROLES[u.role].home;
    state.draft = null; state.lastId = null; state.jobId = null; state.mapSel = null; state.mapBld = null; state.mapQ = ''; state.chat = []; state.prof = null; state.tests = null;
    lastTab = '';
    render(); window.scrollTo(0, 0);
    if (msg) toast(msg);
    if (!state.consent) openConsent();
  }
  async function doLogin() {
    const a = state.auth; if (a.busy) return;
    const email = normEmail(a.email);
    if (!validEmail(email)) return authErr('กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com');
    if (!a.pw) return authErr('กรุณากรอกรหัสผ่าน');
    a.busy = true;
    const u = getUsers().find(x => x.email === email);
    const h = u ? await hashPw(a.pw, u.salt) : null;
    a.busy = false;
    if (!u || h !== u.hash) { a.pw = ''; return authErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); }
    if (u.role !== a.role) { a.pw = ''; return authErr('บัญชีนี้สมัครไว้เป็น "' + ROLES[u.role].label + '" กรุณาเลือกบทบาท "' + ROLES[u.role].label + '" ด้านบนแล้วลองใหม่'); }
    startSession(u, 'เข้าสู่ระบบแล้ว ยินดีต้อนรับ ' + u.name);
  }
  async function doRegister() {
    const a = state.auth; if (a.busy) return;
    const name = a.name.trim().replace(/\s+/g, ' '), email = normEmail(a.email), phone = a.phone.trim(), need = requiredCode(a.role);
    if (name.length < 2) return authErr('กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร');
    if (!validEmail(email)) return authErr('กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com');
    if (!validPhone(phone)) return authErr('เบอร์โทรไม่ถูกต้อง (ใส่เฉพาะตัวเลข เว้นว่างได้)');
    if (need && a.code.trim() !== need) return authErr('รหัสยืนยันสำหรับ' + ROLES[a.role].label + 'ไม่ถูกต้อง');
    if (a.pw.length < 6) return authErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (a.pw !== a.pw2) return authErr('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
    if (!a.agree) return authErr('กรุณาติ๊กยอมรับการเก็บข้อมูลก่อนสมัครสมาชิก');
    const users = getUsers();
    if (users.some(x => x.email === email)) return authErr('อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน');
    a.busy = true;
    const salt = rnd(), hash = await hashPw(a.pw, salt);
    const u = { id: 'U' + Date.now().toString(36) + rnd().slice(0, 4), email, name, phone, dept: a.dept.trim().slice(0, 80), role: a.role,
      zone: a.role === 'staff' ? a.zone : a.role === 'supervisor' ? 'all' : null, created: Date.now(), salt, hash };
    users.push(u);
    if (!setUsers(users)) return authErr('บันทึกบัญชีไม่สำเร็จ เบราว์เซอร์อาจบล็อกการเก็บข้อมูลหรือพื้นที่เต็ม');
    state.consent = true; lsSet(CONSENT_KEY, '1');
    startSession(u, 'สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ' + name);
  }
  async function demoFill(role) {
    const d = DEMO[role], users = getUsers();
    if (!users.some(x => x.email === d.email)) {
      const salt = rnd();
      users.push({ id: 'Udemo-' + role, email: d.email, name: d.name, phone: '', dept: d.dept, role,
        zone: role === 'staff' ? 'Z-A' : role === 'supervisor' ? 'all' : null, created: Date.now(), salt, hash: await hashPw(DEMO_PW, salt) });
      if (!setUsers(users)) return authErr('สร้างบัญชีทดลองไม่สำเร็จ เบราว์เซอร์อาจบล็อกการเก็บข้อมูล');
    }
    Object.assign(state.auth, { mode: 'login', role, email: d.email, pw: DEMO_PW, err: '' });
    showAuth();
  }
  function logout() {
    state.user = null; lsDel(SESSION_KEY); state.auth = blankAuth(); state.role = 'reporter'; state.tab = 'home'; state.draft = null; state.prof = null; lastTab = '';
    const m = $('#consent'); if (m) m.hidden = true; document.body.classList.remove('modal-open');
    render(); window.scrollTo(0, 0); toast('ออกจากระบบแล้ว');
  }

  /* ---------- โปรไฟล์ ---------- */
  function saveProfile() {
    const u = state.user, p = state.prof, name = p.name.trim().replace(/\s+/g, ' '), phone = p.phone.trim();
    p.msg = ''; p.err = '';
    if (name.length < 2) { p.err = 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร'; render(); return; }
    if (!validPhone(phone)) { p.err = 'เบอร์โทรไม่ถูกต้อง (ใส่เฉพาะตัวเลข เว้นว่างได้)'; render(); return; }
    const users = getUsers(), i = users.findIndex(x => x.id === u.id);
    if (i < 0) { p.err = 'ไม่พบบัญชีนี้ในเครื่อง กรุณาออกจากระบบแล้วเข้าใหม่'; render(); return; }
    Object.assign(users[i], { name, phone, dept: p.dept.trim().slice(0, 80), zone: u.role === 'staff' ? p.zone : users[i].zone });
    if (!setUsers(users)) { p.err = 'บันทึกไม่สำเร็จ เบราว์เซอร์อาจบล็อกการเก็บข้อมูลหรือพื้นที่เต็ม'; render(); return; }
    state.user = users[i]; p.name = name; p.msg = 'บันทึกข้อมูลแล้ว';
    if (u.role === 'staff') state.zone = users[i].zone;
    toast('บันทึกโปรไฟล์แล้ว'); render();
  }
  async function changePw() {
    const u = state.user, p = state.prof; p.perr = ''; p.pmsg = '';
    if (!p.pwOld) { p.perr = 'กรุณากรอกรหัสผ่านปัจจุบัน'; render(); return; }
    if ((await hashPw(p.pwOld, u.salt)) !== u.hash) { p.perr = 'รหัสผ่านปัจจุบันไม่ถูกต้อง'; render(); return; }
    if (p.pwNew.length < 6) { p.perr = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'; render(); return; }
    if (p.pwNew !== p.pwNew2) { p.perr = 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน'; render(); return; }
    const users = getUsers(), i = users.findIndex(x => x.id === u.id);
    if (i < 0) { p.perr = 'ไม่พบบัญชีนี้ในเครื่อง'; render(); return; }
    const salt = rnd(); users[i].salt = salt; users[i].hash = await hashPw(p.pwNew, salt);
    if (!setUsers(users)) { p.perr = 'บันทึกไม่สำเร็จ'; render(); return; }
    state.user = users[i]; p.pwOld = p.pwNew = p.pwNew2 = ''; p.pmsg = 'เปลี่ยนรหัสผ่านแล้ว'; toast('เปลี่ยนรหัสผ่านแล้ว'); render();
  }
  function deleteAccount() {
    const u = state.user;
    if (!confirm('ลบบัญชีนี้และเรื่องที่คุณแจ้งทั้งหมดออกจากเครื่องนี้ใช่หรือไม่? ย้อนกลับไม่ได้')) return;
    setUsers(getUsers().filter(x => x.id !== u.id));
    state.reports = state.reports.filter(r => r.uid !== u.id);
    save(); logout(); toast('ลบบัญชีและข้อมูลของคุณแล้ว');
  }

  function viewProfile() {
    const u = state.user, R = ROLES[u.role], p = state.prof || (state.prof = profFrom(u)), rs = state.reports;
    const k = (label, n, cls) => `<div class="kpi ${cls}"><b class="num">${n}</b><span>${label}</span></div>`;
    let stats;
    if (u.role === 'reporter') {
      const m = rs.filter(r => r.uid === u.id);
      stats = k('เรื่องที่แจ้ง', m.length, '') + k('ดำเนินการแล้ว', m.filter(r => r.status === 'done').length, 'green') + k('ยังไม่เสร็จ', m.filter(r => r.status !== 'done').length, 'amber');
    } else {
      const m = rs.filter(r => r.assigneeId === u.id);
      stats = k('งานที่รับ', m.length, '') + k('ปิดงานแล้ว', m.filter(r => r.status === 'done').length, 'green')
        + (u.role === 'supervisor' ? k('เกินเวลาในระบบ', rs.filter(r => r.status === 'wait' && r.escalated).length, 'red') : k('กำลังทำ', m.filter(r => r.status === 'doing').length, 'amber'));
    }
    const fld = (id, label, val, attrs) => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" value="${esc(val)}" ${attrs || ''}></div>`;
    const zone = u.role === 'staff'
      ? `<div class="field"><label for="pZone">โซนที่รับผิดชอบ</label><select class="input" id="pZone">${Object.keys(ZONES).map(z => `<option value="${z}" ${p.zone === z ? 'selected' : ''}>${ZONES[z]}</option>`).join('')}</select></div>` : '';
    return `<div class="grid2"><div class="stack">
      <section class="card" style="--rc:${R.color}"><div class="pfhead"><span class="av lg">${esc(initial(u.name))}</span>
        <div style="min-width:0"><h2 class="title" style="overflow-wrap:anywhere">${esc(u.name)}</h2><div class="small muted" style="overflow-wrap:anywhere">${esc(u.email)}</div>
        <div style="margin-top:8px"><span class="rpill">${ico(ROLE_ICON[u.role])}${R.label}</span></div></div></div></section>
      <form class="card" id="profileForm" novalidate><div class="h">ข้อมูลส่วนตัว</div>
        ${fld('pName', 'ชื่อ-นามสกุล', p.name, 'autocomplete="name" maxlength="60"')}
        ${fld('pEmail', 'อีเมล (เปลี่ยนไม่ได้)', u.email, 'readonly')}
        ${fld('pRole', 'บทบาท (เปลี่ยนไม่ได้ ถ้าต้องการบทบาทอื่นให้สมัครบัญชีใหม่)', R.label, 'readonly')}
        ${fld('pPhone', 'เบอร์โทร (ไม่บังคับ)', p.phone, 'type="tel" inputmode="tel" maxlength="20" autocomplete="tel"')}
        ${fld('pDept', u.role === 'reporter' ? 'คณะ / หน่วยงาน (ไม่บังคับ)' : 'หน่วยงาน / ตำแหน่ง (ไม่บังคับ)', p.dept, 'maxlength="80"')}
        ${zone}
        <p class="err" role="alert">${esc(p.err)}</p><p class="small" style="color:var(--green-ink);font-weight:600;min-height:20px" role="status">${esc(p.msg)}</p>
        <button type="submit" class="btn primary">บันทึกข้อมูล</button></form></div>
    <aside class="stack">
      <section class="card flat"><div class="h">สถิติของฉัน</div><div class="kpis">${stats}</div></section>
      <form class="card" id="pwForm" novalidate><div class="h">เปลี่ยนรหัสผ่าน</div>
        ${fld('pOld', 'รหัสผ่านปัจจุบัน', p.pwOld, 'type="password" autocomplete="current-password"')}
        ${fld('pNew', 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)', p.pwNew, 'type="password" autocomplete="new-password"')}
        ${fld('pNew2', 'ยืนยันรหัสผ่านใหม่', p.pwNew2, 'type="password" autocomplete="new-password"')}
        <p class="err" role="alert">${esc(p.perr)}</p><p class="small" style="color:var(--green-ink);font-weight:600;min-height:20px" role="status">${esc(p.pmsg)}</p>
        <button type="submit" class="btn">เปลี่ยนรหัสผ่าน</button></form>
      <section class="card flat"><div class="h">บัญชี</div>
        <p class="small">สมัครเมื่อ ${thaiDate(u.created)}</p>
        <p class="small muted" style="margin:6px 0 12px">ข้อมูลบัญชีเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น</p>
        <div class="row"><button type="button" class="btn" data-act="logout">ออกจากระบบ</button><button type="button" class="btn red" data-act="deleteacct">ลบบัญชีและข้อมูลของฉัน</button></div></section>
    </aside></div>`;
  }

  /* ---------- แถบบนสุด / แถบบอกบทบาท ---------- */
  function chrome() {
    const u = state.user, R = ROLES[u.role], zoneTxt = u.role === 'staff' ? ' · ' + (ZONES[state.zone] || '') : u.role === 'supervisor' ? ' · ทุกโซน' : '';
    userbox.innerHTML = `<button type="button" class="ghost userbtn" data-act="tab" data-tab="profile" style="--rc:${R.color}" aria-label="โปรไฟล์ของ ${esc(u.name)}"><span class="av">${esc(initial(u.name))}</span><span class="un"><b>${esc(u.name)}</b><small>${R.label}</small></span></button><button type="button" class="ghost" data-act="logout">ออกจากระบบ</button>`;
    rolebar.innerHTML = `<div class="wrap" style="--rc:${R.color}"><span class="small muted">กำลังใช้งานหน้าของ</span><span class="rpill">${ico(ROLE_ICON[u.role])}${R.label}</span><span>สวัสดี <b>${esc(u.name)}</b></span><span class="sp"></span><span class="small muted">${R.desc}${esc(zoneTxt)}</span></div>`;
  }

  /* ผูกเรื่องที่แจ้ง/งานที่รับ เข้ากับบัญชีผู้ใช้ */
  function syncData() {
    const u = state.user; let sn = null;
    try { sn = staffName(); } catch (_) { /* ไม่มี */ }
    const nm = displayName(u);
    state.reports.forEach(r => {
      if (u.role === 'reporter') {
        if (r.live && !r.uid) { r.uid = u.id; r.by = u.name; r.mine = true; }
        if (r.uid) r.mine = r.uid === u.id;
      } else if (sn && r.assignee === sn && !r.assigneeId) {
        r.assigneeId = u.id; r.assignee = nm;
        r.log.forEach(l => { if (l.by === sn) l.by = nm; });
      }
    });
  }

  /* ---------- ครอบฟังก์ชัน render ของ app.js ---------- */
  const baseRender = window.render;
  window.render = function () {
    if (!state.user) { if (!$('#authBox')) showAuth(); return; }
    hideAuth(); syncData();
    if (state.tab === 'profile' && lastTab !== 'profile') state.prof = profFrom(state.user);
    lastTab = state.tab;
    baseRender();
    chrome();
  };

  /* ---------- เมนูโปรไฟล์ และปรับข้อความในหน้าเดิม ---------- */
  ICON.user = 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0';
  Object.keys(TABS).forEach(role => {
    if (TABS[role].some(t => t[0] === 'profile')) return;
    const i = TABS[role].findIndex(t => t[0] === 'about');
    TABS[role].splice(i < 0 ? TABS[role].length : i, 0, ['profile', 'โปรไฟล์', 'user']);
  });
  VIEWS.profile = viewProfile;
  function patchView(name, pairs) {
    const orig = VIEWS[name]; if (!orig) return;
    VIEWS[name] = function () { let h = orig.apply(this, arguments); pairs.forEach(([a, b]) => { if (h.includes(a)) h = h.replace(a, () => b); }); return h; };
  }
  patchView('jobs', [['(สลับเป็นบทบาท "ผู้แจ้ง" เพื่อแจ้งเรื่องแรก)', '(ให้ผู้แจ้งส่งเรื่องก่อน หรือกด "โหลดข้อมูลตัวอย่าง" ท้ายหน้าเพื่อลองใช้)']]);
  patchView('dash', [['สลับเป็นบทบาท "ผู้แจ้ง" ด้านบน แล้วแจ้งเรื่องแรกเพื่อเริ่มมีข้อมูล', 'ให้ผู้แจ้งส่งเรื่องแรกก่อน หรือกด "โหลดข้อมูลตัวอย่าง" ท้ายหน้า']]);
  patchView('about', [
    ['ไม่ขอชื่อ เบอร์โทร หรือตำแหน่ง GPS ของผู้ใช้', 'ไม่ขอตำแหน่ง GPS ของผู้ใช้ ชื่อและอีเมลใช้เพื่อสร้างบัญชีเท่านั้น'],
    ['จึงยังไม่มีระบบล็อกอิน', 'ระบบล็อกอินเป็นต้นแบบที่เก็บบัญชีในเครื่อง ไม่ปลอดภัยเท่าระบบจริง'],
  ]);
  const home0 = VIEWS.home;
  VIEWS.home = function () {
    const h = home0.apply(this, arguments), u = state.user, R = u ? ROLES[u.role] : null, m = '<section class="card hero">';
    if (!u || !h.includes(m)) return h;
    const g = `<section class="card flat greet" style="--rc:${R.color}"><span class="av lg">${esc(initial(u.name))}</span><div style="min-width:0"><div class="h" style="margin-bottom:2px">หน้าหลักของ${R.label}</div><h2 class="title" style="overflow-wrap:anywhere">สวัสดี ${esc(u.name)}</h2><p class="small muted">คุณเข้าสู่ระบบในฐานะ <b>${R.label}</b> · ${R.desc}</p></div></section>`;
    return h.replace(m, () => g + m);
  };

  /* ---------- เหตุการณ์ ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const d = el.dataset;
    switch (d.act) {
      case 'authrole': if (ROLES[d.r]) { state.auth.role = d.r; state.auth.err = ''; showAuth(); } break;
      case 'authmode': state.auth.mode = d.m === 'register' ? 'register' : 'login'; state.auth.err = ''; state.auth.pw = ''; state.auth.pw2 = ''; showAuth(); break;
      case 'demofill': demoFill(d.r); break;
      case 'logout': logout(); break;
      case 'deleteacct': deleteAccount(); break;
    }
  });
  const AF = { aName: 'name', aEmail: 'email', aPw: 'pw', aPw2: 'pw2', aPhone: 'phone', aDept: 'dept', aCode: 'code' };
  const PF = { pName: 'name', pPhone: 'phone', pDept: 'dept', pOld: 'pwOld', pNew: 'pwNew', pNew2: 'pwNew2' };
  document.addEventListener('input', e => {
    const id = e.target.id;
    if (AF[id]) state.auth[AF[id]] = e.target.value;
    else if (PF[id] && state.prof) state.prof[PF[id]] = e.target.value;
  });
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'aZone') state.auth.zone = e.target.value;
    else if (id === 'aAgree') state.auth.agree = e.target.checked;
    else if (id === 'pZone' && state.prof) state.prof.zone = e.target.value;
    else if (id === 'aShow') $$('#authRoot input[data-pw]').forEach(i => { i.type = e.target.checked ? 'text' : 'password'; });
  });
  document.addEventListener('submit', e => {
    const id = e.target.id;
    if (id === 'loginForm') doLogin();
    else if (id === 'regForm') doRegister();
    else if (id === 'profileForm') saveProfile();
    else if (id === 'pwForm') changePw();
  });

  /* ---------- เริ่มต้น: กู้ session เดิม ถ้าไม่มีให้แสดงหน้า login ---------- */
  const cm = $('#consent'); if (cm) cm.hidden = true; document.body.classList.remove('modal-open');   /* app.js เปิดหน้าต่างความยินยอมตอนโหลด ซ่อนไว้ก่อนจนกว่าจะ login */
  const sid = lsGet(SESSION_KEY), su = sid ? getUsers().find(x => x.id === sid) : null;
  if (su) startSession(su); else render();
})();
