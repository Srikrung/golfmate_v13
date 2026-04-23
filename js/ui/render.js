import { fmtDate, autoSave, updateAddPlayerBtn } from '../config.js';
// ============================================================
// ui/render.js — showHole, buildResults, buildMoney, updateTotals
// ============================================================
import { players, scores, pars, G, getCurrentHole, setCurrentHole,
         srikrungData, olympicData, farNearData, skipData,
         teamSoloPlayers, ICONS } from '../config.js';

import { updateProgressBar } from './tabs.js';

import { getHoleMoney, getBiteMult, getOlyMult } from '../modules/games.js';
import { isDragonOn, renderDragonSection, renderPotSummary, buildDragonPotHTML } from '../modules/dragon.js';
import { olyRenderHole, fnRenderHole, toggleGameMidPlay } from '../modules/games.js';
import { sgRenderHole } from '../modules/srikrung.js';
import { computeHcapLiveAll, calcHcapFinalEnd, calcHcapHole } from '../modules/handicap.js';


// ── HELPERS ──
export function shortName(name,n){return name.length>6?name.slice(0,6)+'…':name;}
export function moneyCell(v,fs){
  v=Math.round(v);
  if(v===0)return`<td style="text-align:center;font-size:${fs};color:var(--lbl3);padding:7px 2px">—</td>`;
  const c=v>0?'var(--green)':'var(--red)',bg=v>0?'rgba(48,209,88,0.08)':'rgba(255,69,58,0.07)';
  return`<td style="text-align:center;font-size:${fs};font-weight:700;color:${c};background:${bg};padding:7px 2px">${v>0?'+':''}${v}</td>`;
}
export function ptCell(v,fs){
  v=Math.round(v);
  if(v===0)return`<td style="text-align:center;font-size:${fs};color:var(--lbl3);padding:7px 2px">—</td>`;
  const c=v>0?'var(--green)':'var(--red)',bg=v>0?'rgba(48,209,88,0.06)':'rgba(255,69,58,0.05)';
  return`<td style="text-align:center;font-size:${fs};font-weight:700;color:${c};background:${bg};padding:7px 2px">${v>0?'+':''}${v}</td>`;
}
export function tblFs(n){return`clamp(11px, calc(85vw / ${n+2}), 20px)`;}
export function hdrFs(n){return`clamp(9px, calc(68vw / ${n+2}), 13px)`;}
export function scoreCell(s,par,fs,bd){
  const border=bd?`;border:${bd}`:'';
  if(s===null)return`<td style="text-align:center;font-size:${fs};color:var(--lbl3);padding:10px 3px${border}">—</td>`;
  const d=s-par,L=document.body.classList.contains('light'),pd='10px 3px';
  const n=players.length,wh=`clamp(20px, calc(82vw / ${n+2}), 28px)`,sz=`clamp(11px, calc(78vw / ${n+2}), 15px)`;
  if(d>=1){const tc=L?'#444':'rgba(255,255,255,0.55)';return`<td style="text-align:center;padding:${pd}${border}"><span style="font-size:${fs};font-weight:600;color:${tc}">${s}</span></td>`;}
  if(d===0){const tc=L?'#004fc4':'#4da3ff';return`<td style="text-align:center;padding:${pd}${border}"><span style="font-size:${fs};font-weight:700;color:${tc}">${s}</span></td>`;}
  let bg,tc,fw='800';
  if(s===1){bg='#c8a000';tc=L?'#fff':'#000';}
  else if(d<=-3){bg=L?'#8a5c00':'#7a5800';tc='#fff';}
  else if(d===-2){bg=L?'#004fc4':'#1a3560';tc=L?'#fff':'#60b4ff';}
  else{bg=L?'#cc0000':'#7a1a1a';tc=L?'#fff':'#ff8080';}
  return`<td style="text-align:center;padding:${pd}${border}"><span style="display:inline-flex;align-items:center;justify-content:center;width:${wh};height:${wh};border-radius:50%;font-size:${sz};font-weight:${fw};background:${bg};color:${tc}">${s}</span></td>`;
}

// ── TEAM HELPERS ──
export function getTeamForHole(h,p){
  if(G.team.swapType==='domo')return G.team.domoTeams[h]?.[p]||'A';
  let base=G.team.baseTeams[p]||'A';
  const interval=parseInt(G.team.swapType);
  if(Math.floor(h/interval)%2===1)return base==='A'?'B':base==='B'?'C':'A';
  return base;
}
export function getTeamBadgeProps(h,p){
  if(!G.team.on)return{bg:'transparent',cl:'var(--lbl3)',label:'—'};
  const isOut=skipData[h]?.[p]?.has('team');
  if(isOut)return{bg:'rgba(255,255,255,0.06)',cl:'var(--lbl3)',label:'ไม่เล่น'};
  const isSolo=teamSoloPlayers.has(p);
  if(isSolo)return{bg:'rgba(255,159,10,0.2)',cl:'var(--orange)',label:'⚡Solo'};
  const t=getTeamForHole(h,p);
  const bg=t==='A'?'rgba(10,132,255,0.2)':t==='B'?'rgba(255,69,58,0.18)':t==='C'?'rgba(48,209,88,0.18)':'rgba(10,132,255,0.2)';
  const cl=t==='A'?'var(--blue)':t==='B'?'var(--red)':t==='C'?'var(--green)':'var(--blue)';
  return{bg,cl,label:'ทีม '+t};
}
export function getTeamBadgeHTML(h,p){
  // compat: บางส่วนยังเรียกใช้อยู่
  const {bg,cl,label}=getTeamBadgeProps(h,p);
  return`<button class="pg-tb-btn" style="width:100%;background:${bg};color:${cl}" onclick="toggleTeamScorecard(${h},${p})">${label}</button>`;
}

// ── REFWIDGET ──
export function refWidget(h,p){
  const v=scores[p][h];
  const disp=document.getElementById(`swd-${h}-${p}`);
  const ctrl=document.getElementById(`swc-${h}-${p}`);
  const badge=document.getElementById(`swb-${h}-${p}`);
  if(!disp)return;
  if(v===null){disp.textContent='—';disp.className='sv e';if(ctrl)ctrl.style.background='var(--bg3)';badge.textContent='';badge.className='s-badge';return;}
  disp.textContent=v;disp.className='sv';
  const d=v-pars[h];
  let k='';
  if(v===1)k='hio';else if(d<=-3)k='alba';else if(d===-2)k='e';else if(d===-1)k='bi';
  else if(d===0)k='pa';else if(d===1)k='bo';else if(d===2)k='db';else k='wr';
  const M={hio:{bg:'linear-gradient(135deg,var(--yellow),#c8a000)',t:'HIO',cls:'b-hio'},alba:{bg:'rgba(255,214,10,0.12)',t:'Alba',cls:'b-alba'},e:{bg:'rgba(255,214,10,0.1)',t:'Eagle',cls:'b-eagle'},bi:{bg:'rgba(48,209,88,0.12)',t:'Birdie',cls:'b-birdie'},pa:{bg:'rgba(255,215,0,0.07)',t:'Par',cls:'b-par'},bo:{bg:'rgba(255,255,255,0.05)',t:'Bogey',cls:'b-bogey'},db:{bg:'rgba(255,255,255,0.05)',t:'Double',cls:'b-double'},wr:{bg:'rgba(255,69,58,0.1)',t:'เละ',cls:'b-worse'}};
  if(ctrl)ctrl.style.background=M[k].bg;
  badge.textContent=M[k].t;badge.className=`s-badge ${M[k].cls}`;
}

// ── SCORE CONTROLS — ย้ายไป modules/scoring.js แล้ว ──

