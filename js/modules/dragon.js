// ============================================================
// modules/dragon.js — Dragon Golf Mode V13
// ============================================================
import { players, scores, pars, G, autoSave } from '../config.js';

// ── Dragon State ──
export const dragonData = {
  on: false,
  ptRate: 20,           // 1pt = 20 บาท
  mulligan: [],         // Array[players] of {h1:bool, h2:bool}
  pot: [],              // Array[holes][players] of {water:bool, sand:bool, putt3:bool}
  potTotal: 0,
};

export function isDragonOn(){ return dragonData.on; }

export function toggleDragon(){
  dragonData.on = !dragonData.on;
  G.dragon.on = dragonData.on;
  _syncDragonUI();
  autoSave();
}

export function setDragonOn(v){
  dragonData.on = !!v;
  G.dragon.on = !!v;
  _syncDragonUI();
}

function _syncDragonUI(){
  const on = dragonData.on;
  // toggle bar badge
  const badge = document.getElementById('dragon-badge');
  if(badge){ badge.textContent = on ? 'ON' : 'OFF'; badge.style.background = on ? 'rgba(255,107,43,0.2)' : 'rgba(255,255,255,0.07)'; badge.style.color = on ? '#ff6b2b' : 'rgba(255,255,255,0.3)'; }
  // toggle switch
  const sw = document.getElementById('dragon-sw');
  if(sw){ sw.classList.toggle('on', on); }
  // show/hide dragon rows in scorecard
  document.querySelectorAll('.dragon-row').forEach(el=>{ el.style.display = on ? '' : 'none'; });
  // show/hide dragon section label in setup
  document.querySelectorAll('.dragon-game-row').forEach(el=>{ el.style.display = on ? 'flex' : 'none'; });
  // Chip pt label
  const chipLbl = document.getElementById('dragon-chip-pt');
  if(chipLbl) chipLbl.textContent = on ? '8' : '7';
  // Auto-enable/disable Dragon games
  if(on){
    // เปิด: หมากัด, โอลิมปิก, ทีม, Far (dragon far-only)
    if(!G.bite.on)    { G.bite.on=true;    document.getElementById('sw-bite')?.classList.add('on'); }
    if(!G.olympic.on) { G.olympic.on=true; document.getElementById('sw-olympic')?.classList.add('on'); }
    if(!G.team.on)    { G.team.on=true; G.doubleRe.on=true; document.getElementById('sw-team')?.classList.add('on'); }
    if(!G.farNear.on) { G.farNear.on=true; document.getElementById('sw-farNear')?.classList.add('on'); }
    // dragon pot/mulligan switches
    document.getElementById('sw-dragon-pot')?.classList.add('on');
    document.getElementById('sw-dragon-service')?.classList.add('on');
  }
}

// ── Init dragon data per session ──
export function initDragonData(numPlayers, numHoles=18){
  dragonData.mulligan = Array(numPlayers).fill(null).map(()=>({h1:false,h2:false}));
  dragonData.pot = Array(numHoles).fill(null).map(()=>Array(numPlayers).fill(null).map(()=>({water:false,sand:false,putt3:false})));
  dragonData.potTotal = 0;
}

// ── มูลิแกน ──
export function mulliganUse(playerIdx, slot, hole){
  // slot = 1 หรือ 2
  // หลุม 0 (หลุม 1) ฟรี ไม่เข้ากอง
  if(!dragonData.mulligan[playerIdx]) return;
  const m = dragonData.mulligan[playerIdx];
  const key = slot===1?'h1':'h2';
  const otherKey = slot===1?'h2':'h1';
  // slot 2 unlock เมื่อ slot 1 ใช้แล้ว
  if(slot===2 && !m.h1) return;
  m[key] = !m[key];
  if(!m[key] && slot===1){ m.h2 = false; } // ยกเลิก slot1 → reset slot2
  // คำนวณกองกลาง (หลุม 0 = ฟรี)
  if(hole > 0 && m[key]){ dragonData.potTotal += 100; }
  else if(hole > 0 && !m[key]){ dragonData.potTotal -= 100; }
  _refreshDragonSection(hole);
  _refreshPotSummary();
  autoSave();
}

// ── กองกลาง ──
export function potToggle(hole, playerIdx, type){
  if(!dragonData.pot[hole] || !dragonData.pot[hole][playerIdx]) return;
  const p = dragonData.pot[hole][playerIdx];
  const wasOn = p[type];
  p[type] = !wasOn;
  const isDouble = (hole === 8 || hole === 17); // หลุม 9, 18
  const val = isDouble ? 40 : 20;
  dragonData.potTotal += p[type] ? val : -val;
  _refreshDragonSection(hole);
  _refreshPotSummary();
  autoSave();
}

