// ============================================================
// ui/tabs.js — navigation, setup, course, players, turbo, progress
// ============================================================
import { G, players, scores, pars,
         isGameStarted, getCurrentHole, setCurrentHole,
         LS_KEY, autoSave } from '../config.js';
import { fetchCourses, updateCoursePars, hasPars,
         getSelectedCoursePars, addCourse, addCourseLoop } from '../firebase/courses.js';
import { buildHcapUI } from '../modules/handicap.js';
import { updateBiteMultUI } from '../modules/games.js';
import { buildResults, buildMoney, showHole, updateTotals } from './render.js';
import { syncAll, syncFullBackup } from '../firebase/sync.js';
import { lbStopTimers, lbActivate } from '../modules/leaderboard.js';

// ── clearSession ไม่ import จาก app.js เพราะ circular
// ใช้ window.clearSession() ที่ถูก expose ใน app.js DOMContentLoaded แทน
function _clearSession(){ window.clearSession?.(); }

// ============================================================
// NAVIGATION
// ============================================================
export function goTab(n){
  // หยุด LB timers เมื่อออกจาก results page (ถ้า lb-mode กำลัง run อยู่)
  if(n !== 'results'){
    const scr = document.getElementById('scr-results');
    if(scr?.classList.contains('lb-mode')) lbStopTimers();
  }
  if(n !== 'lb'){ lbStopTimers(); }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ti').forEach(b => b.classList.remove('on'));
  document.getElementById(`scr-${n}`)?.classList.add('active');
  const tabEl = document.getElementById(`tab-${n}`);
  if(tabEl) tabEl.classList.add('on');
  const titles = {setup:'ตั้งค่า',scorecard:'สกอร์',results:'ผลลัพธ์',money:'ยอดเงิน',guide:'คู่มือ',online:'Online'};
  const titleEl = document.getElementById('hdr-title');
  if(titleEl) titleEl.textContent = titles[n] || n;
  _updateDragonBar(n);
  if(n === 'setup'){
    const subEl = document.getElementById('hdr-sub');
    if(subEl) subEl.textContent = 'เลือกสนาม · ผู้เล่น · เกม';
    ['bite','turbo','olympic','team','farNear','doubleRe','srikrung','hcap'].forEach(k => {
      const sw = document.getElementById(`sw-${k}`);
      if(sw) sw.classList.toggle('on', !!G[k]?.on);
      const body = document.getElementById(`gb-${k}`);
      if(body) body.style.display = G[k]?.on ? 'block' : 'none';
    });
    if(G.hcap.on) buildHcapUI();
    updateBiteMultUI();
  }
}

export function goGuide(){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ti').forEach(b => b.classList.remove('on'));
  document.getElementById('scr-guide')?.classList.add('active');
  const titleEl = document.getElementById('hdr-title');
  const subEl   = document.getElementById('hdr-sub');
  if(titleEl) titleEl.textContent = 'คู่มือ';
  if(subEl)   subEl.textContent   = 'GolfMate ฉบับสมบูรณ์';
  window.scrollTo(0, 0);
}

export function goResults(tab='scorecard'){
  if(!isGameStarted()){ alert('กรุณาเริ่มเกมก่อนครับ'); return; }
  if(tab === 'scorecard') buildResults();
  goTab('results');
  switchResultsTab(tab);
}

export function goMoney(){
  if(!isGameStarted()){ alert('กรุณาเริ่มเกมก่อนครับ'); return; }
  buildMoney(); goTab('money');
}

