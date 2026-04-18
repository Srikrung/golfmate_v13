// ============================================================
// firebase/room.js — Room config (lock/unlock/read)
// ============================================================
import { FB_URL } from '../config.js';
import { showSyncBar, getRoomCode, getApiUrl, syncEnabled,
         joinMode, joinPlayerName, setJoinMode, setJoinPlayerName,
         setSyncEnabled, updateRoomCode, fetchWithTimeout } from './init.js';
import { goTab } from '../ui/tabs.js';

export async function getRoomPlayers(room,safeDateKey){
  try{
    const r=await fetchWithTimeout(`${FB_URL}/scores/${safeDateKey}/${room}.json`);
    if(!r.ok)return[];
    const d=await r.json();
    if(!d)return[];
    return Object.entries(d).filter(([k,v])=>k!=='_room_config'&&v&&v.name).map(([,v])=>v.name);
  }catch(e){return[];} 
}

export async function getRoomConfig(room,safeDateKey){
  try{
    const r=await fetchWithTimeout(`${FB_URL}/scores/${safeDateKey}/${room}/_room_config.json`);
    if(!r.ok)return null;
    const d=await r.json();
    return d||null;
  }catch(e){return null;}
}


export function goOnlineSetup(){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.ti').forEach(b=>b.classList.remove('on'));
  document.getElementById('scr-online').classList.add('active');
  document.getElementById('hdr-title').textContent='Online';
  document.getElementById('hdr-sub').textContent='ตั้งค่า Leaderboard';
  try{
    const saved=JSON.parse(localStorage.getItem('golfmate_online')||'{}');
    if(saved.room){
      document.getElementById('room-code').value=saved.room;
      if(saved.room.length>=3){
        document.getElementById('room-code-letter').value=saved.room[0];
        document.getElementById('room-code-num').value=saved.room[1];
        document.getElementById('room-code-num2').value=saved.room[2];
        updateRoomCode();
      }
    }
    if(saved.url)document.getElementById('api-url').value=saved.url;
    if(saved.sync!==undefined){setSyncEnabled(saved.sync);document.getElementById('sw-sync').classList.toggle('on',saved.sync);}
  }catch(e){}
  updateOnlineStatusLabel();window.scrollTo(0,0);
}

export function saveOnlineSetup(){
  const room=getRoomCode();const url=getApiUrl();
  try{localStorage.setItem('golfmate_online',JSON.stringify({room,url,joinMode,joinPlayerName}));}catch(e){}
  updateOnlineStatusLabel();
  if(joinMode){
    const s=document.getElementById('join-status');
    s.style.display='block';s.style.background='rgba(48,209,88,0.12)';s.style.color='var(--green)';
    s.textContent=`✅ บันทึกแล้ว — Join ในฐานะ "${joinPlayerName}" · เปิด Srikrung Golf Day แล้วจด FW/GIR/PUTT ได้เลย`;
  } else {
    goTab('setup');
  }
}

export function updateOnlineStatusLabel(){
  const lbl=document.getElementById('online-status-lbl');if(!lbl)return;
  const room=getRoomCode();
  if(room&&room!=='DEFAULT'){
    lbl.textContent=`Room: ${room} · ☁️ backup พร้อม`;
    lbl.style.color='var(--green)';
  } else {
    lbl.textContent='⚠️ ยังไม่ตั้ง Room Code — ข้อมูลไม่ได้ backup!';
    lbl.style.color='var(--orange,#ff9f0a)';
  }
}

export async function testConnection(){
  const url=getApiUrl();const res=document.getElementById('test-result');
  res.style.display='block';
  if(!url||!url.startsWith('http')){
    res.style.background='rgba(255,69,58,0.15)';res.style.color='var(--red)';res.textContent='กรุณาใส่ URL ก่อน';return;
  }
  res.style.background='rgba(10,132,255,0.1)';res.style.color='var(--blue)';res.textContent='⟳ กำลังทดสอบ...';
  try{
    const r=await fetch(url+'?action=leaderboard');const d=await r.json();
    if(d.ok){res.style.background='rgba(48,209,88,0.15)';res.style.color='var(--green)';res.textContent='✓ เชื่อมต่อสำเร็จ! พบผู้เล่น '+d.players.length+' คน';}
    else{res.style.background='rgba(255,159,10,0.15)';res.style.color='var(--orange)';res.textContent='⚠ ข้อผิดพลาด: '+d.msg;}
  }catch(e){res.style.background='rgba(255,69,58,0.15)';res.style.color='var(--red)';res.textContent='✗ เชื่อมต่อไม่ได้ — ตรวจสอบ URL อีกครั้ง';}
}

export function loadOnlineSetting(){
  try{
    const saved=JSON.parse(localStorage.getItem('golfmate_online')||'{}');
    if(saved.room){
      const r=saved.room;
      document.getElementById('room-code').value=r;
      if(r.length>=3){
        setTimeout(()=>{
          const ls=document.getElementById('room-code-letter');
          const ns=document.getElementById('room-code-num');
          const ns2=document.getElementById('room-code-num2');
          if(ls)ls.value=r[0];if(ns)ns.value=r[1];if(ns2)ns2.value=r[2];
          updateRoomCode();
        },200);
      }
    }
    if(saved.url&&document.getElementById('api-url'))document.getElementById('api-url').value=saved.url;
    if(saved.sync!==undefined)setSyncEnabled(saved.sync);
    if(saved.joinMode){setJoinMode(saved.joinMode);setJoinPlayerName(saved.joinPlayerName||'');}
    setTimeout(updateOnlineStatusLabel,400);
  }catch(e){}
}