// ── SHOW HOLE ──
export function showHole(h){
  setCurrentHole(h);const wrap=document.getElementById('single-hole-wrap');if(!wrap)return;
  updateAddPlayerBtn();
  const turboOn=G.turbo.on&&G.turbo.holes.has(h);
  const scoreRowsHTML=players.map((_,p)=>{
    // ── Olympic grid: DQ/Chip แถวบน · ลง/ไม่ลง แถวล่าง · อันดับสูง 2 แถว ──
    const olyRows = G.olympic.on ? (
      '<div class="oly-grid">'
      + '<button id="oly-dq-'+h+'-'+p+'"   class="ob ob-dq"   onclick="olyAct('+h+','+p+",'dq')\">🚫 DQ</button>"
      + '<button id="oly-chip-'+h+'-'+p+'" class="ob ob-chip" onclick="olyAct('+h+','+p+",'chip')\">🟡 Chip</button>"
      + '<button id="oly-rank-'+h+'-'+p+'" class="ob ob-rank" onclick="olyAct('+h+','+p+",'rank')\"><span class='rn'>—</span><span class='rl'>อันดับ</span></button>"
      + '<button id="oly-sank-'+h+'-'+p+'" class="ob ob-sank" onclick="olyAct('+h+','+p+",'sank')\">ลง ✓</button>"
      + '<button id="oly-miss-'+h+'-'+p+'" class="ob ob-miss" onclick="olyAct('+h+','+p+",'miss')\">ไม่ลง</button>"
      + '</div>'
    ) : '';

    // ── Team badge + Double-Re ──
    const teamPart = G.team.on
      ? `<span id="tb-${h}-${p}">${getTeamBadgeHTML(h,p)}</span>`
      : `<span id="tb-${h}-${p}" style="display:none"></span>`;

    // เบิ้ล-รีในกรอบเดียวกับทีม — Pill Group
    const subRow = G.team.on ? (()=>{
      const m = G.doubleRe.mults[h];
      const dblCls = m===2 ? ' pg-on-dbl' : '';
      const reCls  = m===3 ? ' pg-on-re'  : '';
      const {bg,cl,label} = getTeamBadgeProps(h,p);
      return '<div class="pill-group">'
        + '<button id="tb-'+h+'-'+p+'" class="pg-tb-btn" style="background:'+bg+';color:'+cl+'" onclick="toggleTeamScorecard('+h+','+p+')">'+label+'</button>'
        + '<button class="pg-dr'+dblCls+'" onclick="drSet('+h+',2)">เบิ้ล ×2</button>'
        + '<button class="pg-dr'+reCls+'"  onclick="drSet('+h+',3)">รี ×3</button>'
        + '</div>';
    })() : `<span id="tb-${h}-${p}" style="display:none"></span>`;

    return`<div class="score-row-new${p%2===1?' row-b':''}">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:${G.team.on?'7px':'9px'}">
        <div style="font-size:13px;font-weight:700;color:var(--lbl);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0">${shortName(players[p].name,6)}</div>
        <div class="stepper" id="swc-${h}-${p}" style="flex-shrink:0;width:116px">
          <button class="sb" onpointerdown="startRpt(${h},${p},-1)" onpointerup="stopRpt()" onpointerleave="stopRpt()">−</button>
          <div class="ss"></div>
          <div class="sv e" id="swd-${h}-${p}" ontouchstart="sws(event,${h},${p})" ontouchmove="swm(event,${h},${p})" ontouchend="swe(event,${h},${p})">—</div>
          <div class="ss"></div>
          <button class="sb" onpointerdown="startRpt(${h},${p},1)" onpointerup="stopRpt()" onpointerleave="stopRpt()">+</button>
        </div>
        <div class="s-badge" id="swb-${h}-${p}" style="width:52px;text-align:center;flex-shrink:0"></div>
      </div>
      ${subRow}
      ${olyRows}
    </div>
    `;
  }).join('');

  wrap.innerHTML=`<div class="hole-card">
    <div style="border-bottom:0.5px solid var(--sep)">
      <div onclick="(function(el){var b=document.getElementById('gt-panel-${h}');var open=b.style.display!=='none';b.style.display=open?'none':'block';el.querySelector('.ctrl-arr').style.transform=open?'rotate(-90deg)':'rotate(0)'})(this)"
        style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;cursor:pointer">
        <span style="font-size:12px;font-weight:700;color:var(--lbl)">⚙️ ตั้งค่าหลุมนี้</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span id="gt-summary-${h}" style="font-size:10px;color:var(--lbl2)"></span>
          <span class="ctrl-arr" style="font-size:10px;color:var(--lbl3);transition:transform .2s">▼</span>
        </div>
      </div>
      <div id="gt-panel-${h}" style="display:none">
        <div style="padding:0 14px 10px;border-top:0.5px solid var(--sep)">
          <div style="font-size:10px;font-weight:600;color:var(--lbl3);letter-spacing:0.5px;text-transform:uppercase;padding:8px 0 5px">เกม</div>
          ${(()=>{
            const icons={bite:'🐶',olympic:'🏅',team:'🤝',doubleRe:'🎲',farNear:'🎯'};
            const names={bite:'หมากัด',olympic:'โอลิมปิก',team:'ทีม',doubleRe:'เบิ้ล-รี',farNear:'Far-Near'};
            const btn=(k)=>{const on=G[k].on;return`<button id="gt-${h}-${k}" onclick="toggleGameMidPlay('${k}',${h})" style="flex:1;padding:7px 4px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;border:1.5px solid ${on?'rgba(77,163,255,0.5)':'var(--bg4)'};background:${on?'rgba(77,163,255,0.13)':'var(--bg3)'};color:${on?'#4da3ff':'var(--lbl3)'}">${icons[k]} ${names[k]}</button>`;};
            const turboHoleOn=G.turbo.on&&G.turbo.holes.has(h);
            const turboBtn=G.turbo.on?`<button id="tc2-${h}" onclick="toggleTH(${h})" style="flex:1;padding:7px 4px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;border:1.5px solid ${turboHoleOn?'rgba(255,159,10,0.6)':'var(--bg4)'};background:${turboHoleOn?'rgba(255,159,10,0.18)':'var(--bg3)'};color:${turboHoleOn?'#ff9f0a':'var(--lbl3)'}">⚡ ${turboHoleOn?'หลุมเทอร์โบ':'Turbo'}</button>`:'';
            const row2=turboBtn?`<div style="display:flex;gap:5px;margin-top:5px">${btn('farNear')}${btn('team')}${turboBtn}</div>`:`<div style="display:flex;gap:5px;margin-top:5px">${btn('farNear')}${btn('team')}</div>`;
            return`<div style="display:flex;gap:5px">${btn('bite')}${btn('olympic')}</div>${row2}`;
          })()}
          ${['bite','olympic','farNear'].filter(k=>G[k].on).length>0?`
          <div style="font-size:10px;font-weight:600;color:var(--lbl3);letter-spacing:0.5px;text-transform:uppercase;padding:10px 0 5px">👤 คนไม่เล่น</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${(()=>{
              const gnames={bite:'🐶 หมากัด',olympic:'🏅 โอลิมปิก',farNear:'🎯 Far-Near'};
              return ['bite','olympic','farNear'].filter(k=>G[k].on).map(k=>{
                const btns=players.map((pl,p)=>{const sk=skipData[h]?.[p]?.has(k);const bc=sk?'rgba(255,69,58,0.5)':'var(--bg4)';const bg=sk?'rgba(255,69,58,0.12)':'var(--fill)';const cl=sk?'var(--red)':'var(--lbl2)';const lbl=sk?'✕ '+pl.name:pl.name;return '<button onclick="toggleSkipGame('+h+','+p+`,'`+k+`')" style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid `+bc+';background:'+bg+';color:'+cl+'">'+lbl+'</button>';}).join('');
                return '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:11px;font-weight:700;color:var(--lbl2);min-width:76px">'+gnames[k]+'</span>'+btns+'</div>';
              }).join('');
            })()}
          </div>`:''}
        </div>
      </div>
    </div>
    <div class="score-rows">${scoreRowsHTML}</div>
    ${G.farNear.on&&pars[h]===3?`<div class="fn-wrap"><div class="fn-section-label">🎯 Far-Near</div><select id="fn-mode-${h}" onchange="fnChangeMode(${h},this.value)" style="width:100%;padding:8px 12px;font-size:14px;border-radius:9px;margin-bottom:8px"><option value="none">-- เลือกโหมด --</option><option value="multi">ออน 2 คนขึ้นไป</option><option value="solo">เหมาออนคนเดียว</option></select><div id="fn-ui-${h}" style="display:flex;flex-direction:column;gap:7px"></div></div>`:''}
    ${G.srikrung.on?`<div class="sg-wrap" id="sg-wrap-${h}">
      <div class="section-label" style="color:var(--green)">⛳ Srikrung Golf Day</div>
      <div id="sg-players-${h}"></div></div>`:''}
    <div id="hc-sum-${h}" style="border-top:0.5px solid var(--sep)">
      <div onclick="toggleMatrixSection(${h})"
        style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;cursor:pointer">
        <span style="font-size:13px;font-weight:700;color:var(--lbl)">📊 Matrix หลุม ${h+1}</span>
        <span id="mx-arr-${h}" style="font-size:10px;color:var(--lbl3)">▶</span>
      </div>
      <div id="sum-pills-${h}" style="display:none;padding:0 14px 6px;gap:6px;flex-wrap:wrap"></div>
      <div id="sum-rows-${h}" style="display:none;padding:0 14px 12px"></div>
    </div>
    <!-- 🐉 Dragon Golf Section -->
    <div id="dragon-sec-${h}" class="dragon-sec"></div>
  </div>`;

  players.forEach((_,p)=>refWidget(h,p));
  if(G.olympic.on) _refreshOlyInline(h);
  if(G.farNear.on&&pars[h]===3)fnRenderHole(h);
  if(G.srikrung.on)sgRenderHole(h);
  // Dragon Golf V13
  const drSec = document.getElementById(`dragon-sec-${h}`);
  if(isDragonOn()){
    if(drSec) drSec.classList.add('show');
    renderDragonSection(h);
    renderPotSummary();
  } else {
    if(drSec) drSec.classList.remove('show');
  }
  const prev=document.getElementById('btn-prev');
  if(prev){prev.disabled=h===0;prev.style.opacity=h===0?'0.3':'1';}
  const nxt=document.getElementById('btn-next');
  if(nxt) nxt.textContent=h===17?'🏆':'›';
  updateProgressBar();updateTotals();
  if(!showHole._noScroll) requestAnimationFrame(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;});
  showHole._noScroll=false;
}