// ── Birdie auto เข้ากอง ──
export function calcBirdiePot(){
  let total = 0;
  players.forEach((_,p)=>{
    scores[p].forEach((s,h)=>{
      if(s===null) return;
      const d = s - pars[h];
      if(d <= -1){ // Birdie หรือดีกว่า
        const isDouble = (h===8||h===17);
        total += isDouble ? 200 : 100;
      }
    });
  });
  return total;
}

// ── คะแนน Dragon หมากัด (pt system) ──
// Bogey=1pt, Par=2pt, Birdie=3pt, Eagle=4pt, Alb=25pt, HIO=50pt
export function getDragonPt(score, par){
  if(score===null) return 0;
  if(score===1) return 50; // HIO
  const d = score - par;
  if(d <= -3) return 25;  // Albatross
  if(d === -2) return 4;  // Eagle
  if(d === -1) return 3;  // Birdie
  if(d === 0)  return 2;  // Par
  if(d >= 1)   return 1;  // Bogey+
  return 0;
}

// คำนวณ Dragon หมากัด ต่างจากปกติตรงที่ใช้ pt แทนเงินตรง
export function calcDragonBiteHole(h){
  const m = Array(players.length).fill(0);
  if(!G.bite.on) return m;
  const rate = dragonData.ptRate;
  const active = players.map((_,p)=>p).filter(p=>scores[p][h]!==null);
  if(active.length < 2) return m;
  for(let ii=0;ii<active.length;ii++) for(let jj=ii+1;jj<active.length;jj++){
    const i=active[ii], j=active[jj];
    const si=scores[i][h], sj=scores[j][h];
    if(si===null||sj===null) continue;
    if(si < sj){
      const pt = getDragonPt(si, pars[h]);
      m[i] += pt * rate; m[j] -= pt * rate;
    } else if(sj < si){
      const pt = getDragonPt(sj, pars[h]);
      m[j] += pt * rate; m[i] -= pt * rate;
    }
  }
  return m;
}

// ── Olympic Chip Dragon = 8pt ──
export function getDragonOlyChipPt(){ return 8; }

// ── Far Dragon (Far only, ไม่มี Near) ──
// ใช้ farNearData เดิม แต่บังคับ mode = solo เสมอ
export function ensureFarOnlyMode(h){
  // ไม่ต้องทำอะไร farNearData ใช้ mode='solo' สำหรับ Dragon
}

// ── กองกลาง summary ──
export function calcPotSummary(){
  const birdiePot = calcBirdiePot();
  const manualPot = dragonData.potTotal;
  return {
    birdie: birdiePot,
    manual: manualPot,
    total: birdiePot + manualPot,
  };
}

// ── ค่าเลี้ยง ──
// คำนวณจากสกอร์รวม (น้อยสุด = อันดับ 1)
export function calcServiceFee(potAmount){
  // เรียงอันดับจากสกอร์
  const totals = players.map((_,p)=>({p, total:scores[p].reduce((s,v)=>s+(v||0),0)}));
  totals.sort((a,b)=>a.total-b.total);
  const result = Array(players.length).fill(0);
  const pct = [0.1, 0.4, 0.5]; // อันดับ 1,2,3
  pct.forEach((p,i)=>{
    if(totals[i]) result[totals[i].p] = potAmount * p;
  });
  return result;
}