// ── V12: สลับ sub-tab ภายใน scr-results ──
export function switchResultsTab(tab){
  const btnSc = document.getElementById('res-tab-scorecard');
  const btnLb = document.getElementById('res-tab-lb');
  const secSc = document.getElementById('res-sec-scorecard');
  const secLb = document.getElementById('res-sec-lb');
  const scr   = document.getElementById('scr-results');

  if(tab === 'lb'){
    // ── ไปหน้า อันดับ Live ──
    if(btnSc){ btnSc.style.background='var(--bg3)'; btnSc.style.color='var(--lbl2)'; }
    if(btnLb){ btnLb.style.background='var(--blue)'; btnLb.style.color='#fff'; }
    if(secSc) secSc.style.display='none';
    if(secLb) secLb.style.display='flex';
    if(scr)   scr.classList.add('lb-mode');
    lbActivate(); // measure layout + fetch + start timers
  } else if(tab === 'tournament'){
    // ── ไปหน้า Dragon Tournament ──
    const btnTr = document.getElementById('res-tab-tournament');
    const secTr = document.getElementById('res-sec-tournament');
    if(btnSc){ btnSc.style.background='var(--bg3)'; btnSc.style.color='var(--lbl2)'; }
    if(btnLb){ btnLb.style.background='var(--bg3)'; btnLb.style.color='var(--lbl2)'; }
    if(btnTr){ btnTr.style.background='var(--dragon,#ff6b2b)'; btnTr.style.color='#fff'; }
    if(secSc) secSc.style.display='none';
    if(secLb) secLb.style.display='none';
    if(secTr) secTr.style.display='block';
    if(scr)   scr.classList.remove('lb-mode');
    lbStopTimers();
    if(typeof window.drTournamentInit==='function') window.drTournamentInit();
  } else {
    // ── ไปหน้า สกอร์การ์ด ──
    const btnTr = document.getElementById('res-tab-tournament');
    const secTr = document.getElementById('res-sec-tournament');
    if(btnSc){ btnSc.style.background='var(--blue)'; btnSc.style.color='#fff'; }
    if(btnLb){ btnLb.style.background='var(--bg3)'; btnLb.style.color='var(--lbl2)'; }
    if(btnTr){ btnTr.style.background='var(--bg3)'; btnTr.style.color='var(--lbl2)'; }
    if(secSc) secSc.style.display='block';
    if(secLb) secLb.style.display='none';
    if(secTr) secTr.style.display='none';
    if(scr)   scr.classList.remove('lb-mode');
    lbStopTimers();
  }
}

// ============================================================
// COURSE PRESET — V12.1 Firebase Dynamic
// ============================================================

// state ของสนามที่เลือก
let _allCourses = {};
let _selectedCourseId = 'custom';

// โหลด dropdown จาก Firebase
export async function loadCoursesDropdown(){
  const sel = document.getElementById('course-preset');
  if(!sel) return;

  // แสดง loading
  sel.innerHTML = '<option value="">⟳ กำลังโหลดสนาม...</option>';

  try{
    _allCourses = await fetchCourses();
    const entries = Object.entries(_allCourses).sort((a,b)=>
      a[1].name?.localeCompare(b[1].name,'th')
    );

    let opts = '<option value="custom">-- พิมพ์ชื่อสนามเอง --</option>';

    // จัดกลุ่มตาม region
    const regions = {};
    entries.forEach(([id,c])=>{
      const r = c.region || 'อื่นๆ';
      if(!regions[r]) regions[r] = [];
      regions[r].push([id,c]);
    });

    const regionOrder = [
      'กรุงเทพฯ และปริมณฑล','ภาคกลาง','ภาคตะวันออก',
      'ภาคตะวันตก','ภาคเหนือ','ภาคตะวันออกเฉียงเหนือ','ภาคใต้','อื่นๆ'
    ];
    regionOrder.forEach(r=>{
      if(!regions[r]) return;
      opts += `<optgroup label="${r}">`;
      regions[r].forEach(([id,c])=>{
        opts += `<option value="${id}">${c.name}</option>`;
      });
      opts += `</optgroup>`;
    });

    // เพิ่มสนาม
    opts += `<option value="__add__">➕ เพิ่มสนามใหม่...</option>`;
    sel.innerHTML = opts;
    // V12.1: ตั้ง default เป็น มทบ.13
    if(_allCourses['mthb']) sel.value = 'mthb';

  }catch(e){
    console.error('loadCoursesDropdown error:', e);
    sel.innerHTML = `
      <option value="custom">-- พิมพ์ชื่อสนามเอง --</option>
      <option value="__add__">➕ เพิ่มสนามใหม่...</option>
    `;
  }
  // ถ้า dropdown มีแค่ 2 รายการ (fallback) ลอง retry อีกครั้งหลัง 3 วิ
  if(sel.options.length <= 2){
    setTimeout(async ()=>{
      try{
        _allCourses = await fetchCourses();
        if(Object.keys(_allCourses).length > 0) loadCoursesDropdown();
      }catch(e){}
    }, 3000);
  }

  changeCoursePreset();
}

