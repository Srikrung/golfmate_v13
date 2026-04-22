// ============================================================
// modules/dragon.js — Dragon Golf Mode V13
// ============================================================
import { players, scores, pars, G, autoSave } from '../config.js';

// ── Dragon State ──
export const dragonData = {
  on: false,
  ptRate: 20,
  // mulligan[player][hole] = true/false (max 2/hole ยกเว้นหลุม 0=ฟรี)
  mulligan: [],
  // pot[hole][player] = {water,sand,putt3}
  pot: [],
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
  const badge = document.getElementById('dragon-badge');
  if(badge){ badge.textContent=on?'ON':'OFF'; badge.style.background=on?'rgba(255,107,43,0.2)':'rgba(255,255,255,0.07)'; badge.style.color=on?'#ff6b2b':'rgba(255,255,255,0.3)'; }
  const sw = document.getElementById('dragon-sw');
  if(sw) sw.classList.toggle('on', on);
  document.querySelectorAll('.dragon-row').forEach(el=>{ el.style.display=on?'':'none'; });
  document.querySelectorAll('.dragon-game-row').forEach(el=>{ el.style.display=on?'flex':'none'; });
  const chipLbl = document.getElementById('dragon-chip-pt');
  if(chipLbl) chipLbl.textContent = on?'8':'7';
  // Dragon bite mults — lock/unlock
  const DRAGON_MULTS = {birdie:3,eagle:4,albatross:25,hio:50};
  const DEFAULT_MULTS = {birdie:2,eagle:3,albatross:5,hio:10};
  const mults = on ? DRAGON_MULTS : DEFAULT_MULTS;
  ['birdie','eagle','albatross','hio'].forEach(k=>{
    const el = document.getElementById(`bm-val-${k}`);
    if(!el) return;
    el.value = mults[k];
    el.disabled = on;
    el.style.opacity = on ? '0.5' : '1';
    el.style.cursor = on ? 'not-allowed' : '';
    if(on) el.style.borderColor = 'rgba(255,107,43,0.4)';
    else el.style.borderColor = 'rgba(255,159,10,0.5)';
    // sync G.bite.mults
    if(window.setBiteMult) setBiteMult(k, mults[k]);
  });
  // label
  const multLbl = document.getElementById('bite-mult-lbl');
  if(multLbl) multLbl.textContent = on ? 'ตัวคูณ Dragon (ล็อกตายตัว)' : 'ตัวคูณ — แก้ค่าได้';
  // ── ซ่อน/แสดง sections ตาม Dragon ON/OFF ──
  // ต่อแต้ม
  const hcapSec = document.getElementById('hcap-section');
  if(hcapSec) hcapSec.style.display = on ? 'none' : '';
  // หมากัด
  const gbBite = document.getElementById('gb-bite');
  const gbBiteDr = document.getElementById('gb-bite-dragon');
  if(gbBite) gbBite.style.display = on ? 'none' : '';
  if(gbBiteDr) gbBiteDr.style.display = on ? 'block' : 'none';
  // เทอร์โบ note + ซ่อน grid
  const turboNote = document.getElementById('turbo-dragon-note');
  if(turboNote) turboNote.style.display = on ? 'block' : 'none';
  const tgFront = document.getElementById('tg-front');
  const tgBack  = document.getElementById('tg-back');
  const tgLblF  = document.querySelector('#gb-turbo [data-lbl="front"]');
  const tgLblB  = document.querySelector('#gb-turbo [data-lbl="back"]');
  ['tg-front','tg-back'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = on ? 'none' : '';
  });
  // ซ่อน label Front9/Back9
  document.querySelectorAll('#gb-turbo .turbo-lbl').forEach(el=>{
    el.style.display = on ? 'none' : '';
  });
  // ทีม
  const gbTeam = document.getElementById('gb-team');
  const gbTeamDr = document.getElementById('gb-team-dragon');
  if(gbTeam) gbTeam.style.display = on ? 'none' : 'none'; // ทีม default hide อยู่แล้ว
  if(gbTeamDr) gbTeamDr.style.display = on ? 'block' : 'none';
  // Olympic
  const gbOly = document.getElementById('gb-olympic');
  const gbOlyDr = document.getElementById('gb-olympic-dragon');
  if(gbOly) gbOly.style.display = on ? 'none' : 'none';
  if(gbOlyDr) gbOlyDr.style.display = on ? 'block' : 'none';
  // Far
  const gbFar = document.getElementById('gb-farNear');
  const gbFarDr = document.getElementById('gb-farNear-dragon');
  if(gbFar) gbFar.style.display = on ? 'none' : 'none';
  if(gbFarDr) gbFarDr.style.display = on ? 'block' : 'none';
  // กองกลาง + ค่าเลี้ยง
  const drSec = document.getElementById('dragon-games-section');
  if(drSec) drSec.style.display = on ? 'block' : 'none';

  // show/hide Par+Bogey rows
  const extraEl = document.getElementById('bm-dragon-extra');
  if(extraEl) extraEl.style.display = on ? 'flex' : 'none';
  // sub label
  const subLbl = document.getElementById('bite-sub-lbl');
  if(subLbl) subLbl.textContent = on
    ? 'HIO×50 Alb×25 Eagle×4 Birdie×3'
    : `HIO×${G.bite?.mults?.hio||10} Eagle×${G.bite?.mults?.eagle||3} Birdie×${G.bite?.mults?.birdie||2}`;
  if(on){
    if(!G.bite.on)   { G.bite.on=true;    document.getElementById('sw-bite')?.classList.add('on'); }
    if(!G.olympic.on){ G.olympic.on=true;  document.getElementById('sw-olympic')?.classList.add('on'); }
    if(!G.team.on)   { G.team.on=true; G.doubleRe.on=true; document.getElementById('sw-team')?.classList.add('on'); }
    if(!G.farNear.on){ G.farNear.on=true;  document.getElementById('sw-farNear')?.classList.add('on'); }
    document.getElementById('sw-dragon-pot')?.classList.add('on');
    document.getElementById('sw-dragon-service')?.classList.add('on');
  }
}

