// ============================================================
// modules/join.js — Join Room
// คนเข้าร่วม: กรอก Room Code → เลือกชื่อจาก Firebase dropdown
// sync เฉพาะ fw, gir, putt, srikrung (ไม่แตะ score fields)
// ============================================================
import { FB_URL } from '../config.js';
import { players, srikrungData, G, LS_KEY } from '../config.js';
import { getRoomCode, showSyncBar, syncEnabled, fetchWithTimeout } from '../firebase/init.js';
import { getRoomConfig } from '../firebase/room.js';

// ── state ──
let _joinMode = false;
let _joinPlayerName = '';

export function isJoinMode(){ return _joinMode; }
export function getJoinPlayerName(){ return _joinPlayerName; }
export function setJoinMode(v){ _joinMode = v; }
export function setJoinPlayerName(v){ _joinPlayerName = v; }

export async function joinRoomLookup(){
  const room = getRoomCode();
  if(!room || room==='DEFAULT'){
    const s = document.getElementById('join-status');
    if(!s) return;
    s.style.display='block';
    s.style.background='rgba(255,69,58,0.12)';
    s.style.color='var(--red)';
    s.textContent='⚠️ กรุณาเลือก Room Code ก่อน';
    return;
  }
  const gameDate = document.getElementById('game-date')?.value || new Date().toISOString().split('T')[0];
  const safeDateKey = gameDate.replace(/-/g,'');
  const s = document.getElementById('join-status');
  if(s){
    s.style.display='block';
    s.style.background='rgba(10,132,255,0.1)';
    s.style.color='var(--blue)';
    s.textContent='⟳ กำลังค้นหาห้อง...';
  }

  let config;
  try{
    config = await getRoomConfig(room, safeDateKey);
  }catch(e){
    if(s){
      s.style.background='rgba(255,69,58,0.12)';
      s.style.color='var(--red)';
      s.textContent='❌ หมดเวลา — ตรวจสอบสัญญาณ แล้วลองใหม่';
    }
    return;
  }

  if(!config || config.dateKey !== safeDateKey){
    if(s){
      s.style.background='rgba(255,69,58,0.12)';
      s.style.color='var(--red)';
      s.textContent=`❌ ไม่พบห้อง ${room} วันนี้ — กรุณาตรวจสอบ Room Code`;
    }
    const list = document.getElementById('join-player-list');
    if(list) list.style.display='none';
    return;
  }

  const names = config.players || [];
  if(s) s.style.display='none';
  const list = document.getElementById('join-player-list');
  const namesDiv = document.getElementById('join-names');
  if(!namesDiv) return;

  namesDiv.innerHTML = names.map(n=>`
    <button onclick="selectJoinPlayer('${n.replace(/'/g,"\\'")}')"
      id="join-btn-${n.replace(/[^a-zA-Z0-9ก-ฮ]/g,'_')}"
      style="padding:10px 14px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
      border:1.5px solid ${_joinPlayerName===n?'var(--green)':'var(--bg4)'};
      background:${_joinPlayerName===n?'rgba(48,209,88,0.12)':'var(--bg3)'};
      color:${_joinPlayerName===n?'var(--green)':'var(--lbl)'};text-align:left">
      ${_joinPlayerName===n?'✓ ':''} ${n}
    </button>`).join('');
  if(list) list.style.display='block';
}

export function selectJoinPlayer(name){
  _joinMode = true;
  _joinPlayerName = name;
  const s = document.getElementById('join-status');
  if(s){
    s.style.display='block';
    s.style.background='rgba(48,209,88,0.12)';
    s.style.color='var(--green)';
    s.textContent=`✅ เลือกแล้ว: ${name} — กด "บันทึกการตั้งค่า" เพื่อเปิดใช้งาน`;
  }
  document.querySelectorAll('#join-names button').forEach(btn=>{
    const n = btn.textContent.trim().replace(/^✓\s*/,'');
    const sel = n === name;
    btn.style.borderColor = sel?'var(--green)':'var(--bg4)';
    btn.style.background  = sel?'rgba(48,209,88,0.12)':'var(--bg3)';
    btn.style.color       = sel?'var(--green)':'var(--lbl)';
    btn.textContent       = (sel?'✓ ':'')+n;
  });
}