// ── UPDATE TOTALS (Matrix ต่อหลุม) ──
// ── OLYMPIC INLINE REFRESH ──
export function _refreshOlyInline(h){
  if(!olympicData[h]) return;
  const od = olympicData[h];
  let dqC = players.filter((_,p)=>['dq','dq-sank','dq-miss'].includes(od.status[p])).length;
  const bPt = 2 + dqC;
  const baseEl = document.getElementById(`oly-base-${h}`);
  if(baseEl) baseEl.textContent = `ฐาน ${bPt}pt`;

  players.forEach((_,p)=>{
    const st  = od.status[p];
    const idx = od.order.indexOf(p);
    const isChip = st==='chip';
    const isDQ   = st==='dq'||st==='dq-sank'||st==='dq-miss';
    const isSank = st==='sank'||st==='dq-sank';
    const isMiss = st==='miss'||st==='dq-miss';

    const setBtn = (id, active, dim, label, isRank)=>{
      const el = document.getElementById(id); if(!el) return;
      const specific = [...el.classList].find(c => c.startsWith('ob-') && c!=='ob-on' && c!=='ob-dim') || '';
      el.className = `ob${specific?' '+specific:''}${active?' ob-on':''}${dim?' ob-dim':''}`;
      if(label !== undefined){
        if(isRank){
          el.innerHTML = '<span class="rn">'+label+'</span>';
        } else {
          el.textContent = label;
        }
      }
    };

    setBtn(`oly-chip-${h}-${p}`, isChip, false, '🟡 Chip');
    setBtn(`oly-dq-${h}-${p}`,   isDQ,   isChip||idx!==-1, '🚫 DQ');
    const rankLabel = idx!==-1 ? 'ระยะ '+Math.min(7,bPt+(od.order.length-1-idx))+'pt' : '—';
    setBtn(`oly-rank-${h}-${p}`, idx!==-1, isChip||isDQ, rankLabel, true);
    setBtn(`oly-sank-${h}-${p}`, isSank, false, isSank?'ลง ✓ ✅':'ลง ✓');
    setBtn(`oly-miss-${h}-${p}`, isMiss, false, 'ไม่ลง');
  });
}

export function drSet(h,m){
  // toggle: กดซ้ำ = ยกเลิก
  G.doubleRe.mults[h]=(G.doubleRe.mults[h]===m)?1:m;
  showHole._noScroll=true;
  showHole(h);updateTotals();autoSave();
}

export function updateTotals(){
  const el=document.getElementById(`sum-rows-${getCurrentHole()}`);if(!el)return;
  const h=getCurrentHole(),n=players.length,fs=tblFs(n),hfs=hdrFs(n);
  const games=['bite','olympic','team','farNear'].filter(k=>G[k].on);
  if(!games.length){el.innerHTML=`<div style="color:var(--lbl3);text-align:center;padding:12px;font-size:13px">ยังไม่ได้เปิดเกมใดเลยครับ</div>`;return;}
  const mh=getHoleMoney(h);
  const gameVal={bite:G.bite.val,olympic:G.olympic.val,team:G.team.val,farNear:G.farNear.val};
  const gameIcons={bite:'🐶',olympic:'🏅',team:'🤝',farNear:'🎯'};
  const gameNames={bite:'หมากัด',olympic:'โอลิมปิก',team:'ทีม',farNear:'Far-Near'};
  const perPairByGame={};
  const turboMult=(G.turbo.on&&G.turbo.holes.has(h))?2:1;
  const drMult=(G.doubleRe.on&&G.doubleRe.mults)?G.doubleRe.mults[h]||1:1;
  games.forEach(k=>{ perPairByGame[k]=Array.from({length:n},()=>Array(n).fill(0)); });
  // bite — pair-by-pair จากสกอร์โดยตรง (แก้ bug net=0)
  if(G.bite.on){
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
      const si=scores[i]?.[h], sj=scores[j]?.[h];
      if(si===null||si===undefined||sj===null||sj===undefined||si===sj) continue;
      if(skipData[h]?.[i]?.has('bite')||skipData[h]?.[j]?.has('bite')) continue;
      const wi=si<sj?i:j, lo=si<sj?j:i;
      const m=getBiteMult(scores[wi][h],pars[h])*turboMult*drMult;
      perPairByGame['bite'][wi][lo]+=m; perPairByGame['bite'][lo][wi]-=m;
    }
  }
  // olympic — คำนวณ pair จาก calcOlympicHole โดยตรง (ถูกต้อง)
  if(games.includes('olympic')){
    const od=olympicData[h], r=G.olympic.val;
    const dqC=players.filter((_,p)=>['dq','dq-sank','dq-miss'].includes(od.status[p])).length;
    const bPt=2+dqC, ordLen=od.order.length;
    const infOly=players.map((_,p)=>{
      const st=od.status[p], idx=od.order.indexOf(p);
      let base=null, sank=false;
      if(st==='chip'){base=(G.dragon&&G.dragon.on)?8:7;sank=true;}
      else if(st==='sank'&&idx!==-1){base=Math.min(7,bPt+(ordLen-1-idx));sank=true;}
      else if(st==='miss'&&idx!==-1){base=Math.min(7,bPt+(ordLen-1-idx));sank=false;}
      else if(st==='dq-sank'){base=1;sank=true;}
      else if(st==='dq-miss'){base=1;sank=false;}
      if(base===null)return{p,pts:null,sank:false};
      const s=scores[p][h], mult=s?getOlyMult(s,pars[h]):1;
      return{p,pts:base*mult,base,sank};
    });
    const sankersOly=infOly.filter(x=>x.sank&&x.pts!==null);
    const missersOly=infOly.filter(x=>!x.sank&&x.pts!==null);
    // sanker vs sanker → ส่วนต่าง pair-by-pair
    for(let i=0;i<sankersOly.length;i++)for(let j=i+1;j<sankersOly.length;j++){
      const a=sankersOly[i],b=sankersOly[j];
      const diff=Math.round(Math.abs(a.pts-b.pts)*turboMult*drMult);
      if(a.pts>b.pts){perPairByGame['olympic'][a.p][b.p]+=diff;perPairByGame['olympic'][b.p][a.p]-=diff;}
      else if(b.pts>a.pts){perPairByGame['olympic'][b.p][a.p]+=diff;perPairByGame['olympic'][a.p][b.p]-=diff;}
    }
    // sanker vs misser → misser จ่าย pts ของ sanker นั้นๆ (คูณ turbo+dr)
    for(const s of sankersOly)for(const ms of missersOly){
      const tv=s.pts*turboMult*drMult;
      perPairByGame['olympic'][s.p][ms.p]+=tv;
      perPairByGame['olympic'][ms.p][s.p]-=tv;
    }
    // sanker vs sanker ก็ต้องคูณ turbo+dr
    // (ทำไว้แล้วด้านบนแต่ยังไม่คูณ — fix)
  }
  // team / farNear — ใช้ net money แบ่งตาม loses
  ['team','farNear'].filter(k=>games.includes(k)).forEach(k=>{
    const arr=mh[k],val=gameVal[k]||1;
    const wins=players.map((_,i)=>i).filter(i=>arr[i]>0);
    const loses=players.map((_,i)=>i).filter(i=>arr[i]<0);
    wins.forEach(i=>{if(!loses.length)return;const share=Math.round(arr[i]/val/loses.length);loses.forEach(j=>{perPairByGame[k][i][j]+=share;perPairByGame[k][j][i]-=share;});});
  });
  const perPairAll=Array.from({length:n},()=>Array(n).fill(0));
  games.forEach(k=>{for(let i=0;i<n;i++)for(let j=0;j<n;j++)perPairAll[i][j]+=perPairByGame[k][i][j];});
  window._holeMatrixData={all:perPairAll};
  games.forEach(k=>{window._holeMatrixData[k]=perPairByGame[k];});

  function renderCell(v){
    if(v===0) return '<td style="text-align:center;color:var(--lbl3);padding:7px 4px;border-bottom:0.5px solid var(--sep)">·</td>';
    const c=v>0?'var(--green)':'var(--red)';
    const bg=v>0?'rgba(52,209,122,0.08)':'rgba(255,92,82,0.07)';
    const sign=v>0?'+':'';
    return '<td style="text-align:center;font-size:'+fs+';font-weight:700;color:'+c+';background:'+bg+';padding:7px 4px;border-bottom:0.5px solid var(--sep)">'+sign+v+'</td>';
  }
  function renderTotCell(tot){
    const c=tot>0?'var(--green)':tot<0?'var(--red)':'var(--lbl2)';
    const bg=tot>0?'rgba(52,209,122,0.13)':tot<0?'rgba(255,92,82,0.11)':'var(--bg3)';
    const sign=tot>0?'+':'';
    return '<td style="text-align:center;font-size:'+fs+';font-weight:800;color:'+c+';background:'+bg+';padding:7px 4px;border-bottom:0.5px solid var(--sep);border-left:2px solid rgba(77,163,255,0.3)">'+sign+tot+'</td>';
  }
  function renderHoleTable(pp){
    const rowTot=pp.map(row=>row.reduce((a,b)=>a+b,0));
    const thS='padding:6px 4px;font-size:'+hfs+';font-weight:700;text-align:center;background:rgba(77,163,255,0.12);color:rgba(77,163,255,0.9);border-bottom:1px solid rgba(77,163,255,0.2)';
    const thN='padding:6px 4px 6px 8px;font-size:'+hfs+';font-weight:700;text-align:left;background:rgba(77,163,255,0.12);color:var(--lbl2);border-bottom:1px solid rgba(77,163,255,0.2)';
    let t='<div style="overflow-x:auto;border-radius:10px;border:1px solid var(--bg4)"><table style="width:100%;border-collapse:collapse"><thead><tr>';
    t+='<th style="'+thN+'">ผู้เล่น</th>';
    players.forEach(pl=>{ t+='<th style="'+thS+'">'+shortName(pl.name,n)+'</th>'; });
    t+='<th style="'+thS+';background:rgba(77,163,255,0.2);border-left:2px solid rgba(77,163,255,0.35)">รวม pt</th>';
    t+='</tr></thead><tbody>';
    players.forEach((pl,i)=>{
      t+='<tr>';
      t+='<td style="padding:7px 4px 7px 8px;font-size:'+hfs+';font-weight:700;color:var(--lbl);background:var(--bg3);border-bottom:0.5px solid var(--sep)">'+shortName(pl.name,n)+'</td>';
      players.forEach((_,j)=>{
        if(i===j){ t+='<td style="background:var(--bg4);border-bottom:0.5px solid var(--sep)"></td>'; return; }
        t+=renderCell(pp[i][j]);
      });
      t+=renderTotCell(rowTot[i]);
      t+='</tr>';
    });
    t+='</tbody></table></div>';
    return t;
  }

  const pillsHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"><button id="hmpill-all" onclick="setHoleMatrixPill('all')" style="padding:5px 12px;border-radius:14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid rgba(10,132,255,0.6);background:rgba(10,132,255,0.18);color:var(--blue)">📊 รวม</button>${games.map(k=>`<button id="hmpill-${k}" onclick="setHoleMatrixPill('${k}')" style="padding:5px 12px;border-radius:14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid var(--bg4);background:var(--fill);color:var(--lbl2)">${gameIcons[k]} ${gameNames[k]}</button>`).join('')}</div>`;
  const pillsEl = document.getElementById(`sum-pills-${getCurrentHole()}`);
  if(pillsEl) pillsEl.innerHTML = pillsHTML;
  el.innerHTML=`<div id="hole-matrix-table">${renderHoleTable(perPairAll)}</div>`;
}

