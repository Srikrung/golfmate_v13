// ============================================================
// app.js — Entry point สำหรับ GolfMate v11
// import ทั้งหมดต้องอยู่บนสุดเท่านั้น (ES Module rule)
// ============================================================

// ── config ──
import { players, scores, pars, G,
         olympicData, farNearData, srikrungData, skipData, teamSoloPlayers,
         setPlayers, setScores, setGameStarted, setCurrentHole,
         isGameStarted, getCurrentHole, LS_KEY, FB_URL } from './config.js';

// ── ui ──
import { initTheme, toggleTheme, applyFontScale, initFontScale,
         showExportModal, hideExportModal,
         setExportWho, doExport } from './ui/alerts.js';
import { initSwipe, goTab, goGuide, goResults, goMoney, switchResultsTab,
         buildParGrid, renderPlayerRows, buildTurboGrid,
         buildProgressBar, updateProgressBar, holeNav, toggleTH,
         changeCoursePreset, applyParsFromPreset, loadCoursesDropdown,
         showAddCourseModal, hideAddCourseModal, toggleCourseTypeUI, confirmAddCourse,
         onProvinceChange,
         showAddLoopModal, hideAddLoopModal, confirmAddLoop,
         syncCourseParToFirebase, getSelectedCourseId } from './ui/tabs.js';
import { showHole, updateTotals, drSet, _refreshOlyInline,
         getTeamBadgeHTML, getTeamBadgeProps,
         setHoleMatrixPill, setMatrixPill, lbToggleMatrix,
         buildResults, buildMoney, showMoneyDetail } from './ui/render.js';

// ── modules ──
import { initHcapPairs, addHcapPairsForPlayer, buildHcapUI,
         hcapTogglePair, hcapFlipDir, hcapSetStroke, hcapSetField } from './modules/handicap.js';
import { updateBiteMultUI, toggleBiteMult, setBiteMult,
         toggleGameMidPlay, olyAct, olyReset, olyRenderHole,
         fnChangeMode, fnToggleSank, fnSelectPlayer, fnRenderHole } from './modules/games.js';
import { sgToggle, sgChPutt, sgSetPutt1, sgRenderHole,
         sgToggleFocus, getSgFocusPlayer } from './modules/srikrung.js';
import { joinRoomLookup, selectJoinPlayer, restoreJoinSrikrung,
         loadOnlineRooms, joinFromRoomList } from './modules/join.js';
import { chScore, startRpt, stopRpt, sws, swm, swe,
         setParAll, chPar } from './modules/scoring.js';
import { goLeaderboard, lbGoPrev, lbGoNext,
         lbSetTab, lbSetRoom, lbFetch } from './modules/leaderboard.js';

// ── firebase ──
import { toggleSyncSw, updateRoomCode, syncEnabled, getRoomCode } from './firebase/init.js';
import { isDragonOn, toggleDragon, setDragonOn, initDragonData,
         dragonData, renderDragonSection, renderPotSummary,
         saveDragonState, loadDragonState,
         buildDragonPotHTML, calcDragonTeamScores } from './modules/dragon.js';
import { loadOnlineSetting, goOnlineSetup, saveOnlineSetup, testConnection } from './firebase/room.js';
import { createRoom, syncFullBackup, restoreFromFirebase,
         deleteRoomFromFirebase } from './firebase/sync.js';

// ── Debounce backup 10 วินาที หลัง autoSave ──
let _backupTimer = null;
function scheduleBackup(){
  if(!navigator.onLine) return; // ออฟไลน์ → ข้าม
  clearTimeout(_backupTimer);
  _backupTimer = setTimeout(()=>{ syncFullBackup(); }, 10000);
}


