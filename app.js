/* =====================================================================
   Smart Waste · ระบบแจ้งและติดตามปัญหาขยะล้น  (SPU Khon Kaen · S.M.A.R.T. Campus)
   ข้อมูลทั้งหมดเก็บในเบราว์เซอร์เครื่องนี้ (localStorage) ไม่มีข้อมูลตัวอย่างตั้งต้น
   ===================================================================== */
const MIN = 60000;
const TYPES = { general: 'ทั่วไป', recycle: 'รีไซเคิล', organic: 'อินทรีย์', hazard: 'อันตราย' };
const TYPE_COLOR = { general: 'น้ำเงิน', recycle: 'เหลือง', organic: 'เขียว', hazard: 'แดง' };
const PROBLEMS = ['ขยะล้น', 'ถังเต็ม', 'ขยะตกพื้น', 'มีกลิ่น'];
const STATUS = { wait: 'รอดำเนินการ', doing: 'กำลังดำเนินการ', done: 'ดำเนินการแล้ว' };
const ESC_MIN = 30, REMIND_MIN = 20;
const STORE_KEY = 'smartwaste.v3', THEME_KEY = 'smartwaste.theme', CONSENT_KEY = 'smartwaste.consent';
const CFG = Object.assign({ aiEndpoint: '', contact: '' }, window.SW_CONFIG || {});
const MAX_PHOTO_MB = 10;

/* ---------- ข้อมูลโครงงาน (หน้า "โครงงาน") ----------
   สมมติฐานด้านล่างเขียนจากการสังเกตทั่วไป ต้องยืนยันด้วยข้อมูลจริงก่อนส่งงาน
   ใส่หลักฐานจริงที่ evidence (ผลสำรวจ ภาพถ่ายหน้างาน บทสัมภาษณ์ ฯลฯ) หน้าเว็บจะแสดงให้เอง */
const PROJECT = {
  problem: 'ถังขยะในมหาวิทยาลัยล้นหรือเต็มแล้วไม่มีใครรู้ทันที ผู้พบปัญหาไม่รู้ว่าต้องแจ้งใคร เจ้าหน้าที่ไม่รู้ว่าจุดไหนต้องไปก่อน ทำให้ขยะค้างนาน มีกลิ่นและแมลง',
  users: [
    ['ผู้แจ้ง (นักศึกษา / บุคลากร)', 'พบถังล้นระหว่างเดินในวิทยาเขต ต้องการแจ้งได้เร็วและรู้ว่าเรื่องถูกดำเนินการแล้วหรือยัง'],
    ['เจ้าหน้าที่เก็บขยะ', 'ต้องรู้ว่าจุดไหนด่วนที่สุด และต้องมีหลักฐานว่าเก็บเสร็จแล้ว'],
    ['ผู้ดูแลพื้นที่', 'ต้องเห็นภาพรวม จุดที่ล้นซ้ำ และงานที่เกินเวลา เพื่อจัดคนและรอบเก็บให้เหมาะสม'],
  ],
  causes: [
    'ไม่มีช่องทางแจ้งที่ง่ายและรู้ตำแหน่งถังชัดเจน',
    'เจ้าหน้าที่ตรวจตามรอบ ไม่ได้ตามเหตุการณ์จริง',
    'ไม่มีข้อมูลสะสมว่าจุดไหนล้นบ่อย จึงปรับรอบเก็บไม่ได้',
    'เรื่องแจ้งซ้ำหลายคนแต่ไม่ถูกรวม ทำให้ลำดับความสำคัญไม่ชัด',
  ],
  impacts: ['กลิ่นและแมลงรบกวนผู้ใช้อาคาร', 'ภาพลักษณ์ของวิทยาเขต', 'เสี่ยงต่อสุขอนามัย โดยเฉพาะขยะอินทรีย์และขยะอันตราย', 'เจ้าหน้าที่ทำงานโดยไม่มีข้อมูลช่วยตัดสินใจ'],
  /* ตัวอย่างรูปแบบ: { t: 'แบบสำรวจนักศึกษา', d: 'ตอบ 45 คน พบถังล้นสัปดาห์ละ 3 ครั้งขึ้นไป 62%' } */
  evidence: [],
};

/* ---------- แผนผังวิทยาเขต (ภาพ "แผนผัง SPUKK" · SMART START) ----------
   พิกัด x,y ของถังและอาคารเป็นพิกเซลบนภาพแผนผัง ขนาด 960 × 960
   ตัวภาพฝังอยู่ท้ายไฟล์นี้ (MAP_IMG_B64) จึงไม่ต้องอัปโหลดไฟล์รูปแยก และจะไม่เกิดหน้า 404 */
const MAP = { w: 960, h: 960, src: '' };
const BUILDINGS = ['อาคาร 1', 'อาคาร 2', 'อาคาร 3', 'อาคาร 4', 'สนามกีฬา', 'ที่จอดรถ โซน A', 'ที่จอดรถ โซน B', 'ที่จอดรถ โซน C'];
const ZONE_OF = { 'อาคาร 1': 'Z-A', 'อาคาร 2': 'Z-A', 'ที่จอดรถ โซน A': 'Z-A', 'ที่จอดรถ โซน B': 'Z-A', 'ที่จอดรถ โซน C': 'Z-A',
  'อาคาร 3': 'Z-B', 'อาคาร 4': 'Z-B', 'สนามกีฬา': 'Z-B' };
const BIN_ZONE_LABEL = { 'Z-A': 'โซน A', 'Z-B': 'โซน B' };

const BLD = {
  'อาคาร 1': { n: 1, color: '#2a72c9', soft: '#dbeafc', ink: '#fff', title: 'อาคาร 1', sub: 'บริการนักศึกษา · คณะ', box: [640, 373, 78, 227],
    rooms: [
      { c: '1-101', n: 'USR Theater' },
      { c: '1-104', n: 'เลขานุการคณะ' },
      { c: '1-106', n: 'สำนักบริการการศึกษา', s: ['งานวิชาการ', 'งานสหกิจศึกษา'] },
      { c: '1-107', n: 'One Stop Service Center', s: ['งานทะเบียน'] },
      { c: '1-108', n: 'Admission Office', s: ['งานสมัครนักศึกษาใหม่', 'งานกองทุน', 'งานการเงิน'] },
      { c: '1-201', n: 'ห้องปฏิบัติการคอมพิวเตอร์ Mac' },
      { c: '1-202', n: 'คณะเทคโนโลยีสารสนเทศ' },
      { c: '1-204', n: 'คณะนิเทศศาสตร์' },
      { c: '1-206', n: 'ห้องผู้ช่วยรองอธิการบดี / งานบุคคล' }] },
  'อาคาร 2': { n: 2, color: '#f2a81d', soft: '#fdeccb', ink: '#2a1d00', title: 'อาคาร 2', sub: 'คณะ · วิทยาลัย · Book Center', box: [230, 350, 88, 326],
    rooms: [
      { c: '2-102', n: 'ศูนย์หนังสือ / Book Center' },
      { c: '2-104', n: 'วิทยาลัยโลจิสติกส์และซัพพลายเชน' },
      { c: '2-106', n: 'วิทยาลัยการท่องเที่ยวและการบริการ' },
      { c: '2-205', n: 'คณะบริหารธุรกิจ' },
      { c: '2-206', n: 'คณะบัญชี' },
      { c: '2-207', n: 'คณะศิลปศาสตร์' }] },
  'อาคาร 3': { n: 3, color: '#c94c5c', soft: '#f9dde0', ink: '#fff', title: 'อาคาร 3', sub: 'ห้องประชุม · บัณฑิตวิทยาลัย', box: [70, 262, 223, 88],
    rooms: [
      { f: 1, n: 'ห้องประชุม / ห้องสัมมนา' },
      { c: '3-201', n: 'ห้องรับรอง VIP' },
      { c: '3-206', n: 'ห้องประชุมพุทธยากรณ์' },
      { c: '3-301', n: 'วิทยาลัยบัณฑิตศึกษาด้านการจัดการ' },
      { c: '3-401', n: 'Auditorium Room / Board Game' },
      { c: '3-405', n: 'หลักสูตรประกาศนียบัตรบัณฑิตวิชาชีพครู' }] },
  'อาคาร 4': { n: 4, color: '#8a56b8', soft: '#ecdff6', ink: '#fff', title: 'อาคาร 4', sub: 'Food Court · ห้องสมุด · นิติศาสตร์', box: [293, 262, 332, 61],
    rooms: [
      { c: '4-101', n: 'ศูนย์มีเดีย / Studio / ศูนย์อาหาร / FOOD COURT' },
      { f: 2, n: 'ห้องสมุด / Home@spu' },
      { c: '4-301', n: 'หลักสูตรนิติศาสตรมหาบัณฑิต' },
      { c: '4-307', n: 'คณะนิติศาสตร์' },
      { c: '4-400', n: 'สำนักศึกษาทั่วไป' }] },
};
/* ปลายทางยอดนิยม ("ไปที่ไหนดี" ในภาพ) */
const QUICK = [
  { t: 'One Stop Service · 1-107', b: 'อาคาร 1' }, { t: 'Admission Office · 1-108', b: 'อาคาร 1' },
  { t: 'Book Center · 2-102', b: 'อาคาร 2' }, { t: 'ห้องรับรอง VIP · 3-201', b: 'อาคาร 3' },
  { t: 'Food Court · 4-101', b: 'อาคาร 4' }, { t: 'ห้องสมุด · อาคาร 4 ชั้น 2', b: 'อาคาร 4' },
];
const AREA_BOX = {
  'สนามกีฬา': [322, 350, 262, 330],
  'ที่จอดรถ โซน A': [583, 750, 277, 162],
  'ที่จอดรถ โซน B': [745, 262, 113, 413],
  'ที่จอดรถ โซน C': [70, 385, 155, 291],
};
const bldBox = b => (BLD[b] ? BLD[b].box : AREA_BOX[b]);
const bldColor = b => (BLD[b] ? BLD[b].color : b === 'สนามกีฬา' ? '#3f9b5f' : '#6b7280');
const floorOf = r => r.f || (r.c ? Number(r.c.split('-')[1][0]) : null);
const roomLabel = (bName, r) => `${r.c ? 'ห้อง ' + r.c : 'ชั้น ' + floorOf(r)} ${r.n} (${bName}${r.c ? ' ชั้น ' + floorOf(r) : ''})`;

/* ถังขยะ (ตำแหน่งตัวอย่างเริ่มต้น ปรับ x,y หรือเพิ่มถังได้ที่นี่ · พิกัดเป็นพิกเซลบนภาพ 960 × 960) */
const BINS = [
  { id: 'BIN-101-G', b: 'อาคาร 1', spot: 'ชั้น 1 หน้า One Stop Service (1-107)', type: 'general', x: 679, y: 487 },
  { id: 'BIN-102-Y', b: 'อาคาร 1', spot: 'ชั้น 1 หน้า Admission Office (1-108)', type: 'recycle', x: 679, y: 553 },
  { id: 'BIN-103-R', b: 'อาคาร 1', spot: 'ชั้น 2 มุมแบตเตอรี่ ห้อง Mac (1-201)', type: 'hazard', x: 679, y: 421 },
  { id: 'BIN-201-G', b: 'อาคาร 2', spot: 'ชั้น 1 หน้า Book Center (2-102)', type: 'general', x: 274, y: 640 },
  { id: 'BIN-202-Y', b: 'อาคาร 2', spot: 'ชั้น 1 หน้าวิทยาลัยโลจิสติกส์ฯ (2-104)', type: 'recycle', x: 274, y: 410 },
  { id: 'BIN-301-G', b: 'อาคาร 3', spot: 'ชั้น 1 หน้าห้องประชุม', type: 'general', x: 165, y: 305 },
  { id: 'BIN-302-Y', b: 'อาคาร 3', spot: 'ชั้น 2 หน้าห้องรับรอง VIP (3-201)', type: 'recycle', x: 255, y: 305 },
  { id: 'BIN-401-O', b: 'อาคาร 4', spot: 'ชั้น 1 Food Court (4-101)', type: 'organic', x: 345, y: 303 },
  { id: 'BIN-402-G', b: 'อาคาร 4', spot: 'ชั้น 1 ทางออก Food Court', type: 'general', x: 395, y: 303 },
  { id: 'BIN-403-Y', b: 'อาคาร 4', spot: 'ชั้น 2 ห้องสมุด / Home@spu', type: 'recycle', x: 450, y: 303 },
  { id: 'BIN-404-R', b: 'อาคาร 4', spot: 'ชั้น 2 ห้องสมุด มุมแบตเตอรี่', type: 'hazard', x: 505, y: 303 },
  { id: 'BIN-Y01-G', b: 'สนามกีฬา', spot: 'ข้างสนามกีฬา', type: 'general', x: 545, y: 520 },
  { id: 'BIN-Y02-Y', b: 'สนามกีฬา', spot: 'ใกล้เสาธง', type: 'recycle', x: 452, y: 568 },
  { id: 'BIN-P01-G', b: 'ที่จอดรถ โซน A', spot: 'ทางเข้าลานจอดรถ', type: 'general', x: 620, y: 800 },
  { id: 'BIN-P02-G', b: 'ที่จอดรถ โซน B', spot: 'ข้างอาคาร 1 ด้านที่จอดรถ', type: 'general', x: 778, y: 570 },
  { id: 'BIN-P03-G', b: 'ที่จอดรถ โซน C', spot: 'ข้างอาคาร 2 ด้านที่จอดรถ', type: 'general', x: 147, y: 460 },
];
const binById = id => BINS.find(b => b.id === id);
const binsOf = b => BINS.filter(x => x.b === b);

/* ---------- สถานะแอป ---------- */
const state = {
  role: 'reporter', tab: 'home', zone: 'Z-A',
  offset: 0, seq: 0,
  draft: null, lastId: null, filter: 'all', mapFilter: 'all', mapSel: null, mapBld: null, mapQ: '', mapZoom: 1, mapFocus: null,
  jobId: null, jobStatus: null, jobNote: '', jobAfter: null, jobErr: '',
  period: 'day', chat: [], consent: false, tests: null,
  reports: [], notifs: [],
};
const now = () => Date.now() + state.offset;

