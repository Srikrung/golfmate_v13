// ============================================================
// modules/games.js — หมากัด, โอลิมปิก, ทีม, Far-Near, Turbo
// ============================================================
import { players, scores, pars, G, olympicData, farNearData,
         skipData, teamSoloPlayers } from '../config.js';
import { updateTotals } from '../ui/render.js';
import { showHole } from '../ui/render.js';
import { autoSave } from '../config.js';
import { getTeamForHole } from '../ui/render.js';

export const BITE_MULT_DEFAULT={hio:10,albatross:5,eagle:3,birdie:2};

export function setBiteMult(key, val){
  if(!G.bite.mults) G.bite.mults={...BITE_MULT_DEFAULT};
  G.bite.mults[key] = Math.max(1, val||1);
  updateBiteMultUI();
}

export function toggleBiteMult(key){
  const def=BITE_MULT_DEFAULT[key];
  const cur=G.bite.mults[key];
  G.bite.mults[key]=(cur===def)?1:def;
  updateBiteMultUI();
}
export function updateBiteMultUI(){
  const bm=G.bite.mults||{...BITE_MULT_DEFAULT};
  const keys=['hio','albatross','eagle','birdie'];
  // sync ค่ากับ input fields
  keys.forEach(k=>{
    const inp=document.getElementById(`bm-val-${k}`);
    if(inp) inp.value=bm[k];
  });
  // อัปเดต sub-label
  const sub=document.getElementById('bite-sub-lbl');
  if(sub){
    const parts=keys.filter(k=>bm[k]>1).map(k=>({
      hio:`HIO×${bm.hio}`,albatross:`Alb×${bm.albatross}`,
      eagle:`Eagle×${bm.eagle}`,birdie:`Birdie×${bm.birdie}`
    }[k]));
    sub.textContent=parts.length?parts.join(' '):'Par ×1 เท่านั้น';
  }
}
export function getBiteMult(s,p){
  const bm=G.bite.mults||{hio:10,albatross:5,eagle:3,birdie:2};
  if(s===1)return bm.hio;
  const d=s-p;
  if(d<=-3)return bm.albatross;
  if(d===-2)return bm.eagle;
  if(d===-1)return bm.birdie;
  return 1;
}
export function getOlyMult(s,p){if(s===1)return 4;const d=s-p;if(d<=-3)return 4;if(d===-2)return 3;if(d===-1)return 2;return 1;}