// ── กู้คืน FW/GIR/PUTT — LS ก่อน ถ้าไม่มีดึง Firebase ──
export async function restoreJoinSrikrung(){
  const statusEl = document.getElementById('restore-join-status');
  const show = (msg, color) => {
    if(!statusEl) return;
    statusEl.style.display='block';
    statusEl.style.background=color;
    statusEl.style.color='#fff';
    statusEl.textContent=msg;
  };

  // ดึง room + ชื่อ + วันที่จาก LS อัตโนมัติ
  let room='', joinName='', safeDateKey='';
  try{
    const onlineSaved = JSON.parse(localStorage.getItem('golfmate_online')||'{}');
    room     = onlineSaved.room || '';
    joinName = onlineSaved.joinPlayerName || '';
    const raw = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    const gameDate = raw.gameDate || document.getElementById('game-date')?.value
      || new Date().toISOString().split('T')[0];
    safeDateKey = gameDate.replace(/-/g,'');
  } catch(e){}

  if(!room || !joinName){
    show('❌ ไม่พบข้อมูล Join — กรุณาค้นหาห้องใหม่','rgba(255,69,58,0.9)'); return;
  }

  show(`⟳ กำลังดึง FW/GIR/PUTT ของ "${joinName}"...`, 'rgba(10,132,255,0.9)');

  // ตรวจ localStorage ก่อน (Option A)
  let lsData = null, lsTime = 0;
  try{
    const ls = JSON.parse(localStorage.getItem('golfmate_srikrung')||'{}');
    if(ls.data && ls.updatedAt){ lsData = ls.data; lsTime = ls.updatedAt; }
  }catch(e){}

  // ดึง Firebase (Option B)
  let fbData = null, fbTime = 0;
  try{
    const safeName = joinName.replace(/[.#$/[\]]/g,'_');
    const res = await fetchWithTimeout(
      `${FB_URL}/scores/${safeDateKey}/${room}/${safeName}.json`, {}, 8000
    );
    if(res.ok){
      const d = await res.json();
      if(d?.srikrung){ fbData = d.srikrung; fbTime = d.updatedAt||0; }
    }
  }catch(e){}

  // เลือกอันที่ใหม่กว่า
  const best = (lsTime >= fbTime && lsData) ? lsData : fbData;

  if(!best){
    show('❌ ไม่พบข้อมูล FW/GIR/PUTT','rgba(255,69,58,0.9)'); return;
  }

  // โหลดเข้า srikrungData
  const myIdx = players.findIndex(p=>p.name.trim()===joinName.trim());
  if(myIdx < 0){ show('⚠ ไม่พบชื่อในเกม','rgba(255,159,10,0.9)'); return; }

  best.forEach((hData, h) => {
    if(srikrungData[h]?.[myIdx] && hData){
      srikrungData[h][myIdx] = { ...hData };
    }
  });

  const src = (lsTime >= fbTime && lsData) ? 'localStorage' : 'Firebase';
  show(`✅ กู้คืน FW/GIR/PUTT สำเร็จ (จาก ${src})`, 'rgba(48,209,88,0.9)');
}

export async function syncJoinToFirebase(){
  if(!syncEnabled || !_joinMode || !_joinPlayerName) return;
  const room = getRoomCode();
  if(!room || room==='DEFAULT') return;
  const gameDate = document.getElementById('game-date')?.value || new Date().toISOString().split('T')[0];
  const safeDateKey = gameDate.replace(/-/g,'');

  const myIdx = players.findIndex(p=>p.name.trim()===_joinPlayerName.trim());
  if(myIdx<0){
    showSyncBar('⚠ ไม่พบชื่อ '+_joinPlayerName+' ในเกม','rgba(255,159,10,0.9)',3000);
    return;
  }

  const sg = G.srikrung.on
    ? srikrungData.map(h=>h[myIdx]||{fw:null,gir:null,putt:null})
    : [];
  const payload = {
    fw:  sg.reduce((s,h)=>s+(h&&h.fw?1:0),0),
    gir: sg.reduce((s,h)=>s+(h&&h.gir?1:0),0),
    putt:sg.some(h=>h&&h.putt!==null)
      ? sg.reduce((s,h)=>s+(h&&h.putt!==null?h.putt:0),0)
      : null,
    srikrung: sg,
    updatedAt: Date.now()
  };

  const safeName = _joinPlayerName.replace(/[.#$/[\]]/g,'_');
  try{
    showSyncBar('⟳ Sync FW/GIR/PUTT...','rgba(10,132,255,0.9)',0);
    const res = await fetchWithTimeout(`${FB_URL}/scores/${safeDateKey}/${room}/${safeName}.json`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    }, 8000);
    if(res.ok){
      showSyncBar(`✓ Sync FW/GIR/PUTT สำเร็จ (${_joinPlayerName})`,'rgba(48,209,88,0.9)',2000);
    } else {
      showSyncBar('⚠ Sync ล้มเหลว','rgba(255,159,10,0.9)',2500);
    }
  } catch(e){
    if(e.name==='AbortError'){
      showSyncBar('⌛ หมดเวลา — ตรวจสอบสัญญาณ','rgba(255,69,58,0.9)',3000);
    } else {
      showSyncBar('✗ ไม่มีสัญญาณ','rgba(255,69,58,0.9)',2500);
    }
  }
}

// ── โหลดห้องออนไลน์วันนี้ทั้งหมด ──
export async function loadOnlineRooms(){
  const wrap = document.getElementById('online-rooms-list');
  if(!wrap) return;
  wrap.innerHTML='<div style="text-align:center;color:var(--lbl2);font-size:13px;padding:12px 0">⟳ กำลังโหลด...</div>';

  const gameDate = document.getElementById('game-date')?.value || new Date().toISOString().split('T')[0];
  const safeDateKey = gameDate.replace(/-/g,'');

  try{
    const res = await fetchWithTimeout(`${FB_URL}/scores/${safeDateKey}.json`,{},8000);
    if(!res.ok) throw new Error('fetch fail');
    const data = await res.json();
    if(!data){ wrap.innerHTML='<div style="text-align:center;color:var(--lbl3);font-size:13px;padding:12px 0">ยังไม่มีห้องออนไลน์วันนี้</div>'; return; }

    // จัดกลุ่มตาม room — ใช้ _room_config เป็น source หลัก
    const roomMap={};
    Object.entries(data).forEach(([room,roomData])=>{
      if(!roomData) return;
      // ดึงชื่อจาก _room_config ก่อน (มีทันทีหลัง SAVE GAME)
      const cfg = roomData['_room_config'];
      const names = cfg?.players || [];
      if(!names.length) return;
      // ดึงข้อมูลสกอร์/หลุมเสริม (มีหลังจากกดสกอร์)
      const scoreMap={};
      Object.entries(roomData).forEach(([k,v])=>{
        if(k==='_room_config'||!v||!v.name) return;
        scoreMap[v.name]=v;
      });
      const pList = names.map(name=>({
        name,
        course: scoreMap[name]?.course || cfg?.course || 'ไม่ระบุสนาม',
        holesPlayed: scoreMap[name]?.holesPlayed || 0,
      }));
      roomMap[room]=pList;
    });

    const rooms=Object.keys(roomMap).sort();
    if(!rooms.length){ wrap.innerHTML='<div style="text-align:center;color:var(--lbl3);font-size:13px;padding:12px 0">ยังไม่มีห้องออนไลน์วันนี้</div>'; return; }

    const colors=['rgba(77,163,255','rgba(255,92,82','rgba(52,209,122','rgba(255,159,10','rgba(191,90,242'];
    wrap.innerHTML = rooms.map((room,ri)=>{
      const pList=roomMap[room];
      const course=pList[0]?.course||'ไม่ระบุสนาม';
      const holes=Math.max(...pList.map(p=>p.holesPlayed||0));
      const col=colors[ri%colors.length];
      const names=pList.map(p=>p.name).join(', ');
      return `<div style="border:1px solid var(--bg4);border-radius:10px;margin-bottom:8px;overflow:hidden">
        <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"
          style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;background:var(--bg3)">
          <div style="width:34px;height:34px;border-radius:8px;background:${col},0.15);
            display:flex;align-items:center;justify-content:center;
            font-size:15px;font-weight:800;color:${col},0.9);flex-shrink:0">${ri+1}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--lbl);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${course}</div>
            <div style="font-size:11px;color:var(--lbl2);margin-top:1px">${pList.length} คน · หลุม ${holes}/18</div>
            <div style="font-size:10px;color:var(--lbl3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${names}</div>
          </div>
          <button onclick="event.stopPropagation();deleteRoomFromFirebase('${room}')"
            style="width:32px;height:32px;border-radius:8px;border:none;
            background:rgba(255,69,58,0.1);color:var(--red);font-size:16px;
            cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">
            🗑
          </button>
        </div>
        <div style="display:none;padding:8px 12px 10px;display:flex;flex-wrap:wrap;gap:5px">
          ${pList.map(p=>`
            <button onclick="joinFromRoomList('${room}','${p.name.replace(/'/g,"\\'")}')"
              style="padding:7px 12px;border-radius:999px;border:1.5px solid var(--bg4);
              background:var(--bg3);color:var(--lbl);font-family:inherit;font-size:12px;
              font-weight:700;cursor:pointer">${p.name}</button>
          `).join('')}
        </div>
      </div>`;
    }).join('');

  }catch(e){
    wrap.innerHTML='<div style="text-align:center;color:var(--red);font-size:13px;padding:12px 0">❌ โหลดไม่ได้ — ตรวจสอบสัญญาณ</div>';
  }
}

// ── Join จาก Room List — ถามยืนยัน Room Code ──
let _joinAttempts = 0;
export function joinFromRoomList(room, name){
  _joinAttempts = 0;
  _askRoomCode(room, name);
}

function _askRoomCode(room, name){
  _joinAttempts++;
  const input = prompt(
    `สวัสดี ${name}!\nกรุณากรอก Room Code เพื่อยืนยัน:\n` +
    (_joinAttempts > 1 ? `⚠️ ครั้งที่ ${_joinAttempts}/3 — ถามจาก Host ของคุณถ้าไม่แน่ใจ` : '')
  );
  if(input === null) return; // กด cancel
  if(input.trim().toUpperCase() === room.toUpperCase()){
    // ถูก → Join
    _joinMode = true;
    _joinPlayerName = name;
    const s = document.getElementById('join-status');
    if(s){
      s.style.display='block';
      s.style.background='rgba(48,209,88,0.12)';
      s.style.color='var(--green)';
      s.textContent=`✅ Join สำเร็จ: ${name} · ห้อง ${room} — กด "บันทึกการตั้งค่า"`;
    }
    // highlight ปุ่มที่เลือก
    document.querySelectorAll('#online-rooms-list button').forEach(btn=>{
      const isSelected = btn.textContent.trim()===name;
      btn.style.background = isSelected?'rgba(48,209,88,0.15)':'var(--bg3)';
      btn.style.color = isSelected?'var(--green)':'var(--lbl)';
      btn.style.borderColor = isSelected?'rgba(48,209,88,0.5)':'var(--bg4)';
    });
  } else if(_joinAttempts < 3){
    // ผิด — ลองใหม่
    alert(`❌ Room Code ไม่ถูกต้อง กรุณาลองใหม่`);
    _askRoomCode(room, name);
  } else {
    // ผิด 3 ครั้ง
    alert('❌ Room Code ไม่ถูกต้อง 3 ครั้ง\nกรุณาถาม Host ของคุณโดยตรง');
  }
}