export function setHoleMatrixPill(key){
  if(!window._holeMatrixData)return;
  const n=players.length,fs=tblFs(n),hfs=hdrFs(n);
  const pp=window._holeMatrixData[key];
  const rowTot=pp.map(row=>row.reduce((a,b)=>a+b,0));
  function cell(v){
    if(v===0) return '<td style="text-align:center;color:var(--lbl3);padding:7px 4px;border-bottom:0.5px solid var(--sep)">·</td>';
    const c=v>0?'var(--green)':'var(--red)';
    const bg=v>0?'rgba(52,209,122,0.08)':'rgba(255,92,82,0.07)';
    return '<td style="text-align:center;font-size:'+fs+';font-weight:700;color:'+c+';background:'+bg+';padding:7px 4px;border-bottom:0.5px solid var(--sep)">'+(v>0?'+':'')+v+'</td>';
  }
  function totCell(tot){
    const c=tot>0?'var(--green)':tot<0?'var(--red)':'var(--lbl2)';
    const bg=tot>0?'rgba(52,209,122,0.13)':tot<0?'rgba(255,92,82,0.11)':'var(--bg3)';
    return '<td style="text-align:center;font-size:'+fs+';font-weight:800;color:'+c+';background:'+bg+';padding:7px 4px;border-bottom:0.5px solid var(--sep);border-left:2px solid rgba(77,163,255,0.3)">'+(tot>0?'+':'')+tot+'</td>';
  }
  const thS='padding:6px 4px;font-size:'+hfs+';font-weight:700;text-align:center;background:rgba(77,163,255,0.12);color:rgba(77,163,255,0.9);border-bottom:1px solid rgba(77,163,255,0.2)';
  const thN='padding:6px 4px 6px 8px;font-size:'+hfs+';font-weight:700;text-align:left;background:rgba(77,163,255,0.12);color:var(--lbl2);border-bottom:1px solid rgba(77,163,255,0.2)';
  let t='<div style="overflow-x:auto;border-radius:10px;border:1px solid var(--bg4)"><table style="width:100%;border-collapse:collapse"><thead><tr>';
  t+='<th style="'+thN+'">ผู้เล่น</th>';
  players.forEach(pl=>{ t+='<th style="'+thS+'">'+shortName(pl.name,n)+'</th>'; });
  t+='<th style="'+thS+';background:rgba(77,163,255,0.2);border-left:2px solid rgba(77,163,255,0.35)">รวม pt</th></tr></thead><tbody>';
  players.forEach((pl,i)=>{
    t+='<tr><td style="padding:7px 4px 7px 8px;font-size:'+hfs+';font-weight:700;color:var(--lbl);background:var(--bg3);border-bottom:0.5px solid var(--sep)">'+shortName(pl.name,n)+'</td>';
    players.forEach((_,j)=>{
      if(i===j){ t+='<td style="background:var(--bg4);border-bottom:0.5px solid var(--sep)"></td>'; return; }
      t+=cell(pp[i][j]);
    });
    t+=totCell(rowTot[i])+'</tr>';
  });
  t+='</tbody></table></div>';
  document.getElementById('hole-matrix-table').innerHTML=t;
  document.querySelectorAll('[id^="hmpill-"]').forEach(btn=>{
    const k=btn.id.replace('hmpill-','');const on=k===key;
    btn.style.borderColor=on?'rgba(77,163,255,0.6)':'';
    btn.style.background=on?'rgba(77,163,255,0.18)':'';
    btn.style.color=on?'var(--blue)':'';
  });
}

export function lbToggleMatrix(h){
  const rows=document.getElementById(`sum-rows-${h}`),arrow=document.getElementById(`hc-sum-arrow-${h}`);if(!rows)return;
  const open=rows.style.display!=='none';rows.style.display=open?'none':'block';if(arrow)arrow.style.transform=open?'':'rotate(180deg)';
}