export function calcBiteHole(h){
  const m=Array(players.length).fill(0);
  if(!G.bite.on)return m;
  const r=G.bite.val,tm=(G.turbo.on&&G.turbo.holes.has(h))?G.turbo.mult:1;
  const active=players.map((_,p)=>p).filter(p=>scores[p][h]!==null&&!(skipData[h]?.[p]?.has('bite')));
  if(active.length<2)return m;
  for(let ii=0;ii<active.length;ii++)for(let jj=ii+1;jj<active.length;jj++){
    const i=active[ii],j=active[jj];
    const si=scores[i][h],sj=scores[j][h];
    if(si<sj){const a=r*getBiteMult(si,pars[h])*tm;m[i]+=a;m[j]-=a;}
    else if(sj<si){const a=r*getBiteMult(sj,pars[h])*tm;m[j]+=a;m[i]-=a;}
  }
  return m;
}
export function calcOlympicHole(h){
  const m=Array(players.length).fill(0);if(!G.olympic.on)return m;
  const od=olympicData[h],r=G.olympic.val;
  const dqC=players.filter((_,p)=>['dq','dq-sank','dq-miss'].includes(od.status[p])).length;
  const bPt=2+dqC;
  const inf=players.map((_,p)=>{
    const st=od.status[p],idx=od.order.indexOf(p);let base=null,sank=false;
    const ordLen=od.order.length;
    if(st==='chip'){base=(G.dragon&&G.dragon.on)?8:7;sank=true;}
    else if(st==='sank'&&idx!==-1){base=Math.min(7,bPt+(ordLen-1-idx));sank=true;}
    else if(st==='miss'&&idx!==-1){base=Math.min(7,bPt+(ordLen-1-idx));sank=false;}
    else if(st==='dq-sank'){base=1;sank=true;}
    else if(st==='dq-miss'){base=1;sank=false;}
    if(base===null)return{p,pts:null,sank:false};
    const s=scores[p][h],mult=s?getOlyMult(s,pars[h]):1;
    return{p,pts:base*mult,sank};
  });
  const sankers=inf.filter(x=>x.sank&&x.pts!==null),missers=inf.filter(x=>!x.sank&&x.pts!==null);
  if(!sankers.length)return m;
  for(let i=0;i<sankers.length;i++)for(let j=i+1;j<sankers.length;j++){
    const a=sankers[i],b=sankers[j],diff=Math.abs(a.pts-b.pts)*r;
    if(a.pts>b.pts){m[a.p]+=diff;m[b.p]-=diff;}else if(b.pts>a.pts){m[b.p]+=diff;m[a.p]-=diff;}
  }
  for(const s of sankers)for(const ms of missers){m[s.p]+=s.pts*r;m[ms.p]-=s.pts*r;}
  return m;
}
export function calcTeamHole(h){
  if(!G.team.on)return Array(players.length).fill(0);
  return calcTeamHoleH2H(h);
}
export function calcTeamHoleH2H(h){
  const m=Array(players.length).fill(0);
  const r=G.team.val, cr=G.team.chuanVal*r;
  const dm=G.doubleRe.on?(G.doubleRe.mults[h]||1):1;
  const teamA=[],teamB=[],teamC=[],soloPlayers=[];
  players.forEach((_,p)=>{
    if(scores[p][h]===null||skipData[h]?.[p]?.has('team'))return;
    const t=getTeamForHole(h,p);
    const isSolo=teamSoloPlayers.has(p);
    if(isSolo){ soloPlayers.push({p,t}); }
    else { if(t==='A')teamA.push(p); else if(t==='B')teamB.push(p); else if(t==='C')teamC.push(p); }
  });
  // Round-robin: A vs B, A vs C, B vs C
  const resolveMatchup=(tX,tY)=>{
    const X=[...tX].sort((a,b)=>scores[a][h]-scores[b][h]);
    const Y=[...tY].sort((a,b)=>scores[a][h]-scores[b][h]);
    const len=Math.min(X.length,Y.length);
    if(len===0)return;
    let wX=0,wY=0;
    for(let i=0;i<len;i++){
      const sx=scores[X[i]][h],sy=scores[Y[i]][h];
      if(sx<sy)wX++;else if(sy<sx)wY++;
    }
    const chuanX=wX===0&&wY>0&&len>=2;
    const chuanY=wY===0&&wX>0&&len>=2;
    for(let i=0;i<len;i++){
      const x=X[i],y=Y[i];
      const sx=scores[x][h],sy=scores[y][h];
      if(sx===null||sy===null)continue;
      if(sx<sy){const amt=(chuanY?cr:r)*dm;m[x]+=amt;m[y]-=amt;}
      else if(sy<sx){const amt=(chuanX?cr:r)*dm;m[y]+=amt;m[x]-=amt;}
    }
  };
  resolveMatchup(teamA,teamB);
  resolveMatchup(teamA,teamC);
  resolveMatchup(teamB,teamC);
  // Solo สู้ทุกทีมที่ไม่ใช่ทีมตัวเอง
  const resolveSolo=(sp,t)=>{
    const opps=[...(t!=='A'?teamA:[]),...(t!=='B'?teamB:[]),...(t!=='C'?teamC:[])];
    let soloW=0,soloL=0;
    const results=[];
    opps.forEach(op=>{
      const ss=scores[sp][h],os=scores[op][h];
      if(ss===null||os===null)return;
      if(ss<os){soloW++;results.push({op,win:true});}
      else if(os<ss){soloL++;results.push({op,win:false});}
      else{results.push({op,win:null});}
    });
    const soloChuan=soloL===opps.length&&soloW===0&&opps.length>=2;
    results.forEach(({op,win})=>{
      if(win===null)return;
      const amt=(soloChuan?cr:r)*dm;
      if(win){m[sp]+=amt;m[op]-=amt;}else{m[op]+=amt;m[sp]-=amt;}
    });
  };
  soloPlayers.forEach(({p,t})=>resolveSolo(p,t));
  return m;
}
export function calcFarNearHole(h){
  const m=Array(players.length).fill(0);if(!G.farNear.on||pars[h]!==3)return m;
  const d=farNearData[h],r=G.farNear.val;if(!d)return m;
  // Dragon Far — ออนไกลสุด 1 คน คำนวณจากสกอร์
  if(G.dragon&&G.dragon.on){
    if(d.solo===null)return m;
    const p=d.solo,s=scores[p][h];
    if(s===null)return m;
    const pt=3*r; // 3pt × 20฿ = 60฿/คน
    if(s<=pars[h]){ // เก็บพาร์ได้ → ได้เงิน
      players.forEach((_,i)=>{if(i!==p){m[i]-=pt;m[p]+=pt;}});
    } else { // เกินพาร์ → Reverse
      players.forEach((_,i)=>{if(i!==p){m[i]+=pt;m[p]-=pt;}});
    }
    return m;
  }
  // GolfMate เดิม
  if(d.mode==='solo'&&d.solo!==null){
    const p=d.solo;
    if(d.soloSank1==='sank')players.forEach((_,i)=>{if(i!==p){m[i]-=2*r;m[p]+=2*r;}});
    else if(d.soloSank1==='miss'&&d.soloSank2==='sank')players.forEach((_,i)=>{if(i!==p){m[i]-=r;m[p]+=r;}});
    else if(d.soloSank1==='miss'&&d.soloSank2==='miss')players.forEach((_,i)=>{if(i!==p){m[i]+=2*r;m[p]-=2*r;}});
  } else if(d.mode==='multi'&&d.far!==null&&d.near!==null){
    if(d.farSank==='sank')players.forEach((_,i)=>{if(i!==d.far){m[i]-=r;m[d.far]+=r;}});
    else if(d.farSank==='miss'&&d.nearSank==='sank')players.forEach((_,i)=>{if(i!==d.near){m[i]-=r;m[d.near]+=r;}});
  }
  return m;
}
export function getHoleMoney(h){return{bite:calcBiteHole(h),olympic:calcOlympicHole(h),team:calcTeamHole(h),farNear:calcFarNearHole(h)};}

