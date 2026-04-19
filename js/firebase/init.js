// ============================================================
// firebase/init.js — toggle sync, room code, sync bar
// ============================================================
import { FB_URL } from '../config.js';

export let syncEnabled = false;
export let joinMode = false;
export let joinPlayerName = '';

export function setSyncEnabled(v){ syncEnabled = v; }
export function setJoinMode(v){ joinMode = v; }
export function setJoinPlayerName(v){ joinPlayerName = v; }

export function toggleSyncSw(){
  syncEnabled=!syncEnabled;
  document.getElementById('sw-sync').classList.toggle('on',syncEnabled);
}
export function updateRoomCode(){
  const l=document.getElementById('room-code-letter').value;
  const n=document.getElementById('room-code-num').value;
  const n2=document.getElementById('room-code-num2').value;
  const code=(l&&n&&n2)?l+n+n2:'';
  document.getElementById('room-code').value=code;
  document.getElementById('room-code-preview').textContent=code||'—';
}
export function getRoomCode(){return(document.getElementById('room-code')?.value||'').trim()||'DEFAULT';}
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbytrMvvaaZ_AsJ2aeEGLDqN23rRVm7Xs6fYzWFSWorDXEf-IPIzB86Roz1nDnE5Us_GHg/exec';
export function getApiUrl(){return(document.getElementById('api-url')?.value||'').trim()||APPS_SCRIPT_URL;}
export function showSyncBar(msg,color,duration=2500){
  const bar=document.getElementById('sync-bar');
  if(!bar)return;
  bar.style.display='block';
  bar.style.background=color;
  bar.style.color='#fff';
  bar.textContent=msg;
  if(duration>0)setTimeout(()=>{bar.style.display='none';},duration);
}

// ── fetch with timeout ──
export function fetchWithTimeout(url, opts={}, ms=8000){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, {...opts, signal:ctrl.signal})
    .finally(()=>clearTimeout(timer));
}