// ── Render Dragon Section ──
export function renderDragonSection(h){
  const wrap = document.getElementById(`dragon-sec-${h}`);
  if(!wrap || !dragonData.on) return;
  const hole = h; // 0-indexed
  const isHole1 = (hole === 0);
  const isDouble = (hole === 8 || hole === 17);

  let html = `<div class="dragon-sec-title">🐉 Dragon Golf</div>`;

  // มูลิแกน
  html += `<div class="dr-sub-wrap">
    <div class="dr-sub-title" style="color:var(--dragon)">🏌️ มูลิแกน ${isHole1?'<span style="font-size:9px;color:var(--green)">(หลุม 1 ฟรี!)</span>':'<span style="font-size:9px;color:var(--lbl3)">100฿/ครั้ง · โควต้า 2</span>'}</div>`;

  players.forEach((pl,p)=>{
    const m = dragonData.mulligan[p] || {h1:false,h2:false};
    const pColor = _playerColor(p);
    const sn = _sn(pl.name);
    const slot2Dis = !m.h1;
    html += `<div class="dr-mul-row">
      <div class="dr-pname" style="color:${pColor}">${sn}</div>
      <div style="display:flex;gap:3px;flex:1">
        <button class="dr-mul-btn${m.h1?' used':''}" onclick="drMulUse(${hole},${p},1)">
          ${m.h1?'ครั้ง 1 ✓':'ครั้ง 1'}${m.h1&&!isHole1?' 100฿':''}
        </button>
        <button class="dr-mul-btn${m.h2?' used':''} ${slot2Dis?'dr-dis':''}"
          onclick="drMulUse(${hole},${p},2)" ${slot2Dis?'disabled':''}>
          ${m.h2?'ครั้ง 2 ✓':'ครั้ง 2'}${m.h2&&!isHole1?' 100฿':''}
        </button>
      </div>
      <div class="dr-mul-cnt" style="${(m.h1||m.h2)?'background:rgba(255,107,43,0.3)':'background:rgba(255,255,255,0.05);color:var(--lbl3)'}">
        ${(m.h1?1:0)+(m.h2?1:0)}
      </div>
    </div>`;
  });
  html += `</div>`;

  // กองกลาง
  const potItems = [{key:'water',lbl:'💧น้ำ'},{key:'sand',lbl:'⛱ทราย'},{key:'putt3',lbl:'🏌️3พัต'}];
  html += `<div class="dr-sub-wrap">
    <div class="dr-sub-title" style="color:var(--orange)">🏦 กองกลาง <span style="font-size:9px;color:var(--lbl3)">น้ำ/ทราย/3พัต=${isDouble?'40':'20'}฿ · Birdie=AUTO</span></div>`;

  players.forEach((pl,p)=>{
    const potP = dragonData.pot[hole]?.[p] || {};
    const pColor = _playerColor(p);
    const sn = _sn(pl.name);
    // Birdie auto
    const s = scores[p][hole];
    const isBirdie = s!==null && (s - pars[hole]) <= -1;
    html += `<div class="dr-pot-row">
      <div class="dr-pname" style="color:${pColor}">${sn}</div>
      <div style="display:flex;gap:3px;flex:1">
        ${potItems.map(item=>`<button class="dr-pot-btn${potP[item.key]?' on':''}" onclick="drPotToggle(${hole},${p},'${item.key}')">${item.lbl}</button>`).join('')}
        <div class="dr-pot-auto ${isBirdie?'active':''}">🐦${isBirdie?'✓':'—'}</div>
      </div>
    </div>`;
  });
  html += `</div>`;

  wrap.innerHTML = html;
}