// ── Init ──
export function initDragonData(numPlayers, numHoles=18){
  dragonData.mulligan = Array(numPlayers).fill(null).map(()=>Array(numHoles).fill(false));
  dragonData.pot = Array(numHoles).fill(null).map(()=>
    Array(numPlayers).fill(null).map(()=>({water:false,sand:false,putt3:false}))
  );
}

// ── Refresh helpers ──
function _refreshDragonSection(h){
  const sec = document.getElementById(`dragon-sec-${h}`);
  if(sec){ sec.classList.add('show'); renderDragonSection(h); }
  if(typeof window.updateTotals === 'function') window.updateTotals();
}
function _refreshPotSummary(){
  renderPotSummary();
}


// ── มูลิแกน ──
// หลุม 1 = ฟรี 1 ครั้ง | ทั้งเกม = 2 สิทธิ์ paid ใช้หลุมไหนก็ได้ × 100฿
export function mulliganUse(playerIdx, hole){
  let m = dragonData.mulligan[playerIdx];
  // ป้องกัน structure เก่า (array) → แปลงเป็น object ใหม่
  if(!m || Array.isArray(m)){
    dragonData.mulligan[playerIdx] = {freeUsed:false, paid:[]};
    m = dragonData.mulligan[playerIdx];
  }
  if(!m.paid) m.paid = [];
  if(hole === 0){
    const h0paid = m.paid.includes(0);
    if(!m.freeUsed){
      m.freeUsed = true;
    } else if(!h0paid && m.paid.length < 2){
      m.paid.push(0); dragonData.potTotal += 100;
    } else {
      if(h0paid){ m.paid.splice(m.paid.indexOf(0),1); dragonData.potTotal -= 100; }
      m.freeUsed = false;
    }
  } else {
    const idx = m.paid.indexOf(hole);
    if(idx !== -1){
      m.paid.splice(idx, 1);
      dragonData.potTotal -= 100;
    } else if(m.paid.length < 2){
      m.paid.push(hole);
      dragonData.potTotal += 100;
    }
  }
  _refreshDragonSection(hole);
  _refreshPotSummary();
  autoSave();
}

// ── กองกลาง ──
export function potToggle(hole, playerIdx, type){
  if(!dragonData.pot[hole]?.[playerIdx]) return;
  const p = dragonData.pot[hole][playerIdx];
  p[type] = !p[type];
  _refreshDragonSection(hole);
  _refreshPotSummary();
  autoSave();
}

