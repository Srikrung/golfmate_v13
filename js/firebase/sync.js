// ============================================================
// firebase/sync.js — syncToFirebase, syncToSheets, syncAll, registerAllPlayers
// ============================================================
import { FB_URL } from '../config.js';
import { getRoomCode, getApiUrl, showSyncBar,
         syncEnabled, joinMode, joinPlayerName } from './init.js';
import {} from './room.js';
import { fetchWithTimeout } from './init.js';

// ── state ที่ใช้ร่วมกัน (import จาก config) ──
import { players, scores, pars, srikrungData, G,
         olympicData, farNearData, skipData, teamSoloPlayers,
         LS_KEY, autoSave } from '../config.js';

export async function syncToFirebase(){
  const room=getRoomCode();
  if(!room||room==='DEFAULT')return;
  const cn=document.getElementById('course-name').value||'—';
  const gameDate=document.getElementById('game-date').value||new Date().toISOString().split('T')[0];
  const safeDateKey=gameDate.replace(/-/g,'');

  players.forEach(async(pl,p)=>{
    const scores18=scores[p];
    const hcp=pl.hcp||0;
    const total=scores18.reduce((s,v)=>s+(v||0),0);
    const net=total-hcp;
    const holesPlayed=scores18.filter(v=>v!==null).length;
    const sg=G.srikrung.on?(srikrungData.map(h=>h[p]||{fw:null,gir:null,putt:0})):[];
    const payload={
      room, name:pl.name, hcp, course:cn, gameDate,
      scores:scores18, pars, holesPlayed, total, net,
      fw:sg.reduce((s,h)=>s+(h&&h.fw?1:0),0),
      gir:sg.reduce((s,h)=>s+(h&&h.gir?1:0),0),
      putt:sg.some(h=>h&&h.putt!==null)?sg.reduce((s,h)=>s+(h&&h.putt!==null?h.putt:0),0):null,
      srikrung:sg, updatedAt:Date.now()
    };
    const safeName=pl.name.replace(/[.#$/[\]]/g,'_');
    const path=`scores/${safeDateKey}/${room}/${safeName}.json`;
    try{
      showSyncBar('⟳ กำลัง Sync...','rgba(10,132,255,0.9)',0);
      const res=await fetch(`${FB_URL}/${path}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(res.ok){showSyncBar(`✓ Sync สำเร็จ`,'rgba(48,209,88,0.9)',2000);}
      else{showSyncBar('⚠ Sync ล้มเหลว','rgba(255,159,10,0.9)',2500);}
    }catch(e){showSyncBar('✗ ไม่มีสัญญาณ','rgba(255,69,58,0.9)',2500);}
  });
}

export async function syncToSheets(){
  const url=getApiUrl();
  if(!url||!url.startsWith('http'))return;
  const room=getRoomCode();
  const cn=document.getElementById('course-name').value||'—';
  players.forEach(async(pl,p)=>{
    const payload={
      action:'sync', room, name:pl.name, hcp:pl.hcp||0, course:cn, pars,
      scores:scores[p],
      gameDate:document.getElementById('game-date').value||new Date().toISOString().split('T')[0],
      srikrung:G.srikrung.on?(srikrungData.map(h=>h[p]||{fw:null,gir:null,putt:0})):[]
    };
    try{await fetch(url,{method:'POST',body:JSON.stringify(payload)});}catch(e){}
  });
}

export function syncAll(){
  if(joinMode) syncJoinToFirebase();
  else syncToFirebase();
  syncToSheets();
}

export async function createRoom(){
  const room=getRoomCode();
  if(!room||room==='DEFAULT'){
    showSyncBar('⚠ กรุณาเลือก Room Code ก่อน','rgba(255,159,10,0.9)',3000); return;
  }
  const cn=document.getElementById('course-name')?.value||'—';
  const gameDate=document.getElementById('game-date')?.value||new Date().toISOString().split('T')[0];
  const safeDateKey=gameDate.replace(/-/g,'');

  // ดึงชื่อจาก players array ถ้ามี ถ้าไม่มีดึงจาก DOM
  let myNames=players.map(p=>p.name).filter(Boolean);
  if(!myNames.length){
    myNames=[...document.querySelectorAll('.pn')]
      .map(el=>el.value.trim()||el.placeholder||'')
      .filter(Boolean)
      .slice(0, +document.getElementById('num-players')?.value||4);
  }

  showSyncBar('⟳ กำลังสร้างห้อง...','rgba(10,132,255,0.9)',0);
  try{
    await fetchWithTimeout(`${FB_URL}/scores/${safeDateKey}/${room}/_room_config.json`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({players:myNames,course:cn,createdAt:Date.now(),dateKey:safeDateKey})
    },8000);
    showSyncBar(`✅ สร้างห้อง ${room} สำเร็จ · ${myNames.length} คน · คนอื่นค้นหาเจอแล้ว`,'rgba(48,209,88,0.9)',4000);
    // sync สกอร์ขึ้นด้วยถ้าเกมเริ่มแล้ว
    if(players.length) syncToFirebase();
    // auto-reload room list
    setTimeout(()=>{ if(window.loadOnlineRooms) window.loadOnlineRooms(); }, 800);
  }catch(e){
    showSyncBar('❌ สร้างห้องไม่สำเร็จ — ตรวจสอบสัญญาณ','rgba(255,69,58,0.9)',3000);
  }
}

// import นี้อยู่ด้านล่างเพื่อหลีกเลี่ยง circular import
import { syncJoinToFirebase } from '../modules/join.js';

// ── ลบห้องทั้งหมดออกจาก Firebase (Host only) ──
export async function deleteRoomFromFirebase(roomParam){
  const statusEl = document.getElementById('delete-player-status');
  const show = (msg, color) => {
    if(!statusEl) return;
    statusEl.style.display='block';
    statusEl.style.background=color;
    statusEl.style.color='#fff';
    statusEl.textContent=msg;
  };
  let room='', safeDateKey='';
  try{
    // ใช้ roomParam ถ้ามี (กดจาก room list) ไม่งั้นดึงจาก localStorage
    room = roomParam || JSON.parse(localStorage.getItem('golfmate_online')||'{}').room || '';
    const raw = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    const gameDate = raw.gameDate || document.getElementById('game-date')?.value
      || new Date().toISOString().split('T')[0];
    safeDateKey = gameDate.replace(/-/g,'');
  }catch(e){}
  if(!room||room==='DEFAULT'){
    show('❌ ไม่พบ Room Code — ตั้งค่าออนไลน์ก่อน','rgba(255,69,58,0.9)'); return;
  }
  if(!confirm(`ลบห้อง "${room}" ?\n\n• สกอร์บน Firebase — หายถาวร\n• สกอร์ในเครื่องนี้ — หายด้วย\n\nยืนยันลบ?`)) return;
  show('⟳ กำลังลบ...','rgba(255,69,58,0.9)');
  try{
    await fetchWithTimeout(`${FB_URL}/scores/${safeDateKey}/${room}.json`,{method:'DELETE'},8000);
    await fetchWithTimeout(`${FB_URL}/backup/${safeDateKey}/${room}.json`,{method:'DELETE'},8000);
    show(`✅ ลบห้อง "${room}" สำเร็จ — สร้างห้องใหม่ได้เลย`,'rgba(48,209,88,0.9)');
    // ล้าง localStorage (สกอร์ในเครื่อง)
    try{ localStorage.removeItem(LS_KEY); }catch(e){}
    // auto-reload room list
    setTimeout(()=>{ if(window.loadOnlineRooms) window.loadOnlineRooms(); }, 800);
    // รีเซ็ต Room Code กลับค่าเริ่มต้น (เฉพาะถ้าลบห้องตัวเอง)
    const el1=document.getElementById('room-code-letter');
    const el2=document.getElementById('room-code-num');
    const el3=document.getElementById('room-code-num2');
    const preview=document.getElementById('room-code-preview');
    const hidden=document.getElementById('room-code');
    if(el1) el1.value='';
    if(el2) el2.value='';
    if(el3) el3.value='';
    if(preview) preview.textContent='—';
    if(hidden) hidden.value='';
  }catch(e){
    show(e.name==='AbortError'?'⌛ หมดเวลา':'❌ ลบไม่สำเร็จ','rgba(255,69,58,0.9)');
  }
}

export async function syncFullBackup(){
  const room = getRoomCode();
  if(!room || room==='DEFAULT') return;
  const gameDate = document.getElementById('game-date')?.value
    || new Date().toISOString().split('T')[0];
  const safeDateKey = gameDate.replace(/-/g,'');

  const payload = {
    v: 1,
    players, scores, pars,
    currentHole: (() => {
      try{ return JSON.parse(localStorage.getItem(LS_KEY)||'{}').currentHole||0; }catch(e){return 0;}
    })(),
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
      hcap:    {on:G.hcap.on,    pairs:G.hcap.pairs.map(p=>({...p}))}
    },
    olympicData,
    farNearData,
    srikrungData,
    skipData: skipData.map(row => row.map(s => [...s])),
    teamSoloPlayers: [...teamSoloPlayers],
    courseName: document.getElementById('course-name')?.value || '—',
    gameDate,
    backedUpAt: Date.now(),
    // Dragon Golf V13
    dragon: G.dragon?.on ? (() => {
      try{
        const calcDragonTeamScores = window.calcDragonTeamScores;
        const dragonData = window.dragonData;
        const teamPts = calcDragonTeamScores ? calcDragonTeamScores() : {};
        const n = players.length;
        const pot = {};
        if(window.calcPlayerPot){
          let w=0,s=0,p3=0,b=0,m=0,st=0;
          for(let i=0;i<n;i++){ const pp=window.calcPlayerPot(i); if(pp){w+=pp.water;s+=pp.sand;p3+=pp.putt3;b+=pp.birdie;m+=pp.mul;st+=pp.settamaa;} }
          Object.assign(pot,{water:w,sand:s,putt3:p3,birdie:b,mul:m,settamaa:st});
        }
        return { on:true, teamPts, pot, mulligan: dragonData?.mulligan };
      }catch(e){ return {on:true}; }
    })() : {on:false}
  };

  try{
    await fetchWithTimeout(
      `${FB_URL}/backup/${safeDateKey}/${room}/session.json`,
      { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) },
      8000
    );
  } catch(e){ /* silent fail — ไม่รบกวน UX */ }
}

// ── RESTORE จาก Firebase ──
export async function restoreFromFirebase(silent=false){
  const statusEl = document.getElementById('restore-status');
  const show = (msg, color) => {
    if(!statusEl) return;
    statusEl.style.display='block';
    statusEl.style.background=color;
    statusEl.style.color='#fff';
    statusEl.textContent=msg;
  };

  show('⟳ กำลังค้นหาข้อมูล...', 'rgba(10,132,255,0.9)');

  // ดึง room + date จาก localStorage อัตโนมัติ
  let room='', safeDateKey='';
  try{
    const saved = JSON.parse(localStorage.getItem('golfmate_online')||'{}');
    room = saved.room||'';
    const raw = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    const gameDate = raw.gameDate || document.getElementById('game-date')?.value
      || new Date().toISOString().split('T')[0];
    safeDateKey = gameDate.replace(/-/g,'');
  } catch(e){}

  // ถ้าไม่มีใน LS
  if(!room || room==='DEFAULT'){
    if(silent) return; // auto mode — ไม่ถาม
    room = prompt('กรอก Room Code (เช่น A12):');
    if(!room){ show('❌ ยกเลิก','rgba(255,69,58,0.9)'); return; }
    const dateInput = prompt('กรอกวันที่ (YYYY-MM-DD):');
    if(!dateInput){ show('❌ ยกเลิก','rgba(255,69,58,0.9)'); return; }
    safeDateKey = dateInput.replace(/-/g,'');
  }

  try{
    const res = await fetchWithTimeout(
      `${FB_URL}/backup/${safeDateKey}/${room}/session.json`,
      {}, 8000
    );
    if(!res.ok){ show('❌ ไม่พบข้อมูล — ตรวจสอบ Room Code หรือวันที่','rgba(255,69,58,0.9)'); return; }
    const data = await res.json();
    if(!data?.players?.length){ show('❌ ข้อมูลไม่สมบูรณ์','rgba(255,69,58,0.9)'); return; }

    const names = data.players.map(p=>p.name).join(', ');
    const holes = data.scores?.[0]?.filter(v=>v!==null).length || 0;
    const backedAt = data.backedUpAt ? new Date(data.backedUpAt).toLocaleTimeString('th-TH') : '—';

    if(!silent && !confirm(`พบข้อมูล:\n👥 ${names}\n⛳ ${holes}/18 หลุม\n🕐 บันทึกเมื่อ ${backedAt}\n\nกู้คืนเกมนี้ไหมครับ?`)){
      show('ยกเลิกการกู้คืน','rgba(255,159,10,0.9)'); return;
    }

    // บันทึกลง localStorage แล้ว reload
    localStorage.setItem(LS_KEY, JSON.stringify({...data, v:1}));
    show('✅ กู้คืนสำเร็จ! กำลังโหลด...','rgba(48,209,88,0.9)');
    setTimeout(()=>window.location.reload(), 1200);

  } catch(e){
    if(e.name==='AbortError') show('⌛ หมดเวลา — ตรวจสอบสัญญาณ','rgba(255,69,58,0.9)');
    else show('✗ เกิดข้อผิดพลาด','rgba(255,69,58,0.9)');
  }
}