export function changeCoursePreset(){
  const sel     = document.getElementById('course-preset');
  if(!sel) return;
  const v       = sel.value;

  // กด เพิ่มสนามใหม่
  if(v === '__add__'){
    sel.value = _selectedCourseId || 'custom';
    showAddCourseModal();
    return;
  }

  _selectedCourseId = v;
  const sub     = document.getElementById('course-sub-wrap');
  const nameRow = document.getElementById('course-name-row');
  const nameEl  = document.getElementById('course-name');

  if(v === 'custom'){
    if(nameEl)  nameEl.value = '';
    if(nameRow) nameRow.style.display = 'flex';
    if(sub)     sub.style.display = 'none';
    return;
  }

  const course = _allCourses[v];
  if(!course) return;

  if(nameEl)  nameEl.value = course.name || '';
  if(nameRow) nameRow.style.display = 'none';

  if(course.type === '9hole-loop' && course.loops){
    // build loop selects
    const loopKeys = Object.keys(course.loops).sort();
    const f9 = document.getElementById('course-f9');
    const b9 = document.getElementById('course-b9');
    if(f9 && b9){
      const opts = loopKeys.map(k=>`<option value="${k}">คอส ${k}</option>`).join('');
      f9.innerHTML = opts;
      b9.innerHTML = opts;
      if(loopKeys[1]) b9.value = loopKeys[1];
    }
    // เพิ่มปุ่ม + คอสใหม่
    let addBtn = document.getElementById('add-loop-btn');
    if(!addBtn){
      addBtn = document.createElement('button');
      addBtn.id = 'add-loop-btn';
      addBtn.className = 'nav-b';
      addBtn.style.cssText = 'font-size:12px;padding:6px;color:var(--blue)';
      addBtn.onclick = ()=> showAddLoopModal(v);
      sub.appendChild(addBtn);
    }
    addBtn.textContent = `➕ เพิ่มคอสใหม่ให้ ${course.name}`;
    if(sub) sub.style.display = 'flex';
    applyParsFromPreset();
  } else {
    if(sub) sub.style.display = 'none';
    if(course.pars?.length === 18){
      pars.splice(0,18,...course.pars);
      buildParGrid();
    } else {
      // Par ยังว่าง — ใส่ default 4
      pars.splice(0,18,...Array(18).fill(4));
      buildParGrid();
      _showParWarning(course.name);
    }
  }
}

export function applyParsFromPreset(){
  const v = _selectedCourseId;
  if(v === 'custom' || !v) return;
  const course = _allCourses[v];
  if(!course || course.type !== '9hole-loop') return;

  const f9Key = document.getElementById('course-f9')?.value || 'A';
  const b9Key = document.getElementById('course-b9')?.value || 'B';
  const newPars = getSelectedCoursePars(course, f9Key, b9Key);
  if(newPars){
    pars.splice(0,18,...newPars);
    buildParGrid();
  }
}

// แสดง Banner เตือน Par ว่าง + ปุ่มแชร์
function _showParWarning(courseName){
  const warn = document.getElementById('par-warning');
  const btn  = document.getElementById('par-share-btn');
  if(warn){
    warn.style.display = 'block';
    const nameEl = document.getElementById('par-warn-name');
    if(nameEl) nameEl.textContent = courseName;
  }
  if(btn) btn.style.display = 'block';
}

