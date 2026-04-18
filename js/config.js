// ============================================================
// config.js — State และ Config ทั้งหมดของ GolfMate v11
// ใช้ pattern: export reference + setter function
// เพื่อให้ module อื่น import แล้วแก้ค่าได้
// ============================================================

// ── FIREBASE ──
export const FB_URL = 'https://golfmate-4d819-default-rtdb.asia-southeast1.firebasedatabase.app';
export const ROOM_MAX = 8;
export const LS_KEY = 'golfmate_v11';
export const THEME_KEY = 'golfmate_theme';
export const ICONS = {bite:'🐶',olympic:'🏅',team:'🤝',farNear:'🎯',hcap:'🎯'};

// ── COURSE DB ── ย้ายไป Firebase แล้ว (V12.1)
// ดู firebase/courses.js

// ── MUTABLE STATE ──
// ใช้ array/object แบบ mutable เพื่อให้ module อื่น import reference เดียวกัน
export const pars = Array(18).fill(4);
export const players = [];
export const scores = [];
export const olympicData = [];
export const farNearData = [];
export const srikrungData = [];
export const skipData = [];
export const teamSoloPlayers = new Set();

// ── GAME CONFIG ──
export const G = {
  bite:    {on:true, val:20, mults:{hio:50,albatross:4,eagle:3,birdie:2}},
  olympic: {on:false,val:20},
  team:    {on:false,val:20,chuanVal:4,mode:'h2h',swapType:'domo',baseTeams:[],domoTeams:[]},
  farNear: {on:false,val:20},
  turbo:   {on:true, holes:new Set([8,17]),mult:2},
  doubleRe:{on:false,mults:Array(18).fill(1)},
  srikrung:{on:false},
  sync:    {on:true},
  hcap:    {on:false,pairs:[]},
  dragon:  {on:false}
};

// ── PRIMITIVE STATE (ต้องใช้ setter เพราะ JS ส่ง primitive by value) ──
let _gameStarted = false;
let _currentHole = 0;

export function isGameStarted(){ return _gameStarted; }
export function setGameStarted(v){ _gameStarted = v; }
export function getCurrentHole(){ return _currentHole; }
export function setCurrentHole(v){ _currentHole = v; }

// ── Aliases สำหรับ backward compat ──
// ไฟล์อื่นใช้ gameStarted / currentHole โดยตรง ให้ getter แทน
Object.defineProperty(globalThis,'gameStarted',{get:()=>_gameStarted,set:v=>{_gameStarted=v;},configurable:true});
Object.defineProperty(globalThis,'currentHole',{get:()=>_currentHole,set:v=>{_currentHole=v;},configurable:true});

// ── Setter สำหรับ array state (replace content) ──
export function setPlayers(arr){ players.splice(0,players.length,...arr); }
export function setScores(arr){ scores.splice(0,scores.length,...arr); }

// ── DATE HELPERS (shared ไม่ circular) ──
export function fmtDate(v){
  if(!v)return'';const[y,m,d]=v.split('-');
  const mn=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return`${+d} ${mn[+m-1]}${+y+543}`;
}
export function autoSave(){ window._autoSave?.(); }
export function updateAddPlayerBtn(){ window._updateAddPlayerBtn?.(); }

// ── Dragon Golf V13 ──
export const LS_KEY_DRAGON = 'golfmate_dragon_v13';