// ── Auto Generate Room Code ──
function autoGenRoomCode(){
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter=letters[Math.floor(Math.random()*26)];
  const day=new Date().getDate();
  const d1=Math.floor(day/10).toString();
  const d2=(day%10).toString();
  const sl=document.getElementById('room-code-letter');
  const sn=document.getElementById('room-code-num');
  const sn2=document.getElementById('room-code-num2');
  for(let i=0;i<sl.options.length;i++) if(sl.options[i].value===letter){sl.selectedIndex=i;break;}
  for(let i=0;i<sn.options.length;i++) if(sn.options[i].value===d1){sn.selectedIndex=i;break;}
  for(let i=0;i<sn2.options.length;i++) if(sn2.options[i].value===d2){sn2.selectedIndex=i;break;}
  updateRoomCode();
}
// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFontScale();
  setTimeout(() => document.getElementById('splash')?.classList.add('hide'), 1200);
  setToday();
  // V12.1 — โหลดสนามจาก Firebase (แทน hardcode)
  loadCoursesDropdown();
  // build Par input grids สำหรับ modal เพิ่มสนาม
  _buildModalParGrids();
  buildParGrid();
  renderPlayerRows();
  buildTurboGrid();
  initDragonData(players.length||4);
  // ── Auto-expire: ล้างเกมเก่าช่วง 04:00–05:59 ──
  try{
    const saved = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    if(saved.gameDate){
      const now   = new Date();
      const hour  = now.getHours();
      const today = now.toISOString().split('T')[0];
      if(saved.gameDate !== today && hour >= 4 && hour < 6){
        localStorage.removeItem(LS_KEY);
        // V12.1: reset Room Code กลับค่าเริ่มต้น (ว่าง) เมื่อข้ามวัน
        try{
          const sl = document.getElementById('room-code-letter');
          const sn = document.getElementById('room-code-num');
          const sn2 = document.getElementById('room-code-num2');
          if(sl) sl.selectedIndex = 0;
          if(sn) sn.selectedIndex = 0;
          if(sn2) sn2.selectedIndex = 0;
          const rc = document.getElementById('room-code');
          const rcp = document.getElementById('room-code-preview');
          if(rc) rc.value = '';
          if(rcp) rcp.textContent = '—';
          const swSync = document.getElementById('sw-sync');
          if(swSync) swSync.classList.remove('on');
        }catch(e2){}
      }
    }
  }catch(e){}
  setTimeout(()=>{
    const hadLocal = loadSession();
    loadDragonState();
    if(!hadLocal){
      // ไม่มีข้อมูลในเครื่อง → ลองดึง Firebase อัตโนมัติ
      try{
        const online = JSON.parse(localStorage.getItem('golfmate_online')||'{}');
        if(online.room && online.room !== 'DEFAULT'){
          restoreFromFirebase(true); // silent=true ไม่ถาม
        }
      }catch(e){}
    }
  }, 400);
  loadOnlineSetting();
  initRestoreBtn();
  initSwipe();
  updateBiteMultUI();

  document.getElementById('add-player-modal')?.addEventListener('click', function(e){
    if(e.target === this) hideAddPlayerModal();
  });
  document.getElementById('export-modal')?.addEventListener('click', function(e){
    if(e.target === this) hideExportModal();
  });
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') saveSession();
  });
  window.addEventListener('beforeunload', () => saveSession());

  // bridge สำหรับ config.js ที่ใช้ window._autoSave()
  window._autoSave = ()=>{ saveSession(); saveDragonState(); };
  window._updateAddPlayerBtn = updateAddPlayerBtn;

  // expose ทุก function ที่ HTML onclick เรียก
  Object.assign(window, {
    // app
    setToday, fmtDate, toggleSw, toggleSkipPlayer, toggleSkipGame,
    toggleTeamSolo, toggleTeamScorecard, setTeamMode, setH2HSize, startGame, newGame,
    showAddPlayerModal, hideAddPlayerModal, confirmAddPlayer,
    updateAddPlayerBtn, saveSession, loadSession, clearSession, clearGameData, initRestoreBtn, autoSave,
    shareToLine,
    // V12.1 course
    changeCoursePreset, applyParsFromPreset, loadCoursesDropdown,
    showAddCourseModal, hideAddCourseModal, toggleCourseTypeUI, confirmAddCourse,
    showAddLoopModal, hideAddLoopModal, confirmAddLoop,
    shareCourseParToFirebase,
    // tabs/nav
    goTab, goGuide, goResults, goMoney, switchResultsTab, showMoneyDetail,
    buildParGrid, renderPlayerRows, buildTurboGrid,
    buildProgressBar, updateProgressBar, holeNav, toggleTH,
    // scoring
    chScore, startRpt, stopRpt, sws, swm, swe,
    setParAll, chPar, drSet,
    // games
    toggleGameMidPlay, olyAct, olyReset, olyRenderHole,
    fnChangeMode, fnToggleSank, fnSelectPlayer, fnRenderHole,
    toggleBiteMult, setBiteMult, updateBiteMultUI,
    setHoleMatrixPill, setMatrixPill, lbToggleMatrix,
    // handicap
    hcapTogglePair, hcapFlipDir, hcapSetStroke, hcapSetField, buildHcapUI,
    // srikrung
    sgToggle, sgChPutt, sgSetPutt1,
    sgSetFocusAll, sgSetFocusMe,
    // leaderboard
    goLeaderboard, lbGoPrev, lbGoNext, lbSetTab, lbSetRoom, lbFetch,
    // firebase
    toggleSyncSw, updateRoomCode, autoGenRoomCode,
  // Dragon Golf V13
  toggleDragon, isDragonOn, renderDragonSection, renderPotSummary,
  buildDragonPotHTML, calcDragonTeamScores,
    goOnlineSetup, saveOnlineSetup, testConnection, createRoom,
    restoreFromFirebase, restoreJoinSrikrung,
    deleteRoomFromFirebase,
    // join
    joinRoomLookup, selectJoinPlayer, restoreJoinSrikrung,
    loadOnlineRooms, joinFromRoomList,
    // export / share
    showExportModal, hideExportModal, setExportWho, doExport,
    toggleTheme, applyFontScale,
    // collapse
    toggleSkipSection, toggleMatrixSection, chParNav,
  });
});