export function toggleGameMidPlay(k,h){
  G[k].on=!G[k].on;
  if(G[k].on){
    if(k==='team'){
      // เบิ้ล-รีเป็นส่วนหนึ่งของทีม — เปิดพร้อมกัน
      G.doubleRe.on=true;
      if(G.team.domoTeams.length===0){
        G.team.domoTeams=Array(18).fill(null).map(()=>[...G.team.baseTeams]);
      }
    }
  } else {
    if(k==='team'){
      // ปิดทีม → ปิดเบิ้ล-รีด้วย รีเซ็ต mults
      G.doubleRe.on=false;
      G.doubleRe.mults=Array(18).fill(1);
    }
  }
  showHole(h);autoSave();
}

// ── OLYMPIC UI ──
export function olyAct(h,p,action){
  const od=olympicData[h];const st=od.status[p];const idx=od.order.indexOf(p);
  if(action==='chip'){if(st==='chip')delete od.status[p];else{od.status[p]='chip';if(idx!==-1)od.order.splice(idx,1);}}
  else if(action==='dq'){if(st==='dq')delete od.status[p];else{od.status[p]='dq';if(idx!==-1)od.order.splice(idx,1);}}
  else if(action==='rank'){if(st==='chip'||st==='dq')return;if(idx!==-1){od.order.splice(idx,1);if(st==='sank'||st==='miss')delete od.status[p];}else od.order.push(p);}
  else if(action==='putt'){
    if(st==='chip')return;
    if(st==='dq')       od.status[p]='dq-sank';
    else if(st==='dq-sank') od.status[p]='dq-miss';
    else if(st==='dq-miss') od.status[p]='dq';
    else if(st==='sank') od.status[p]='miss';
    else if(st==='miss') delete od.status[p];
    else                 od.status[p]='sank';
  }
  else if(action==='sank'){
    if(st==='chip')return;
    if(st==='dq')       od.status[p]='dq-sank';
    else if(st==='dq-sank') delete od.status[p], od.status[p]='dq';
    else if(st==='sank') delete od.status[p];
    else                 od.status[p]='sank';
  }
  else if(action==='miss'){
    if(st==='chip')return;
    if(st==='dq')       od.status[p]='dq-miss';
    else if(st==='dq-miss') od.status[p]='dq';
    else if(st==='miss') delete od.status[p];
    else                 od.status[p]='miss';
  }
  olyRenderHole(h);  // fallback กรณีมี oly-wrap (leaderboard ฯลฯ)
  if(typeof window._refreshOlyInline === 'function') window._refreshOlyInline(h);
  updateTotals();autoSave();
}
export function olyReset(h){
  olympicData[h]={order:[],status:{}};
  olyRenderHole(h);
  if(typeof window._refreshOlyInline === 'function') window._refreshOlyInline(h);
  updateTotals();autoSave();
}
export function olyRenderHole(h){
  const od=olympicData[h],wrap=document.getElementById(`oly-players-${h}`);if(!wrap)return;
  let dqC=players.filter((_,p)=>od.status[p]==='dq'||od.status[p]==='dq-sank'||od.status[p]==='dq-miss').length;
  let bPt=2+dqC;
  const baseEl=document.getElementById(`oly-base-${h}`);
  if(baseEl)baseEl.textContent=`ฐาน ${bPt}pt`;
  wrap.innerHTML=players.map((pl,p)=>{
    const st=od.status[p],idx=od.order.indexOf(p);
    const isChip=st==='chip',isDQ=st==='dq'||st==='dq-sank'||st==='dq-miss';
    const isSank=st==='sank'||st==='dq-sank',isMiss=st==='miss'||st==='dq-miss';
    return`<div class="oly-r-row"><div class="oly-r-name">${pl.name}</div>
      <button class="oly-btn ob-chip${isChip?' on':''} ${isDQ?'ob-dis':''}" onclick="olyAct(${h},${p},'chip')">Chip</button>
      <button class="oly-btn ob-dq${isDQ?' on':''} ${isChip||idx!==-1?'ob-dis':''}" onclick="olyAct(${h},${p},'dq')">🚫 DQ</button>
      <button class="oly-btn ob-rank${idx!==-1?' on':''} ${isChip||isDQ?'ob-dis':''}" onclick="olyAct(${h},${p},'rank')">${idx!==-1?`ระยะ ${Math.min(7,bPt+(od.order.length-1-idx))}pt`:'ลำดับ'}</button>
      <button class="oly-btn ${isSank?'ob-sank on':isMiss?'ob-miss on':'ob-sank'} ${isChip||(idx===-1&&!isDQ)?'ob-dis':''}" onclick="olyAct(${h},${p},'putt')">${isSank?'ลง ✅':isMiss?'ไม่ลง ❌':'พัตต์?'}</button>
    </div>`;
  }).join('');
}