/* ---------- ฟังก์ชันช่วย ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const hhmm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const mmss = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const THAI_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_D = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const startOfDay = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const dayLabel = t => {
  const diff = Math.round((startOfDay(now()) - startOfDay(t)) / 86400000);
  if (diff === 0) return 'วันนี้ ' + hhmm(t);
  if (diff === 1) return 'เมื่อวาน';
  const d = new Date(t);
  return d.getDate() + ' ' + THAI_M[d.getMonth()] + ' ' + hhmm(t);
};
const ago = t => Math.max(0, Math.floor((now() - t) / MIN));
const idFor = n => { const d = new Date(now()); return 'SW-' + pad(d.getFullYear() % 100) + pad(d.getMonth() + 1) + '-' + String(n).padStart(4, '0'); };
const typeDot = t => `<span class="dot ${t}"></span>`;
const pill = s => `<span class="pill ${s}">${STATUS[s]}</span>`;
const SAMPLE_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#cfe3df"/><rect x="22" y="30" width="36" height="38" rx="4" fill="#2f6bb5"/><rect x="18" y="26" width="44" height="8" rx="3" fill="#24558f"/><circle cx="30" cy="22" r="7" fill="#e9b824"/><rect x="40" y="14" width="14" height="12" rx="2" fill="#e08a12"/></svg>');

const ICON = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  map: 'M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  bell: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1.2 1.2L7 5M4 12l1.2 1.2L7 11M4 18l1.2 1.2L7 17',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  pin: 'M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z',
  info: 'M12 11v6M12 7.5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
};
const ico = (n, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[n]}"/></svg>`;

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
}

/* ---------- เก็บข้อมูลในเครื่อง ---------- */
let saveWarned = false;
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ reports: state.reports, notifs: state.notifs, seq: state.seq, offset: state.offset }));
  } catch (e) {
    if (!saveWarned) { saveWarned = true; toast('พื้นที่เก็บข้อมูลในเครื่องเต็ม ข้อมูลล่าสุดอาจไม่ถูกบันทึก'); }
  }
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY); if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.reports)) state.reports = d.reports.filter(r => r && binById(r.bin));
    if (Array.isArray(d.notifs)) state.notifs = d.notifs;
    state.seq = Number(d.seq) || state.reports.length;
    state.offset = Number(d.offset) || 0;
  } catch (e) { /* ข้อมูลเสียหาย เริ่มใหม่ */ }
}

/* ---------- ข้อมูลตัวอย่าง (โหลดเองเมื่อกดปุ่มท้ายหน้า เท่านั้น) ---------- */
function loadDemo() {
  const t = now(), day = 24 * 60 * MIN;
  const mk = (bin, prob, detail, agoMin, status, extra = {}) => {
    const r = {
      id: idFor(++state.seq), bin, problem: prob, detail, created: t - agoMin * MIN, status,
      mine: true, count: 1, photo: SAMPLE_PHOTO, after: null, assignee: null, accepted: null, resolved: null,
      escalated: false, reminded: false, live: false, by: 'นักศึกษา',
      log: [{ s: 'wait', by: 'นักศึกษา', at: t - agoMin * MIN, note: 'แจ้งเรื่อง' }], ...extra };
    const a = SWAI.analyzeReport({ problem: prob, detail, bin: binById(bin), now: t, recent: [] });
    r.ai = { status: a.status, severity: a.severity || SWAI.sevFromScore(a.score), score: a.score, confidence: a.confidence };
    state.reports.push(r); state.notifs.push({ k: 'N1', rid: r.id, at: r.created });
    return r;
  };
  const sm = 'สมชาย (เจ้าหน้าที่โซน B)', ml = 'มาลี (เจ้าหน้าที่โซน A)';
  const fin = (r, accMin, doneMin, who) => {
    r.status = 'done'; r.accepted = r.created + accMin * MIN; r.resolved = r.created + doneMin * MIN; r.assignee = who;
    r.log.push({ s: 'doing', by: who, at: r.accepted, note: 'รับงานแล้ว' }, { s: 'done', by: who, at: r.resolved, note: 'เก็บเรียบร้อย' });
    state.notifs.push({ k: 'N5', rid: r.id, at: r.accepted }, { k: 'N4', rid: r.id, at: r.resolved });
  };
  mk('BIN-401-O', 'ถังเต็ม', 'เศษอาหารล้นถัง มีแมลงวัน', 21, 'wait', { mine: false, reminded: true, by: 'บุคลากร' });
  state.notifs.push({ k: 'N2', rid: state.reports[state.reports.length - 1].id, at: t - 1 * MIN });
  mk('BIN-101-G', 'ขยะล้น', 'ถังขยะเต็ม มีขยะวางด้านข้าง', 12, 'wait');
  const d = mk('BIN-403-Y', 'ถังเต็ม', 'ขวดพลาสติกเต็มถัง', 55, 'doing', { accepted: t - 46 * MIN, assignee: sm });
  d.log.push({ s: 'doing', by: 'สมชาย', at: d.accepted, note: 'รับงานแล้ว' }); state.notifs.push({ k: 'N5', rid: d.id, at: d.accepted });
  fin(mk('BIN-402-G', 'ขยะตกพื้น', 'ขยะตกรอบถัง', day + 40, 'wait'), 12, 30, sm);
  fin(mk('BIN-Y01-G', 'ขยะล้น', 'ขยะล้นข้างสนามกีฬา', 3 * day + 90, 'wait'), 9, 20, sm);
  fin(mk('BIN-201-G', 'มีกลิ่น', 'กลิ่นเหม็นหน้า Book Center', 2 * day + 300, 'wait'), 14, 35, ml);
}
function resetAll() {
  state.reports = []; state.notifs = []; state.seq = 0; state.offset = 0; state.lastId = null; state.jobId = null; state.draft = null;
  state.mapSel = null; state.mapBld = null; state.mapQ = ''; state.chat = [];
}

/* ---------- ตรรกะธุรกิจ ---------- */
const remaining = r => r.created + ESC_MIN * MIN - now();
const zoneOf = r => ZONE_OF[binById(r.bin).b];
const staffName = () => state.role === 'supervisor' ? 'ผู้ดูแลพื้นที่' : 'เจ้าหน้าที่โซน ' + (state.zone === 'Z-B' ? 'B' : 'A') + ' (คุณ)';

function timerSpan(r, mode) {
  if (r.status !== 'wait') return '';
  const rem = remaining(r);
  const cls = r.escalated ? 'esc' : rem < 10 * MIN ? 'late' : '';
  const txt = r.escalated ? 'เกินเวลา ส่งต่อผู้ดูแลแล้ว' : mode === 's' ? 'เหลือ ' + mmss(rem) : 'เหลือ ' + Math.ceil(rem / MIN) + ' น. ก่อนแจ้งผู้ดูแล';
  return `<span class="timer ${cls}" data-cd="${r.id}" data-mode="${mode}">${txt}</span>`;
}
function setStatus(r, s, by, note) {
  const t = now();
  r.status = s;
  if (s === 'doing') { r.accepted = r.accepted || t; r.assignee = by; }
  if (s === 'done') { r.resolved = t; r.accepted = r.accepted || t; r.assignee = r.assignee || by; }
  if (s === 'wait') { r.accepted = null; r.assignee = null; r.resolved = null; }
  r.log.push({ s, by, at: t, note });
  if (s === 'doing') state.notifs.push({ k: 'N5', rid: r.id, at: t });
  if (s === 'done') state.notifs.push({ k: 'N4', rid: r.id, at: t });
}
function acceptJob(r, by) { setStatus(r, 'doing', by || staffName(), 'รับงานแล้ว'); toast('รับงานแล้ว หยุดนับเวลา และแจ้งผู้แจ้งทันที'); }

/* ---------- ผู้ช่วยวิเคราะห์ (AI-assist) ---------- */
const aiInput = d => ({ problem: d.problem, detail: d.detail, bin: binById(d.bin), now: now(),
  recent: state.reports.filter(r => r.status !== 'done').map(r => ({ bin: r.bin, created: r.created })) });