// ซ่อน warning และแสดงปุ่มแชร์เมื่อมีการแก้ Par
export function onParChanged(){
  const warn = document.getElementById('par-warning');
  const btn  = document.getElementById('par-share-btn');
  if(warn) warn.style.display = 'none';
  if(btn && _selectedCourseId && _selectedCourseId !== 'custom'){
    btn.style.display = 'block';
  }
}

// sync Par กลับ Firebase หลังแก้บนหน้าสกอ
export async function syncCourseParToFirebase(){
  if(!_selectedCourseId || _selectedCourseId === 'custom') return;
  const course = _allCourses[_selectedCourseId];
  if(!course || course.type === '9hole-loop') return; // loop ไม่ sync แบบนี้
  await updateCoursePars(_selectedCourseId, [...pars]);
}

export function getSelectedCourseId(){ return _selectedCourseId; }

// ============================================================
// MODAL — เพิ่มสนามใหม่
// ============================================================
// ── Province → Region Map ──
const PROVINCE_REGION = {
  'กรุงเทพมหานคร':'กรุงเทพฯ และปริมณฑล','นนทบุรี':'กรุงเทพฯ และปริมณฑล',
  'ปทุมธานี':'กรุงเทพฯ และปริมณฑล','สมุทรปราการ':'กรุงเทพฯ และปริมณฑล',
  'สมุทรสาคร':'กรุงเทพฯ และปริมณฑล','นครปฐม':'กรุงเทพฯ และปริมณฑล',
  'พระนครศรีอยุธยา':'ภาคกลาง','อ่างทอง':'ภาคกลาง','ลพบุรี':'ภาคกลาง',
  'สิงห์บุรี':'ภาคกลาง','ชัยนาท':'ภาคกลาง','สระบุรี':'ภาคกลาง',
  'นครนายก':'ภาคกลาง','สุพรรณบุรี':'ภาคกลาง','กาญจนบุรี':'ภาคกลาง',
  'ราชบุรี':'ภาคกลาง','เพชรบุรี':'ภาคกลาง','ประจวบคีรีขันธ์':'ภาคกลาง',
  'สมุทรสงคราม':'ภาคกลาง',
  'ชลบุรี':'ภาคตะวันออก','ระยอง':'ภาคตะวันออก','จันทบุรี':'ภาคตะวันออก',
  'ตราด':'ภาคตะวันออก','ฉะเชิงเทรา':'ภาคตะวันออก','ปราจีนบุรี':'ภาคตะวันออก',
  'สระแก้ว':'ภาคตะวันออก',
  'เชียงใหม่':'ภาคเหนือ','เชียงราย':'ภาคเหนือ','ลำปาง':'ภาคเหนือ',
  'ลำพูน':'ภาคเหนือ','แม่ฮ่องสอน':'ภาคเหนือ','พะเยา':'ภาคเหนือ',
  'แพร่':'ภาคเหนือ','น่าน':'ภาคเหนือ','อุตรดิตถ์':'ภาคเหนือ',
  'ตาก':'ภาคเหนือ','สุโขทัย':'ภาคเหนือ','พิษณุโลก':'ภาคเหนือ',
  'พิจิตร':'ภาคเหนือ','กำแพงเพชร':'ภาคเหนือ','นครสวรรค์':'ภาคเหนือ',
  'อุทัยธานี':'ภาคเหนือ','เพชรบูรณ์':'ภาคเหนือ',
  'นครราชสีมา':'ภาคตะวันออกเฉียงเหนือ','บุรีรัมย์':'ภาคตะวันออกเฉียงเหนือ',
  'สุรินทร์':'ภาคตะวันออกเฉียงเหนือ','ศรีสะเกษ':'ภาคตะวันออกเฉียงเหนือ',
  'อุบลราชธานี':'ภาคตะวันออกเฉียงเหนือ','ยโสธร':'ภาคตะวันออกเฉียงเหนือ',
  'ชัยภูมิ':'ภาคตะวันออกเฉียงเหนือ','อำนาจเจริญ':'ภาคตะวันออกเฉียงเหนือ',
  'บึงกาฬ':'ภาคตะวันออกเฉียงเหนือ','หนองบัวลำภู':'ภาคตะวันออกเฉียงเหนือ',
  'ขอนแก่น':'ภาคตะวันออกเฉียงเหนือ','อุดรธานี':'ภาคตะวันออกเฉียงเหนือ',
  'เลย':'ภาคตะวันออกเฉียงเหนือ','หนองคาย':'ภาคตะวันออกเฉียงเหนือ',
  'มหาสารคาม':'ภาคตะวันออกเฉียงเหนือ','ร้อยเอ็ด':'ภาคตะวันออกเฉียงเหนือ',
  'กาฬสินธุ์':'ภาคตะวันออกเฉียงเหนือ','สกลนคร':'ภาคตะวันออกเฉียงเหนือ',
  'นครพนม':'ภาคตะวันออกเฉียงเหนือ','มุกดาหาร':'ภาคตะวันออกเฉียงเหนือ',
  'ชุมพร':'ภาคใต้','ระนอง':'ภาคใต้','สุราษฎร์ธานี':'ภาคใต้',
  'นครศรีธรรมราช':'ภาคใต้','กระบี่':'ภาคใต้','พังงา':'ภาคใต้',
  'ภูเก็ต':'ภาคใต้','ตรัง':'ภาคใต้','พัทลุง':'ภาคใต้',
  'สตูล':'ภาคใต้','สงขลา':'ภาคใต้','ปัตตานี':'ภาคใต้',
  'ยะลา':'ภาคใต้','นราธิวาส':'ภาคใต้',
};
export function getRegionFromProvince(province){
  return PROVINCE_REGION[province] || 'ไม่ระบุ';
}
export function onProvinceChange(province){
  const region = getRegionFromProvince(province);
  const rd  = document.getElementById('ac-region-display');
  const rt  = document.getElementById('ac-region-text');
  if(!rd || !rt) return;
  if(province && region !== 'ไม่ระบุ'){
    rd.style.display = 'block';
    rt.textContent   = region;
  } else {
    rd.style.display = 'none';
  }
}