// ============================================================
// HELPERS
// ============================================================
export function setToday(){
  const d = new Date(Date.now() + 7*3600000);
  const el = document.getElementById('game-date');
  if(el) el.value = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
export function fmtDate(v){
  if(!v) return '';
  const [y,m,d] = v.split('-');
  const mn = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${+d} ${mn[+m-1]}${+y+543}`;
}

// ============================================================
// TOGGLE GAME SWITCH
// ============================================================
export function toggleSw(id){
  G[id].on = !G[id].on;
  document.getElementById(`sw-${id}`)?.classList.toggle('on', G[id].on);
  const body = document.getElementById(`gb-${id}`);
  if(body) body.style.display = G[id].on ? 'block' : 'none';
  // Srikrung: แสดง/ซ่อน focus row และสร้างปุ่มเลือกคน
  if(id === 'srikrung'){
    const row = document.getElementById('sg-focus-row');
    if(row) row.style.display = G.srikrung.on ? 'block' : 'none';
    if(G.srikrung.on) _sgBuildFocusBtns();
  }
  if(isGameStarted()){
    const sy = window.scrollY;
    showHole(getCurrentHole());
    requestAnimationFrame(() => window.scrollTo(0, sy));
  }
  autoSave();
}

// ============================================================
// SKIP
// ============================================================
// ── TEAM SCORECARD TOGGLE ──
// กด badge ทีม → วนรอบ: A → B → Solo → ไม่เล่น → A
export function toggleTeamScorecard(h, p){
  const isSolo = teamSoloPlayers.has(p);
  const isOut  = skipData[h]?.[p]?.has('team');
  const cur    = G.team.domoTeams[h]?.[p] || 'A';

  if(isOut){
    // ไม่เล่น → กลับ A
    skipData[h][p].delete('team');
    teamSoloPlayers.delete(p);
    G.team.domoTeams[h][p] = 'A';
    // propagate A ไปหลุมถัดไป
    for(let i=h+1;i<18;i++) G.team.domoTeams[i][p]='A';
  } else if(isSolo){
    // Solo → ไม่เล่น
    teamSoloPlayers.delete(p);
    if(!skipData[h]){ skipData[h]=Array(players.length).fill(null).map(()=>new Set()); }
    else { while(skipData[h].length<players.length) skipData[h].push(new Set()); }
    if(!skipData[h][p]) skipData[h][p]=new Set();
    skipData[h][p].add('team');
  } else if(cur==='C'){
    // C → Solo
    teamSoloPlayers.add(p);
  } else if(cur==='B'){
    // B → C
    G.team.domoTeams[h][p] = 'C';
    for(let i=h+1;i<18;i++) G.team.domoTeams[i][p]='C';
  } else {
    // A → B
    G.team.domoTeams[h][p] = 'B';
    for(let i=h+1;i<18;i++) G.team.domoTeams[i][p]='B';
  }
  // อัปเดต badge ทุกหลุมที่เปลี่ยน
  for(let i=h;i<18;i++){
    const el=document.getElementById(`tb-${i}-${p}`);
    if(el){
      const {bg,cl,label}=getTeamBadgeProps(i,p);
      el.style.background=bg; el.style.color=cl; el.textContent=label;
    }
  }
  updateTotals(); autoSave();
}

export function toggleSkipPlayer(h, p){
  toggleSkipGame(h,p,'bite');
  toggleSkipGame(h,p,'olympic');
  toggleSkipGame(h,p,'farNear');
}
export function toggleSkipGame(h, p, k){
  // init แบบปลอดภัย — ไม่ล้าง slot เดิมที่มีอยู่
  if(!skipData[h]){
    skipData[h] = Array(players.length).fill(null).map(()=>new Set());
  } else {
    // ถ้า array สั้นกว่า players ปัจจุบัน (เพิ่มคนระหว่างแมท) → ต่อ slot
    while(skipData[h].length < players.length) skipData[h].push(new Set());
  }
  if(!skipData[h][p]) skipData[h][p] = new Set();
  if(skipData[h][p].has(k)) skipData[h][p].delete(k);
  else skipData[h][p].add(k);
  updateTotals(); autoSave();
  // จำสถานะ skip section ก่อน render ใหม่
  const skipOpen = document.getElementById(`skip-body-${h}`)?.style.display === 'block';
  showHole._noScroll = true; // ไม่ scroll ขึ้นบนเสมอเมื่อกด skip
  showHole(h);
  // คืนสถานะ skip section เหมือนเดิม
  const body = document.getElementById(`skip-body-${h}`);
  const arr  = document.getElementById(`skip-arr-${h}`);
  if(body) body.style.display = skipOpen ? 'block' : 'none';
  if(arr)  arr.textContent    = skipOpen ? '▼' : '▶';
}

// ============================================================
// TEAM SOLO
// ============================================================
export function toggleTeamSolo(p){
  if(teamSoloPlayers.has(p)) teamSoloPlayers.delete(p);
  else teamSoloPlayers.add(p);
  showHole(getCurrentHole()); updateTotals(); autoSave();
}
export function setTeamMode(mode){ G.team.mode = 'h2h'; }
export function setH2HSize(sz){}

// ============================================================
// NEW GAME
// ============================================================
export function sgSetFocusAll(){
  sgToggleFocus(null); // รีเซ็ตเป็น ทุกคน
  _sgUpdateFocusBtns(null);
  // re-render ทุกหลุม
  for(let h=0;h<18;h++){ if(document.getElementById('sg-players-'+h)) sgRenderHole(h); }
}
export function sgSetFocusMe(p){
  sgToggleFocus(p);
  _sgUpdateFocusBtns(p);
  for(let h=0;h<18;h++){ if(document.getElementById('sg-players-'+h)) sgRenderHole(h); }
}
function _sgBuildFocusBtns(){
  const wrap=document.getElementById('sg-focus-btns'); if(!wrap) return;
  const focus=getSgFocusPlayer();
  wrap.innerHTML=`<button onclick="sgSetFocusAll()" id="sg-focus-all"
    style="padding:6px 14px;border-radius:999px;border:1.5px solid ${focus===null?'rgba(52,199,89,0.45)':'var(--bg4)'};
    background:${focus===null?'rgba(52,199,89,0.12)':'transparent'};
    color:${focus===null?'var(--green)':'var(--lbl2)'};
    font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">ทุกคน (Host)</button>`
    +players.map((pl,i)=>`<button onclick="sgSetFocusMe(${i})" id="sg-focus-${i}"
      style="padding:6px 14px;border-radius:999px;border:1.5px solid ${focus===i?'rgba(10,132,255,0.45)':'var(--bg4)'};
      background:${focus===i?'rgba(10,132,255,0.12)':'transparent'};
      color:${focus===i?'var(--blue)':'var(--lbl2)'};
      font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">${pl.name}</button>`).join('');
}
function _sgUpdateFocusBtns(focus){
  const all=document.getElementById('sg-focus-all');
  if(all){all.style.background=focus===null?'rgba(52,199,89,0.12)':'transparent';all.style.borderColor=focus===null?'rgba(52,199,89,0.45)':'var(--bg4)';all.style.color=focus===null?'var(--green)':'var(--lbl2)';}
  players.forEach((_,i)=>{const b=document.getElementById('sg-focus-'+i);if(!b)return;const on=focus===i;b.style.background=on?'rgba(10,132,255,0.12)':'transparent';b.style.borderColor=on?'rgba(10,132,255,0.45)':'var(--bg4)';b.style.color=on?'var(--blue)':'var(--lbl2)';});
}

export function newGame(){
  _lockDragonToggle(false);
  if(confirm('เริ่มเกมใหม่?')){
    setGameStarted(false);
    setPlayers([]); setScores([]); setCurrentHole(0);
    clearSession(); goTab('setup');
  }
}

// ============================================================
// START GAME
// ============================================================

// ── Lock/Unlock Dragon toggle ──
function _lockDragonToggle(lock){
  const sw = document.getElementById('dragon-sw');
  const btn = document.querySelector('button[onclick="showDragonGuide()"]');
  if(!sw) return;
  if(lock){
    sw.style.pointerEvents = 'none';
    sw.style.opacity = '0.5';
    sw.title = 'ไม่สามารถเปลี่ยนโหมด Dragon ระหว่างเล่นได้';
    // แสดง badge ล็อก
    let lk = document.getElementById('dragon-lock-lbl');
    if(!lk){
      lk = document.createElement('span');
      lk.id = 'dragon-lock-lbl';
      lk.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.3);white-space:nowrap';
      lk.textContent = '🔒 ระหว่างเล่น';
      sw.parentNode.insertBefore(lk, sw);
    }
    lk.style.display = 'inline';
  } else {
    sw.style.pointerEvents = '';
    sw.style.opacity = '';
    sw.title = '';
    const lk = document.getElementById('dragon-lock-lbl');
    if(lk) lk.style.display = 'none';
  }
}
export function startGame(){
  // lock Dragon toggle
  _lockDragonToggle(true);
  // เตือนถ้าไม่มี Room Code
  const room = getRoomCode();
  if(!room || room==='DEFAULT'){
    const go = confirm(
      '⚠️ ยังไม่ได้ตั้ง Room Code\n\nข้อมูลสกอร์จะไม่ถูก backup ขึ้น Cloud\nถ้ารีเฟรชพลาดข้อมูลอาจหาย\n\nกด ตกลง เพื่อเล่นต่อโดยไม่ backup\nกด ยกเลิก เพื่อไปตั้ง Room Code ก่อน'
    );
    if(!go){ goOnlineSetup(); return; }
  }
  const n = +document.getElementById('num-players').value;
  setPlayers([...document.querySelectorAll('.pn')].slice(0,n).map((el,i) => ({
    name: el.value.trim() || el.placeholder || `ผู้เล่น ${i+1}`,
    hcp:  Math.max(0, +(document.querySelectorAll('.ph')[i]?.value) || 0)
  })));
  setScores(Array(n).fill(null).map(() => Array(18).fill(null)));

  ['bite','olympic','team','farNear'].forEach(k => {
    const ve = document.getElementById(`gv-${k}`);
    if(ve) G[k].val = Math.max(1, +ve.value || 20);
  });
  G.team.chuanVal = Math.max(1, +(document.getElementById('gv-team-chuan')?.value) || 4);
  G.team.mode = 'h2h'; G.team.swapType = 'domo';
  // V12.1: default ทุกคนเป็น A — แบ่งทีมเอง
  for(let i=0; i<n; i++){ if(!G.team.baseTeams[i]) G.team.baseTeams[i] = 'A'; }
  G.team.domoTeams = Array(18).fill(null).map(() => [...G.team.baseTeams]);
  G.doubleRe.mults = Array(18).fill(1);
  G.doubleRe.on = G.team.on; // เบิ้ล-รีเปิดพร้อมทีมเสมอ

  olympicData.splice(0, olympicData.length,
    ...Array(18).fill(null).map(() => ({order:[],status:{}})));
  farNearData.splice(0, farNearData.length,
    ...Array(18).fill(null).map(() => ({mode:'none',far:null,near:null,farSank:null,nearSank:null,solo:null,soloSank1:null,soloSank2:null})));
  srikrungData.splice(0, srikrungData.length,
    ...Array(18).fill(null).map(() => players.map(() => ({fw:null,gir:null,putt:null}))));
  skipData.splice(0, skipData.length,
    ...Array(18).fill(null).map(() => Array(n).fill(null).map(() => new Set())));
  teamSoloPlayers.clear();

  initHcapPairs(n);
  initDragonData(n); // V13 Dragon
  // ตั้งม้า targets
  if(!G.settamaa) G.settamaa={targets:[]};
  G.settamaa.targets = [...document.querySelectorAll('.settamaa-input')]
    .slice(0,n).map(el=>el.value.trim()===''?null:+el.value);
  setGameStarted(true); setCurrentHole(0);
  buildProgressBar(); showHole(0); goTab('scorecard');
  autoSave();
}