// ── BUILD RESULTS ──
export function buildResults(){
  const n=players.length,fs=tblFs(n),hfs=hdrFs(n);
  const ds=fmtDate(document.getElementById('game-date').value);
  const cn=document.getElementById('course-name').value||'ไม่ระบุสนาม';
  const stats=players.map((pl,p)=>{
    let tot=0,hio=0,alba=0,e=0,bi=0,pa=0,bo=0,db=0,mx=0;
    scores[p].forEach((s,h)=>{if(s===null)return;tot+=s;const d=s-pars[h];if(s===1)hio++;else if(d<=-3)alba++;else if(d===-2)e++;else if(d===-1)bi++;else if(d===0)pa++;else if(d===1)bo++;else if(d===2)db++;else mx++;});
    return{...pl,tot,net:tot-pl.hcp,hio,alba,e,bi,pa,bo,db,mx};
  });
  const rankHTML=[...stats].sort((a,b)=>a.net-b.net).map((st,rk)=>`
    <div class="rank-card" style="border-left:3px solid ${rk===0?'var(--blue)':rk===1?'rgba(255,255,255,0.3)':'transparent'}">
      <div class="rank-num" style="color:${rk===0?'var(--blue)':rk===1?'var(--lbl2)':'var(--lbl3)'}">${rk===0?'🥇':rk===1?'🥈':rk===2?'🥉':'#'+(rk+1)}</div>
      <div><div class="rank-name">${st.name}</div><div class="rank-sub">HCP ${st.hcp}</div></div>
      <div class="rank-net" style="color:${st.net<0?'var(--red)':st.net>0?'var(--green)':'var(--lbl2)'}">${st.tot>0?st.net:'—'}</div>
    </div>`).join('');
  const L=document.body.classList.contains('light');
  const thBg=L?'#1a4a8a':'#1a3a6e';
  const thBd=L?'#0d3070':'#2a4a8e';
  // responsive font + layout ตามจำนวนคน
  const narrow=n<=3;
  const fsSc=n<=2?20:n<=3?18:n<=4?17:15;
  const fsHdr=n<=3?14:13;
  const fsSub=n<=3?16:14;
  const fsTot=n<=2?26:n<=3?22:n<=4?20:18;
  const wBall=n<=2?28:n<=4?26:22;
  const hW=narrow?'12%':'6%', pW=narrow?'11%':'5%';
  const nmW=((100-parseFloat(hW)-parseFloat(pW))/n).toFixed(1)+'%';
  const thS=`padding:8px 1px;font-size:${fsHdr}px;font-weight:700;color:${L?'#fff':'#ffd700'};text-align:center;background:${thBg};border:1px solid ${thBd};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:0`;
  const tdBd=L?'1px solid #bbb':'1px solid #333';
  const rowOdd=L?'background:#fff':'background:#131f30';
  const rowEven=L?'background:#f5f7fa':'background:#0f1a28';
  const hColStyle=`text-align:center;font-size:${fsHdr-1}px;font-weight:600;color:${L?'#555':'#ffd700'};padding:10px 2px;${L?'background:#eef2fa':'background:#0a1520'};border:${tdBd}`;
  const wrapBg=L?'background:#fff':'background:#0d1320';
  // ≤3 คน: center + max-width เพื่อไม่ให้คอลัมน์กว้างเกิน
  const maxW=narrow?`${Math.max(280,n*160)}px`:'100%';
  const tblWrap=`<div class="tbl-wrap" style="${wrapBg};margin-left:auto;margin-right:auto;max-width:${maxW}">`;
  let tblHTML=`${tblWrap}<table class="tbl-new" style="border-collapse:collapse;width:100%"><colgroup><col style="width:${hW}"><col style="width:${pW}">${players.map(()=>`<col style="width:${nmW}">`).join('')}</colgroup><thead><tr><th style="${thS}">H</th><th style="${thS}">P</th>${players.map(p=>`<th style="${thS}">${shortName(p.name,n)}</th>`).join('')}</tr></thead><tbody>`;
  for(let h=0;h<18;h++){
    const rowBg=h%2===0?rowOdd:rowEven;
    tblHTML+=`<tr style="${rowBg}"><td style="${hColStyle}">${h+1}</td><td style="${hColStyle}">${pars[h]}</td>${players.map((_,p)=>scoreCell(scores[p][h],pars[h],fsSc+'px',tdBd)).join('')}</tr>`;
    if(h===8){
      const subBg=L?'background:#ddeeff':'background:rgba(255,215,0,0.1)';
      const subCl=L?'#1a4a8a':'#ffd700';
      const par9a=pars.slice(0,9).reduce((s,v)=>s+v,0);
      const overPosCl=L?'#cc4400':'#ff9966';
      const overNegCl=L?'#004fc4':'#4da3ff';
      tblHTML+=`<tr style="${subBg}"><td colspan="2" style="text-align:center;font-size:${fsHdr}px;font-weight:800;color:${L?'#1a4a8a':'#fff'};padding:8px 2px;border:${tdBd}">9 แรก</td>${players.map((_,p)=>{
        const f9=scores[p].slice(0,9).reduce((s,v)=>s+(v||0),0);
        const f9valid=scores[p].slice(0,9).some(v=>v!==null);
        if(!f9valid) return`<td style="text-align:center;padding:8px 2px;border:${tdBd}"><span style="color:${subCl};font-size:${fs};font-weight:800">—</span></td>`;
        const diff=f9-par9a;
        const overCl=diff>0?overPosCl:diff<0?overNegCl:'rgba(150,150,150,0.8)';
        const overTxt=diff===0?'E':(diff>0?'+':'')+diff;
        return`<td style="text-align:center;padding:8px 2px;border:${tdBd}"><div style="color:${subCl};font-size:${fsSub}px;font-weight:800">${f9}</div><div style="font-size:10px;font-weight:700;color:${overCl};margin-top:1px">เกิน ${overTxt}</div></td>`;
      }).join('')}</tr>`;
    }
    if(h===17){
      const subBg=L?'background:#ddeeff':'background:rgba(255,215,0,0.1)';
      const subCl=L?'#1a4a8a':'#ffd700';
      const totBg=L?'background:#1a4a8a':'background:rgba(255,215,0,0.22)';
      const totCl=L?'#fff':'#ffd700';
      const par9b=pars.slice(9,18).reduce((s,v)=>s+v,0);
      const parTot=pars.reduce((s,v)=>s+v,0);
      const overPosCl=L?'#cc4400':'#ff9966';
      const overNegCl=L?'#004fc4':'#4da3ff';
      const overPosTot=L?'#ffbb88':'#ff9966';
      const overNegTot=L?'#88ddff':'#4da3ff';
      tblHTML+=`<tr style="${subBg}"><td colspan="2" style="text-align:center;font-size:${fsHdr}px;font-weight:800;color:${L?'#1a4a8a':'#fff'};padding:8px 2px;border:${tdBd}">9 หลัง</td>${players.map((_,p)=>{
        const b9=scores[p].slice(9,18).reduce((s,v)=>s+(v||0),0);
        const b9valid=scores[p].slice(9,18).some(v=>v!==null);
        if(!b9valid) return`<td style="text-align:center;padding:8px 2px;border:${tdBd}"><span style="color:${subCl};font-size:${fs};font-weight:800">—</span></td>`;
        const diff=b9-par9b;
        const overCl=diff>0?overPosCl:diff<0?overNegCl:'rgba(150,150,150,0.8)';
        const overTxt=diff===0?'E':(diff>0?'+':'')+diff;
        return`<td style="text-align:center;padding:8px 2px;border:${tdBd}"><div style="color:${subCl};font-size:${fsSub}px;font-weight:800">${b9}</div><div style="font-size:10px;font-weight:700;color:${overCl};margin-top:1px">เกิน ${overTxt}</div></td>`;
      }).join('')}</tr>`;
      tblHTML+=`<tr style="${totBg}"><td colspan="2" style="text-align:center;font-size:${fsHdr}px;font-weight:800;color:#fff;padding:10px 2px;border:${tdBd}">รวม</td>${players.map((_,p)=>{
        const tot=scores[p].reduce((s,v)=>s+(v||0),0);
        const hcp=players[p].hcp||0;
        const net=tot-hcp;
        const valid=scores[p].some(v=>v!==null);
        const netColor=net<0?'var(--green)':net>0?'var(--red)':'var(--lbl)';
        if(!valid) return`<td style="text-align:center;padding:10px 2px;border:${tdBd}"><span style="color:${totCl};font-size:${fsTot}px;font-weight:800">—</span></td>`;
        // ใช้ par เฉพาะหลุมที่เล่นจริง
        const playedParTot=pars.reduce((s,v,h)=>s+(scores[p][h]!==null&&scores[p][h]!==undefined?v:0),0);
        const diff=tot-playedParTot;
        const overCl=diff>0?overPosTot:diff<0?overNegTot:'rgba(255,255,255,0.5)';
        const overTxt=diff===0?'E':(diff>0?'+':'')+diff;
        return`<td style="text-align:center;padding:10px 2px;border:${tdBd}"><div style="color:${totCl};font-size:${fsTot}px;font-weight:800">${tot}</div>${hcp>0?`<div style="font-size:10px;color:${netColor};margin-top:1px">Net ${net}</div>`:''}<div style="font-size:10px;font-weight:700;color:${overCl};margin-top:1px">เกิน ${overTxt}</div></td>`;
      }).join('')}</tr>`;
    }
  }
  // ── stats table ใหม่ มีเส้น border ──
  const statRows=[
    {label:'HIO',key:'hio',dc:'#ffd700',lc:'#b8860b'},
    {label:'Alb',key:'alba',dc:'#ffd700',lc:'#8a6c00'},
    {label:'Eagle',key:'e',dc:'#60b4ff',lc:'#1d5fa0'},
    {label:'Birdie',key:'bi',dc:'#34d399',lc:'#16803c'},
    {label:'Par',key:'pa',dc:'rgba(255,215,0,0.7)',lc:'#b8860b'},
    {label:'Bogey',key:'bo',dc:'#666',lc:'#aaa'},
    {label:'Double',key:'db',dc:'#666',lc:'#aaa'},
    {label:'เละ',key:'mx',dc:'#ff6b61',lc:'#cc2222'},
  ];
  const sthBg=L?'#1a4a8a':'#1a3a6e', sthBd=L?'#0d3070':'#2a4a8e';
  const stTdBd=L?'1px solid #dde':'1px solid #1e2d45';
  const stRowO=L?'background:#fff':'background:#131f30';
  const stRowE=L?'background:#f5f7fa':'background:#0f1a28';
  const stWrap=L?'background:#fff':'background:#0d1320';
  tblHTML+=`<div class="tbl-wrap" style="margin-top:12px;${stWrap}"><table class="tbl-new" style="border-collapse:collapse;width:100%"><thead><tr>
    <th style="text-align:left;padding:10px 12px;font-size:${hfs};font-weight:700;color:${L?'#fff':'#ffd700'};background:${sthBg};border:1px solid ${sthBd};width:22%">📊 สถิติ</th>
    ${players.map(p=>`<th style="text-align:center;padding:8px 1px;font-size:${hfs};font-weight:700;color:${L?'#fff':'#ffd700'};background:${sthBg};border:1px solid ${sthBd};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:0">${shortName(p.name,n)}</th>`).join('')}
    </tr></thead><tbody>`;
  statRows.forEach((sr,ri)=>{
    // ซ่อนแถวถ้าไม่มีค่าในสถิตินั้นเลย
    const hasAny=stats.some(st=>st[sr.key]>0);
    if(!hasAny) return;
    const rowBg=ri%2===0?stRowO:stRowE;
    const sc=L?sr.lc:sr.dc;
    tblHTML+=`<tr style="${rowBg}"><td style="text-align:left;padding:9px 12px;font-size:${hfs};font-weight:700;color:${sc};border:${stTdBd}">${sr.label}</td>${stats.map(st=>{const v=st[sr.key];return`<td style="text-align:center;font-size:${fs};font-weight:${v>0?700:400};color:${v>0?sc:'var(--lbl4,#333)'};padding:9px 3px;border:${stTdBd}">${v>0?v:'—'}</td>`;}).join('')}</tr>`;
  });
  tblHTML+=`</tbody></table></div>`;
  tblHTML+=`</tbody></table></div>`;

  // ── Srikrung Summary ──
  let sgHTML = '';
  if(G.srikrung.on && srikrungData.length){
    const sgSt = players.map((pl,p)=>{
      let fw=0,gir=0,putt=0,chip=0,holes=0;
      srikrungData.forEach(hd=>{
        const d=hd[p]; if(!d) return;
        if(d.fw===true) fw++;
        if(d.gir===true) gir++;
        if(d.putt!==null && d.putt!==undefined){ if(d.putt===0) chip++; else putt+=d.putt; holes++; }
      });
      return{name:pl.name,fw,gir,putt,chip,holes};
    });
    const sgTh=`padding:7px 4px;font-size:${hfs};font-weight:600;color:var(--lbl2);text-align:center;background:var(--bg3);border-bottom:0.5px solid var(--sep)`;
    sgHTML=`
    <div class="tbl-wrap"><table class="tbl-inner">
      <thead><tr>
        <th style="${sgTh};text-align:left;padding-left:10px">ผู้เล่น</th>
        <th style="${sgTh}">FW</th>
        <th style="${sgTh}">GIR</th>
        <th style="${sgTh}">พัต</th>
        <th style="${sgTh}">Chip</th>
      </tr></thead>
      <tbody>
        ${sgSt.map(s=>`<tr style="border-bottom:0.5px solid var(--sep)">
          <td style="font-size:${fs};font-weight:600;color:var(--lbl);padding:6px 4px 6px 10px;white-space:nowrap">${s.name}</td>
          <td style="text-align:center;font-size:${fs};font-weight:700;color:${s.fw>0?'var(--green)':'var(--lbl3)'};padding:6px 2px">${s.fw>0?s.fw:'—'}</td>
          <td style="text-align:center;font-size:${fs};font-weight:700;color:${s.gir>0?'var(--blue)':'var(--lbl3)'};padding:6px 2px">${s.gir>0?s.gir:'—'}</td>
          <td style="text-align:center;font-size:${fs};font-weight:700;color:${s.holes>0?'var(--lbl)':'var(--lbl3)'};padding:6px 2px">${s.holes>0?s.putt:'—'}</td>
          <td style="text-align:center;font-size:${fs};font-weight:700;color:${s.chip>0?'var(--orange)':'var(--lbl3)'};padding:6px 2px">${s.chip>0?s.chip:'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  document.getElementById('res-content').innerHTML=`
    <div style="text-align:center;margin-bottom:14px;padding-bottom:12px;border-bottom:0.5px solid var(--sep)">
      <div style="font-size:11px;font-weight:600;color:var(--lbl2);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">⛳ ผลการแข่งขัน</div>
      <div style="font-size:22px;font-weight:700;color:var(--lbl)">${cn}</div>
      <div style="font-size:13px;color:var(--lbl2);margin-top:3px">${ds}</div>
    </div>
    <div style="font-size:15px;font-weight:700;color:var(--lbl);margin-bottom:8px">📋 สกอร์รายหลุม</div>
    ${tblHTML}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
      <button class="nav-b" onclick="document.getElementById('rank-section').style.display=document.getElementById('rank-section').style.display==='none'?'block':'none'">🏆 ดูอันดับ ↕</button>
    </div>
    <div id="rank-section" style="display:none;margin-top:12px">
      <div style="font-size:15px;font-weight:700;color:var(--lbl);margin-bottom:8px">🏆 อันดับ</div>
      ${rankHTML}
    </div>
    ${sgHTML ? `
    <div style="margin-top:12px">
      <button onclick="var b=document.getElementById('sg-res');b.style.display=b.style.display==='none'?'block':'none';this.querySelector('.arr').style.transform=b.style.display==='block'?'rotate(180deg)':''"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;
        padding:12px 14px;background:rgba(52,209,88,0.08);border:1.5px solid rgba(52,209,88,0.25);
        border-radius:12px;cursor:pointer;font-family:inherit">
        <span style="font-size:14px;font-weight:700;color:var(--green)">⛳ สถิติ Srikrung Golf Day</span>
        <span class="arr" style="font-size:13px;color:var(--lbl3);transition:transform .2s">▼</span>
      </button>
      <div id="sg-res" style="display:none;margin-top:6px">${sgHTML}</div>
    </div>` : ''}
    <a href="https://insure.724.co.th/golf-insure/u/AM00035138" target="_blank" data-html2canvas-ignore="true"
      style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin-top:12px;
      background:linear-gradient(135deg,#1a6a3a,#2d9e5c);border-radius:12px;text-decoration:none">
      <div style="font-size:28px;flex-shrink:0">⛳</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#fff">ประกันกอล์ฟ ครอบคลุม Hole-in-One</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px">ศรีกรุงโบรคเกอร์ · www.ศรีกรุง.com</div>
      </div>
      <div style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.2);
        border:1.5px solid rgba(255,255,255,0.5);color:#fff;font-size:12px;font-weight:700;white-space:nowrap">
        ดูรายละเอียด
      </div>
    </a>`;
}

// ── BUILD MONEY ──
export function buildMoney(){
  const n=players.length,fs=tblFs(n),hfs=hdrFs(n);
  let tot=Array(n).fill(0);
  const gTot={bite:Array(n).fill(0),olympic:Array(n).fill(0),team:Array(n).fill(0),farNear:Array(n).fill(0)};
  const hcapLiveAll=computeHcapLiveAll(),hcapFinalEnd=calcHcapFinalEnd(),hcapTot=Array(n).fill(0);
  const allMH=Array.from({length:18},(_,h)=>{
    const mh=getHoleMoney(h),hcapStroke=calcHcapHole(h);
    players.forEach((_,p)=>{
      tot[p]+=mh.bite[p]+mh.olympic[p]+mh.team[p]+mh.farNear[p];
      gTot.bite[p]+=mh.bite[p];gTot.olympic[p]+=mh.olympic[p];gTot.team[p]+=mh.team[p];gTot.farNear[p]+=mh.farNear[p];
      const hcapH=hcapStroke[p]+hcapLiveAll[h][p];hcapTot[p]+=hcapH;tot[p]+=hcapH;
    });return mh;
  });
  players.forEach((_,p)=>{hcapTot[p]+=hcapFinalEnd[p];tot[p]+=hcapFinalEnd[p];});
  tot=tot.map(v=>Math.round(v));
  Object.keys(gTot).forEach(k=>{gTot[k]=gTot[k].map(v=>Math.round(v));});
  const hcapTotR=hcapTot.map(v=>Math.round(v));
  const hasHcap=G.hcap.on&&G.hcap.pairs.some(p=>p.on)&&hcapTotR.some(v=>v!==0);
  const gridCols=n<=4?`repeat(${n},1fr)`:'repeat(3,1fr)';
  let netHTML=`<div style="display:grid;grid-template-columns:${gridCols};gap:8px;margin-bottom:14px">`;
  [...players.map((pl,p)=>({...pl,total:tot[p],idx:p}))].sort((a,b)=>b.total-a.total).forEach(pl=>{
    const v=pl.total;
    const games=['bite','olympic','team','farNear'].filter(k=>G[k].on&&gTot[k][pl.idx]!==0).map(k=>{const vv=gTot[k][pl.idx];return`${ICONS[k]}<span style="color:${vv>0?'var(--green)':'var(--red)'};font-size:9px">${vv>0?'+':''}${vv}</span>`;}).join(' ');
    const hv=hcapTotR[pl.idx];const hcapTag=hasHcap&&hv!==0?` <span style="color:${hv>0?'var(--green)':'var(--red)'};font-size:9px">🎯${hv>0?'+':''}${hv}</span>`:'';
    netHTML+=`<div style="background:var(--bg2);border-radius:12px;padding:10px 12px;border:0.5px solid ${v>0?'rgba(48,209,88,0.3)':v<0?'rgba(255,69,58,0.3)':'var(--sep)'}"><div style="font-size:11px;color:var(--lbl2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pl.name}</div><div style="font-size:${n<=3?22:18}px;font-weight:800;color:${v>0?'var(--green)':v<0?'var(--red)':'var(--lbl2)'};margin-top:3px">${v>0?'+':''}${v.toLocaleString()}฿</div><div style="font-size:9px;color:var(--lbl2);margin-top:3px;line-height:1.6">${games}${hcapTag}</div></div>`;
  });
  netHTML+='</div>';
  let txs=[],bal=[...tot],pos=[],neg=[];
  for(let i=0;i<n;i++){if(bal[i]>0)pos.push({name:players[i].name,b:bal[i]});else if(bal[i]<0)neg.push({name:players[i].name,b:Math.abs(bal[i])});}
  pos.sort((a,b)=>b.b-a.b);neg.sort((a,b)=>a.b-b.b);
  let pi=0,ni=0;
  while(pi<pos.length&&ni<neg.length){const amt=Math.min(pos[pi].b,neg[ni].b);if(amt>0)txs.push({from:neg[ni].name,to:pos[pi].name,amt});pos[pi].b-=amt;neg[ni].b-=amt;if(pos[pi].b===0)pi++;if(neg[ni].b===0)ni++;}
  const transfersHTML=txs.length?`<div class="money-card"><div class="mc-hdr"><div class="mc-lbl">โอนให้</div></div>${txs.map(tx=>`<div class="m-row"><div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-size:15px;color:var(--red);font-weight:600">${tx.from}</span><span style="font-size:18px;color:var(--lbl3);line-height:1">→</span><span style="font-size:15px;color:var(--green);font-weight:600">${tx.to}</span></div><div class="m-amt mw" style="font-size:20px">${tx.amt.toLocaleString()}฿</div></div>`).join('')}</div>`:'';
  const thS=`padding:7px 2px;font-size:${hfs};font-weight:600;color:var(--lbl2);text-align:center;background:var(--bg3);border-bottom:0.5px solid var(--sep)`;
  const front9Tot=players.map((_,p)=>Array.from({length:9},(_,h)=>allMH[h].bite[p]+allMH[h].olympic[p]+allMH[h].team[p]+allMH[h].farNear[p]).reduce((a,b)=>a+b,0));
  const back9Tot=players.map((_,p)=>Array.from({length:9},(_,i)=>{const h=i+9;return allMH[h].bite[p]+allMH[h].olympic[p]+allMH[h].team[p]+allMH[h].farNear[p];}).reduce((a,b)=>a+b,0));
  const subRowStyle=`background:rgba(10,132,255,0.07);border-top:1px solid rgba(10,132,255,0.25);border-bottom:1px solid rgba(10,132,255,0.25)`;
  let masterHTML=`<div class="tbl-wrap"><table class="tbl-inner"><thead><tr><th style="${thS};width:${n<=3?'14%':'10%'}">H</th><th style="${thS};width:${n<=3?'12%':'9%'}">P</th>${players.map(p=>`<th style="${thS}">${shortName(p.name,n)}</th>`).join('')}</tr></thead><tbody>`;
  for(let h=0;h<18;h++){
    const mh=allMH[h];masterHTML+=`<tr style="border-bottom:0.5px solid var(--sep)"><td style="text-align:center;font-size:${fs};color:var(--lbl2);padding:${fs<=12?5:6}px 2px">${h+1}</td><td style="text-align:center;font-size:${fs};color:var(--lbl2);padding:${fs<=12?5:6}px 2px">${pars[h]}</td>${players.map((_,p)=>moneyCell(mh.bite[p]+mh.olympic[p]+mh.team[p]+mh.farNear[p],fs)).join('')}</tr>`;
    if(h===8){masterHTML+=`<tr style="${subRowStyle}"><td colspan="2" style="text-align:center;font-size:${hfs};font-weight:700;color:var(--blue);padding:7px 2px">หน้า 9</td>${front9Tot.map(v=>`<td style="text-align:center;font-size:${fs};font-weight:800;color:${v>0?'var(--green)':v<0?'var(--red)':'var(--lbl2)'};padding:7px 2px">${v>0?'+':''}${v.toLocaleString()}</td>`).join('')}</tr>`;}
  }
  masterHTML+=`<tr style="${subRowStyle}"><td colspan="2" style="text-align:center;font-size:${hfs};font-weight:700;color:var(--blue);padding:7px 2px">หลัง 9</td>${back9Tot.map(v=>`<td style="text-align:center;font-size:${fs};font-weight:800;color:${v>0?'var(--green)':v<0?'var(--red)':'var(--lbl2)'};padding:7px 2px">${v>0?'+':''}${v.toLocaleString()}</td>`).join('')}</tr>`;
  masterHTML+=`<tr style="background:var(--bg3);border-top:1.5px solid var(--blue)"><td colspan="2" style="text-align:center;font-size:${hfs};font-weight:700;color:var(--blue);padding:8px 2px">รวม ฿</td>${players.map((_,p)=>{const v=tot[p];return`<td style="text-align:center;font-size:${fs};font-weight:800;color:${v>0?'var(--green)':v<0?'var(--red)':'var(--lbl2)'};padding:8px 2px">${v>0?'+':''}${v.toLocaleString()}</td>`;}).join('')}</tr></tbody></table></div>`;

  document.getElementById('money-content').innerHTML=`
    <div style="text-align:center;margin-bottom:14px;padding-bottom:12px;border-bottom:0.5px solid var(--sep)">
      <div style="font-size:20px;font-weight:700;color:var(--lbl)">${document.getElementById('course-name').value||'ไม่ระบุสนาม'}</div>
    </div>
    <div style="font-size:15px;font-weight:700;color:var(--lbl);margin-bottom:10px">📊 Matrix พ้อย</div>
    ${buildMatrixHTML(gTot,n,fs,hfs)}
    <button class="nav-b pr" style="width:100%;margin:14px 0 4px;font-size:16px;padding:14px" onclick="showMoneyDetail(this)">💵 คำนวณเงิน</button>
    <div id="money-detail" style="display:none;margin-top:4px">
      ${netHTML}${transfersHTML}
      <div style="font-size:15px;font-weight:700;color:var(--lbl);margin:14px 0 8px">📋 MASTER รายหลุม (฿)</div>
      ${masterHTML}
    </div>
    ${isDragonOn() ? buildDragonPotHTML() : ''}`;
}