export function showAddCourseModal(){
  const modal = document.getElementById('add-course-modal');
  const sheet = document.getElementById('add-course-sheet');
  if(!modal) return;
  // reset
  document.getElementById('ac-name').value = '';
  document.getElementById('ac-type').value = '18hole';
  const prov = document.getElementById('ac-province');
  if(prov) prov.value = '';
  const rd = document.getElementById('ac-region-display');
  if(rd) rd.style.display='none';
  document.getElementById('ac-status').style.display = 'none';
  toggleCourseTypeUI('18hole');
  modal.style.display = 'flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    sheet.style.transform = 'translateY(0)';
  }));
}

export function hideAddCourseModal(){
  const sheet = document.getElementById('add-course-sheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(()=>{ document.getElementById('add-course-modal').style.display='none'; },300);
}

export function toggleCourseTypeUI(type){
  document.getElementById('ac-18hole-wrap').style.display = type==='18hole'?'block':'none';
  document.getElementById('ac-9hole-wrap').style.display  = type==='9hole-loop'?'block':'none';
}

export async function confirmAddCourse(){
  const name   = document.getElementById('ac-name')?.value.trim();
  const type   = document.getElementById('ac-type')?.value;
  const status = document.getElementById('ac-status');

  const showStatus = (msg,color)=>{
    status.style.display='block';
    status.style.background=color;
    status.textContent=msg;
  };

  if(!name){ document.getElementById('ac-name').focus(); return; }

  const province = document.getElementById('ac-province')?.value || 'ไม่ระบุ';
  const region   = getRegionFromProvince(province);
  let data = { name, type, region, province };

  if(type === '18hole'){
    const inputs = document.querySelectorAll('#ac-18hole-wrap .ac-par-input');
    data.pars = [...inputs].map(i=>Math.max(3,Math.min(6,+i.value||4)));
    data.par  = data.pars.reduce((s,v)=>s+v,0);
  } else {
    const loopName = document.getElementById('ac-loop-name')?.value.trim()||'A';
    const inputs   = document.querySelectorAll('#ac-9hole-wrap .ac-par-input');
    const loopPars = [...inputs].map(i=>Math.max(3,Math.min(6,+i.value||4)));
    data.loops = { [loopName]:{ name:`คอส ${loopName}`, pars:loopPars } };
    data.par   = loopPars.reduce((s,v)=>s+v,0);
  }

  showStatus('⟳ กำลังบันทึก...','rgba(10,132,255,0.9)');
  const res = await addCourse(data);

  if(res.ok){
    showStatus(`✅ เพิ่มสนาม "${name}" สำเร็จ!`,'rgba(48,209,88,0.9)');
    setTimeout(async()=>{
      hideAddCourseModal();
      await loadCoursesDropdown();
      // เลือกสนามที่เพิ่งเพิ่ม
      const sel = document.getElementById('course-preset');
      if(sel && res.id){ sel.value = res.id; changeCoursePreset(); }
    },1200);
  } else {
    showStatus(`❌ ${res.msg}`,'rgba(255,69,58,0.9)');
  }
}

// ── Modal เพิ่มคอสใหม่ ──
export function showAddLoopModal(courseId){
  const modal = document.getElementById('add-loop-modal');
  const sheet = document.getElementById('add-loop-sheet');
  if(!modal) return;
  const course = _allCourses[courseId];
  document.getElementById('al-course-name').textContent = course?.name||'';
  document.getElementById('al-loop-name').value = '';
  document.getElementById('al-status').style.display='none';
  modal.dataset.courseId = courseId;
  modal.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    sheet.style.transform='translateY(0)';
  }));
}