// ============================================================
// ADD PLAYER
// ============================================================
const ADD_MAX = 8;

export function showAddPlayerModal(){
  if(!isGameStarted()) return;
  if(players.length >= ADD_MAX){
    alert(`ไม่สามารถเพิ่มได้\nผู้เล่นครบ ${ADD_MAX} คนแล้ว`); return;
  }
  const modal = document.getElementById('add-player-modal');
  const sheet = document.getElementById('add-player-sheet');
  document.getElementById('new-player-name').value = '';
  document.getElementById('new-player-hcp').value = '0';
  const badge = document.getElementById('ap-slot-badge');
  if(badge) badge.textContent = `เหลือ ${ADD_MAX-players.length} ช่อง`;
  const cta = document.querySelector('#add-player-sheet .cta');
  if(cta) cta.textContent = `เพิ่มผู้เล่น (${players.length+1}/${ADD_MAX})`;
  modal.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; }));
}
export function hideAddPlayerModal(){
  const sheet = document.getElementById('add-player-sheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => { document.getElementById('add-player-modal').style.display = 'none'; }, 300);
}
export function confirmAddPlayer(){
  if(players.length >= ADD_MAX){ alert('ไม่สามารถเพิ่มผู้เล่นได้'); hideAddPlayerModal(); return; }
  const name = document.getElementById('new-player-name').value.trim();
  const hcp  = Math.max(0, +(document.getElementById('new-player-hcp').value) || 0);
  if(!name){ document.getElementById('new-player-name').focus(); return; }
  const p = players.length;
  players.push({name, hcp});
  scores.push(Array(18).fill(null));
  srikrungData.forEach(hd => hd.push({fw:null,gir:null,putt:null}));
  G.team.baseTeams.push('A');
  G.team.domoTeams.forEach(hd => hd.push('A'));
  addHcapPairsForPlayer(p);
  // เพิ่ม skipData slot สำหรับคนใหม่ทุกหลุม
  for(let h=0; h<18; h++){
    if(!skipData[h]) skipData[h] = Array(p+1).fill(null).map(()=>new Set());
    else if(!skipData[h][p]) skipData[h][p] = new Set();
  }
  updateAddPlayerBtn(); hideAddPlayerModal();
  showHole(getCurrentHole()); autoSave();
  // auto อัปเดต _room_config ถ้าห้องเปิดอยู่
  if(syncEnabled) createRoom();
}
export function updateAddPlayerBtn(){
  const btn = document.getElementById('btn-add-player'); if(!btn) return;
  if(players.length >= ADD_MAX){
    btn.textContent = `✋ ผู้เล่นครบ ${ADD_MAX} คนแล้ว`;
    btn.style.opacity = '0.4'; btn.style.pointerEvents = 'none';
    btn.style.color = 'var(--lbl2)'; btn.style.borderColor = 'var(--sep)';
  } else {
    btn.textContent = `+ เพิ่มผู้เล่น (เหลือ ${ADD_MAX-players.length} ช่อง)`;
    btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
    btn.style.color = 'var(--blue)'; btn.style.borderColor = 'rgba(10,132,255,0.3)';
  }
}

// ============================================================
// SESSION
// ============================================================
// saveDragonState / loadDragonState → see dragon.js
export function saveSession(){
  if(!isGameStarted()) return;
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({
      v:1, players, scores, pars,
      saveDate: new Date().toISOString().slice(0,10), // YYYY-MM-DD
      currentHole: getCurrentHole(),
      gameStarted: isGameStarted(),
      G:{
        bite:    {on:G.bite.on,    val:G.bite.val,    mults:G.bite.mults},
        olympic: {on:G.olympic.on, val:G.olympic.val},
        team:    {on:G.team.on,    val:G.team.val,    chuanVal:G.team.chuanVal,
                  mode:G.team.mode, swapType:G.team.swapType,
                  baseTeams:G.team.baseTeams, domoTeams:G.team.domoTeams},
        farNear: {on:G.farNear.on, val:G.farNear.val},
        turbo:   {on:G.turbo.on,   holes:[...G.turbo.holes], mult:G.turbo.mult},
        doubleRe:{on:G.doubleRe.on,mults:G.doubleRe.mults},
        srikrung:{on:G.srikrung.on},
        hcap:    {on:G.hcap.on,    pairs:G.hcap.pairs.map(p => ({...p}))}
      },
      olympicData, farNearData, srikrungData,
      skipData: skipData.map(row => row.map(s => [...s])),
      teamSoloPlayers: [...teamSoloPlayers],
      courseName: document.getElementById('course-name')?.value,
      gameDate:   document.getElementById('game-date')?.value
    }));
    scheduleBackup(); // debounce backup 10 วิ
  } catch(e){}
}