const sevPill = s => s ? `<span class="sev ${s}">ความรุนแรง${SWAI.SEV_LABEL[s]}</span>` : '';
async function runAnalyze() {
  const d = state.draft; if (!d || d.aiBusy) return;
  d.aiBusy = true; d.ai = null; render();
  const started = Date.now();
  const res = await SWAI.analyze(aiInput(d), { endpoint: CFG.aiEndpoint });
  const wait = 350 - (Date.now() - started);            /* ให้เห็นสถานะ "กำลังวิเคราะห์" อย่างน้อยครู่หนึ่ง ไม่ให้หน้าจอกะพริบ */
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  if (state.draft !== d) return;                         /* ผู้ใช้เปลี่ยนหน้าไประหว่างรอ */
  d.aiBusy = false; d.ai = res; render();
  const el = document.getElementById('aiPanel'); if (el) el.focus({ preventScroll: false });
}
function aiPanelHtml(d) {
  const r = d.ai;
  const head = `<div class="row"><b>${ico('spark')} ผู้ช่วยวิเคราะห์ปัญหา</b><span class="sp"></span><span class="tag">ข้อเสนอแนะ · ไม่ใช่คำตัดสิน</span></div>`;
  let body;
  if (d.aiBusy) body = `<p class="small" role="status"><span class="spin" aria-hidden="true"></span> กำลังวิเคราะห์…</p>`;
  else if (!r) body = `<p class="small muted">กด "วิเคราะห์ก่อนส่ง" เพื่อให้ระบบประเมินความรุนแรง แนะนำประเภทถัง และบอกเหตุผล (ไม่ส่งรูปออกจากเครื่อง)</p>`;
  else {
    const conf = Math.round(r.confidence * 100);
    const sev = r.severity ? `<div class="aisev ${r.severity}"><span class="small">ความรุนแรงที่ประเมิน</span><b>${SWAI.SEV_LABEL[r.severity]}</b><span class="small">คะแนนเร่งด่วน ${r.score}/100</span></div>` : `<div class="aisev none"><span class="small">ความรุนแรงที่ประเมิน</span><b>ประเมินไม่ได้</b></div>`;
    body = `<div class="aigrid">${sev}<div class="aiconf"><span class="small">ความมั่นใจ ${r.confidenceLabel}</span><div class="meter" role="img" aria-label="ความมั่นใจ ${conf} เปอร์เซ็นต์"><i style="width:${conf}%"></i></div><b class="num">${conf}%</b></div></div>
      <p class="small ${r.status === 'ok' ? '' : 'aiwarn'}" role="status">${esc(r.message || '')}</p>
      ${(r.questions || []).length ? `<div class="small"><b>ช่วยบอกเพิ่ม:</b><ul class="aiq">${r.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
      ${(r.suggestions || []).map(s => `<div class="aisug"><span class="small">${esc(s.text)}</span><button type="button" class="btn sm" data-act="aiapply" data-t="${esc(s.binType)}">ใช้ถังประเภทนี้</button></div>`).join('')}
      ${(r.notes || []).map(n => `<p class="small aiwarn">${esc(n)}</p>`).join('')}
      ${(r.reasons || []).length ? `<details class="aidet"><summary>ดูเหตุผลที่ระบบใช้ (${r.reasons.length})</summary><ol>${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}
      <p class="small muted">${r.source === 'remote' ? 'วิเคราะห์โดยโมเดลภายนอก' : 'วิเคราะห์ด้วยกฎในเครื่อง (' + esc(r.version) + ')'} · ผลอาจคลาดเคลื่อน เจ้าหน้าที่ตรวจซ้ำก่อนดำเนินการ</p>`;
  }
  return `<section class="card aibox" id="aiPanel" tabindex="-1" aria-live="polite">${head}${body}
    <div style="margin-top:10px"><button type="button" class="btn sm primary" data-act="analyze" ${d.aiBusy ? 'disabled' : ''}>${d.aiBusy ? 'กำลังวิเคราะห์…' : r ? 'วิเคราะห์อีกครั้ง' : 'วิเคราะห์ก่อนส่ง'}</button></div></section>`;
}

function askConsent(msg) { openConsent(); if (msg) toast(msg); }

function submitReport() {
  const d = state.draft, t = now();
  if (!state.consent) { d.err = 'กรุณายอมรับการเก็บข้อมูลก่อนส่งเรื่อง'; render(); askConsent(); return; }
  if (!d.photo) { d.err = 'ต้องแนบรูปอย่างน้อย 1 รูป เพื่อให้เจ้าหน้าที่เห็นสภาพจริง'; render(); return; }
  if (!binById(d.bin)) { d.err = 'ไม่พบถังที่เลือก กรุณาเลือกถังใหม่'; render(); return; }
  d.detail = d.detail.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const dup = state.reports.find(r => r.bin === d.bin && r.status !== 'done' && t - r.created < ESC_MIN * MIN);
  if (dup) {
    dup.count++;
    dup.log.push({ s: dup.status, by: 'นักศึกษา', at: t, note: 'มีผู้แจ้งซ้ำ รวมเป็นเรื่องเดียว' });
    state.lastId = dup.id; state.tab = 'done'; state.draft = null;
    toast('ถังนี้มีผู้แจ้งแล้ว ระบบรวมเป็นเรื่องเดียว (ผู้แจ้ง ' + dup.count + ' คน)');
    render(); window.scrollTo(0, 0); return;
  }
  state.seq++;
  const ai = d.ai && d.ai.status !== 'invalid' ? d.ai : SWAI.analyzeReport(aiInput(d));   /* ทุกเรื่องมีคะแนนเร่งด่วน แม้ผู้แจ้งไม่ได้กดวิเคราะห์ */
  const r = {
    id: idFor(state.seq), bin: d.bin, problem: d.problem, detail: d.detail.trim(), created: t, status: 'wait',
    mine: true, count: 1, photo: d.photo, after: null, assignee: null, accepted: null, resolved: null,
    escalated: false, reminded: false, live: true, by: 'นักศึกษา',
    ai: { status: ai.status, severity: ai.severity || SWAI.sevFromScore(ai.score), score: ai.score, confidence: ai.confidence },
    log: [{ s: 'wait', by: 'นักศึกษา', at: t, note: 'แจ้งเรื่อง' }],
  };
  state.reports.unshift(r);
  state.notifs.push({ k: 'N1', rid: r.id, at: t });
  state.lastId = r.id; state.tab = 'done'; state.draft = null;
  render(); window.scrollTo(0, 0);
}

/* ---------- แผนที่ย่อ (ตัดจากแผนผังวิทยาเขต ให้ถังอยู่กึ่งกลาง) ---------- */
function miniMap(bin, label) {
  const k = 2.2, ar = 1.8, ratio = MAP.h / MAP.w;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const left = clamp(50 - 100 * k * (bin.x / MAP.w), -(k - 1) * 100, 0);
  const top = clamp(50 - 100 * k * ar * ratio * (bin.y / MAP.h), 100 * (1 - k * ar * ratio), 0);
  const at = o => ({ x: left + 100 * k * (o.x / MAP.w), y: top + 100 * k * ar * ratio * (o.y / MAP.h) });
  const dots = BINS.filter(o => o.id !== bin.id).map(o => {
    const p = at(o); if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return '';
    return `<i class="md" style="left:${p.x}%;top:${p.y}%"></i>`;
  }).join('');
  const p = at(bin);
  return `<div class="minimap" role="img" aria-label="${esc(label || 'ตำแหน่งถัง ' + bin.id + ' ' + bin.b)}" style="aspect-ratio:${ar}/1">
    <img src="${MAP.src}" alt="" style="width:${k * 100}%;left:${left}%;top:${top}%" draggable="false">${dots}
    <span class="mp" style="left:${p.x}%;top:${p.y}%"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-7 8-12.5A8 8 0 004 9.5C4 15 12 22 12 22z" style="fill:var(--red)" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="9.5" r="3" fill="#fff"/></svg></span></div>`;
}

/* ---------- มุมมอง ---------- */
function itemHtml(r) {
  const b = binById(r.bin);
  return `<button type="button" class="item" data-act="open" data-id="${r.id}">
    <span class="thumb"><img src="${r.photo || SAMPLE_PHOTO}" alt=""></span>
    <span style="min-width:0"><span class="id">${r.id}</span><br>
      <span class="meta">${esc(b.b)} · ${typeDot(b.type)}${TYPES[b.type]}${r.count > 1 ? ' · ผู้แจ้ง ' + r.count + ' คน' : ''}</span>${r.ai ? '<br>' + sevPill(r.ai.severity) : ''}</span>
    <span style="text-align:right">${pill(r.status)}<br><span class="meta small muted">${dayLabel(r.created)}</span></span></button>`;
}
const mine = () => state.reports.filter(r => r.mine).sort((a, b) => b.created - a.created);

function viewHome() {
  const m = mine().slice(0, 2);
  return `<div class="stack" style="max-width:760px;margin:0 auto">
    <section class="card hero">
      <div class="small" style="opacity:.7">ถังเต็ม?</div>
      <h1 class="big">เลือกจุด <em>ถ่าย</em> ส่ง<br>แจ้งขยะล้นได้ในไม่กี่วินาที</h1>
      <p>เจอถังขยะเต็มหรือขยะล้น เลือกอาคารและจุดที่พบ ถ่ายรูป แล้วส่ง เจ้าหน้าที่ประจำโซนจะได้รับแจ้งทันที</p>
      <div style="margin-top:18px;max-width:340px"><button type="button" class="btn primary lg" data-act="tab" data-tab="report">${ico('camera')} แจ้งขยะล้นเลย</button></div>
    </section>
    <div class="tiles">
      <button type="button" class="tile" data-act="tab" data-tab="list">${ico('list')}รายการแจ้งปัญหา</button>
      <button type="button" class="tile" data-act="tab" data-tab="map">${ico('map')}แผนผังวิทยาเขต</button>
      <button type="button" class="tile" data-act="tab" data-tab="dash">${ico('chart')}Dashboard</button>
      <button type="button" class="tile" data-act="tab" data-tab="chat">${ico('chat')}Chatbot</button>
      <button type="button" class="tile" data-act="tab" data-tab="about">${ico('info')}ข้อมูลโครงงาน</button>
    </div>
    <section class="card"><div class="h">เรื่องล่าสุดของฉัน</div>
      <div class="list">${m.length ? m.map(itemHtml).join('') : '<p class="muted">ยังไม่มีเรื่องที่แจ้ง เริ่มจากกด "แจ้งขยะล้นเลย" ด้านบน</p>'}</div></section>
  </div>`;
}

function viewReport() {
  const d = state.draft;
  const bin = binById(d.bin);
  const spots = binsOf(d.building);
  return `<div class="grid2"><form class="card" id="reportForm" novalidate>
    <h2 class="title" style="margin-bottom:2px">แจ้งขยะล้น</h2><p class="muted small" style="margin-bottom:16px">กรอกให้ครบแล้วกดส่ง</p>
    ${d.fromMap ? `<div class="autofill field"><small>เลือกจากแผนผังแล้ว</small><b class="mono">${bin.id}</b> · ถัง${TYPES[bin.type]} (${TYPE_COLOR[bin.type]})<small>${esc(bin.b)} ${esc(bin.spot)}</small></div>` : ''}
    <div class="field"><span class="lab" id="lp">ประเภทปัญหา</span>
      <div class="chips" role="group" aria-labelledby="lp">${PROBLEMS.map(p => `<button type="button" class="chip sel" data-act="problem" data-p="${p}" aria-pressed="${d.problem === p}">${p}</button>`).join('')}</div></div>
    <div class="field"><label for="fBuilding">สถานที่</label>
      <select class="input" id="fBuilding">${BUILDINGS.map(b => `<option ${b === d.building ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
    <div class="field"><label for="fBin">ถัง / จุดที่พบ</label>
      <select class="input" id="fBin">${spots.map(b => `<option value="${b.id}" ${b.id === d.bin ? 'selected' : ''}>${b.id} · ${esc(b.spot)} (${TYPES[b.type]})</option>`).join('')}</select>
      <button type="button" class="btn sm" style="justify-self:start" data-act="pickmap">เลือกจากแผนผังวิทยาเขต</button></div>
    <div class="field"><label for="fDetail">รายละเอียดเพิ่มเติม <span class="muted" style="font-weight:400">(ไม่บังคับ)</span></label>
      <textarea class="input" id="fDetail" maxlength="200" placeholder="เช่น ถังขยะเต็ม มีขยะวางด้านข้าง">${esc(d.detail)}</textarea>
      <span class="small muted num" id="fCount" style="text-align:right">${d.detail.length}/200</span></div>
    ${aiPanelHtml(d)}
    <div class="field"><span class="lab">รูปภาพ <span style="color:var(--red-ink)">*</span></span>
      <div class="photo"><span class="pv" id="fPv">${d.photo ? `<img src="${d.photo}" alt="รูปที่แนบ">` : ico('camera')}</span>
        <label class="drop" for="fPhoto">+ แนบรูป หรือถ่ายใหม่</label>
        <input type="file" id="fPhoto" accept="image/*" capture="environment" hidden>
        <button type="button" class="btn sm" data-act="samplePhoto" style="align-self:center">ใช้รูปตัวอย่าง</button></div></div>
    <div class="field"><span class="lab">ตำแหน่งบนแผนผัง</span>
      <div class="gps">${ico('pin')}<div class="gt"><b>${esc(bin.b)}</b><span>${esc(bin.spot)} · ${typeDot(bin.type)}ถัง${TYPES[bin.type]}</span></div></div>
      ${miniMap(bin)}</div>
    <p class="err" role="alert" id="fErr">${esc(d.err)}</p>
    <p class="small muted" style="margin-bottom:10px">รูปและข้อความเก็บในเครื่องนี้เท่านั้น โปรดเลี่ยงถ่ายติดใบหน้าหรือข้อมูลส่วนบุคคล <button type="button" class="linkbtn" data-act="privacy">อ่านนโยบาย</button></p>
    <button type="submit" class="btn primary lg">ส่งแจ้งปัญหา</button></form>
    <aside class="stack"><section class="card flat"><div class="h">ขั้นตอนหลังส่ง</div>
      <ol class="small" style="margin:0;padding-left:18px;display:grid;gap:6px">
        <li>ระบบสร้างรหัสเรื่อง และตั้งสถานะ รอดำเนินการ</li><li>ส่ง LINE ถึงเจ้าหน้าที่ประจำโซนทันที</li>
        <li>เตือนซ้ำที่นาทีที่ ${REMIND_MIN} ถ้ายังไม่มีผู้รับงาน</li><li>ครบ ${ESC_MIN} นาที ส่งต่อผู้ดูแลพื้นที่อัตโนมัติ</li></ol></section>
      <section class="card flat small muted">ถังเดียวกันที่ถูกแจ้งซ้ำภายใน ${ESC_MIN} นาที จะรวมเป็นเรื่องเดียวและนับจำนวนผู้แจ้ง</section></aside></div>`;
}

function viewDone() {
  const r = state.reports.find(x => x.id === state.lastId);
  if (!r) return '<p class="muted">ไม่พบเรื่องที่เลือก</p>';
  const b = binById(r.bin);
  const step = (cls, label, t) => `<li class="${cls}"><span>${label}</span><span class="small muted num">${t || ''}</span></li>`;
  const fresh = r.live && r.log.length === 1 && now() - r.created < 2 * MIN;
  return `<div class="grid2"><div class="stack">
    <section class="ok-hero">${fresh ? `<div class="ck">${ico('check', 3)}</div><h2 class="title">ส่งแจ้งปัญหาแล้ว</h2>` : `<h2 class="title">ติดตามเรื่องที่แจ้ง</h2>`}
      <p class="small" style="margin-top:4px">${esc(b.b)} · ${esc(b.spot)} · ${typeDot(b.type)}${TYPES[b.type]}</p></section>
    <section class="card"><div class="row" style="margin-bottom:14px"><div><div class="small muted">รหัสเรื่อง</div><div class="title mono">${r.id}</div></div><span class="sp"></span>${pill(r.status)}</div>
      <ul class="tl">
        ${step('done', 'ส่งเรื่องเข้าระบบ', hhmm(r.created))}
        ${step('done', 'แจ้งเจ้าหน้าที่' + BIN_ZONE_LABEL[zoneOf(r)], hhmm(r.created))}
        ${r.escalated ? step('done', 'ส่งต่อผู้ดูแลพื้นที่', hhmm(r.created + ESC_MIN * MIN)) : ''}
        ${r.accepted ? step('done', 'เจ้าหน้าที่รับงาน', hhmm(r.accepted)) : step('now', 'เจ้าหน้าที่รับงาน', 'รอ')}
        ${r.resolved ? step('done', 'ดำเนินการแล้ว', hhmm(r.resolved)) : step('off', 'ดำเนินการแล้ว', '')}
      </ul>
      ${r.count > 1 ? `<p class="small" style="margin-top:10px">มีผู้แจ้งเรื่องนี้ ${r.count} คน ระบบรวมเป็นเรื่องเดียว</p>` : ''}
    </section>
    ${r.status === 'wait' ? `<section class="card" style="background:var(--amber-soft);border-color:transparent"><div class="row"><b style="color:var(--amber-ink)">เหลือเวลารับงาน</b><span class="sp"></span>${timerSpan(r, 's')}</div>
        <p class="small" style="margin-top:6px">ครบ ${ESC_MIN} นาทีแล้วยังไม่มีผู้รับงาน ระบบแจ้งผู้ดูแลพื้นที่อัตโนมัติ</p></section>` : ''}
    ${r.status === 'doing' ? `<section class="card flat small">รับงานโดย <b>${esc(r.assignee)}</b> เมื่อ ${hhmm(r.accepted)} จะแจ้งให้ทราบเมื่อเสร็จ</section>` : ''}
    ${r.status === 'done' ? `<section class="card flat"><div class="h">รูปหลังเก็บ</div><div class="thumb" style="width:120px;height:120px"><img src="${r.after || SAMPLE_PHOTO}" alt="รูปหลังเก็บ"></div><p class="small" style="margin-top:8px">ขอบคุณที่ช่วยแจ้งให้มหาวิทยาลัยสะอาดขึ้น</p></section>` : ''}
    <div class="row"><button type="button" class="btn dark" style="flex:1" data-act="tab" data-tab="list">ดูรายการ</button>
      <button type="button" class="btn" style="flex:1" data-act="tab" data-tab="report">แจ้งเรื่องอื่น</button></div></div>
    <aside class="stack"><section class="card flat"><div class="h">ตำแหน่งถัง</div>${miniMap(b)}
      <div class="row" style="margin-top:10px"><span class="small muted">${esc(b.b)} · ${b.id}</span><span class="sp"></span><button type="button" class="btn sm" data-act="showbin" data-bin="${b.id}">ดูบนแผนผัง</button></div></section></aside></div>`;
}

function viewList() {
  const f = state.filter;
  const rows = mine().filter(r => f === 'all' || r.status === f);
  const chip = (k, t) => `<button type="button" class="chip" data-act="filter" data-f="${k}" aria-pressed="${f === k}">${t}</button>`;
  return `<div class="stack" style="max-width:720px;margin:0 auto">
    <div class="row"><div><h2 class="title">รายการแจ้งปัญหา</h2><span class="small muted">ของฉัน ${mine().length} เรื่อง</span></div><span class="sp"></span>
      <button type="button" class="btn primary" data-act="tab" data-tab="report">+ แจ้งเรื่องใหม่</button></div>
    <div class="chips">${chip('all', 'ทั้งหมด')}${chip('wait', 'รอ')}${chip('doing', 'กำลัง')}${chip('done', 'เสร็จ')}</div>
    <div class="list">${rows.length ? rows.map(itemHtml).join('') : `<p class="muted card flat">${mine().length ? 'ไม่มีเรื่องในสถานะนี้' : 'ยังไม่มีเรื่องที่แจ้ง กด "+ แจ้งเรื่องใหม่" เพื่อเริ่มต้น'}</p>`}</div></div>`;
}

/* ---------- ฝั่งเจ้าหน้าที่ ---------- */
function scopeReports() {
  return state.reports.filter(r => state.zone === 'all' || zoneOf(r) === state.zone);
}
function viewJobs() {
  const rs = scopeReports();
  const today = new Date(now()).toDateString();
  const doneToday = rs.filter(r => r.status === 'done' && new Date(r.resolved).toDateString() === today);
  /* เรียงงานรอ: เกินเวลาก่อน แล้วตามคะแนนเร่งด่วนของ AI-assist (สูงก่อน) แล้วตามเวลาที่แจ้ง */
  const wait = rs.filter(r => r.status === 'wait').sort((a, b) => (b.escalated - a.escalated) || ((b.ai ? b.ai.score : 0) - (a.ai ? a.ai.score : 0)) || (a.created - b.created));
  const doing = rs.filter(r => r.status === 'doing').sort((a, b) => a.created - b.created);
  const sup = state.role === 'supervisor';
  const card = r => {
    const b = binById(r.bin);
    return `<article class="job ${r.status}"><div class="top"><span class="mono" style="font-weight:500">${r.id}</span><span>${r.ai && r.status === 'wait' ? sevPill(r.ai.severity) + ' ' : ''}${pill(r.status)}</span></div>
      <div><b>${esc(b.b)} ${esc(b.spot)}</b><div class="small muted">${typeDot(b.type)}${TYPES[b.type]} · ${r.status === 'doing' ? 'รับเมื่อ ' + hhmm(r.accepted) : r.status === 'done' ? 'เสร็จ ' + hhmm(r.resolved) : 'รอมา ' + ago(r.created) + ' น.'}${r.count > 1 ? ' · ผู้แจ้ง ' + r.count + ' คน' : ''}</div></div>
      ${timerSpan(r, 'm')}
      <div class="row">
        ${r.status === 'wait' ? `<button type="button" class="btn primary sm" style="flex:1" data-act="accept" data-id="${r.id}">รับงาน</button>` : ''}
        ${r.status === 'doing' ? `<button type="button" class="btn sm" style="flex:1;background:var(--green);color:#fff;border-color:var(--green)" data-act="finish" data-id="${r.id}">เสร็จแล้ว</button>` : ''}
        ${sup && r.status === 'wait' ? `<button type="button" class="btn sm" data-act="reassign" data-id="${r.id}">มอบหมายใหม่</button>` : ''}
        <button type="button" class="btn sm" data-act="open" data-id="${r.id}">รายละเอียด</button></div></article>`;
  };
  const empty = state.reports.length
    ? 'ไม่มีงานค้างในโซนนี้'
    : 'ยังไม่มีงาน เมื่อผู้แจ้งส่งเรื่อง งานจะขึ้นที่นี่ (สลับเป็นบทบาท "ผู้แจ้ง" เพื่อแจ้งเรื่องแรก)';
  return `<div class="stack">
    <div class="row"><div><h2 class="title">${sup ? 'ภาพรวมงานในพื้นที่' : 'งาน' + (state.zone === 'Z-B' ? 'โซน B' : 'โซน A')}</h2><span class="small muted">${sup ? 'ผู้ดูแลพื้นที่' : 'เจ้าหน้าที่เก็บขยะ'}</span></div><span class="sp"></span>
      <label class="small muted" for="zoneSel">โซน</label><select class="input" id="zoneSel" style="width:auto">
        <option value="Z-A" ${state.zone === 'Z-A' ? 'selected' : ''}>โซน A (อาคาร 1-2 · ที่จอดรถ)</option><option value="Z-B" ${state.zone === 'Z-B' ? 'selected' : ''}>โซน B (อาคาร 3-4 · สนามกีฬา)</option>
        ${sup ? `<option value="all" ${state.zone === 'all' ? 'selected' : ''}>ทุกโซน</option>` : ''}</select></div>
    <div class="kpis" style="max-width:520px"><div class="kpi red"><b class="num">${wait.length}</b><span>รอ</span></div>
      <div class="kpi amber"><b class="num">${doing.length}</b><span>กำลังทำ</span></div>
      <div class="kpi green"><b class="num">${doneToday.length}</b><span>เสร็จวันนี้</span></div></div>
    <div class="jobs">${[...wait, ...doing, ...doneToday].map(card).join('') || `<p class="muted card flat" style="grid-column:1/-1">${empty}</p>`}</div></div>`;
}

function viewJob() {
  const r = state.reports.find(x => x.id === state.jobId);
  if (!r) return '<p class="muted">ไม่พบงาน</p>';
  const b = binById(r.bin), s = state.jobStatus;
  const seg = (k, t) => `<button type="button" class="s-${k}" data-act="jstatus" data-s="${k}" aria-pressed="${s === k}">${t}</button>`;
  return `<div class="grid2"><div class="stack">
    <button type="button" class="btn sm" data-act="back" style="justify-self:start">← กลับ</button>
    <section class="card"><div class="row" style="margin-bottom:12px"><h2 class="title mono">${r.id}</h2>${pill(r.status)}${timerSpan(r, 'm')}</div>
      <div class="thumb" style="width:100%;height:210px;border-radius:12px"><img src="${r.photo || SAMPLE_PHOTO}" alt="รูปจากผู้แจ้ง" style="object-fit:cover"></div>
      <p class="small muted" style="margin:6px 0 14px">รูปจากผู้แจ้ง · 1 รูป</p>
      <dl style="display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px 12px;margin:0">
        <dt class="muted">ที่ตั้ง</dt><dd style="margin:0"><b>${esc(b.b)} ${esc(b.spot)}</b></dd>
        <dt class="muted">ถัง</dt><dd style="margin:0" class="mono">${b.id} · ${TYPES[b.type]} (${TYPE_COLOR[b.type]})</dd>
        <dt class="muted">ปัญหา</dt><dd style="margin:0">${esc(r.problem)}${r.detail ? ' · ' + esc(r.detail) : ''}</dd>
        ${r.ai ? `<dt class="muted">AI-assist</dt><dd style="margin:0">${sevPill(r.ai.severity)} <span class="small muted">คะแนน ${r.ai.score}/100 · มั่นใจ ${Math.round(r.ai.confidence * 100)}% · เป็นข้อเสนอแนะ เจ้าหน้าที่ตัดสินใจเอง</span></dd>` : ''}
        <dt class="muted">เวลาแจ้ง</dt><dd style="margin:0">${dayLabel(r.created)} · ${esc(r.by)}${r.count > 1 ? ' และอีก ' + (r.count - 1) + ' คน' : ''}</dd>
        ${r.assignee ? `<dt class="muted">ผู้รับงาน</dt><dd style="margin:0">${esc(r.assignee)}</dd>` : ''}</dl></section></div>
    <div class="stack"><section class="card">
      <div style="margin-bottom:12px">${miniMap(b)}</div>
      <div class="row" style="margin-bottom:16px"><span class="small muted">${esc(b.b)} · ${esc(b.spot)}</span><span class="sp"></span>
        <button type="button" class="btn sm primary" data-act="showbin" data-bin="${b.id}">ดูบนแผนผัง</button></div>
      <div class="field"><span class="lab">เปลี่ยนสถานะ</span><div class="seg" role="group" aria-label="สถานะงาน">${seg('wait', 'รอ')}${seg('doing', 'กำลังทำ')}${seg('done', 'เสร็จ')}</div></div>
      <div class="field"><label for="jNote">หมายเหตุ</label><textarea class="input" id="jNote" placeholder="เช่น เก็บขยะเสร็จ เปลี่ยนถุงใหม่">${esc(state.jobNote)}</textarea></div>
      <div class="field"><span class="lab">รูปหลังเก็บ ${s === 'done' ? '<span style="color:var(--red-ink)">* ต้องแนบก่อนปิดงาน</span>' : ''}</span>
        <div class="photo"><span class="pv" id="jPv">${state.jobAfter ? `<img src="${state.jobAfter}" alt="รูปหลังเก็บ">` : ico('camera')}</span>
          <label class="drop" for="jPhoto">แนบรูปหลังเก็บ</label><input type="file" id="jPhoto" accept="image/*" capture="environment" hidden>
          <button type="button" class="btn sm" data-act="sampleAfter" style="align-self:center">ใช้รูปตัวอย่าง</button></div></div>
      <p class="err" role="alert">${esc(state.jobErr)}</p>
      <button type="button" class="btn dark lg" data-act="saveJob">บันทึกสถานะ</button>
      <p class="small muted" style="margin-top:8px">บันทึกแล้วระบบแจ้งผู้แจ้งทันที และเก็บผู้เปลี่ยน เวลา หมายเหตุไว้ใน status_log</p></section>
      <section class="card flat"><div class="h">ประวัติสถานะ (status_log)</div><ul class="tl">${r.log.map(l => `<li class="done"><span>${STATUS[l.s]} <span class="muted small">· ${esc(l.by)}${l.note ? ' · ' + esc(l.note) : ''}</span></span><span class="small muted num">${hhmm(l.at)}</span></li>`).join('')}</ul></section></div></div>`;
}

/* ---------- แผนผังวิทยาเขต ---------- */
function binState(bin) {
  const r = state.reports.filter(x => x.bin === bin.id && x.status !== 'done').sort((a, b) => a.created - b.created)[0];
  return r ? r.status : 'done';
}
const SCOL = { wait: 'var(--red)', doing: 'var(--amber)', done: 'var(--green)' };
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
function roomMatches(b, r, q) {
  if (!q) return true;
  const hay = norm([b, r.c, r.n, (r.s || []).join(' '), r.f ? 'ชั้น' + r.f : ''].join(' '));
  return hay.includes(q);
}
function binMatches(b, q) { return !q || norm([b.id, b.b, b.spot, TYPES[b.type]].join(' ')).includes(q); }

function roomsHtml(bName, q) {
  const rooms = BLD[bName].rooms.filter(r => roomMatches(bName, r, q));
  return rooms.map(r => `<li><span class="rc" style="background:${BLD[bName].soft};color:var(--ink)">${r.c || 'ชั้น ' + r.f}</span><span>${esc(r.n)}${(r.s || []).length ? `<small>${r.s.map(esc).join(' · ')}</small>` : ''}</span></li>`).join('');
}
function bldCard(bName, q) {
  const B = BLD[bName], rooms = roomsHtml(bName, q);
  if (!rooms) return '';
  return `<section class="bcard"><button type="button" class="bhead" style="background:${B.color};color:${B.ink}" data-act="bld" data-b="${bName}" aria-label="${bName} ดูบนแผนผัง">
      <span class="bn">${B.n}</span><span><b>${B.title}</b><small>${B.sub}</small></span></button><ul class="rooms">${rooms}</ul></section>`;
}

function viewMap() {
  const f = state.mapFilter, q = norm(state.mapQ);
  const sel = state.mapSel ? binById(state.mapSel) : null;
  const selB = state.mapBld;
  const chip = (k, t) => `<button type="button" class="chip" data-act="mfilter" data-f="${k}" aria-pressed="${f === k}">${t}</button>`;
  const roomHit = b => BLD[b] && BLD[b].rooms.some(r => roomMatches(b, r, q));
  const hits = q ? Object.keys(BLD).filter(roomHit) : [];

  const zones = Object.keys({ ...BLD, ...AREA_BOX }).map(b => {
    const [x, y, w, h] = bldBox(b), on = selB === b, hit = hits.includes(b);
    return `<button type="button" class="bhit ${on ? 'on' : ''} ${hit ? 'hit' : ''}" data-act="bld" data-b="${b}" aria-label="${b}" aria-pressed="${on}"
      style="left:${x / MAP.w * 100}%;top:${y / MAP.h * 100}%;width:${w / MAP.w * 100}%;height:${h / MAP.h * 100}%"></button>`;
  }).join('');
  const pins = BINS.map(b => {
    const st = binState(b);
    const match = (f === 'all' || f === st) && binMatches(b, q);
    return `<button type="button" class="mpin ${match ? '' : 'dim'} ${sel && sel.id === b.id ? 'sel' : ''}" data-act="pin" data-bin="${b.id}"
      style="left:${b.x / MAP.w * 100}%;top:${b.y / MAP.h * 100}%;background:${SCOL[st]}" aria-pressed="${!!(sel && sel.id === b.id)}"
      aria-label="${b.id} ${esc(b.b)} ${esc(b.spot)} ${STATUS[st]}"><span class="tdot ${b.type}"></span></button>`;
  }).join('');

  const act = sel ? state.reports.find(x => x.bin === sel.id && x.status !== 'done') : null;
  let side;
  if (sel) {
    side = `<section class="card"><div class="row"><b class="mono">${sel.id}</b><span class="sp"></span>${pill(act ? act.status : 'done')}</div>
      <p style="margin:6px 0">${esc(sel.b)} · ${esc(sel.spot)}</p><p class="small muted">${typeDot(sel.type)}ถัง${TYPES[sel.type]} (${TYPE_COLOR[sel.type]}) ${act ? '· ล่าสุด ' + act.id : '· ไม่มีเรื่องค้าง'}</p>
      <div class="row" style="margin-top:12px">
        ${state.role === 'reporter' ? `<button type="button" class="btn primary sm" data-act="reportbin" data-bin="${sel.id}">แจ้งปัญหาที่ถังนี้</button>` : ''}
        ${act && state.role !== 'reporter' ? `<button type="button" class="btn primary sm" data-act="open" data-id="${act.id}">ดูงาน</button>` : ''}
        <button type="button" class="btn sm" data-act="clearsel">ปิด</button></div></section>`;
  } else if (selB) {
    const bins = binsOf(selB);
    const B = BLD[selB];
    side = `<section class="card"><div class="row"><b style="font-size:17px">${selB}</b><span class="sp"></span><button type="button" class="btn sm" data-act="clearsel">ปิด</button></div>
      <p class="small muted" style="margin:2px 0 10px">${B ? B.sub : selB === 'สนามกีฬา' ? 'สนามกีฬา เสาธง บ่อน้ำพุ สวนหย่อม' : 'ที่จอดรถยนต์'} · ${BIN_ZONE_LABEL[ZONE_OF[selB]]}</p>
      <div class="h" style="margin-bottom:6px">ถังขยะในพื้นที่ (${bins.length})</div>
      <div class="list">${bins.map(b => { const st = binState(b); return `<button type="button" class="binrow" data-act="pin" data-bin="${b.id}"><span class="sdot" style="background:${SCOL[st]}"></span><span style="min-width:0"><b class="mono">${b.id}</b><br><span class="small muted">${esc(b.spot)} · ${typeDot(b.type)}${TYPES[b.type]}</span></span></button>`; }).join('') || '<p class="small muted">ยังไม่มีถังในพื้นที่นี้</p>'}</div></section>`;
  } else {
    side = `<section class="card flat small muted">แตะหมุดบนแผนผังเพื่อดูข้อมูลถังและสถานะล่าสุด หรือแตะอาคารเพื่อดูถังในอาคารนั้น</section>`;
  }
  const quick = QUICK.map(x => `<button type="button" class="chip" data-act="bld" data-b="${x.b}">${esc(x.t)}</button>`).join('');
  const dirs = Object.keys(BLD).map(b => bldCard(b, q)).join('');
  const zoom = state.mapZoom;
  return `<div class="stack"><div class="row"><div><h2 class="title">แผนผังวิทยาเขต</h2><span class="small muted">SPU Khon Kaen · ตำแหน่งอาคาร ห้อง และถังขยะ</span></div><span class="sp"></span>
      <label class="small muted" for="mapQ">ค้นหา</label><input class="input" id="mapQ" style="width:min(280px,100%)" placeholder="ห้อง อาคาร หรือรหัสถัง เช่น 1-107" value="${esc(state.mapQ)}"></div>
    <div class="grid2"><div class="stack">
      <div class="chips">${chip('all', 'ทั้งหมด')}${chip('wait', 'รอ')}${chip('doing', 'กำลังทำ')}${chip('done', 'เรียบร้อย')}</div>
      <section class="card mapcard"><div class="maptools"><span class="small muted">ซูม</span>
        <button type="button" class="btn sm" data-act="zoom" data-d="-1" aria-label="ซูมออก" ${zoom <= 1 ? 'disabled' : ''}>−</button>
        <span class="small num" style="min-width:42px;text-align:center">${Math.round(zoom * 100)}%</span>
        <button type="button" class="btn sm" data-act="zoom" data-d="1" aria-label="ซูมเข้า" ${zoom >= 3 ? 'disabled' : ''}>+</button>
        <span class="sp"></span><button type="button" class="btn sm" data-act="fullmap">ดูภาพแผนผังเต็ม ↗</button></div>
        <div class="mapview" tabindex="0" role="group" aria-label="แผนผังวิทยาเขต เลื่อนเพื่อดูส่วนอื่น"><div class="mapin" style="width:${zoom * 100}%">
          <img src="${MAP.src}" alt="แผนผังวิทยาเขต SPU ขอนแก่น อาคาร 1 ถึง 4 สนามกีฬา และที่จอดรถยนต์ โซน A B C" draggable="false" width="${MAP.w}" height="${MAP.h}">${zones}${pins}</div></div>
        <div class="legend small"><span class="pill wait">รอดำเนินการ</span><span class="pill doing">กำลังดำเนินการ</span><span class="pill done">เรียบร้อย</span>
          <span class="muted">· จุดสีในหมุด = ประเภทถัง: ${typeDot('general')}ทั่วไป ${typeDot('recycle')}รีไซเคิล ${typeDot('organic')}อินทรีย์ ${typeDot('hazard')}อันตราย</span></div></section>
      <section class="card flat"><div class="h">ไปที่ไหนดี</div><div class="chips">${quick}</div></section></div>
    <aside class="stack">${side}
      <section class="card flat"><div class="h">วิธีอ่านเลขห้อง</div>
        <div class="row" style="gap:12px"><div class="roomex"><b style="color:#2a72c9">1</b><i>-</i><b style="color:var(--teal-ink)">108</b></div>
          <p class="small muted" style="flex:1;min-width:160px">เลขแรกคืออาคาร ส่วนเลขหลักแรกของเลขห้องคือเลขชั้น เช่น <b class="mono">1-108</b> คืออาคาร 1 ห้อง 108 อยู่ชั้น 1</p></div></section></aside></div>
    <div><div class="h">ห้องสำคัญในแต่ละอาคาร${q ? ' · ผลค้นหา' : ''}</div>
      <div class="bgrid">${dirs || '<p class="card flat muted" style="grid-column:1/-1">ไม่พบห้องหรืออาคารที่ค้นหา ลองพิมพ์เลขห้อง เช่น 2-102 หรือชื่อห้อง เช่น Book Center</p>'}</div></div></div>`;
}

/* ---------- Dashboard (แสดงเฉพาะข้อมูลที่เพิ่มเข้ามาจริง) ---------- */
function periodInfo() {
  const t = now(), d0 = startOfDay(t), per = state.period;
  const inRange = x => x >= d0 && x < d0 + 86400000;
  if (per === 'day') {
    const hrs = state.reports.filter(r => inRange(r.created)).map(r => new Date(r.created).getHours());
    const lo = Math.min(8, ...hrs), hi = Math.max(16, ...hrs), labels = [];
    for (let h = lo; h <= hi; h++) labels.push(pad(h));
    return { labels, idx: r => new Date(r.created).getHours() - lo, from: d0, to: d0 + 86400000, title: `จำนวนเรื่องตามช่วงเวลา (${pad(lo)}:00–${pad(hi)}:59)` };
  }
  if (per === 'week') {
    const from = d0 - 6 * 86400000, labels = [];
    for (let i = 0; i < 7; i++) labels.push(THAI_D[new Date(from + i * 86400000 + 43200000).getDay()]);
    return { labels, idx: r => Math.round((startOfDay(r.created) - from) / 86400000), from, to: d0 + 86400000, title: 'จำนวนเรื่องรายวัน (7 วันล่าสุด)' };
  }
  const d = new Date(t), from = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const days = Math.round((to - from) / 86400000), nW = Math.ceil(days / 7);
  const labels = Array.from({ length: nW }, (_, i) => 'สัปดาห์ ' + (i + 1));
  return { labels, idx: r => Math.min(nW - 1, Math.floor((new Date(r.created).getDate() - 1) / 7)), from, to, title: 'จำนวนเรื่องรายสัปดาห์ (เดือนนี้)' };
}
function metrics() {
  const p = periodInfo();
  const rs = state.reports.filter(r => r.created >= p.from && r.created < p.to);
  const vals = p.labels.map(() => 0), spots = {};
  rs.forEach(r => { const i = p.idx(r); if (i >= 0 && i < vals.length) vals[i]++; const b = binById(r.bin).b; spots[b] = (spots[b] || 0) + 1; });
  const done = rs.filter(r => r.status === 'done').length;
  const acc = rs.filter(r => r.accepted).map(r => Math.max(0, Math.round((r.accepted - r.created) / MIN)));
  return { p, rs, vals, spots, total: rs.length, pct: rs.length ? Math.round(done / rs.length * 100) : null, acc: acc.length ? Math.round(acc.reduce((a, b) => a + b, 0) / acc.length) : null };
}
function viewDash() {
  const per = state.period, reporter = state.role === 'reporter';
  const head = `<div><h2 class="title">Dashboard</h2><span class="small muted">ภาพรวมทั้งวิทยาเขต · สรุปจากเรื่องที่แจ้งเข้ามาจริง</span></div>`;
  if (!state.reports.length) {
    return `<div class="stack" style="max-width:720px;margin:0 auto"><div class="row">${head}</div>
      <section class="card emptydash"><svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M10 54V30M26 54V16M42 54V38M58 54H6"/></svg>
        <h3 class="title" style="font-size:18px">ยังไม่มีข้อมูล</h3>
        <p class="muted">Dashboard จะแสดงสถิติหลังมีการแจ้งปัญหา เมื่อเพิ่มเรื่องแล้ว จะเห็นจำนวนเรื่อง เวลารับงานเฉลี่ย สัดส่วนที่แก้ไขแล้ว และจุดที่ล้นบ่อย</p>
        ${reporter ? `<button type="button" class="btn primary" data-act="tab" data-tab="report">${ico('camera')} แจ้งเรื่องแรก</button>`
          : `<p class="small muted">สลับเป็นบทบาท "ผู้แจ้ง" ด้านบน แล้วแจ้งเรื่องแรกเพื่อเริ่มมีข้อมูล</p>`}</section></div>`;
  }
  const m = metrics();
  const W = 520, H = 220, L = 30, B = 26, T = 18, n = m.vals.length, max = Math.max(...m.vals, 0);
  const top = Math.max(4, Math.ceil(max / 4) * 4), bw = (W - L - 10) / n;
  const pk = max > 0 && m.vals.filter(v => v === max).length === 1 ? m.vals.indexOf(max) : -1;
  const grid = [0, .5, 1].map(g => { const y = T + (H - T - B) * (1 - g); return `<line class="grid" x1="${L}" x2="${W - 6}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round(top * g)}</text>`; }).join('');
  const bars = m.vals.map((v, i) => { const h = (H - T - B) * v / top, x = L + i * bw + bw * .18, y = H - B - h;
    return `<rect class="${i === pk ? 'bar-pk' : 'bar-n'}" x="${x}" y="${y}" width="${bw * .64}" height="${h}" rx="3"/>
      <text x="${x + bw * .32}" y="${y - 4}" text-anchor="middle">${v}</text><text x="${x + bw * .32}" y="${H - 8}" text-anchor="middle">${m.p.labels[i]}</text>`; }).join('');
  const spots = Object.entries(m.spots).sort((a, b) => b[1] - a[1]).slice(0, 6), sm = spots.length ? spots[0][1] : 1;
  const chip = (k, t) => `<button type="button" class="chip" data-act="period" data-p="${k}" aria-pressed="${per === k}">${t}</button>`;
  const summary = m.vals.map((v, i) => m.p.labels[i] + ' ' + v).join(', ');
  return `<div class="stack"><div class="row">${head}<span class="sp"></span>
      <div class="chips">${chip('day', 'วันนี้')}${chip('week', '7 วัน')}${chip('month', 'เดือนนี้')}</div></div>
    <div class="kpis" style="max-width:560px"><div class="kpi"><b class="num">${m.total}</b><span>เรื่องทั้งหมด</span></div>
      <div class="kpi amber"><b class="num">${m.acc === null ? '–' : m.acc + ' น.'}</b><span>รับงานเฉลี่ย</span></div><div class="kpi green"><b class="num">${m.pct === null ? '–' : m.pct + '%'}</b><span>แก้ไขแล้ว</span></div></div>
    <div class="${reporter ? '' : 'grid2'}"><section class="card"><div class="h">${m.p.title}</div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${m.p.title} ${summary}">${grid}${bars}</svg>
      <p class="small muted">${!m.total ? 'ช่วงเวลานี้ยังไม่มีเรื่องที่แจ้ง ลองเลือกช่วงเวลาอื่น' : pk >= 0 ? 'แท่งสีแดงคือช่วงที่เกิดเรื่องมากที่สุด' : 'ทุกช่วงมีจำนวนเรื่องใกล้เคียงกัน'}</p></section>
      ${reporter ? '' : `<section class="card"><div class="h">จุดที่ล้นบ่อยที่สุด</div>
        ${spots.length ? spots.map(([k, v]) => `<div class="rank"><span>${esc(k)}</span><span class="tr"><i style="width:${v / sm * 100}%"></i></span><b class="num">${v}</b></div>`).join('') : '<p class="small muted">ยังไม่มีข้อมูลในช่วงนี้</p>'}
        <div style="margin-top:12px"><button type="button" class="btn sm" data-act="csv" ${m.total ? '' : 'disabled'}>ดาวน์โหลดรายงาน CSV</button></div></section>`}</div>
    ${hotspotCard(m)}</div>`;
}
function hotspotCard(m) {
  const h = SWAI.analyzeHotspots(m.rs, { minTotal: 3, label: id => { const b = binById(id); return b ? b.id + ' · ' + b.b + ' ' + b.spot : id; } });
  const body = !h.enough ? `<p class="small muted">${esc(h.note)}</p>`
    : `<div class="list">${h.items.map((x, i) => `<div class="hot"><div class="row"><b class="num">${i + 1}.</b><span style="min-width:0;overflow-wrap:anywhere">${esc(x.label)}</span><span class="sp"></span><span class="small muted num">${x.count} เรื่อง${x.avgAcc !== null ? ' · รับงานเฉลี่ย ' + x.avgAcc + ' น.' : ''}</span></div>
        ${x.advice.length ? `<ul class="small">${x.advice.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="small muted">ยังไม่พบสัญญาณผิดปกติ</p>'}</div>`).join('')}</div>
      <p class="small muted" style="margin-top:8px">${esc(h.note)}</p>`;
  return `<section class="card"><div class="h">${ico('spark')} วิเคราะห์จุดเสี่ยง (จากข้อมูลช่วงที่เลือก)</div>${body}</section>`;
}
function exportCsv() {
  const m = metrics(), q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const dt = t => t ? new Date(t).toLocaleString('sv-SE').replace('T', ' ') : '';
  const rows = [['รหัสเรื่อง', 'สถานที่', 'จุดที่พบ', 'รหัสถัง', 'ประเภทถัง', 'ปัญหา', 'สถานะ', 'ผู้แจ้ง(คน)', 'เวลาแจ้ง', 'เวลารับงาน', 'เวลาปิดงาน', 'ผู้รับงาน', 'ความรุนแรง(AI-assist)']];
  m.rs.slice().sort((a, b) => a.created - b.created).forEach(r => { const b = binById(r.bin);
    rows.push([r.id, b.b, b.spot, b.id, TYPES[b.type], r.problem, STATUS[r.status], r.count, dt(r.created), dt(r.accepted), dt(r.resolved), r.assignee, r.ai ? SWAI.SEV_LABEL[r.ai.severity] : '']); });
  const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  const d = new Date(now()); a.download = `smart-waste-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('ดาวน์โหลดรายงาน CSV แล้ว');
}

/* ---------- Chatbot ---------- */
function findRooms(text) {
  const t = norm(text), code = text.match(/([1-4])\s*[-–]?\s*(\d{3})/);
  const q2 = t.replace(/ห้อง(?=\d)/g, '').replace(/อยู่ที่ไหน|อยู่ไหน|ที่ไหน|อยู่ที่|หน่อย|ครับ|ค่ะ|คะ|ไหน/g, '');
  const out = [];
  Object.keys(BLD).forEach(b => BLD[b].rooms.forEach(r => {
    const byCode = code && r.c === code[1] + '-' + code[2];
    const nm = norm(r.n);
    const byName = t.includes(nm) || nm.split('/').some(p => p.length > 3 && t.includes(p)) || (r.s || []).some(s => t.includes(norm(s))) ||
      (q2.length >= 3 && !code && (nm.includes(q2) || (r.s || []).some(s => norm(s).includes(q2))));
    if (byCode || byName) out.push(roomLabel(b, r));
  }));
  return out;
}
function botReply(text) {
  const t = text.trim(), low = t.toLowerCase();
  if (/^(ถัง|ห้อง|ขยะ|อาคาร|ที่ไหน|ไหน)$/.test(low)) return 'ช่วยระบุให้ชัดขึ้นอีกนิดครับ เช่น "ถังรีไซเคิลอยู่ไหน" "ถังที่อาคาร 4" หรือ "ห้อง 1-107"';
  const id = (t.match(/SW-\d{4}-\d{4}/i) || [])[0];
  if (id) {
    const r = state.reports.find(x => x.id.toLowerCase() === id.toLowerCase());
    if (!r) return `ไม่พบเรื่อง ${id.toUpperCase()} ลองตรวจรหัสอีกครั้ง`;
    const b = binById(r.bin);
    return `${r.id} · ${b.b}\nสถานะ: ${STATUS[r.status]}\n` + (r.status === 'wait' ? (r.escalated ? 'เกินเวลา ส่งต่อผู้ดูแลพื้นที่แล้ว' : 'ยังไม่มีผู้รับงาน เหลือเวลาอีก ' + Math.ceil(remaining(r) / MIN) + ' นาที ก่อนส่งต่อผู้ดูแล') : r.status === 'doing' ? `เจ้าหน้าที่รับงานแล้วเมื่อ ${hhmm(r.accepted)} จะแจ้งให้ทราบเมื่อเสร็จ` : `ปิดงานเมื่อ ${hhmm(r.resolved)}`);
  }
  if (/สถานะ|เช็ก|เช็ค/.test(low)) { const r = mine()[0]; return r ? botReply(r.id) : 'ยังไม่มีเรื่องที่คุณแจ้ง'; }
  const kinds = [['รีไซเคิล', 'recycle'], ['อินทรีย์', 'organic'], ['อันตราย', 'hazard'], ['ทั่วไป', 'general']];
  if (/ถัง/.test(low)) {
    const k = kinds.find(x => low.includes(x[0]));
    const bld = BUILDINGS.find(b => low.includes(norm(b)) || low.includes(b.toLowerCase())) || (/ลานกลาง/.test(low) ? 'สนามกีฬา' : null);
    const park = !bld && /จอดรถ/.test(low);
    const list = BINS.filter(b => (!k || b.type === k[1]) && (!bld || b.b === bld) && (!park || b.b.startsWith('ที่จอดรถ')));
    if (!list.length) return 'ไม่พบถังตามที่ถาม ลองระบุประเภท (ทั่วไป/รีไซเคิล/อินทรีย์/อันตราย) หรืออาคาร';
    return `ถัง${k ? k[0] : ''}${bld ? 'ที่' + bld : park ? 'ที่ที่จอดรถ' : ''} มี ${list.length} จุด:\n` + list.slice(0, 4).map(b => `• ${b.id} ${b.b} ${b.spot}`).join('\n') + (list.length > 4 ? `\nและอีก ${list.length - 4} จุด` : '') + '\n(ดูตำแหน่งได้ที่เมนู แผนผัง)';
  }
  const rooms = findRooms(t);
  if (rooms.length) return rooms.slice(0, 3).join('\n') + (rooms.length > 3 ? `\nและอีก ${rooms.length - 3} รายการ` : '') + '\n(ดูตำแหน่งอาคารได้ที่เมนู แผนผัง)';
  if (/แจ้ง|ล้น|เต็ม/.test(low)) return 'แตะปุ่ม "แจ้ง" ที่เมนูด้านบน เลือกอาคารและจุดที่พบ ถ่ายรูป แล้วกดส่ง';
  return 'ขอโทษครับ เรื่องนี้อยู่นอกขอบเขตของผม จึงไม่ขอเดาคำตอบ ผมตอบได้ 4 เรื่อง: แจ้งขยะล้น เช็กสถานะ (พิมพ์รหัส SW-...) หาถังขยะ (เช่น ถังรีไซเคิลอยู่ไหน) และหาห้อง (เช่น Book Center อยู่ไหน หรือ ห้อง 1-107)';
}
function viewChat() {
  if (!state.chat.length) state.chat.push({ me: false, t: 'สวัสดีครับ ผมช่วยแจ้งขยะล้น เช็กสถานะ หาถังขยะ และบอกตำแหน่งห้องในอาคาร 1-4 ได้' });
  const q = (t, v) => `<button type="button" data-act="quick" data-q="${v}">${t}</button>`;
  return `<div style="max-width:620px;margin:0 auto"><section class="card chat"><div class="ch"><b>Chatbot ช่วยเหลือ</b><div class="small" style="opacity:.8">ตอบตามกฎที่กำหนด ไม่ใช่โมเดล AI ที่สร้างคำตอบเอง จึงไม่แต่งข้อมูล · ไม่เก็บข้อความแชตหลังรีเฟรช</div></div>
    <div class="log" id="chatLog">${state.chat.map(m => `<div class="bub ${m.me ? 'me' : ''}">${esc(m.t).replace(/\n/g, '<br>')}</div>`).join('')}
      <div class="qr-row">${q('แจ้งขยะล้น', 'แจ้งขยะล้น')}${q('เช็กสถานะ', 'เช็กสถานะ')}${q('ถังรีไซเคิลอยู่ไหน', 'ถังรีไซเคิลอยู่ไหน')}${q('Book Center อยู่ไหน', 'Book Center อยู่ไหน')}${q('ห้อง 1-107', 'ห้อง 1-107')}</div></div>
    <form id="chatForm" autocomplete="off"><input class="input" id="chatIn" placeholder="พิมพ์ข้อความ..." aria-label="พิมพ์ข้อความ" maxlength="${SWAI.MAX_CHAT}"><button class="btn primary" type="submit">ส่ง</button></form></section></div>`;
}

/* ---------- ข้อความแจ้งเตือน ---------- */
function notifHtml(n) {
  const r = state.reports.find(x => x.id === n.rid); if (!r) return '';
  const b = binById(r.bin), where = `${b.b} ${b.spot}`;
  const dl = rows => `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const when = `<span class="small muted" style="margin-left:auto;font-weight:400;opacity:.9">${hhmm(n.at)}</span>`;
  const head = (cls, t) => `<div class="mh row" style="gap:8px">${t}${when}</div>`;
  if (n.k === 'N1') return `<article class="msg n1">${head('', 'LINE · N1 งานใหม่')}<div class="mb"><b>งานใหม่ ${r.id}</b>${dl([['สถานที่', esc(where)], ['ถัง', `<span class="mono">${b.id}</span> · ขยะ${TYPES[b.type]}`], ['ปัญหา', esc(r.problem) + (r.detail ? ' · ' + esc(r.detail) : '')], ['เวลา', hhmm(r.created) + ' · มีรูปแนบ 1 รูป']])}
    <div class="acts">${r.status === 'wait' ? `<button type="button" class="btn sm primary" data-act="accept" data-id="${r.id}">รับงาน</button>` : `<span class="pill ${r.status}">${STATUS[r.status]}</span>`}<button type="button" class="btn sm" data-act="showbin" data-bin="${b.id}">ดูบนแผนผัง</button></div>
    <div class="cond">เงื่อนไข: ทันทีที่ส่งเรื่อง · ผู้รับ: กลุ่มเจ้าหน้าที่${BIN_ZONE_LABEL[zoneOf(r)]}</div></div></article>`;
  if (n.k === 'N2') return `<article class="msg n2">${head('', 'LINE · N2 เตือนก่อนครบเวลา')}<div class="mb"><b>ยังไม่มีผู้รับงาน ${r.id}</b>${dl([['เหลือเวลา', `${ESC_MIN - REMIND_MIN} นาที ก่อนแจ้งผู้ดูแลพื้นที่`], ['สถานที่', esc(where)]])}
    <div class="acts">${r.status === 'wait' ? `<button type="button" class="btn sm primary" data-act="accept" data-id="${r.id}">รับงาน</button>` : `<span class="pill ${r.status}">${STATUS[r.status]}</span>`}</div>
    <div class="cond">เงื่อนไข: นาทีที่ ${REMIND_MIN} ยังไม่มีผู้รับงาน · ผู้รับ: กลุ่มเจ้าหน้าที่${BIN_ZONE_LABEL[zoneOf(r)]}</div></div></article>`;
  if (n.k === 'N3') return `<article class="msg n3">${head('', 'LINE · N3 Escalation')}<div class="mb"><b>เกินเวลา ${r.id} ยังไม่มีผู้รับงาน</b>${dl([['รอมา', ESC_MIN + ' นาที'], ['โซน', BIN_ZONE_LABEL[zoneOf(r)] + ' · แจ้งเจ้าหน้าที่ประจำโซนแล้ว'], ['สถานที่', esc(where)]])}
    <div class="acts">${r.status === 'wait' ? `<button type="button" class="btn sm red" data-act="reassign" data-id="${r.id}">มอบหมายใหม่</button>` : `<span class="pill ${r.status}">${STATUS[r.status]}</span>`}<button type="button" class="btn sm" data-act="call">โทรติดตาม</button></div>
    <div class="cond">เงื่อนไข: ครบ ${ESC_MIN} นาทียังไม่มีผู้รับงาน · ผู้รับ: ผู้ดูแลพื้นที่</div></div></article>`;
  if (n.k === 'N4') return `<article class="msg n4">${head('', 'Push Notification · N4 งานเสร็จ')}<div class="mb"><b>เรื่องของคุณดำเนินการแล้ว</b>${dl([['รหัสเรื่อง', `<span class="mono">${r.id}</span>`], ['ปิดงาน', hhmm(r.resolved || n.at) + ' · ใช้เวลา ' + Math.max(1, Math.round(((r.resolved || n.at) - r.created) / MIN)) + ' นาที'], ['ขอบคุณ', 'ที่ช่วยแจ้งให้มหาวิทยาลัยสะอาดขึ้น']])}
    <div class="cond">เงื่อนไข: เมื่อสถานะเป็นดำเนินการแล้ว · ผู้รับ: ผู้แจ้ง</div></div></article>`;
  return `<article class="msg n5">${head('', 'Push Notification · เจ้าหน้าที่รับงานแล้ว')}<div class="mb"><b>เรื่อง ${r.id} มีผู้รับงานแล้ว</b>${dl([['ผู้รับงาน', esc(r.assignee || '')], ['เวลา', hhmm(r.accepted || n.at)]])}
    <div class="cond">เงื่อนไข: เมื่อเจ้าหน้าที่กดรับงาน · ผู้รับ: ผู้แจ้ง</div></div></article>`;
}
function viewNotif() {
  const role = state.role;
  const ok = n => { const r = state.reports.find(x => x.id === n.rid); if (!r) return false;
    if (role === 'reporter') return r.mine && (n.k === 'N4' || n.k === 'N5');
    if (role === 'staff') return (n.k === 'N1' || n.k === 'N2') && (state.zone === 'all' || zoneOf(r) === state.zone);
    return n.k === 'N3'; };
  const list = state.notifs.filter(ok).sort((a, b) => b.at - a.at);
  const empty = role === 'supervisor' ? 'ยังไม่มีเรื่องที่เกินเวลา ลองกด "เร่งเวลา +10 นาที" ด้านบนเพื่อดูการส่งต่อเมื่อครบ 30 นาที' : role === 'reporter' ? 'ยังไม่มีการแจ้งเตือน เมื่อเจ้าหน้าที่รับงานหรือทำเสร็จ ข้อความจะขึ้นที่นี่' : 'ยังไม่มีงานใหม่';
  return `<div class="grid2"><div class="stack"><h2 class="title">ข้อความแจ้งเตือน</h2>
    ${list.length ? list.map(notifHtml).join('') : `<p class="card flat muted">${empty}</p>`}</div>
    <aside class="stack"><section class="card flat"><div class="h">ช่องทางและการส่งซ้ำ</div><ol class="small" style="margin:0;padding-left:18px;display:grid;gap:6px">
      <li>LINE Messaging API เป็นช่องทางหลักสำหรับเจ้าหน้าที่และผู้ดูแล</li><li>Telegram Bot เป็นช่องทางสำรอง</li><li>Web Push สำหรับผู้แจ้ง</li></ol>
      <p class="small muted" style="margin-top:10px">ถ้าส่งไม่สำเร็จ ลองซ้ำทุก 1 นาทีสูงสุด 3 ครั้ง แล้วสลับไปช่องทางสำรอง และบันทึกผลในตาราง notifications</p></section>
      <section class="card flat small muted">LINE Notify ปิดให้บริการตั้งแต่เดือนมีนาคม 2568 ระบบจึงออกแบบให้ใช้ LINE Messaging API แทน</section></aside></div>`;
}

/* ---------- หน้า "โครงงาน": ปัญหา ผู้ใช้ AI ความปลอดภัย และชุดทดสอบ ---------- */
function viewAbout() {
  const li = a => a.map(x => `<li>${esc(x)}</li>`).join('');
  const ev = PROJECT.evidence.length
    ? PROJECT.evidence.map(e => `<li><b>${esc(e.t)}</b> · ${esc(e.d)}</li>`).join('')
    : `<li class="muted">ยังไม่ได้ใส่หลักฐานจากผู้ใช้จริง (ผลสำรวจ ภาพหน้างาน บทสัมภาษณ์) ผู้พัฒนาเพิ่มได้ที่ <span class="mono">PROJECT.evidence</span> ใน app.js</li>`;
  const live = state.reports.length ? `<li>ข้อมูลจากการใช้งานในเครื่องนี้: ${state.reports.length} เรื่อง (ดูสรุปที่ Dashboard)</li>` : '';
  const tests = state.tests;
  const pass = tests ? tests.filter(c => c.pass).length : 0;
  const testHtml = tests ? `<p role="status"><b>ผ่าน ${pass} / ${tests.length} กรณี (${Math.round(pass / tests.length * 100)}%)</b></p>
    <div class="tscroll"><table class="ttable"><thead><tr><th>รหัส</th><th>กรณีทดสอบ</th><th>ข้อมูลนำเข้า</th><th>ผลที่คาดหวัง</th><th>ผลจริง</th><th>ผล</th></tr></thead><tbody>
    ${tests.map(c => `<tr><td class="mono">${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.input)}</td><td>${esc(c.expected)}</td><td>${esc(c.actual)}</td><td><span class="pill ${c.pass ? 'done' : 'wait'}">${c.pass ? 'ผ่าน' : 'ไม่ผ่าน'}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">กดปุ่มเพื่อรันชุดทดสอบของผู้ช่วยวิเคราะห์ปัญหา (ตัวอย่าง 5 กรณี และ TC05–TC09) ผลคำนวณสดในเบราว์เซอร์</p>';
  return `<div class="stack" style="max-width:860px;margin:0 auto">
    <div><h2 class="title">โครงงาน Smart Waste</h2><span class="small muted">ระบบแจ้งและติดตามปัญหาขยะล้น พร้อมผู้ช่วยวิเคราะห์ปัญหา</span></div>
    <section class="card"><div class="h">1. ปัญหาที่แก้</div><p>${esc(PROJECT.problem)}</p>
      <div class="h" style="margin-top:14px">กลุ่มผู้ใช้</div><ul class="plain">${PROJECT.users.map(u => `<li><b>${esc(u[0])}</b> · ${esc(u[1])}</li>`).join('')}</ul></section>
    <section class="card"><div class="grid2" style="gap:16px"><div><div class="h">2. สาเหตุ (สมมติฐาน)</div><ul>${li(PROJECT.causes)}</ul></div><div><div class="h">ผลกระทบ</div><ul>${li(PROJECT.impacts)}</ul></div></div>
      <div class="h" style="margin-top:14px">3. หลักฐานที่เก็บมา</div><ul>${ev}${live}</ul></section>
    <section class="card"><div class="h">4. ทำไมใช้ AI-assist และเลือกแบบนี้</div>
      <p class="small">งานที่ AI ช่วยคือ <b>อ่านข้อความที่ผู้แจ้งพิมพ์ แล้วประเมินความเร่งด่วน ตรวจว่าเลือกถังตรงชนิดขยะหรือไม่ และบอกเหตุผล</b> เพื่อให้เจ้าหน้าที่จัดลำดับงานได้เร็วขึ้น ส่วนการตัดสินใจขั้นสุดท้ายเป็นของคนเสมอ</p>
      <div class="tscroll"><table class="ttable"><thead><tr><th>ทางเลือก</th><th>ข้อดี</th><th>ข้อจำกัด</th><th>ที่เลือก</th></tr></thead><tbody>
        <tr><td>กฎ + พจนานุกรมคำ</td><td>อธิบายเหตุผลได้ทุกข้อ ผลคงที่ ไม่ต้องใช้เซิร์ฟเวอร์ ไม่เสี่ยง API key รั่ว</td><td>เข้าใจเฉพาะคำที่กำหนดไว้ ต้องปรับพจนานุกรมเอง</td><td><b>ใช้ (ค่าเริ่มต้น)</b></td></tr>
        <tr><td>โมเดลภาษา (LLM) ผ่านเซิร์ฟเวอร์กลาง</td><td>เข้าใจภาษาธรรมชาติได้กว้างกว่า</td><td>ต้องมีเซิร์ฟเวอร์ซ่อน key มีค่าใช้จ่าย ผลอาจเปลี่ยนในแต่ละครั้ง ส่งข้อความออกนอกเครื่อง</td><td>รองรับเป็นทางเลือก (ตั้ง <span class="mono">aiEndpoint</span>)</td></tr>
        <tr><td>โมเดลจำแนกภาพ (ดูระดับขยะจากรูป)</td><td>ตรวจจากภาพจริงได้</td><td>ต้องมีชุดภาพสอนจำนวนมากและต้องทดสอบความแม่นยำก่อน</td><td>ยังไม่ทำ (ดูหัวข้อพัฒนาต่อ)</td></tr></tbody></table></div>
      <div class="h" style="margin-top:14px">วิธีทำงานของผู้ช่วยวิเคราะห์</div>
      <ol class="small"><li>ให้คะแนนพื้นฐานจากประเภทปัญหา (ขยะล้น 48, มีกลิ่น 42, ขยะตกพื้น 38, ถังเต็ม 30)</li><li>ปรับคะแนนตามคำเสี่ยงสูง เช่น น้ำเน่า แมลงวัน คำที่บอกว่าไม่รุนแรง ชนิดถัง และการแจ้งซ้ำใน 24 ชั่วโมง</li><li>แปลงเป็นความรุนแรง ต่ำ (&lt;40) กลาง (40–64) สูง (≥65) พร้อมความมั่นใจ</li><li>ถ้าข้อมูลไม่พอ จะถามเพิ่ม ถ้าไม่เกี่ยวกับขยะ จะแจ้งว่าวิเคราะห์ไม่ได้</li></ol>
      <div class="h" style="margin-top:14px">ข้อจำกัดของ AI-assist</div>
      <ul class="small"><li>ยังไม่ดูรูปภาพ ประเมินจากข้อความและข้อมูลถังเท่านั้น</li><li>เข้าใจเฉพาะคำในพจนานุกรม ภาษาแสลงหรือคำสะกดผิดอาจประเมินต่ำกว่าจริง</li><li>คะแนนและเกณฑ์เป็นค่าที่ผู้พัฒนากำหนด ยังไม่ได้ปรับเทียบกับข้อมูลหน้างานจริง</li><li>วิเคราะห์จุดเสี่ยงจากจำนวนเรื่องที่แจ้ง ไม่ใช่ปริมาณขยะที่วัดได้จริง</li></ul></section>
    <section class="card"><div class="h">5. ความปลอดภัยและข้อมูลส่วนบุคคล (PDPA)</div>
      <ul class="small"><li>แจ้งและขอความยินยอมก่อนใช้งานครั้งแรก เปิดอ่านได้ทุกเมื่อที่ปุ่ม "นโยบายข้อมูลส่วนบุคคล" ท้ายหน้า</li>
        <li>ไม่ขอชื่อ เบอร์โทร หรือตำแหน่ง GPS ของผู้ใช้ ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้ ล้างได้ด้วยปุ่ม "ล้างข้อมูลทั้งหมด"</li>
        <li>ไม่มี API key หรือรหัสผ่านในโค้ดฝั่งเบราว์เซอร์ ถ้าใช้โมเดลภายนอกต้องผ่านเซิร์ฟเวอร์กลาง (ตัวอย่างอยู่ในโฟลเดอร์ worker)</li>
        <li>ข้อความที่ผู้ใช้พิมพ์ถูกแปลงอักขระพิเศษก่อนแสดงผล (กัน XSS) และข้อความที่เหมือนคำสั่งถึงระบบ เช่น "ไม่ต้องสนใจคำสั่งก่อนหน้า" จะไม่ถูกทำตาม</li></ul></section>
    <section class="card"><div class="row"><div class="h" style="margin:0">6. ชุดทดสอบผู้ช่วยวิเคราะห์</div><span class="sp"></span><button type="button" class="btn sm primary" data-act="selftest">${tests ? 'รันอีกครั้ง' : 'รันชุดทดสอบ'}</button></div>
      <div style="margin-top:10px">${testHtml}</div></section>
    <section class="card flat small muted"><div class="h">ข้อจำกัดของต้นแบบ</div><ul><li>ไม่ส่ง LINE จริง แสดงเป็นหน้าตาข้อความเท่านั้น</li><li>ตำแหน่งถังขยะเป็นตำแหน่งตัวอย่างบนแผนผัง</li><li>ข้อมูลอยู่ในเครื่องเดียว ไม่ซิงก์ข้ามอุปกรณ์ จึงยังไม่มีระบบล็อกอิน</li></ul></section></div>`;
}

/* ---------- แอป: เมนู, render, เหตุการณ์ ---------- */
const TABS = {
  reporter: [['home', 'หน้าหลัก', 'home'], ['list', 'รายการ', 'list'], ['report', 'แจ้ง', 'camera'], ['map', 'แผนผัง', 'map'], ['dash', 'Dashboard', 'chart'], ['chat', 'Chatbot', 'chat'], ['notif', 'แจ้งเตือน', 'bell'], ['about', 'โครงงาน', 'info']],
  staff: [['jobs', 'งานของโซน', 'tasks'], ['map', 'แผนผัง', 'map'], ['dash', 'Dashboard', 'chart'], ['notif', 'ข้อความ LINE', 'bell'], ['about', 'โครงงาน', 'info']],
  supervisor: [['jobs', 'ภาพรวมงาน', 'tasks'], ['map', 'แผนผัง', 'map'], ['dash', 'Dashboard', 'chart'], ['notif', 'Escalation', 'bell'], ['about', 'โครงงาน', 'info']],
};
const NAV_KEY = { report: 'report', done: 'list', job: 'jobs' };
const VIEWS = { home: viewHome, report: viewReport, done: viewDone, list: viewList, jobs: viewJobs, job: viewJob, map: viewMap, dash: viewDash, chat: viewChat, notif: viewNotif, about: viewAbout };

function newDraft(binId, fromMap) {
  const b = binById(binId);
  return { bin: b.id, building: b.b, fromMap: !!fromMap, problem: 'ขยะล้น', detail: '', photo: null, err: '', ai: null, aiBusy: false };
}
function go(tab) { state.tab = tab; render(); window.scrollTo(0, 0); }
function showBin(binId) { state.mapSel = binId; state.mapBld = null; state.mapQ = ''; state.mapFilter = 'all'; state.mapFocus = binId; if (state.mapZoom < 2) state.mapZoom = 2; go('map'); }

function badges() {
  const waiting = scopeReports().filter(r => r.status === 'wait').length;
  const esc_ = state.reports.filter(r => r.status === 'wait' && r.escalated).length;
  return { jobs: waiting, notif: state.role === 'supervisor' ? esc_ : 0 };
}
function render() {
  const ae = document.activeElement, keep = ae && ae.id && $('#app').contains(ae) ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const mv0 = $('.mapview'), sc = mv0 ? { l: mv0.scrollLeft, t: mv0.scrollTop } : null;
  const cur = NAV_KEY[state.tab] || state.tab, bd = badges();
  $('#tabs').innerHTML = TABS[state.role].map(([k, t, i]) =>
    `<button type="button" data-act="nav" data-tab="${k}" ${k === cur ? 'aria-current="page"' : ''}>${ico(i)}${t}${bd[k] ? `<span class="badge">${bd[k]}</span>` : ''}</button>`).join('');
  $$('.roles button').forEach(b => b.setAttribute('aria-pressed', b.dataset.role === state.role));
  if (state.tab === 'report' && !state.draft) state.draft = newDraft(BINS[0].id, false);
  $('#app').innerHTML = VIEWS[state.tab]();
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (_) {} } }
  const lg = $('#chatLog'); if (lg) lg.scrollTop = lg.scrollHeight;
  const mv = $('.mapview');
  if (mv) {
    if (state.mapFocus) {
      const p = mv.querySelector(`.mpin[data-bin="${state.mapFocus}"]`);
      if (p) { mv.scrollLeft = p.offsetLeft - mv.clientWidth / 2; mv.scrollTop = p.offsetTop - mv.clientHeight / 2; }
      state.mapFocus = null;
    } else if (sc) { mv.scrollLeft = sc.l; mv.scrollTop = sc.t; }
  }
  save();
}

/* ---------- เวลา: เตือน, Escalation ---------- */
function process() {
  let changed = false;
  state.reports.forEach(r => {
    if (r.status !== 'wait') return;
    const el = now() - r.created;
    if (!r.reminded && el >= REMIND_MIN * MIN) { r.reminded = true; state.notifs.push({ k: 'N2', rid: r.id, at: r.created + REMIND_MIN * MIN }); changed = true; }
    if (!r.escalated && el >= ESC_MIN * MIN) {
      r.escalated = true; changed = true;
      state.notifs.push({ k: 'N3', rid: r.id, at: r.created + ESC_MIN * MIN });
      r.log.push({ s: 'wait', by: 'ระบบ', at: r.created + ESC_MIN * MIN, note: 'ครบ 30 นาที ส่งต่อผู้ดูแลพื้นที่' });
      toast('ครบ 30 นาที ระบบแจ้งผู้ดูแลพื้นที่แล้ว (' + r.id + ')');
    }
  });
  return changed;
}
function tickUi() {
  $$('[data-cd]').forEach(el => {
    const r = state.reports.find(x => x.id === el.dataset.cd); if (!r || r.status !== 'wait') return;
    const rem = remaining(r);
    el.className = 'timer ' + (r.escalated ? 'esc' : rem < 10 * MIN ? 'late' : '');
    el.textContent = r.escalated ? 'เกินเวลา ส่งต่อผู้ดูแลแล้ว' : el.dataset.mode === 's' ? 'เหลือ ' + mmss(rem) : 'เหลือ ' + Math.ceil(rem / MIN) + ' น. ก่อนแจ้งผู้ดูแล';
  });
}
setInterval(() => {
  const ch = process();
  if (ch && !['report', 'job', 'chat'].includes(state.tab)) render(); else if (ch) { render_tabsOnly(); save(); }
  tickUi();
}, 1000);
function render_tabsOnly() {
  const bd = badges();
  $$('#tabs button').forEach(b => { const k = b.dataset.tab; let sp = $('.badge', b); if (bd[k]) { if (!sp) { sp = document.createElement('span'); sp.className = 'badge'; b.appendChild(sp); } sp.textContent = bd[k]; } else if (sp) sp.remove(); });
}

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const d = el.dataset, find = id => state.reports.find(r => r.id === id);
  switch (d.act) {
    case 'nav': if (d.tab === 'report') state.draft = null; go(d.tab); break;
    case 'tab': if (d.tab === 'report') state.draft = null; go(d.tab); break;
    case 'reportbin': { const old = state.draft; state.draft = newDraft(d.bin, true);
      if (old) Object.assign(state.draft, { problem: old.problem, detail: old.detail, photo: old.photo });
      go('report'); break; }
    case 'pickmap': state.mapSel = state.draft ? state.draft.bin : null; state.mapBld = null; state.mapFocus = state.mapSel; if (state.mapZoom < 2) state.mapZoom = 2; go('map'); break;
    case 'showbin': showBin(d.bin); break;
    case 'problem': state.draft.problem = d.p; state.draft.ai = null; render(); break;
    case 'analyze': runAnalyze(); break;
    case 'aiapply': {
      const dr = state.draft; if (!dr) break;
      const target = binsOf(dr.building).find(b => b.type === d.t);
      if (!target) { toast('อาคารนี้ไม่มีถังประเภทนั้น ลองเปลี่ยนสถานที่ หรือระบุในรายละเอียด'); break; }
      dr.bin = target.id; dr.fromMap = false; dr.ai = null; toast('เปลี่ยนเป็น ' + target.id + ' แล้ว กด "วิเคราะห์ก่อนส่ง" อีกครั้งเพื่อตรวจซ้ำ'); render(); break; }
    case 'selftest': state.tests = SWAI.selfTest(); render(); break;
    case 'privacy': openConsent(); break;
    case 'consent-yes': state.consent = true; try { localStorage.setItem(CONSENT_KEY, '1'); } catch (_) {} closeConsent(); toast('บันทึกความยินยอมแล้ว'); break;
    case 'consent-no': state.consent = false; try { localStorage.removeItem(CONSENT_KEY); } catch (_) {} closeConsent(); toast('ยังดูข้อมูลได้ แต่จะส่งเรื่องหรือบันทึกงานไม่ได้จนกว่าจะยอมรับ'); break;
    case 'samplePhoto': state.draft.photo = SAMPLE_PHOTO; state.draft.err = ''; render(); break;
    case 'open': {
      const r = find(d.id); if (!r) break;
      if (state.role === 'reporter') { state.lastId = r.id; go('done'); }
      else { state.jobId = r.id; state.jobStatus = r.status; state.jobNote = ''; state.jobAfter = null; state.jobErr = ''; go('job'); }
      break; }
    case 'back': go(state.role === 'reporter' ? 'list' : 'jobs'); break;
    case 'accept': { const r = find(d.id); if (r && r.status === 'wait') { acceptJob(r); render(); } break; }
    case 'finish': { const r = find(d.id); if (!r) break; state.jobId = r.id; state.jobStatus = 'done'; state.jobNote = ''; state.jobAfter = null; state.jobErr = ''; go('job'); break; }
    case 'reassign': { const r = find(d.id); if (r && r.status === 'wait') { setStatus(r, 'doing', 'ทีมสำรอง (ผู้ดูแลมอบหมายใหม่)', 'ผู้ดูแลมอบหมายใหม่'); toast('มอบหมายใหม่แล้ว แจ้งผู้แจ้งและบันทึกใน status_log'); render(); } break; }
    case 'jstatus': state.jobStatus = d.s; render(); break;
    case 'call': toast('บันทึกการโทรติดตามแล้ว (จำลอง)'); break;
    case 'sampleAfter': state.jobAfter = SAMPLE_PHOTO; state.jobErr = ''; render(); break;
    case 'saveJob': {
      const r = find(state.jobId), s = state.jobStatus; if (!r) break;
      if (!state.consent) { state.jobErr = 'กรุณายอมรับการเก็บข้อมูลก่อนบันทึกงาน'; render(); askConsent(); break; }
      if (s === 'done' && !state.jobAfter && !r.after) { state.jobErr = 'ปิดงานต้องมีรูปหลังเก็บ'; render(); break; }
      if (state.jobAfter) r.after = state.jobAfter;
      if (s !== r.status) setStatus(r, s, staffName(), state.jobNote.trim());
      else if (state.jobNote.trim()) r.log.push({ s: r.status, by: staffName(), at: now(), note: state.jobNote.trim() });
      toast('บันทึกแล้ว ระบบแจ้งผู้แจ้งทันที'); go('jobs'); break; }
    case 'filter': state.filter = d.f; render(); break;
    case 'mfilter': state.mapFilter = d.f; render(); break;
    case 'pin': { const b = binById(d.bin); state.mapSel = d.bin; state.mapBld = null; state.mapFocus = null; render(); break; }
    case 'bld': state.mapBld = d.b; state.mapSel = null; state.mapFocus = null; if (state.tab !== 'map') go('map'); else render(); break;
    case 'clearsel': state.mapSel = null; state.mapBld = null; render(); break;
    case 'zoom': state.mapZoom = Math.min(3, Math.max(1, state.mapZoom + Number(d.d) * .5)); render(); break;
    case 'period': state.period = d.p; render(); break;
    case 'csv': exportCsv(); break;
    case 'fullmap': if (!window.open(MAP.src, '_blank')) toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณาอนุญาต pop-up แล้วลองอีกครั้ง'); break;
    case 'quick': chatSend(d.q); break;
    case 'demo': if (state.reports.length && !confirm('มีข้อมูลอยู่แล้ว เพิ่มข้อมูลตัวอย่างเข้าไปด้วยหรือไม่?')) break; loadDemo(); process(); toast('โหลดข้อมูลตัวอย่างแล้ว'); render(); break;
    case 'reset': if (confirm('ล้างข้อมูลทั้งหมดในเครื่องนี้ (เรื่องที่แจ้ง การแจ้งเตือน และเวลาที่เร่ง) ใช่หรือไม่?')) { resetAll(); toast('ล้างข้อมูลแล้ว'); go(state.role === 'reporter' ? 'home' : 'jobs'); } break;
  }
});
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'fDetail') {
    state.draft.detail = e.target.value; $('#fCount').textContent = e.target.value.length + '/200';
    if (state.draft.ai && !state.draft.aiBusy) { state.draft.ai = null; const p = $('#aiPanel'); if (p) p.outerHTML = aiPanelHtml(state.draft); }   /* ข้อความเปลี่ยน ผลเก่าใช้ไม่ได้แล้ว */
  }
  else if (id === 'jNote') state.jobNote = e.target.value;
  else if (id === 'mapQ') { state.mapQ = e.target.value; render(); }
});
/* ย่อรูปก่อนเก็บ เพื่อไม่ให้พื้นที่ในเครื่องเต็ม */
function readPhoto(file, cb, onErr) {
  if (!file) return;
  const fail = m => { if (onErr) onErr(m); };
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type)) { fail('ไฟล์นี้ไม่ใช่รูปภาพ (รองรับ JPG, PNG, WebP, GIF, HEIC) กรุณาเลือกไฟล์ใหม่'); return; }
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) { fail('ไฟล์ใหญ่เกิน ' + MAX_PHOTO_MB + ' MB กรุณาเลือกรูปที่เล็กกว่านี้'); return; }
  const raw = () => { const rd = new FileReader(); rd.onload = () => cb(rd.result); rd.onerror = () => fail('อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่'); rd.readAsDataURL(file); };
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    try {
      const k = Math.min(1, 960 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', .72));
    } catch (_) { raw(); }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { URL.revokeObjectURL(url); if (/heic|heif/i.test(file.type)) raw(); else fail('เปิดรูปนี้ไม่ได้ ไฟล์อาจเสียหาย กรุณาเลือกรูปอื่น'); };
  img.src = url;
}
document.addEventListener('change', e => {
  const id = e.target.id, d = state.draft;
  if (id === 'fBuilding') { d.building = e.target.value; d.bin = binsOf(d.building)[0].id; d.fromMap = false; d.ai = null; render(); }
  else if (id === 'fBin') { d.bin = e.target.value; d.fromMap = false; d.ai = null; render(); }
  else if (id === 'fPhoto') { const inp = e.target; readPhoto(inp.files[0], u => { d.photo = u; d.err = ''; render(); }, m => { inp.value = ''; d.err = m; render(); }); }
  else if (id === 'jPhoto') { const inp = e.target; readPhoto(inp.files[0], u => { state.jobAfter = u; state.jobErr = ''; render(); }, m => { inp.value = ''; state.jobErr = m; render(); }); }
  else if (id === 'zoneSel') { state.zone = e.target.value; render(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'reportForm') submitReport();
  if (e.target.id === 'chatForm') { const i = $('#chatIn'); const v = i.value.trim(); if (v) chatSend(v); }
});
function chatSend(text) {
  const g = SWAI.guard(text);
  if (!g.ok && g.reason === 'empty') return;
  state.chat.push({ me: true, t: String(text).slice(0, SWAI.MAX_CHAT) });
  state.chat.push({ me: false, t: g.ok ? botReply(text) : g.reply });
  render();
}
$$('.roles button').forEach(b => b.addEventListener('click', () => {
  state.role = b.dataset.role; state.mapSel = null; state.mapBld = null;
  state.zone = state.role === 'supervisor' ? 'all' : 'Z-A';
  state.tab = state.role === 'reporter' ? 'home' : 'jobs'; render(); window.scrollTo(0, 0);
}));
$('#skip').addEventListener('click', () => {
  state.offset += 10 * MIN; const ch = process(); render(); if (!ch) toast('เร่งเวลาไปข้างหน้า 10 นาที');
});

/* ธีม: อัตโนมัติ → สว่าง → มืด */
const THEMES = ['auto', 'light', 'dark'], THEME_LABEL = { auto: 'ธีม: อัตโนมัติ', light: 'ธีม: สว่าง', dark: 'ธีม: มืด' };
function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const b = $('#theme'); if (b) b.textContent = THEME_LABEL[t];
}
let theme = 'auto';
try { theme = THEMES.includes(localStorage.getItem(THEME_KEY)) ? localStorage.getItem(THEME_KEY) : 'auto'; } catch (_) {}
applyTheme(theme);
$('#theme').addEventListener('click', () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]; applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
});

/* ---------- ภาพแผนผัง SPUKK (ฝังในไฟล์ ไม่ต้องใช้ไฟล์รูปแยก) ---------- */
const MAP_IMG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAPAA8ADASIAAhEBAxEB/8QAHAABAAEFAQEAAAAAAAAAAAAAAAUBAgMEBgcI/8QAVRAAAQMCAgMJDQcCBQEHAwMFAQACAwQRBRIGITETFBZBUVJUcZMXIjIzNFNhcnORkrHRBxU1VYGUsqHBIzZCdOFiJCVDgoOi0kRjwkVko+Im8PF1/8QAGwEBAAMBAQEBAAAAAAAAAAAAAAECBAMFBgf/xAArEQEAAgIBBAEFAAMAAwEBAAAAAQIDERIEITFREwUUMjNBFSJhI1JxgeH/2gAMAwEAAhEDEQA/AOOREXqqiIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgy0074H3GsHaOVS8UjJWB7DcH3qDWWnnfTvzA3B2jlXO9OXeHpdF1s4f9beE0isikZKwOYbg/wBFes0xp9FW0WiJgRFRARERAqIiAiIpQIioiBERECIqIkRERWZERUQEREQIiIgREUoEREFEREQKiIiBERECIiAqIikEREQIiIgVERAVERFRERARERAiIgKiIpRMiIqIgREUoEREBUVVRECIiIERUQERFIIioiEeiIu7wRERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREGWCd8EmZusHaOVS0UrJYw9huD7woRZIJ3wPzNNxxjlXO9N94ej0XWzinjbvCaRWRSsljD2G4P8ARXrNrT6Gt4tG4kVEREiIilAiKiAiIioscszIW5pHWHVe6yKPxfxMfrFIjfZyz5Jx0m0N2ORkrM8ZuCrlpYT5K71yt1TMa7K4MnyUi0iIqKHYRERAiIiBERSgREQURERAqIiIEREQIiICoiKQRERAiIiBUREBUREVEREBERECIiAqIilEiIqIgREUoEREBCiogIiIrIiKiAiIpBEVEQIiIiUeiIu7whERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERBkgnfA/M3ZxhS0UrJWBzDcfJQqyQTugfmbrB2g8a53pvvD0Oj6ycX+tvCZRWRSsljD2G44/Qr1nmNPoa2i0biREWka4CbIWWYCRe6mI34c8mWuPXKW4ioCHAEEEHYQqqHSJ33gRFRAWhi/io+s/Jb60MW8VH6x+StXyy9Z+qV2FeTO9YrdWjhXkzvWK3VN/Mq9F+mBERUaREVHuDG5nEADjKImdRuVUWjHiIkqBGGWY42B41vKZjTnTLS++MiIqIuIiIgVERARERUREQFREUgiIiBERECoiICoiIqIiICIiIEREBURFIIioiq5rS94YwEuJ1AayTxLpKHQyvqY2vqJGQAjwfCcE0FpI58VlmeATCwZb8RK6TSbSB2C7jHDAJJJb2LiQ0ALne8xOoYs2e/PhRztXoVXRML6aeOaw8FwyErmpYpIZXRSsLJGGzmu1EFd5o/pW7EqzelXC2KRwJY5l7FR2nkNOZ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uAM/T29inAGbp47JPkr7PuKe3Gouy4AzdPHZJwBm6eOyU/LX2fPT241UXZ8AJvzBvZf8pwAm6e3slHy1R89PbjFRdpwAl6e3sk4ATdPb2an5a+0fPT24tF1lToLiEbS6nqIZTzSCxc3W0NXQS7nWQOidxZth6jsKmt6z4WjJW3iWuiIrLioiIgRFRSgREQEREQl0RFlfSiIiAgaXEBoJJNgByopvRWhbVYgZJBdsQ1daOPUZfixzeU7o/gDaNjaipAdOf/b1LowAFUBFymdvksuW2S02tKqIihzEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBalfQ0+IUxgqomyRu2g/2W2qFIHkekOCy4LW5CS+CS5iefkVEr1jSnD24jgs0dgZGNMkZ5HBeTg3AK1478o7t+HJyjuIhVF1dBERARERAiIpQl0RFkfTCIiAux0IaN61DuWQfJccuy0H8jqPa/2UT4l531T9Dq0RFyfMua05xWrwbR59ZQPayYStaC5ubUV5x3RdJukw9g1es46M2HOBsRcbVydRNTUzQ6pkhiaTqL7C5UTOnfFh5xM7cl3RtJukw9g1U7o2k3SYewauudNSsg3d8kLYjskOUNPUhmphBu5khENr7obZVXm6/a/wDXI90XSbpMPYNTui6TdJh7Bq66OopJYjLHLA+Jt7vblIHWUjnpJYnTRSwPjbte3KQOtOZ9t/1yXdG0m6TD2DVTujaS9Jh7Bq6+CamqWl9PJDK0GxLLGyy5G81nwhOZHSb/AK4vujaTdJh7Bqd0bSbpMPYNXaZG81nwhMjeaz4QnNP2c+3F90bSbpMPYNTujaTdJh7Bq7TI3ms+EJkbzWfCE5n2c+3F90bSbpMPYNTujaTdJh7Bq7TI3ms+EJkbzWfCE5n2c+3Gd0bSbpMPYNTujaTdJh7Bq7PI3ms+EKmVvNb7gnM+0/64zujaTdJh7Bqd0bSbpMPYNXaZG81nwhMjeaz4QnNH2k+3F90bSbpMPYNTujaTdJh7Bq7TI3ms+EKmVvNb7gnM+0/64zujaTdJh7Bqd0bSbpMPYNXaZG81nwhM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';
(function () {
  try {
    const bin = atob(MAP_IMG_B64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    MAP.src = URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' }));
  } catch (e) { MAP.src = 'data:image/jpeg;base64,' + MAP_IMG_B64; }
})();

/* ---------- ความยินยอม PDPA ---------- */
let lastFocus = null;
function openConsent() {
  const m = $('#consent'); if (!m) return;
  lastFocus = document.activeElement; m.hidden = false; document.body.classList.add('modal-open');
  const c = $('#consentContact'); if (c) c.textContent = CFG.contact ? 'ติดต่อผู้รับผิดชอบข้อมูล: ' + CFG.contact : '';
  const y = $('[data-act="consent-yes"]', m); if (y) y.focus();
}
function closeConsent() {
  const m = $('#consent'); if (!m) return;
  m.hidden = true; document.body.classList.remove('modal-open');
  if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (_) {} }
  if (state.draft && state.draft.err && state.consent) { state.draft.err = ''; }
  if (state.tab === 'report' || state.tab === 'job') render();
}
document.addEventListener('keydown', e => {
  const m = $('#consent'); if (!m || m.hidden) return;
  if (e.key === 'Escape') { closeConsent(); return; }       /* ปิดโดยไม่เปลี่ยนสถานะความยินยอม */
  if (e.key === 'Tab') {
    const f = $$('button', m).filter(b => !b.disabled); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

load();
try { state.consent = localStorage.getItem(CONSENT_KEY) === '1'; } catch (_) { state.consent = false; }
if (window.matchMedia && matchMedia('(max-width:640px)').matches) state.mapZoom = 2;
process();
render();
if (!state.consent) openConsent();