export function hideAddLoopModal(){
  const sheet = document.getElementById('add-loop-sheet');
  sheet.style.transform='translateY(100%)';
  setTimeout(()=>{ document.getElementById('add-loop-modal').style.display='none'; },300);
}

export async function confirmAddLoop(){
  const modal    = document.getElementById('add-loop-modal');
  const courseId = modal.dataset.courseId;
  const loopKey  = document.getElementById('al-loop-name')?.value.trim().toUpperCase();
  const inputs   = document.querySelectorAll('#al-par-grid .ac-par-input');
  const loopPars = [...inputs].map(i=>Math.max(3,Math.min(6,+i.value||4)));
  const status   = document.getElementById('al-status');

  const showStatus=(msg,color)=>{
    status.style.display='block';
    status.style.background=color;
    status.textContent=msg;
  };

  if(!loopKey){ document.getElementById('al-loop-name').focus(); return; }

  showStatus('⟳ กำลังบันทึก...','rgba(10,132,255,0.9)');
  const res = await addCourseLoop(courseId, loopKey, {
    name:`คอส ${loopKey}`, pars:loopPars
  });

  if(res.ok){
    showStatus(`✅ เพิ่มคอส ${loopKey} สำเร็จ!`,'rgba(48,209,88,0.9)');
    setTimeout(async()=>{
      hideAddLoopModal();
      await loadCoursesDropdown();
    },1200);
  } else {
    showStatus(`❌ ${res.msg}`,'rgba(255,69,58,0.9)');
  }
}

// ============================================================
// GRIDS
// ============================================================
export function buildParGrid(){
  ['par-front','par-back'].forEach((id, half) => {
    const el = document.getElementById(id); if(!el) return;
    el.innerHTML = '';
    for(let i = half*9; i < half*9+9; i++){
      el.innerHTML += `<div class="par-hole">
        <div class="par-hole-num">H${i+1}</div>
        <input type="number" min="3" max="5" value="${pars[i]}"
          onchange="pars[${i}]=Math.max(3,Math.min(5,parseInt(this.value)||4))">
      </div>`;
    }
  });
}