export function loadSession(){
  try{
    const raw = localStorage.getItem(LS_KEY); if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data?.v || !data.players?.length) return false;
    // ตรวจข้ามวัน — ถ้าบันทึกคนละวัน ล้างอัตโนมัติ
    const today = new Date().toISOString().slice(0,10);
    if(data.saveDate && data.saveDate !== today){
      localStorage.removeItem(LS_KEY);
      return false;
    }
    setPlayers(data.players);
    setScores(data.scores);
    pars.splice(0, pars.length, ...data.pars);
    setCurrentHole(data.currentHole || 0);
    setGameStarted(data.gameStarted);
    if(data.gameStarted) _lockDragonToggle(true);

    olympicData.splice(0, olympicData.length,
      ...(data.olympicData || Array(18).fill(null).map(() => ({order:[],status:{}}))));
    farNearData.splice(0, farNearData.length,
      ...(data.farNearData || Array(18).fill(null).map(() => ({mode:'none',far:null,near:null,farSank:null,nearSank:null,solo:null,soloSank1:null,soloSank2:null}))));
    srikrungData.splice(0, srikrungData.length,
      ...(data.srikrungData || Array(18).fill(null).map(() => players.map(() => ({fw:null,gir:null,putt:1})))));
    skipData.splice(0, skipData.length,
      ...(data.skipData
        ? data.skipData.map(row => row.map(s => {
            const set = new Set(s);
            set.delete('team'); // team ไม่เก็บใน skipData แล้ว — ใช้ teamSoloPlayers แทน
            return set;
          }))
        : Array(18).fill(null).map(() => Array(players.length).fill(null).map(() => new Set()))));
    teamSoloPlayers.clear();
    (data.teamSoloPlayers || []).forEach(v => teamSoloPlayers.add(v));

    const gd = data.G;
    if(gd){
      Object.assign(G.bite,    gd.bite);
      G.bite.mults = {...{hio:10,albatross:5,eagle:3,birdie:2}, ...(gd.bite?.mults||{})};
      // migrate: ถ้า mults เป็น default เก่า → อัปเกรดเป็น default ใหม่
      if(G.bite.mults.hio===50) G.bite.mults.hio=10;
      if(G.bite.mults.albatross===4) G.bite.mults.albatross=5;
      Object.assign(G.olympic, gd.olympic);
      Object.assign(G.team,    gd.team);
      Object.assign(G.farNear, gd.farNear);
      Object.assign(G.turbo,   gd.turbo);
      G.turbo.holes = new Set(gd.turbo?.holes || []);
      Object.assign(G.doubleRe,gd.doubleRe);
      if(gd.srikrung) Object.assign(G.srikrung, gd.srikrung);
      if(gd.hcap){ Object.assign(G.hcap, gd.hcap); setTimeout(buildHcapUI, 300); }
    }

    const cnEl = document.getElementById('course-name');
    const gdEl = document.getElementById('game-date');
    if(data.courseName && cnEl) cnEl.value = data.courseName;
    if(data.gameDate   && gdEl) gdEl.value = data.gameDate;

    // ── ใส่ชื่อ/HCP กลับเข้าช่อง Setup ──
    const numEl = document.getElementById('num-players');
    if(numEl) numEl.value = players.length;
    renderPlayerRows();
    setTimeout(()=>{
      const pns = document.querySelectorAll('.pn');
      const phs = document.querySelectorAll('.ph');
      players.forEach((p,i)=>{
        if(pns[i]) pns[i].value = p.name;
        if(phs[i]) phs[i].value = p.hcp ?? 0;
      });
    }, 50);

    updateBiteMultUI();
    buildParGrid();
    buildProgressBar();
    showHole(getCurrentHole());
    goTab('scorecard');
    return true;
  } catch(e){ localStorage.removeItem(LS_KEY); return false; }
}