// ── คำนวณกองกลางรายคน ──
export function calcPlayerPot(playerIdx){
  const p = playerIdx;
  let water=0, sand=0, putt3=0, birdie=0, mul=0, settamaa=0;
  const isDouble = h => h===8||h===17;

  // น้ำ/ทราย/3พัต (อย่างละ 20฿ ต่อหลุม ต่อคน)
  for(let h=0;h<18;h++){
    const pot = dragonData.pot[h]?.[p];
    if(!pot) continue;
    const m = isDouble(h)?2:1;
    if(pot.water) water += 20*m;
    if(pot.sand)  sand  += 20*m;
    if(pot.putt3) putt3 += 20*m;
  }

  // Birdie/Eagle/Alb/HIO AUTO จากสกอร์
  scores[p].forEach((s,h)=>{
    if(s===null) return;
    const d = s - pars[h];
    if(d<=-1){ birdie += isDouble(h)?200:100; }
  });

  // มูลิแกน — 2 สิทธิ์/เกม paid × 100฿
  const mp = dragonData.mulligan[p]||{paid:[]};
  mul = (mp.paid||[]).length * 100;

  // ตั้งม้า
  const target = G.settamaa?.targets?.[p];
  if(target != null && target !== ''){
    const actual = scores[p].reduce((s,v)=>s+(v||0),0);
    if(actual > target)      settamaa = 20;
    else if(actual < target) settamaa = 40;
  }

  return {water,sand,putt3,birdie,mul,settamaa,
    total: water+sand+putt3+birdie+mul+settamaa};
}

export function calcTotalPot(){
  return players.map((_,p)=>calcPlayerPot(p)).reduce((s,pp)=>s+pp.total,0);
}

// ── Dragon ทีม — คะแนน Best N ──
export function calcDragonTeamScores(){
  const isDouble = h => h===8||h===17;
  const teamPts = {}; // {A:0, B:0, C:0}

  for(let h=0;h<18;h++){
    // จัดกลุ่มผู้เล่นตามทีม
    const groups = {};
    players.forEach((_,p)=>{
      const t = G.team.domoTeams?.[h]?.[p] || G.team.baseTeams?.[p] || 'A';
      if(!groups[t]) groups[t]=[];
      if(scores[p][h]!==null) groups[t].push(scores[p][h]);
    });

    // Best N ต่อทีม (sort น้อย→มาก, เอา N ตัวแรก)
    const bests = {};
    Object.entries(groups).forEach(([t,arr])=>{
      arr.sort((a,b)=>a-b);
      const n = Math.min(arr.length, 3);
      bests[t] = arr.slice(0,n).reduce((s,v)=>s+v,0) / n; // ค่าเฉลี่ย best N
    });

    // จัดอันดับ (น้อยสุด=ดีสุด)
    const teams = Object.keys(bests);
    if(teams.length<2) continue;
    teams.sort((a,b)=>bests[a]-bests[b]);

    // แจกแต้ม 3/2/1 (เสมอ=หาร)
    const ptsMap = [3,2,1,0,0,0];
    let i=0;
    while(i<teams.length){
      let j=i;
      while(j<teams.length-1 && bests[teams[j]]===bests[teams[j+1]]) j++;
      // i..j เสมอกัน
      const pts = ptsMap.slice(i,j+1).reduce((s,v)=>s+v,0)/(j-i+1);
      for(let k=i;k<=j;k++){
        if(!teamPts[teams[k]]) teamPts[teams[k]]=0;
        teamPts[teams[k]] += pts * (isDouble(h)?2:1);
      }
      i=j+1;
    }
  }
  return teamPts; // {A:52, B:44, C:36}
}