export function renderPlayerRows(){
  const n = +(document.getElementById('num-players')?.value || 4);
  const wrap = document.getElementById('player-rows'); if(!wrap) return;
  const prev = [...wrap.querySelectorAll('[data-prow]')].map(r => ({
    name: r.querySelector('.pn')?.value || '',
    hcp:  r.querySelector('.ph')?.value || '0'
  }));
  wrap.innerHTML = '';
  for(let i = 0; i < n; i++){
    const vName = prev[i]?.name || '';
    const vHcp  = prev[i]?.hcp  || '0';
    const isDragon = document.getElementById('dragon-sw')?.classList.contains('on');
    wrap.innerHTML += `<div class="group" style="margin-bottom:8px" data-prow>
      <div class="row">
        <div style="width:26px;height:26px;border-radius:50%;background:var(--blue);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:700;color:#fff;flex-shrink:0;margin-right:12px">${i+1}</div>
        <input type="text" class="pn" value="${vName}" placeholder="ผู้เล่น ${i+1}"
          style="flex:1;background:transparent;border:none;padding:0;border-radius:0;font-size:15px;color:var(--lbl)">
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:12px;color:var(--lbl2)">HCP</span>
          <input type="number" class="ph" min="0" value="${vHcp}"
            style="width:56px;border-radius:8px;padding:6px;text-align:center;font-size:14px">
        </div>
      </div>
      ${isDragon ? `<div class="row" style="margin-top:5px;padding-left:38px">
        <span style="font-size:11px;color:#ff6b2b;margin-right:6px;flex-shrink:0">🐴 ตั้งม้า</span>
        <input type="number" class="settamaa-input" min="50" max="150" placeholder="สกอร์เป้า"
          style="width:90px;border-radius:8px;padding:5px 8px;text-align:center;font-size:13px;border:1px solid rgba(255,107,43,0.3);background:rgba(255,107,43,0.05);color:var(--lbl)">
      </div>` : ''}
    </div>`;
  }
}

export function buildTurboGrid(){
  ['tg-front','tg-back'].forEach((id, half) => {
    const el = document.getElementById(id); if(!el) return;
    el.innerHTML = '';
    for(let i = half*9; i < half*9+9; i++){
      el.innerHTML += `<div class="t-cell">
        <div class="t-cell-num">H${i+1}</div>
        <div class="t-cb${G.turbo.holes.has(i)?' on':''}" id="tc-${i}" onclick="toggleTH(${i})">⚡</div>
      </div>`;
    }
  });
}

export function toggleTH(h){
  if(G.turbo.holes.has(h)) G.turbo.holes.delete(h);
  else G.turbo.holes.add(h);
  const on = G.turbo.holes.has(h);
  // Setup grid button
  document.getElementById(`tc-${h}`)?.classList.toggle('on', on);
  // Scorecard button — อัปเดต inline style ด้วย
  const t2 = document.getElementById(`tc2-${h}`);
  if(t2){
    t2.textContent = on ? '⚡ หลุมเทอร์โบ' : '⚡ Turbo';
    t2.style.borderColor  = on ? 'rgba(255,159,10,0.6)' : 'var(--bg4)';
    t2.style.background   = on ? 'rgba(255,159,10,0.18)' : 'var(--bg3)';
    t2.style.color        = on ? '#ff9f0a' : 'var(--lbl3)';
  }
  updateTotals(); autoSave();
}

// ============================================================
// PROGRESS BAR
// ============================================================
export function buildProgressBar(){
  const dots = document.getElementById('progress-dots'); if(!dots) return;
  dots.innerHTML = '';
  for(let h = 0; h < 18; h++){
    const d = document.createElement('div');
    d.className = 'pd'; d.id = `pd-${h}`;
    d.onclick = () => { setCurrentHole(h); showHole(h); };
    dots.appendChild(d);
  }
  updateProgressBar();
}