export function clearSession(){ try{ localStorage.removeItem(LS_KEY); } catch(e){} }

export async function initRestoreBtn(){
  try{
    const online = JSON.parse(localStorage.getItem('golfmate_online')||'{}');
    const room = online.room || '';
    if(!room || room==='DEFAULT') return;
    const today = new Date().toISOString().split('T')[0].replace(/-/g,'');
    const res = await fetch(`${FB_URL}/backup/${today}/${room}/session.json`);
    if(!res.ok) return;
    const data = await res.json();
    if(!data?.players?.length) return;
    const names = data.players.map(p=>p.name).join(', ');
    const holes = data.scores?.[0]?.filter(v=>v!==null).length||0;
    const dateStr = data.gameDate ? new Date(data.gameDate).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : '';
    const btn=document.getElementById('restore-game-btn');
    const roomLbl=document.getElementById('restore-room-lbl');
    const infoLbl=document.getElementById('restore-info-lbl');
    if(btn){ btn.style.display='block'; }
    if(roomLbl) roomLbl.textContent = room;
    if(infoLbl) infoLbl.textContent = `${dateStr} · ${names} · ${holes}/18 หลุม`;
  }catch(e){}
}

export function clearGameData(){
  if(!confirm('ล้างข้อมูลเกมเก่า?\n\nสกอร์ในเครื่องจะหาย\n(Firebase backup ยังอยู่ — กู้คืนได้ภายหลัง)')) return;
  localStorage.removeItem(LS_KEY);
  setPlayers([]); setScores([]); setCurrentHole(0); setGameStarted(false);
  location.reload();
}
export function autoSave(){ saveSession(); }

// ============================================================
// V12.1 — SHARE COURSE PAR
// ============================================================
export async function shareCourseParToFirebase(){
  const btn = document.getElementById('par-share-btn');
  const warn = document.getElementById('par-warning');
  if(btn){ btn.textContent='⟳ กำลังบันทึก...'; btn.disabled=true; }
  await syncCourseParToFirebase();
  if(btn){ btn.textContent='✅ บันทึกแล้ว!'; setTimeout(()=>{ btn.textContent='💾 บันทึกและแชร์ Par ให้ทุกคน'; btn.disabled=false; btn.style.display='none'; },2000); }
  if(warn) warn.style.display='none';
}

// build Par input grids ใน modal เพิ่มสนาม
function _buildModalParGrids(){
  const front = document.getElementById('ac-front-grid');
  const back  = document.getElementById('ac-back-grid');
  const nine  = document.getElementById('ac-9hole-grid');
  const alPar = document.getElementById('al-par-grid');
  const inp   = ()=>`<input type="number" min="3" max="6" value="4" class="ac-par-input"
    style="width:100%;text-align:center;padding:5px 2px;font-size:14px;border-radius:6px;
    border:1px solid var(--bg4);background:var(--bg3);color:var(--lbl);box-sizing:border-box">`;
  if(front) front.innerHTML = Array(9).fill(inp()).join('');
  if(back)  back.innerHTML  = Array(9).fill(inp()).join('');
  if(nine)  nine.innerHTML  = Array(9).fill(inp()).join('');
  if(alPar) alPar.innerHTML = Array(9).fill(inp()).join('');
}