export function showMoneyDetail(btn){
  const el=document.getElementById('money-detail');if(!el)return;
  const isHidden=el.style.display==='none';el.style.display=isHidden?'block':'none';
  if(btn) btn.textContent=isHidden?'💵 ซ่อนยอดเงิน':'💵 คำนวณเงิน';
}

export function buildMatrixHTML(gTot,n,fs,hfs){
  const games=['bite','olympic','team','farNear'].filter(k=>G[k].on);
  if(!games.length)return`<div style="color:var(--lbl3);text-align:center;padding:20px">ยังไม่ได้เปิดเกมใดเลยครับ</div>`;
  const gameIcons={bite:'🐶',olympic:'🏅',team:'🤝',farNear:'🎯'};
  const gameNames={bite:'หมากัด',olympic:'โอลิมปิก',team:'ทีม',farNear:'Far-Near'};
  const gameVal={bite:G.bite.val,olympic:G.olympic.val,team:G.team.val,farNear:G.farNear.val};
  const perPairByGame={};
  games.forEach(k=>{perPairByGame[k]=Array.from({length:n},()=>Array(n).fill(0));});
  for(let h=0;h<18;h++){
    const turboMult=(G.turbo.on&&G.turbo.holes.has(h))?2:1;
    const drMult=(G.doubleRe.on&&G.doubleRe.mults)?G.doubleRe.mults[h]||1:1;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      if(i>=j) continue;
      const si=scores[i]?.[h], sj=scores[j]?.[h];
      if(si===null||si===undefined||sj===null||sj===undefined) continue;
      if(si===sj) continue;
      const winner=si<sj?i:j, loser=si<sj?j:i;
      const sw=scores[winner][h];
      // bite
      if(G.bite.on&&!skipData[h]?.[winner]?.has('bite')&&!skipData[h]?.[loser]?.has('bite')){
        const m=getBiteMult(sw,pars[h])*turboMult*drMult;
        perPairByGame['bite'][winner][loser]+=m;
        perPairByGame['bite'][loser][winner]-=m;
      }
      // olympic — ใช้ getHoleMoney สำหรับ oly/team/farNear (complex logic)
    }
    // olympic — pair-by-pair จากข้อมูลจริง (แก้ bug matrix ผิด)
    if(games.includes('olympic')){
      const od=olympicData[h];
      const dqC=players.filter((_,p)=>['dq','dq-sank','dq-miss'].includes(od.status[p])).length;
      const bPt=2+dqC, ordLen=od.order.length;
      const infOly=players.map((_,p)=>{
        const st=od.status[p], idx=od.order.indexOf(p);
        let base=null, sank=false;
        if(st==='chip'){base=(G.dragon&&G.dragon.on)?8:7;sank=true;}
        else if(st==='sank'&&idx!==-1){base=Math.min(7,bPt+(ordLen-1-idx));sank=true;}
        else if(st==='miss'&&idx!==-1){base=Math.min(7,bPt+(ordLen-1-idx));sank=false;}
        else if(st==='dq-sank'){base=1;sank=true;}
        else if(st==='dq-miss'){base=1;sank=false;}
        if(base===null)return{p,pts:null,sank:false};
        const s=scores[p][h],mult=s?getOlyMult(s,pars[h]):1;
        return{p,pts:base*mult,sank};
      });
      const sankOly=infOly.filter(x=>x.sank&&x.pts!==null);
      const missOly=infOly.filter(x=>!x.sank&&x.pts!==null);
      for(let i=0;i<sankOly.length;i++)for(let j=i+1;j<sankOly.length;j++){
        const a=sankOly[i],b=sankOly[j],diff=Math.round(Math.abs(a.pts-b.pts)*turboMult*drMult);
        if(a.pts>b.pts){perPairByGame['olympic'][a.p][b.p]+=diff;perPairByGame['olympic'][b.p][a.p]-=diff;}
        else if(b.pts>a.pts){perPairByGame['olympic'][b.p][a.p]+=diff;perPairByGame['olympic'][a.p][b.p]-=diff;}
      }
      for(const s of sankOly)for(const ms of missOly){
        const tv=s.pts*turboMult*drMult;
        perPairByGame['olympic'][s.p][ms.p]+=tv;
        perPairByGame['olympic'][ms.p][s.p]-=tv;
      }
    }
    // team / farNear — net money แบ่ง loses
    const mh=getHoleMoney(h);
    ['team','farNear'].filter(k=>games.includes(k)).forEach(k=>{
      const val=gameVal[k]||1,arr=mh[k];
      const wins=players.map((_,i)=>i).filter(i=>arr[i]>0);
      const loses=players.map((_,i)=>i).filter(i=>arr[i]<0);
      wins.forEach(i=>{if(!loses.length)return;const share=Math.round(arr[i]/val/loses.length);loses.forEach(j=>{perPairByGame[k][i][j]+=share;perPairByGame[k][j][i]-=share;});});
    });
  }
  const perPairAll=Array.from({length:n},()=>Array(n).fill(0));
  games.forEach(k=>{for(let i=0;i<n;i++)for(let j=0;j<n;j++)perPairAll[i][j]+=perPairByGame[k][i][j];});
  function renderTable(pp){
    const rowTot=pp.map(row=>row.reduce((a,b)=>a+b,0));
    const thS=`padding:9px 4px;font-size:${hfs};font-weight:700;text-align:center;background:var(--bg3);border:0.5px solid var(--sep)`;
    let t=`<div class="tbl-wrap"><table class="tbl-inner" style="border-collapse:collapse;width:100%"><thead><tr><th style="${thS};text-align:left;padding-left:10px;"></th>${players.map(pl=>`<th style="${thS}">${shortName(pl.name,n)}</th>`).join('')}<th style="${thS};background:rgba(10,132,255,0.12);color:var(--blue)">ยอด</th></tr></thead><tbody>`;
    players.forEach((pl,i)=>{const tot=rowTot[i];t+=`<tr><td style="padding:10px 4px 10px 8px;font-size:${hfs};font-weight:700;color:var(--lbl);background:var(--bg3);border:0.5px solid var(--sep)">${shortName(pl.name,n)}</td>${players.map((_,j)=>{if(i===j)return`<td style="background:var(--bg4);border:0.5px solid var(--sep)"></td>`;const v=pp[i][j];if(v===0)return`<td style="text-align:center;font-size:${fs};color:var(--lbl3);padding:10px 4px;border:0.5px solid var(--sep)">0</td>`;const c=v>0?'var(--green)':'var(--red)',bg=v>0?'rgba(48,209,88,0.07)':'rgba(255,69,58,0.06)';return`<td style="text-align:center;font-size:${fs};font-weight:700;color:${c};background:${bg};padding:10px 4px;border:0.5px solid var(--sep)">${v>0?'+':''}${v}</td>`;}).join('')}<td style="text-align:center;font-size:${fs};font-weight:800;color:${tot>0?'var(--green)':tot<0?'var(--red)':'var(--lbl2)'};background:${tot>0?'rgba(48,209,88,0.1)':tot<0?'rgba(255,69,58,0.08)':'var(--bg3)'};padding:10px 4px;border:0.5px solid var(--sep);border-left:2px solid rgba(10,132,255,0.3)">${tot>0?'+':''}${tot}</td></tr>`;});
    t+=`<tr style="background:var(--bg3);border-top:1.5px solid var(--sep)"><td style="padding:8px 4px 8px 10px;font-size:${hfs};font-weight:700;color:var(--lbl2);border:0.5px solid var(--sep)">รวม</td>${rowTot.map(v=>{const c=v>0?'var(--green)':v<0?'var(--red)':'var(--lbl2)';return`<td style="text-align:center;font-size:${fs};font-weight:800;color:${c};padding:8px 4px;border:0.5px solid var(--sep)">${v>0?'+':''}${v}</td>`;}).join('')}<td style="border:0.5px solid var(--sep)"></td></tr></tbody></table></div>`;
    return t;
  }
  const pillsHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"><button id="mpill-all" onclick="setMatrixPill('all')" style="padding:6px 14px;border-radius:16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid rgba(10,132,255,0.6);background:rgba(10,132,255,0.18);color:var(--blue)">📊 รวม</button>${games.map(k=>`<button id="mpill-${k}" onclick="setMatrixPill('${k}')" style="padding:6px 14px;border-radius:16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid var(--bg4);background:var(--fill);color:var(--lbl2)">${gameIcons[k]} ${gameNames[k]}</button>`).join('')}</div>`;
  window._matrixData={all:perPairAll};games.forEach(k=>{window._matrixData[k]=perPairByGame[k];});
  return`${pillsHTML}<div id="matrix-table">${renderTable(perPairAll)}</div>`;
}