// ── Pot Summary ──
export function renderPotSummary(){
  const wrap = document.getElementById('dragon-pot-summary');
  if(!wrap) return;
  if(!dragonData.on){ wrap.style.display='none'; return; }
  wrap.style.display = 'block';
  const {birdie, manual, total} = calcPotSummary();
  const mulPot = _calcMulPot();
  const grandTotal = birdie + manual + mulPot;
  wrap.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:7px">🏦 กองกลางสะสม</div>
    <div class="dr-sum-row"><span>น้ำ/ทราย/3พัต</span><span>${manual}฿</span></div>
    <div class="dr-sum-row"><span>Birdie AUTO</span><span>${birdie}฿</span></div>
    <div class="dr-sum-row"><span>มูลิแกน</span><span>${mulPot}฿</span></div>
    <div class="dr-sum-total">
      <span>รวมกองกลาง</span>
      <span>${grandTotal}฿</span>
    </div>`;
}

// ── Helpers ──
function _calcMulPot(){
  let tot = 0;
  dragonData.mulligan.forEach((m,p)=>{
    // หลุม 1 ฟรี — แต่เราไม่ track per hole ตรงๆ ใน mulligan
    // นับจาก potTotal ที่ track ไว้แล้ว
  });
  return dragonData.potTotal; // potTotal มีทั้ง manual+mulligan รวมกัน
}

function _sn(name){ return name && name.length > 6 ? name.slice(0,6)+'…' : (name||'?'); }

function _playerColor(p){
  const colors = ['var(--blue)','var(--red)','var(--green)','var(--gold)','#bf5af2','#5ac8fa','#ff9f0a','#ff6b2b'];
  return colors[p % colors.length];
}

function _refreshDragonSection(h){
  renderDragonSection(h);
}

function _refreshPotSummary(){
  renderPotSummary();
}


// ── Build กองกลาง HTML สำหรับ Tab เงิน ──
export function buildDragonPotHTML(playersList, scoresList, parsList){
  const isDouble = h => h===8||h===17;
  const rate = dragonData.ptRate; // 20

  // คำนวณ per-player breakdown
  const perPlayer = playersList.map((_,p)=>{
    let water=0, sand=0, putt3=0, birdie=0, mul=0;
    // manual pot (น้ำ/ทราย/3พัต)
    for(let h=0;h<18;h++){
      const pot = dragonData.pot[h]?.[p];
      if(!pot) continue;
      const mult = isDouble(h)?2:1;
      if(pot.water) water += 20*mult;
      if(pot.sand)  sand  += 20*mult;
      if(pot.putt3) putt3 += 20*mult;
    }
    // birdie auto (จากสกอร์)
    scoresList[p].forEach((s,h)=>{
      if(s===null) return;
      const d = s - parsList[h];
      if(d<=-1){ birdie += isDouble(h)?200:100; }
    });
    // มูลิแกน (หลุม 1 = ฟรี, หลุม 2-18 = 100)
    // นับจาก potTotal ที่ track ไว้แล้ว — ใช้ mulligan array
    const m = dragonData.mulligan[p]||{h1:false,h2:false};
    // ไม่รู้ว่า mulligan ใช้ที่หลุมไหน แต่นับจำนวน
    // h1=ครั้งแรก h2=ครั้งสอง — หลุม 1 ฟรี ต้องตรวจ
    // simplified: นับจาก potTotal contribution
    const mulCount = (m.h1?1:0)+(m.h2?1:0);
    mul = mulCount * 100; // approximation (หลุม 1 ฟรีจะไม่เข้ากอง)

    const total = water+sand+putt3+birdie+mul;
    return {water,sand,putt3,birdie,mul,total};
  });

  const grandTotal = perPlayer.reduce((s,p)=>s+p.total,0);

  // สร้าง HTML
  const sn = name => name&&name.length>6?name.slice(0,6)+'…':(name||'?');
  const colors = ['var(--blue)','var(--red)','var(--green)','var(--gold)','#bf5af2','#5ac8fa','#ff9f0a','#ff6b2b'];

  let html = `<div style="margin-top:16px">
    <div style="font-size:15px;font-weight:700;color:var(--lbl);margin-bottom:10px">🏦 กองกลาง</div>
    <div style="background:var(--bg2);border-radius:14px;overflow:hidden;border:1px solid rgba(255,107,43,0.2)">`;

  // แถว breakdown รายประเภท
  const birdieTot = perPlayer.reduce((s,p)=>s+p.birdie,0);
  const manualTot = perPlayer.reduce((s,p)=>s+p.water+p.sand+p.putt3,0);
  const mulTot    = perPlayer.reduce((s,p)=>s+p.mul,0);

  html += `<div style="padding:10px 14px;border-bottom:0.5px solid var(--sep)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font-size:12px;color:var(--lbl2)">💧 น้ำ / ⛱ ทราย / 🏌️ 3พัต</span>
      <span style="font-size:13px;font-weight:700;color:var(--orange)">${manualTot}฿</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font-size:12px;color:var(--lbl2)">🐦 Birdie AUTO</span>
      <span style="font-size:13px;font-weight:700;color:var(--orange)">${birdieTot}฿</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--lbl2)">🏌️ มูลิแกน</span>
      <span style="font-size:13px;font-weight:700;color:var(--orange)">${mulTot}฿</span>
    </div>
  </div>`;

  // แถวรวม
  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,215,0,0.06);border-bottom:0.5px solid var(--sep)">
    <span style="font-size:14px;font-weight:800;color:var(--gold)">รวมกองกลาง</span>
    <span style="font-size:20px;font-weight:800;color:var(--gold)">${grandTotal}฿</span>
  </div>`;

  // ตารางรายคนที่จ่ายเข้ากอง
  html += `<div style="padding:10px 14px">
    <div style="font-size:11px;font-weight:700;color:var(--lbl2);margin-bottom:8px">รายคนที่จ่ายเข้ากอง</div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(playersList.length,4)},1fr);gap:6px">`;

  perPlayer.forEach((pp,p)=>{
    const name = sn(playersList[p].name);
    const clr = colors[p%colors.length];
    const lines = [];
    if(pp.water)  lines.push(`💧 ${pp.water}฿`);
    if(pp.sand)   lines.push(`⛱ ${pp.sand}฿`);
    if(pp.putt3)  lines.push(`🏌️ ${pp.putt3}฿`);
    if(pp.birdie) lines.push(`🐦 ${pp.birdie}฿`);
    if(pp.mul)    lines.push(`🚶 ${pp.mul}฿`);
    const breakdown = lines.length ? lines.join('<br>') : '—';
    html += `<div style="background:var(--bg3);border-radius:10px;padding:8px 6px;text-align:center">
      <div style="font-size:10px;font-weight:700;color:${clr};margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
      <div style="font-size:${pp.total>0?'16':'13'}px;font-weight:800;color:${pp.total>0?'var(--orange)':'var(--lbl3)'}">${pp.total>0?pp.total+'฿':'—'}</div>
      <div style="font-size:9px;color:var(--lbl3);margin-top:3px;line-height:1.7">${breakdown}</div>
    </div>`;
  });

  html += `</div></div></div></div>`;
  return html;
}

// ── Expose to window ──
window.drMulUse = (h,p,slot) => { mulliganUse(p, slot, h); };
window.drPotToggle = (h,p,type) => { potToggle(h, p, type); };