// ============================================================
// SHARE
// ============================================================
export async function shareToLine(tid){
  const ov = document.getElementById('saving-ov');
  if(ov) ov.classList.add('show');
  try{
    const L = document.body.classList.contains('light');
    const A4_W = 794;
    const n = players.length;
    const HW=46, PW=38, NW_MAX=Math.round((A4_W-32-HW-PW)/8);
    const nW = NW_MAX;
    const tblW = Math.min(HW+PW+n*nW, A4_W-32);
    const par9a=pars.slice(0,9).reduce((a,b)=>a+b,0);
    const par9b=pars.slice(9).reduce((a,b)=>a+b,0);
    const cn=document.getElementById('course-name')?.value||'ไม่ระบุสนาม';
    const ds=fmtDate(document.getElementById('game-date')?.value||'');

    const thBg=L?'#1a4a8a':'#1a3a6e', thCl=L?'#fff':'#ffd700';
    const tdBd=L?'1px solid #bbb':'1px solid #333';
    const rowO=L?'#fff':'#131f30', rowE=L?'#f5f7fa':'#0f1a28';
    const hcBg=L?'#eef2fa':'#0a1520', hcCl=L?'#555':'#ffd700';
    const subBg=L?'#ddeeff':'rgba(255,215,0,0.1)', subCl=L?'#1a4a8a':'#ffd700';
    const totBg=L?'#1a4a8a':'rgba(255,215,0,0.22)', totCl=L?'#fff':'#ffd700';
    const ovP=L?'#cc4400':'#ff9966', ovN=L?'#004fc4':'#4da3ff';
    const totOvP=L?'#ffbb88':'#ff9966', totOvN=L?'#88ddff':'#4da3ff';

    function scHTML(s,par){
      if(s===null||s===undefined) return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="font-size:20px;color:rgba(150,150,150,.3)">—</span></td>`;
      const d=s-par;
      const overCl=L?'#111':'rgba(255,255,255,.9)'; // Bogey/Double/เละ สีเข้ม อ่านง่าย
      if(d>=1) return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="font-size:24px;font-weight:700;color:${overCl}">${s}</span></td>`;
      if(d===0) return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="font-size:24px;font-weight:800;color:${L?'#004fc4':'#4da3ff'}">${s}</span></td>`;
      const bg=d===-1?(L?'#cc0000':'#7a1a1a'):d===-2?(L?'#004fc4':'#1a3560'):(L?'#8a5c00':'#7a5800');
      const cl=d===-1?(L?'#fff':'#ff8080'):d===-2?(L?'#fff':'#60b4ff'):'#fff';
      return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;font-size:16px;font-weight:800;background:${bg};color:${cl}">${s}</span></td>`;
    }
    function ovDiv(d,tot){
      const oc=d>0?(tot?totOvP:ovP):d<0?(tot?totOvN:ovN):'rgba(150,150,150,.6)';
      const ot=d===0?'E':(d>0?'+':'')+d;
      return`<div style="font-size:10px;font-weight:700;color:${oc}">เกิน ${ot}</div>`;
    }

    const thS=`background:${thBg};color:${thCl};border:1px solid #333;padding:9px 2px;font-size:13px;font-weight:700;text-align:center`;
    const colgroup=`<colgroup><col style="width:${HW}px"><col style="width:${PW}px">${players.map(()=>`<col style="width:${nW}px">`).join('')}</colgroup>`;
    const thead=`<thead><tr><th style="${thS}">H</th><th style="${thS}">P</th>${players.map(p=>`<th style="${thS};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:0">${p.name.slice(0,4)}</th>`).join('')}</tr></thead>`;

    let tbody='<tbody>';
    for(let h=0;h<18;h++){
      const par=pars[h], bg=h%2===0?rowO:rowE;
      tbody+=`<tr style="background:${bg}"><td style="background:${hcBg};color:${hcCl};border:${tdBd};padding:8px 2px;font-size:13px;font-weight:600;text-align:center">${h+1}</td><td style="background:${hcBg};color:${hcCl};border:${tdBd};padding:8px 2px;font-size:13px;font-weight:600;text-align:center">${par}</td>${players.map((_,p)=>scHTML(scores[p][h],par)).join('')}</tr>`;
      if(h===8){
        const f9s=players.map((_,p)=>({v:scores[p].slice(0,9).reduce((s,v)=>s+(v||0),0),valid:scores[p].slice(0,9).some(v=>v!==null)}));
        tbody+=`<tr style="background:${subBg}"><td colspan="2" style="border:1px solid ${L?'#999':'#444'};padding:8px 2px;font-size:13px;font-weight:800;color:${subCl};text-align:center">9 แรก</td>${f9s.map(({v,valid})=>{const d=v-par9a;return`<td style="border:1px solid ${L?'#999':'#444'};padding:6px 2px;text-align:center;background:${subBg}">${valid?`<div style="font-size:18px;font-weight:800;color:${subCl}">${v}</div>${ovDiv(d,false)}`:`<span style="font-size:18px;color:rgba(150,150,150,.4)">—</span>`}</td>`;}).join('')}</tr>`;
      }
    }
    const b9s=players.map((_,p)=>scores[p].slice(9).reduce((s,v)=>s+(v||0),0));
    const tots=players.map((_,p)=>scores[p].reduce((s,v)=>s+(v||0),0));
    tbody+=`<tr style="background:${subBg}"><td colspan="2" style="border:1px solid ${L?'#999':'#444'};padding:8px 2px;font-size:13px;font-weight:800;color:${subCl};text-align:center">9 หลัง</td>${b9s.map((v,p)=>{const valid=scores[p].slice(9).some(s=>s!==null);const d=v-par9b;return`<td style="border:1px solid ${L?'#999':'#444'};padding:6px 2px;text-align:center;background:${subBg}">${valid?`<div style="font-size:18px;font-weight:800;color:${subCl}">${v}</div>${ovDiv(d,false)}`:`<span style="font-size:18px;color:rgba(150,150,150,.4)">—</span>`}</td>`;}).join('')}</tr>`;
    tbody+=`<tr style="background:${totBg}"><td colspan="2" style="border:1px solid #333;padding:9px 2px;font-size:13px;font-weight:800;color:${totCl};text-align:center">รวม</td>${tots.map((v,p)=>{const pl=pars.reduce((s,pv,h)=>s+(scores[p][h]!==null&&scores[p][h]!==undefined?pv:0),0);const d=v-pl;return`<td style="border:1px solid #333;padding:6px 2px;text-align:center;background:${totBg}"><div style="font-size:22px;font-weight:800;color:${totCl}">${v}</div>${ovDiv(d,true)}</td>`;}).join('')}</tr></tbody>`;

    const html=`<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid ${L?'rgba(0,0,0,0.1)':' rgba(255,255,255,0.08)'}"><img src="data:image/png;base64,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" style="width:48px;height:48px;border-radius:12px;flex-shrink:0"><div style="text-align:center;flex:1;padding:0 12px"><div style="font-size:11px;font-weight:800;letter-spacing:3px;color:${L?'#1a4a8a':'#ffd700'};text-transform:uppercase">SCORE CARD</div><div style="font-size:10px;font-weight:500;color:${L?'#555':'#aaa'};margin-top:3px">GolfMate · Keep Playing. Keep Winning.</div></div><div style="text-align:right"><div style="font-size:16px;font-weight:800;color:${L?'#111':'#fff'}">${cn}</div><div style="font-size:11px;color:${L?'#888':'#555'};margin-top:2px">${ds}</div></div></div><div style="display:flex;justify-content:center;border-radius:12px;overflow:hidden;margin-bottom:14px"><table style="width:${tblW}px;border-collapse:collapse;table-layout:fixed">${colgroup}${thead}${tbody}</table></div><div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1a6a3a,#2d9e5c);border-radius:12px"><span style="font-size:22px">⛳</span><div style="flex:1;font-size:12px;font-weight:700;color:#fff">ประกันกอล์ฟ ครอบคลุม Hole-in-One<br><span style="font-size:10px;opacity:.8">ศรีกรุงโบรคเกอร์ · www.ศรีกรุง.com</span></div><span style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.2);border:1.5px solid rgba(255,255,255,0.5);color:#fff;font-size:11px;font-weight:700">ดูเลย</span></div>`;

    const wrap=document.createElement('div');
    wrap.style.cssText=`position:fixed;left:-9999px;top:0;width:${A4_W}px;padding:16px;font-family:'Noto Sans Thai',-apple-system,sans-serif;background:${L?'#f2f2f7':'#111827'};z-index:-1;box-sizing:border-box`;
    wrap.innerHTML=html;
    document.body.appendChild(wrap);

    const c=await html2canvas(wrap,{backgroundColor:L?'#f2f2f7':'#111827',scale:2,useCORS:true,logging:false,width:A4_W});
    document.body.removeChild(wrap);

    c.toBlob(async b=>{
      const f=new File([b],'golfmate.png',{type:'image/png'});
      if(ov) ov.classList.remove('show');
      if(navigator.canShare&&navigator.canShare({files:[f]})){
        try{ await navigator.share({files:[f]}); }catch(e){}
      } else { alert('ไม่สามารถแชร์ตรงๆ ได้ โปรดบันทึกหน้าจอแทนครับ'); }
    },'image/png');
  } catch(e){ if(ov) ov.classList.remove('show'); }
}