// ── Dragon Pot HTML สำหรับ Tab เงิน ──
export function buildDragonPotHTML(){
  const isDouble = h => h===8||h===17;
  const sn = name => name&&name.length>6?name.slice(0,6)+'…':(name||'?');
  const pColors=['var(--blue)','var(--red)','var(--green)','var(--gold)','#bf5af2','#5ac8fa','#ff9f0a','#ff6b2b'];

  const perPlayer = players.map((_,p)=>calcPlayerPot(p));
  const grandTotal = perPlayer.reduce((s,pp)=>s+pp.total,0);

  // รวมรายประเภท
  const totWater  = perPlayer.reduce((s,pp)=>s+pp.water,0);
  const totSand   = perPlayer.reduce((s,pp)=>s+pp.sand,0);
  const totPutt3  = perPlayer.reduce((s,pp)=>s+pp.putt3,0);
  const totBirdie = perPlayer.reduce((s,pp)=>s+pp.birdie,0);
  const totMul    = perPlayer.reduce((s,pp)=>s+pp.mul,0);
  const totSet    = perPlayer.reduce((s,pp)=>s+pp.settamaa,0);

  let html = `<div style="margin-top:14px">
  <div style="font-size:15px;font-weight:700;color:var(--lbl);margin-bottom:10px">🏦 กองกลาง</div>
  <div style="background:var(--bg2);border-radius:14px;overflow:hidden;border:1px solid rgba(255,107,43,0.2)">`;

  // breakdown รายประเภท
  const rows=[
    {icon:'💧',name:'น้ำ',val:totWater},
    {icon:'⛱',name:'ทราย',val:totSand},
    {icon:'🏌️',name:'3พัต',val:totPutt3},
    {icon:'🐦',name:'Birdie/Eagle/Alb/HIO AUTO',val:totBirdie},
    {icon:'🏌️',name:'มูลิแกน',val:totMul},
    {icon:'🐴',name:'ตั้งม้า',val:totSet},
  ].filter(r=>r.val>0);

  html += `<div style="padding:10px 14px;border-bottom:0.5px solid var(--sep)">`;
  rows.forEach(r=>{
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:0.5px solid var(--sep)">
      <span style="font-size:12px;color:var(--lbl2)">${r.icon} ${r.name}</span>
      <span style="font-size:13px;font-weight:700;color:var(--orange)">${r.val}฿</span>
    </div>`;
  });
  html += `</div>`;

  // รวม
  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,215,0,0.06);border-bottom:0.5px solid var(--sep)">
    <span style="font-size:14px;font-weight:800;color:var(--gold)">รวมกองกลาง</span>
    <span style="font-size:22px;font-weight:800;color:var(--gold)">${grandTotal.toLocaleString()}฿</span>
  </div>`;

  // รายคน
  html += `<div style="padding:10px 14px">
    <div style="font-size:11px;font-weight:700;color:var(--lbl2);margin-bottom:8px">ใครจ่ายเข้ากองเท่าไหร่</div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(players.length,4)},1fr);gap:6px">`;

  perPlayer.forEach((pp,p)=>{
    const clr = pColors[p%pColors.length];
    const lines=[];
    if(pp.water)    lines.push(`💧${pp.water}฿`);
    if(pp.sand)     lines.push(`⛱${pp.sand}฿`);
    if(pp.putt3)    lines.push(`🏌️${pp.putt3}฿`);
    if(pp.birdie)   lines.push(`🐦${pp.birdie}฿`);
    if(pp.mul)      lines.push(`🏌️มูล${pp.mul}฿`);
    if(pp.settamaa) lines.push(`🐴${pp.settamaa}฿`);
    html += `<div style="background:var(--bg3);border-radius:10px;padding:8px 5px;text-align:center">
      <div style="font-size:10px;font-weight:700;color:${clr};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">${sn(players[p].name)}</div>
      <div style="font-size:${pp.total>0?16:13}px;font-weight:800;color:${pp.total>0?'var(--orange)':'var(--lbl3)'}">${pp.total>0?pp.total+'฿':'—'}</div>
      <div style="font-size:8px;color:var(--lbl3);margin-top:3px;line-height:1.8">${lines.join('<br>')||'—'}</div>
    </div>`;
  });
  html += `</div></div></div></div>`;

  // ── ทีม Dragon ──
  const teamPts = calcDragonTeamScores();
  const teamNames = Object.keys(teamPts).sort((a,b)=>teamPts[b]-teamPts[a]);
  if(teamNames.length>0){
    const tColors={A:'var(--blue)',B:'var(--red)',C:'var(--green)',D:'var(--purple)'};
    const tBg={A:'rgba(10,132,255,0.12)',B:'rgba(255,69,58,0.1)',C:'rgba(48,209,88,0.08)',D:'rgba(191,90,242,0.1)'};
    const tBd={A:'rgba(10,132,255,0.25)',B:'rgba(255,69,58,0.2)',C:'rgba(48,209,88,0.15)',D:'rgba(191,90,242,0.2)'};
    const medals=['🥇','🥈','🥉','4️⃣'];

    html += `<div style="margin-top:8px">
    <div style="font-size:15px;font-weight:700;color:var(--lbl);margin-bottom:10px">👥 ทีม Dragon — คะแนน</div>
    <div style="background:var(--bg2);border-radius:14px;overflow:hidden;border:1px solid rgba(48,209,88,0.2)">
      <div style="padding:8px 14px;border-bottom:0.5px solid var(--sep);font-size:10px;color:var(--lbl2)">Best 3 · 3/2/1 pt · หลุม 9,18 Turbo ×2</div>
      <div style="padding:10px 14px">
        <div style="display:grid;grid-template-columns:repeat(${Math.min(teamNames.length,3)},1fr);gap:6px;margin-bottom:10px">`;

    teamNames.forEach((t,i)=>{
      const members = players.map((pl,p)=>{
        const bt = G.team.baseTeams?.[p]||'A';
        return bt===t?sn(pl.name):null;
      }).filter(Boolean).join(',');
      html += `<div style="background:${tBg[t]||'var(--bg3)'};border:1px solid ${tBd[t]||'var(--sep)'};border-radius:10px;padding:9px 6px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:${tColors[t]||'var(--lbl)'}">${medals[i]||''} อันดับ ${i+1}</div>
        <div style="font-size:14px;font-weight:800;color:${tColors[t]||'var(--lbl)'};margin:3px 0">ทีม ${t}</div>
        <div style="font-size:20px;font-weight:800;color:${tColors[t]||'var(--lbl)'}">${teamPts[t].toFixed(1).replace('.0','')}pt</div>
        <div style="font-size:8px;color:var(--lbl3);margin-top:2px">${members}</div>
      </div>`;
    });
    html += `</div>`;

    // ค่าเลี้ยง
    if(grandTotal>0 && teamNames.length>=3){
      const pcts=[0.1,0.4,0.5];
      const pctLabels=['10%','40%','50%'];
      const svcColors=['var(--gold)','var(--orange)','var(--red)'];
      const svcBg=['rgba(255,215,0,0.09)','rgba(255,159,10,0.09)','rgba(255,69,58,0.09)'];
      const svcBd=['rgba(255,215,0,0.2)','rgba(255,159,10,0.2)','rgba(255,69,58,0.2)'];
      html += `<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:7px">🍽️ ค่าเลี้ยง (จากกองกลาง ${grandTotal.toLocaleString()}฿)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px">`;
      teamNames.slice(0,3).forEach((t,i)=>{
        const amt = Math.round(grandTotal*pcts[i]);
        html += `<div style="background:${svcBg[i]};border:1px solid ${svcBd[i]};border-radius:9px;padding:8px 5px;text-align:center">
          <div style="font-size:9px;font-weight:700;color:${svcColors[i]}">ทีม ${t} (${pctLabels[i]})</div>
          <div style="font-size:16px;font-weight:800;color:${svcColors[i]};margin-top:3px">${amt.toLocaleString()}฿</div>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div></div></div>`;
  }

  return html;
}

// ── Render Dragon Section (Scorecard) ──
export function renderDragonSection(h){
  const wrap = document.getElementById(`dragon-sec-${h}`);
  if(!wrap || !dragonData.on) return;
  const isHole1 = (h===0);
  const isDouble = (h===8||h===17);
  const sn = name => name&&name.length>6?name.slice(0,6)+'…':(name||'?');
  const pColors=['var(--blue)','var(--red)','var(--green)','var(--gold)','#bf5af2','#5ac8fa','#ff9f0a','#ff6b2b'];

  let html = `<div class="dragon-sec-title">🐉 Dragon Golf</div>`;

  // มูลิแกน
  const totalPaidAll = players.reduce((s,_,p)=>{
    const mp = dragonData.mulligan[p]||{paid:[]};
    return s + (mp.paid||[]).length;
  },0); // ใช้แค่ per player
  html += `<div class="dr-sub-wrap">
    <div class="dr-sub-title" style="color:var(--dragon)">🏌️ มูลิแกน ${isHole1
      ? '<span style="font-size:9px;color:var(--green)">(หลุม 1 ฟรี 1 ครั้ง)</span>'
      : '<span style="font-size:9px;color:var(--lbl3)">100฿/ครั้ง · เหลือสิทธิ์ 2 ครั้ง/คน ทั้งเกม</span>'
    }</div>`;

  players.forEach((pl,p)=>{
    const m = dragonData.mulligan[p]||{freeUsed:false, paid:[]};
    const clr = pColors[p%pColors.length];
    const paidCount = (m.paid||[]).length;
    const h0paid    = isHole1 && (m.paid||[]).includes(0);
    const usedHere  = isHole1 ? (m.freeUsed||h0paid) : (m.paid||[]).includes(h);
    const maxed     = !isHole1 && !usedHere && paidCount >= 2;
    // label สั้น
    let btnLabel;
    if(isHole1){
      if(!m.freeUsed)       btnLabel = 'ฟรี';
      else if(!h0paid)      btnLabel = '✓ฟรี · กดอีก 100฿';
      else                  btnLabel = '✓ฟรี+100฿ · กดยกเลิก';
    } else {
      btnLabel = maxed ? 'เต็ม' : usedHere ? '✓ 100฿' : '100฿';
    }
    const remain = 2 - paidCount;
    html += `<div class="dr-mul-row">
      <div class="dr-pname" style="color:${clr}">${sn(pl.name)}</div>
      <button class="dr-mul-btn${usedHere?' used':''} ${maxed?'dr-dis':''}"
        onclick="drMulUse(${h},${p})" style="flex:1" ${maxed?'disabled':''}>
        ${btnLabel}
      </button>
      <div class="dr-mul-cnt" style="${(usedHere||paidCount>0)?'background:rgba(255,107,43,0.3)':'background:rgba(255,255,255,0.05);color:var(--lbl3)'}">
        ${isHole1?(m.freeUsed?(h0paid?'2':'1'):'0'):(remain+'เหลือ')}
      </div>
    </div>`;
  });
  html += `</div>`;

  // กองกลาง
  const potItems=[{key:'water',lbl:'💧น้ำ'},{key:'sand',lbl:'⛱ทราย'},{key:'putt3',lbl:'🏌️3พัต'}];
  html += `<div class="dr-sub-wrap">
    <div class="dr-sub-title" style="color:var(--orange)">🏦 กองกลาง <span style="font-size:9px;color:var(--lbl3)">อย่างละ ${isDouble?'40':'20'}฿/คน · Birdie+=AUTO</span></div>`;

  players.forEach((pl,p)=>{
    const potP = dragonData.pot[h]?.[p]||{};
    const clr = pColors[p%pColors.length];
    const s = scores[p][h];
    const isBirdie = s!==null && (s-pars[h])<=-1;
    html += `<div class="dr-pot-row">
      <div class="dr-pname" style="color:${clr}">${sn(pl.name)}</div>
      <div style="display:flex;gap:3px;flex:1">
        ${potItems.map(item=>`<button class="dr-pot-btn${potP[item.key]?' on':''}" onclick="drPotToggle(${h},${p},'${item.key}')">${item.lbl}</button>`).join('')}
        <div class="dr-pot-auto ${isBirdie?'active':''}">🐦${isBirdie?'✓':'—'}</div>
      </div>
    </div>`;
  });
  html += `</div>`;

  wrap.innerHTML = html;
}

// ── Pot Summary (ใต้ scorecard) ──
export function renderPotSummary(){
  const wrap = document.getElementById('dragon-pot-summary');
  if(!wrap) return;
  if(!dragonData.on){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  const total = calcTotalPot();
  const perP = players.map((_,p)=>calcPlayerPot(p));
  wrap.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:7px">🏦 กองกลางสะสม</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:10px;color:var(--lbl2)">💧 น้ำ/ทราย/3พัต</span><span style="font-size:11px;font-weight:700;color:var(--orange)">${perP.reduce((s,p)=>s+p.water+p.sand+p.putt3,0)}฿</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:10px;color:var(--lbl2)">🐦 Birdie/Eagle/Alb/HIO AUTO</span><span style="font-size:11px;font-weight:700;color:var(--orange)">${perP.reduce((s,p)=>s+p.birdie,0)}฿</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:10px;color:var(--lbl2)">🏌️ มูลิแกน</span><span style="font-size:11px;font-weight:700;color:var(--orange)">${perP.reduce((s,p)=>s+p.mul,0)}฿</span></div>
    <div style="border-top:1px solid rgba(255,215,0,0.18);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;font-weight:800;color:var(--gold)">รวมกองกลาง</span>
      <span style="font-size:18px;font-weight:800;color:var(--gold)">${total.toLocaleString()}฿</span>
    </div>`;
}

// ── Save/Load ──
export function saveDragonState(){
  try{
    localStorage.setItem('golfmate_dragon_v13', JSON.stringify({
      on:dragonData.on,
      mulligan:dragonData.mulligan,
      pot:dragonData.pot,
    }));
  }catch(e){}
}
export function loadDragonState(){
  try{
    const d=JSON.parse(localStorage.getItem('golfmate_dragon_v13')||'null');
    if(!d)return;
    setDragonOn(d.on||false);
    if(d.mulligan) dragonData.mulligan.splice(0,dragonData.mulligan.length,...d.mulligan);
    if(d.pot)      dragonData.pot.splice(0,dragonData.pot.length,...d.pot);
  }catch(e){}
}

// ── Expose ──
window.drMulUse    = (h,p)   => { mulliganUse(p,h); };
window.drPotToggle = (h,p,t) => { potToggle(h,p,t); };