export function setMatrixPill(key){
  if(!window._matrixData)return;
  const pp=window._matrixData[key];if(!pp)return;
  const n=players.length,fs=tblFs(n),hfs=hdrFs(n);
  const rowTot=pp.map(row=>row.reduce((a,b)=>a+b,0));
  const thS=`padding:9px 4px;font-size:${hfs};font-weight:700;text-align:center;background:var(--bg3);border:0.5px solid var(--sep)`;
  let t=`<div class="tbl-wrap"><table class="tbl-inner" style="border-collapse:collapse;width:100%"><thead><tr><th style="${thS};text-align:left;padding-left:10px;"></th>${players.map(pl=>`<th style="${thS}">${shortName(pl.name,n)}</th>`).join('')}<th style="${thS};background:rgba(10,132,255,0.12);color:var(--blue)">ยอด</th></tr></thead><tbody>`;
  players.forEach((pl,i)=>{const tot=rowTot[i];t+=`<tr><td style="padding:10px 4px 10px 10px;font-size:${fs};font-weight:700;color:var(--lbl);background:var(--bg3);border:0.5px solid var(--sep)">${pl.name}</td>${players.map((_,j)=>{if(i===j)return`<td style="background:var(--bg4);border:0.5px solid var(--sep)"></td>`;const v=pp[i][j];if(v===0)return`<td style="text-align:center;font-size:${fs};color:var(--lbl3);padding:10px 4px;border:0.5px solid var(--sep)">0</td>`;const c=v>0?'var(--green)':'var(--red)',bg=v>0?'rgba(48,209,88,0.07)':'rgba(255,69,58,0.06)';return`<td style="text-align:center;font-size:${fs};font-weight:700;color:${c};background:${bg};padding:10px 4px;border:0.5px solid var(--sep)">${v>0?'+':''}${v}</td>`;}).join('')}<td style="text-align:center;font-size:${fs};font-weight:800;color:${tot>0?'var(--green)':tot<0?'var(--red)':'var(--lbl2)'};background:${tot>0?'rgba(48,209,88,0.1)':tot<0?'rgba(255,69,58,0.08)':'var(--bg3)'};padding:10px 4px;border:0.5px solid var(--sep);border-left:2px solid rgba(10,132,255,0.3)">${tot>0?'+':''}${tot}</td></tr>`;});
  t+=`<tr style="background:var(--bg3);border-top:1.5px solid var(--sep)"><td style="padding:8px 4px 8px 10px;font-size:${hfs};font-weight:700;color:var(--lbl2);border:0.5px solid var(--sep)">รวม</td>${rowTot.map(v=>{const c=v>0?'var(--green)':v<0?'var(--red)':'var(--lbl2)';return`<td style="text-align:center;font-size:${fs};font-weight:800;color:${c};padding:8px 4px;border:0.5px solid var(--sep)">${v>0?'+':''}${v}</td>`;}).join('')}<td style="border:0.5px solid var(--sep)"></td></tr></tbody></table></div>`;
  document.getElementById('matrix-table').innerHTML=t;
  document.querySelectorAll('[id^="mpill-"]').forEach(btn=>{const k=btn.id.replace('mpill-','');const on=k===key;btn.style.borderColor=on?'rgba(10,132,255,0.6)':'';btn.style.background=on?'rgba(10,132,255,0.18)':'';btn.style.color=on?'var(--blue)':'';});
}