// ── EXPOSE ทันทีที่ module โหลด (ไม่รอ DOMContentLoaded) ──
// เพื่อให้ HTML onclick เรียกได้ก่อน DOM ready
Object.assign(window, {
  setToday, fmtDate, toggleSw, toggleSkipPlayer, toggleSkipGame,
  toggleTeamSolo, toggleTeamScorecard, setTeamMode, setH2HSize, startGame, newGame,
  showAddPlayerModal, hideAddPlayerModal, confirmAddPlayer,
  updateAddPlayerBtn, saveSession, loadSession, clearSession, clearGameData, initRestoreBtn, autoSave,
  shareToLine,
  changeCoursePreset, applyParsFromPreset, loadCoursesDropdown,
  showAddCourseModal, hideAddCourseModal, toggleCourseTypeUI, confirmAddCourse,
  onProvinceChange,
  shareCourseParToFirebase,
  goTab, goGuide, goResults, goMoney, switchResultsTab, showMoneyDetail,
  buildParGrid, renderPlayerRows, buildTurboGrid,
  buildProgressBar, updateProgressBar, holeNav, toggleTH,
  chScore, startRpt, stopRpt, sws, swm, swe, setParAll, chPar, drSet,
  toggleGameMidPlay, olyAct, olyReset, olyRenderHole,
  fnChangeMode, fnToggleSank, fnSelectPlayer, fnRenderHole,
  toggleBiteMult, setBiteMult, updateBiteMultUI,
  setHoleMatrixPill, setMatrixPill, lbToggleMatrix,
  hcapTogglePair, hcapFlipDir, hcapSetStroke, hcapSetField, buildHcapUI,
  sgToggle, sgChPutt, sgSetPutt1,
  goLeaderboard, lbGoPrev, lbGoNext, lbSetTab, lbSetRoom, lbFetch,
  toggleSyncSw, updateRoomCode, autoGenRoomCode,
  // Dragon Golf V13
  toggleDragon, isDragonOn, renderDragonSection, renderPotSummary,
  buildDragonPotHTML, calcDragonTeamScores,
  goOnlineSetup, saveOnlineSetup, testConnection, createRoom,
  joinRoomLookup, selectJoinPlayer,
  showExportModal, hideExportModal, setExportWho, doExport,
  toggleTheme, _refreshOlyInline, toggleSkipSection, toggleMatrixSection, chParNav,
});

// ── COLLAPSE HELPERS ──
export function toggleSkipSection(h){
  const body=document.getElementById(`skip-body-${h}`);
  const arr=document.getElementById(`skip-arr-${h}`);
  if(!body||!arr)return;
  const open=body.style.display==='block';
  body.style.display=open?'none':'block';
  arr.textContent=open?'▶':'▼';
}
export function toggleMatrixSection(h){
  const body=document.getElementById(`sum-rows-${h}`);
  const pills=document.getElementById(`sum-pills-${h}`);
  const arr=document.getElementById(`mx-arr-${h}`);
  if(!body)return;
  const open=body.style.display==='none'||body.style.display==='';
  body.style.display=open?'block':'none';
  if(pills)pills.style.display=open?'flex':'none';
  if(arr)arr.textContent=open?'▼':'▶';
}

// ── chParNav: แก้ PAR จาก nav bar ──
export function chParNav(d){
  const h = getCurrentHole();
  chPar(h, d);
}