export function updateProgressBar(){
  const cur = getCurrentHole();
  for(let h = 0; h < 18; h++){
    const d = document.getElementById(`pd-${h}`); if(!d) continue;
    d.className = 'pd';
    const has = players.some((_,p) => scores[p] && scores[p][h] !== null);
    if(h === cur)       d.classList.add('cur');
    else if(has)        d.classList.add('scored');
    else if(h < cur)    d.classList.add('done');
    if(G.turbo.on && G.turbo.holes.has(h)) d.classList.add('turbo');
  }
  // อัปเดต nav badge (Option B)
  const holeNumEl = document.getElementById('nav-hole-num');
  const parValEl  = document.getElementById('nav-par-val');
  const progLblEl = document.getElementById('nav-prog-label');
  const parAllBtn = document.getElementById('nav-par-all');
  if(holeNumEl) holeNumEl.textContent = cur+1;
  if(parValEl)  parValEl.textContent  = pars[cur];
  if(progLblEl) progLblEl.textContent = `${cur+1} / 18`;
  if(parAllBtn) parAllBtn.setAttribute('onclick', `setParAll(${cur})`);
  // ปุ่ม prev disabled
  const prevBtn = document.getElementById('btn-prev');
  if(prevBtn){ prevBtn.disabled=cur===0; prevBtn.style.opacity=cur===0?'0.3':'1'; }
  // อัปเดต legacy elements ถ้ายังมี
  const lblEl = document.getElementById('prog-label');
  const totEl = document.getElementById('prog-total');
  const subEl = document.getElementById('hdr-sub');
  const cnEl  = document.getElementById('course-name');
  if(lblEl) lblEl.textContent = `${cur+1} / 18`;
  if(totEl) totEl.textContent = `Par ${pars[cur]}`;
  if(subEl) subEl.textContent = `${cnEl?.value||'—'} · หลุม ${cur+1}`;
}

// ============================================================
// HOLE NAVIGATION
// ============================================================
export function holeNav(dir){
  const cur  = getCurrentHole();
  const next = cur + dir;
  if(next < 0) return;
  if(next > 17){ syncAll(); goResults(); return; }
  syncAll();
  syncFullBackup();
  // V12.1 — sync Par สนามขึ้น Firebase (เบื้องหลัง)
  syncCourseParToFirebase();
  setCurrentHole(next); showHole(next);
}

// ============================================================
// SWIPE GESTURE (สลับ tab)
// ============================================================
const TABS = ['setup','scorecard','results','money'];
let _swX = 0, _swY = 0, _swOK = false;

export function initSwipe(){
  document.addEventListener('touchstart', e => {
    if(e.target.closest('.stepper,.h-par-ctrl,.oly-r-row,.fn-wrap,.dr-row,.score-rows,.ta-btns,input,select,button')) return;
    _swX = e.touches[0].clientX;
    _swY = e.touches[0].clientY;
    _swOK = true;
  }, {passive:true});

  document.addEventListener('touchend', e => {
    if(!_swOK) return; _swOK = false;
    const dx = e.changedTouches[0].clientX - _swX;
    const dy = e.changedTouches[0].clientY - _swY;
    if(Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)*0.65) return;
    const cur = TABS.findIndex(t => document.getElementById(`scr-${t}`)?.classList.contains('active'));
    if(cur === -1) return;
    const next = dx < 0 ? cur+1 : cur-1;
    if(next < 0 || next >= TABS.length) return;
    const dest = TABS[next];
    if((dest==='scorecard'||dest==='results'||dest==='money') && !isGameStarted()) return;
    if(dest === 'results') goResults();
    else if(dest === 'money') goMoney();
    else goTab(dest);
  }, {passive:true});
}