// ── FAR-NEAR UI ──
export function fnChangeMode(h,m){
  const d=farNearData[h];Object.assign(d,{mode:m,far:null,near:null,solo:null,farSank:null,nearSank:null,soloSank1:null,soloSank2:null});
  fnRenderHole(h);updateTotals();autoSave();
}
export function fnToggleSank(h,role,st){
  const d=farNearData[h];
  if(role==='far')d.farSank=d.farSank===st?null:st;
  else if(role==='near')d.nearSank=d.nearSank===st?null:st;
  else if(role==='s1')d.soloSank1=d.soloSank1===st?null:st;
  else if(role==='s2')d.soloSank2=d.soloSank2===st?null:st;
  fnRenderHole(h);updateTotals();autoSave();
}
export function fnSelectPlayer(h,role,v){
  const d=farNearData[h];v=v===''?null:parseInt(v);
  if(role==='far')d.far=v;else if(role==='near')d.near=v;else if(role==='solo')d.solo=v;
  fnRenderHole(h);updateTotals();autoSave();
}
export function fnRenderHole(h){
  const d=farNearData[h],ui=document.getElementById(`fn-ui-${h}`);if(!ui)return;
  // Dragon Far — ซ่อน mode select, แสดงแค่ dropdown ออนไกลสุด
  if(G.dragon&&G.dragon.on){
    const modeEl=document.getElementById(`fn-mode-${h}`);
    if(modeEl) modeEl.style.display='none';
    // บังคับ mode = solo เพื่อใช้ d.solo field
    if(d.mode!=='solo') Object.assign(d,{mode:'solo',solo:null});
    const opts=`<option value="">-เลือก-</option>`+players.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('');
    const sel=opts.replace(`value="${d.solo}"`,`value="${d.solo}" selected`);
    const rowStyle=`display:flex;align-items:center;gap:6px;padding:7px 0`;
    const lblStyle=`color:var(--teal);font-size:13px;width:80px;flex-shrink:0`;
    const selStyle=`flex:1;padding:7px 10px;font-size:13px;border-radius:8px;background:var(--bg4);border:none;color:var(--lbl);font-family:inherit`;
    // แสดงผลคำนวณ
    let resultTxt='';
    if(d.solo!==null){
      const s=scores[d.solo]?.[h],par=pars[h];
      if(s!==null){
        const r=G.farNear.val,pt=3*r;
        if(s<=par) resultTxt=`<div style="margin-top:5px;background:rgba(48,209,88,0.1);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;color:var(--green)">✅ ${players[d.solo].name} เก็บพาร์ → ได้ ${pt}฿/คน</div>`;
        else resultTxt=`<div style="margin-top:5px;background:rgba(255,69,58,0.1);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;color:var(--red)">🔄 Reverse → ${players[d.solo].name} จ่าย ${pt}฿/คน</div>`;
      }
    }
    ui.innerHTML=`<div style="${rowStyle}"><span style="${lblStyle}">📍 ออนไกลสุด</span><select onchange="fnSelectPlayer(${h},'solo',this.value)" style="${selStyle}">${sel}</select></div>${resultTxt}`;
    return;
  }
  document.getElementById(`fn-mode-${h}`).value=d.mode;
  const opts=`<option value="">-เลือก-</option>`+players.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('');
  const rowStyle=`display:flex;align-items:center;gap:6px;padding:7px 0;border-bottom:0.5px solid var(--sep)`;
  const lblStyle=`color:var(--purple);font-size:13px;width:72px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
  const selStyle=`flex:1;padding:7px 10px;font-size:13px;border-radius:8px;background:var(--bg4);border:none;color:var(--lbl);font-family:inherit;text-align:center;text-align-last:center`;
  const btnSt=(cond,val,role,st,lbl)=>`<button class="oly-btn${val===st?' ob-sank on':''} ${cond?'ob-dis':''}" onclick="fnToggleSank(${h},'${role}','${st}')">${lbl}</button>`;
  if(d.mode==='multi'){
    ui.innerHTML=`
      <div style="${rowStyle}"><span style="${lblStyle}">Far</span><select onchange="fnSelectPlayer(${h},'far',this.value)" style="${selStyle}">${opts.replace(`value="${d.far}"`,`value="${d.far}" selected`)}</select>${btnSt(d.far===null,d.farSank,'far','sank','ลง (+1)')}${btnSt(d.far===null,d.farSank,'far','miss','ไม่ลง')}</div>
      <div style="${rowStyle.replace('border-bottom:0.5px solid var(--sep)','')}"><span style="${lblStyle}">Near</span><select onchange="fnSelectPlayer(${h},'near',this.value)" style="${selStyle}">${opts.replace(`value="${d.near}"`,`value="${d.near}" selected`)}</select>${btnSt(d.near===null,d.nearSank,'near','sank','ลง (+1)')}${btnSt(d.near===null,d.nearSank,'near','miss','ไม่ลง')}</div>`;
  } else if(d.mode==='solo'){
    const lblStyle2=`font-size:13px;color:var(--lbl2);width:72px;flex-shrink:0`;
    ui.innerHTML=`
      <div style="${rowStyle}"><span style="${lblStyle}">คนออน</span><select onchange="fnSelectPlayer(${h},'solo',this.value)" style="${selStyle}">${opts.replace(`value="${d.solo}"`,`value="${d.solo}" selected`)}</select></div>
      <div style="${rowStyle}"><span style="${lblStyle2}">พัตต์ 1</span><button class="oly-btn${d.soloSank1==='sank'?' ob-sank on':''} ${d.solo===null?'ob-dis':''}" onclick="fnToggleSank(${h},'s1','sank')">ลง (+2)</button><button class="oly-btn${d.soloSank1==='miss'?' ob-miss on':''} ${d.solo===null?'ob-dis':''}" onclick="fnToggleSank(${h},'s1','miss')">ไม่ลง</button></div>
      <div style="${rowStyle.replace('border-bottom:0.5px solid var(--sep)','')}"><span style="${lblStyle2}">พัตต์ 2</span><button class="oly-btn${d.soloSank2==='sank'?' ob-sank on':''} ${d.solo===null||d.soloSank1!=='miss'?'ob-dis':''}" onclick="fnToggleSank(${h},'s2','sank')">ลง (+1)</button><button class="oly-btn${d.soloSank2==='miss'?' ob-miss on':''} ${d.solo===null||d.soloSank1!=='miss'?'ob-dis':''}" onclick="fnToggleSank(${h},'s2','miss')">ไม่ลง (เสีย2)</button></div>`;
  } else ui.innerHTML='';
}
