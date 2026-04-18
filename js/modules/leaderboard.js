// ============================================================
// modules/leaderboard.js — Live Leaderboard
// ============================================================
import { FB_URL } from '../config.js';

// ── State ──
const LB_REFRESH_SEC = 30;
const LB_PARS_DEFAULT = [4,3,5,3,5,4,3,4,4,3,4,4,5,3,4,4,4,5];
const LB_MEDALS = ['🥇','🥈','🥉'];

export let lbTimer=null, lbClockTimer=null;
let lbAllP=[], lbRoom='', lbTab='score';
let lbDateOffset=0, lbIsLive=true;
let lbConfirmed={}, lbPending={}, lbPrevSc={}, lbPrevH={};
let lbSwipeX=0;
let _midnightTimer=null;
let _lbSwipeInit=false;

export function _lbMeasureLayout(){
  const hdr=document.querySelector('.hdr');
  const tab=document.querySelector('.tab-bar');
  if(hdr)document.documentElement.style.setProperty('--hdr-h',hdr.getBoundingClientRect().height+'px');
  if(tab)document.documentElement.style.setProperty('--tab-h',tab.getBoundingClientRect().height+'px');
}

// ── V12: lbActivate — setup LB ใน sub-tab (ไม่ navigate) ──
export function lbActivate(){
  _lbMeasureLayout();
  lbUpdateDateBar();
  lbFetch();
  clearInterval(lbTimer);
  lbTimer=setInterval(()=>{
    const scr=document.getElementById('scr-results');
    const sec=document.getElementById('res-sec-lb');
    if(scr?.classList.contains('active')&&sec?.style.display!=='none') lbFetch();
  },LB_REFRESH_SEC*1000);
  clearInterval(lbClockTimer);
  lbClockTimer=setInterval(()=>{
    const scr=document.getElementById('scr-results');
    const sec=document.getElementById('res-sec-lb');
    if(scr?.classList.contains('active')&&sec?.style.display!=='none') lbRenderTicker();
  },1000);
  scheduleThaiMidnightReset();
  if(!_lbSwipeInit){
    _lbSwipeInit=true;
    const cont=document.getElementById('lb-content');
    if(cont){
      cont.addEventListener('touchstart',e=>{lbSwipeX=e.touches[0].clientX;},{passive:true});
      cont.addEventListener('touchend',e=>{
        const dx=e.changedTouches[0].clientX-lbSwipeX;
        if(Math.abs(dx)>60)lbSwipeRoom(dx<0?1:-1);
      },{passive:true});
    }
  }
}

// ── V12: goLeaderboard → redirect เข้า results page (lb sub-tab) ──
export function goLeaderboard(){
  window.goResults?.('lb');
}

export function lbGetThaiNow(){return new Date(Date.now()+7*3600000);}

export function lbGetAdjustedDate(offset){
  const now=new Date();
  const thTime=new Date(now.getTime()+7*3600000);
  const thHour=thTime.getUTCHours(),thMin=thTime.getUTCMinutes();
  if(thHour===0&&thMin<1){thTime.setUTCDate(thTime.getUTCDate()-1);}
  thTime.setUTCDate(thTime.getUTCDate()-offset);
  return thTime;
}

export function lbDateKey(offset){
  const d=lbGetAdjustedDate(offset);
  return`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function lbFormatDateTH(offset){
  const d=lbGetAdjustedDate(offset);
  const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return`${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()+543}`;
}

export function lbUpdateDateBar(){
  lbIsLive=lbDateOffset===0;
  document.getElementById('lb-ddate').textContent=lbFormatDateTH(lbDateOffset);
  const tag=document.getElementById('lb-dtag');
  if(lbIsLive){
    tag.textContent='● Live';
    tag.style.cssText='font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(48,209,88,0.15);color:#30d158;border:1px solid rgba(48,209,88,0.3)';
  } else {
    tag.textContent='📂 ย้อนหลัง';
    tag.style.cssText='font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(10,132,255,0.13);color:#4da3ff;border:1px solid rgba(10,132,255,0.3)';
  }
  document.getElementById('lb-dnext').style.opacity=lbDateOffset===0?'.25':'1';
}

export function lbGoPrev(){lbDateOffset++;lbUpdateDateBar();lbFetch();}
export function lbGoNext(){if(lbDateOffset>0){lbDateOffset--;lbUpdateDateBar();lbFetch();}}

export function lbSetStatus(s,ts){
  const dot=document.getElementById('lb-dot');
  const lbl=document.getElementById('lb-status');
  const upd=document.getElementById('lb-update-lbl');
  if(s==='ok'){dot.style.background='#30d158';dot.style.animation='lbPulse 2s infinite';lbl.textContent='ออนไลน์';}
  else if(s==='loading'){dot.style.background='var(--orange)';dot.style.animation='';lbl.textContent='กำลังโหลด...';}
  else{dot.style.background='#ff453a';dot.style.animation='';lbl.textContent='ไม่มีสัญญาณ';}
  if(ts){upd.textContent='อัปเดต '+new Date(ts).toLocaleTimeString('th-TH');}
}

export async function lbFetch(){
  lbSetStatus('loading');
  try{
    const dk=lbDateKey(lbDateOffset);
    const res=await fetch(`${FB_URL}/scores/${dk}.json`);
    const d=await res.json();
    lbAllP=[];
    if(d)Object.values(d).forEach(rd=>{if(rd)Object.values(rd).forEach(p=>{if(p&&p.name)lbAllP.push(p);});});
    lbDetectAlerts();lbBuildFilter();lbRender();lbRenderTicker();
    lbSetStatus('ok',new Date().toISOString());
  }catch(e){lbSetStatus('err');}
}

export function lbDetectAlerts(){
  const now=new Date();
  const ts=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
  const pars=(lbAllP.find(p=>p.pars&&p.pars.length===18)||{pars:LB_PARS_DEFAULT}).pars;
  lbAllP.forEach(p=>{
    const sc=p.scores||[],ps=lbPrevSc[p.name]||[];
    const ph=lbPrevH[p.name]||0,ch=p.holesPlayed||0;
    const holeChanged=ch>ph;
    sc.forEach((s,h)=>{
      if(s===null||s===undefined)return;
      const key=p.name+'_'+h,par=pars[h]||4,diff=s-par;
      if(diff>-1)return;
      if(holeChanged&&lbPending[key]){delete lbPending[key];return;}
      if(s!==ps[h]){
        let type='Birdie',cls='bir';
        if(s===1){type='HIO';cls='hio';}else if(diff<=-3){type='Albatross';cls='alb';}else if(diff<=-2){type='Eagle';cls='egl';}
        lbPending[key]={name:p.name,hole:h,score:s,par,type,cls,time:ts};
      }
    });
    Object.keys(lbPending).forEach(k=>{
      const a=lbPending[k];if(a.name!==p.name)return;
      const cur=sc[a.hole];
      if(cur===a.score){lbConfirmed[k]={...a};delete lbPending[k];}
      else{delete lbPending[k];delete lbConfirmed[k];}
    });
    lbPrevSc[p.name]=[...sc];lbPrevH[p.name]=ch;
  });
}

export function lbBuildFilter(){
  const rooms=[...new Set(lbAllP.map(p=>p.room).filter(Boolean))].sort();
  const fr=document.getElementById('lb-filter');
  const btn=(on,label,onclick)=>
    `<button onclick="${onclick}" style="padding:5px 12px;border-radius:16px;border:1px solid ${on?'rgba(10,132,255,0.5)':'var(--bg4)'};background:${on?'rgba(10,132,255,0.2)':'var(--bg3)'};color:${on?'var(--blue)':'var(--lbl2)'};font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;flex-shrink:0">${label}</button>`;
  fr.innerHTML=btn(lbRoom==='',`ทั้งหมด (${lbAllP.length})`,"lbSetRoom('')");
  rooms.forEach(r=>{
    const cnt=lbAllP.filter(p=>p.room===r).length;
    fr.innerHTML+=btn(lbRoom===r,`${r} (${cnt})`,`lbSetRoom('${r}')`);
  });
}

export function lbSetRoom(r){lbRoom=r;lbBuildFilter();lbRender();lbRenderTicker();}

export function lbSwipeRoom(dir){
  const rooms=['',...[...new Set(lbAllP.map(p=>p.room).filter(Boolean))].sort()];
  let idx=rooms.indexOf(lbRoom)+dir;
  idx=Math.max(0,Math.min(rooms.length-1,idx));
  lbSetRoom(rooms[idx]);
}

export function lbSetTab(t){
  lbTab=t;
  ['score','sg','rooms'].forEach(k=>{
    const el=document.getElementById('lb-t-'+k);if(!el)return;
    const on=k===t;
    const col=k==='score'?'var(--blue)':k==='rooms'?'var(--green)':'var(--green)';
    el.style.background=on?col:'var(--bg2)';el.style.color=on?'#fff':'var(--lbl2)';
  });
  lbRender();
}

export function lbRender(){
  const list=[...lbAllP.filter(p=>!lbRoom||p.room===lbRoom)].sort((a,b)=>{
    const an=(a.total||0)-(a.hcp||0),bn=(b.total||0)-(b.hcp||0);
    if(a.holesPlayed===18&&b.holesPlayed!==18)return -1;
    if(b.holesPlayed===18&&a.holesPlayed!==18)return 1;
    return an-bn;
  });
  const content=document.getElementById('lb-content');
  if(lbTab==='rooms'){ lbRenderRooms(content); return; }
  if(!list.length){content.innerHTML='<div style="text-align:center;padding:40px 0;color:var(--lbl2);font-size:14px">⛳ ยังไม่มีข้อมูล</div>';return;}
  if(lbTab==='score')lbRenderScore(list,content);
  else lbRenderSG(list,content);
}

export function lbRenderRooms(el){
  // จัดกลุ่มผู้เล่นตาม room
  const roomMap={};
  lbAllP.forEach(p=>{
    const r=p.room||'—';
    if(!roomMap[r]) roomMap[r]=[];
    roomMap[r].push(p);
  });
  const rooms=Object.keys(roomMap).sort();
  if(!rooms.length){
    el.innerHTML='<div style="text-align:center;padding:40px 0;color:var(--lbl2);font-size:14px">⛳ ยังไม่มีห้องออนไลน์วันนี้</div>';
    return;
  }
  const total=lbAllP.length;
  const L=document.body.classList.contains('light');
  const cardBg=L?'#ffffff':'var(--bg2)';
  const borderBase=L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.08)';

  let html=`<div style="display:flex;gap:8px;margin-bottom:10px;padding:10px 12px;
    background:${L?'rgba(0,122,255,0.06)':'rgba(77,163,255,0.08)'};
    border-radius:12px;border:1px solid ${L?'rgba(0,122,255,0.15)':'rgba(77,163,255,0.2)'}">
    <div style="flex:1;text-align:center">
      <div style="font-size:20px;font-weight:800;color:var(--blue)">${rooms.length}</div>
      <div style="font-size:10px;color:var(--lbl2);font-weight:500">ห้องทั้งหมด</div>
    </div>
    <div style="width:0.5px;background:var(--sep)"></div>
    <div style="flex:1;text-align:center">
      <div style="font-size:20px;font-weight:800;color:var(--green)">${total}</div>
      <div style="font-size:10px;color:var(--lbl2);font-weight:500">ผู้เล่น</div>
    </div>
  </div>`;

  const colors=['var(--blue)','var(--red)','var(--green)','var(--orange)','var(--purple,#bf5af2)'];
  rooms.forEach((room,ri)=>{
    const players=roomMap[room];
    const holes=Math.max(...players.map(p=>p.holesPlayed||0));
    const full=players.every(p=>(p.holesPlayed||0)>0);
    const color=colors[ri%colors.length];
    const bgColor=`rgba(${color==='var(--blue)'?'77,163,255':color==='var(--red)'?'255,92,82':color==='var(--green)'?'52,209,122':color==='var(--orange)'?'255,159,10':'191,90,242'},0.12)`;

    html+=`<div style="background:${cardBg};border-radius:12px;border:1px solid ${borderBase};
      margin-bottom:8px;overflow:hidden">
      <div onclick="var b=this.nextElementSibling;b.style.display=b.style.display==='block'?'none':'block';this.querySelector('.rarr').textContent=b.style.display==='block'?'▼':'▶'"
        style="display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer">
        <div style="width:40px;height:40px;border-radius:10px;background:${bgColor};
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:800;color:${color};flex-shrink:0;letter-spacing:-0.5px">${room}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--lbl)">${players[0]?.course||'ไม่ระบุสนาม'}</div>
          <div style="font-size:11px;color:var(--lbl2);margin-top:2px">${players.length} คน · หลุม ${holes}/18</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
          <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;
            background:${full?'rgba(52,209,122,0.15)':'rgba(255,159,10,0.15)'};
            color:${full?'var(--green)':'var(--orange)'}">
            ${players.length} คน ${full?'✓':''}
          </span>
          <span class="rarr" style="font-size:11px;color:var(--lbl3)">▶</span>
        </div>
      </div>
      <div style="display:none;border-top:0.5px solid var(--sep);padding:8px 13px 10px">
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${players.map((p,i)=>{
            const isHost = i===0;
            const hasSynced = (p.holesPlayed||0)>0;
            const badge = isHost?'🎮 Host':hasSynced?'✓ Sync':'รอ...';
            const bg = isHost?'rgba(255,214,10,0.12)':hasSynced?'rgba(52,209,122,0.1)':'rgba(255,255,255,0.05)';
            const cl = isHost?'var(--yellow)':hasSynced?'var(--green)':'var(--lbl3)';
            return `<span style="display:inline-flex;align-items:center;gap:3px;padding:5px 9px;
              border-radius:999px;font-size:11px;font-weight:700;background:${bg};color:${cl}">
              ${badge} ${p.name}</span>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  });

  el.innerHTML=html;
}

export function lbScoreChip(s,par,fs){
  if(s===null||s===undefined)return`<td style="text-align:center;padding:4px 1px;font-size:${fs}px;color:var(--lbl3)">—</td>`;
  const d=s-par;const L=document.body.classList.contains('light');const wh=fs<=11?18:20;
  let bg,tc,fw='700';
  if(s===1){bg='#c8a000';tc='#000';}
  else if(d<=-3){bg='#7a5800';tc='#ffd060';}
  else if(d<=-2){bg=L?'#004fc4':'#1a3560';tc=L?'#fff':'#60b4ff';}
  else if(d===-1){bg=L?'#cc0000':'#7a1a1a';tc=L?'#fff':'#ff8080';}
  else if(d===0){bg='transparent';tc=L?'#004fc4':'#4da3ff';fw='600';}
  else{bg='transparent';tc='var(--lbl2)';}
  return`<td style="text-align:center;padding:3px 1px"><span style="display:inline-flex;align-items:center;justify-content:center;width:${wh}px;height:${wh}px;border-radius:50%;font-size:${fs}px;font-weight:${fw};background:${bg};color:${tc}">${s}</span></td>`;
}

export function lbRenderScore(list,el){
  const pars=(lbAllP.find(x=>x.pars&&x.pars.length===18)||{pars:LB_PARS_DEFAULT}).pars;
  const n=list.length,fs=n<=3?13:n<=5?12:11,hfs=fs-1;
  const L=document.body.classList.contains('light');
  const blue=L?'#004fc4':'#4da3ff',green=L?'#1a7a3a':'#30d158',red=L?'#cc0000':'#ff453a';
  const pars2=(lbAllP.find(x=>x.pars&&x.pars.length===18)||{pars:LB_PARS_DEFAULT}).pars;
  let cards=list.map((p,i)=>{
    const gross=p.total||0,hcp=p.hcp||0,net=gross-hcp;
    const f9=p.scores&&p.scores.slice(0,9).some(v=>v!==null)?p.scores.slice(0,9).reduce((a,v)=>a+(v||0),0):null;
    const b9=p.scores&&p.scores.slice(9).some(v=>v!==null)?p.scores.slice(9).reduce((a,v)=>a+(v||0),0):null;
    const done=p.holesPlayed===18,holes=p.holesPlayed||0;
    // score types
    const sc=countScoreTypes(p.scores||[],pars2);
    const statChips=[
      sc.hio>0 ?`<span style="display:inline-flex;align-items:center;gap:2px;background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:700;color:#ffd700">🏆 HIO ${sc.hio}</span>`:'',
      sc.alb>0 ?`<span style="display:inline-flex;align-items:center;gap:2px;background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:700;color:#ffd700">🌟 Alb ${sc.alb}</span>`:'',
      sc.egl>0 ?`<span style="display:inline-flex;align-items:center;gap:2px;background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:700;color:${L?'#1d5fa0':'#60b4ff'}">🦅 Eagle ${sc.egl}</span>`:'',
      sc.bir>0 ?`<span style="display:inline-flex;align-items:center;gap:2px;background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:700;color:${L?'#cc0000':'#ff8080'}">🐦 Birdie ${sc.bir}</span>`:'',
      sc.par>0 ?`<span style="background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:700;color:rgba(255,215,0,0.7)">Par ${sc.par}</span>`:'',
      sc.bog>0 ?`<span style="background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:600;color:var(--lbl3)">Bogey ${sc.bog}</span>`:'',
      sc.dbl>0 ?`<span style="background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:600;color:var(--lbl3)">Double ${sc.dbl}</span>`:'',
      sc.le>0  ?`<span style="background:var(--bg3);border-radius:20px;padding:3px 8px;font-size:11px;font-weight:700;color:${L?'#cc2222':'#ff6b61'}">เละ ${sc.le}</span>`:'',
    ].filter(Boolean).join('');
    const brd=i===0?`rgba(255,215,0,0.4)`:i===1?`rgba(192,192,192,0.35)`:i===2?`rgba(205,127,50,0.3)`:`var(--bg4)`;
    const netCl=L?'#1a7a3a':'#34d399';
    const sBlock=(lbl,val,isNet)=>`<div style="flex:1;text-align:center;background:${isNet?L?'rgba(52,211,153,0.07)':'rgba(52,211,153,0.07)':'var(--bg3)'};border-radius:9px;padding:6px 2px${isNet?';border:0.5px solid rgba(52,211,153,0.2)':''}">
      <div style="font-size:10px;color:${isNet?netCl:'var(--lbl3)'};font-weight:600;margin-bottom:2px">${lbl}</div>
      <div style="font-size:18px;font-weight:800;color:${isNet?netCl:val==='—'?'var(--bg4)':lbl.includes('9')?blue:'var(--lbl)'};line-height:1">${val}</div>
    </div>`;
    return`<div style="background:var(--bg2);border-radius:14px;padding:12px 14px;margin-bottom:8px;border:0.5px solid ${brd}">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:${i<3?26:18}px;font-weight:800;min-width:32px;text-align:center;color:var(--lbl3)">${LB_MEDALS[i]||'#'+(i+1)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:19px;font-weight:800;color:var(--lbl);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:11px;color:var(--lbl3);margin-top:1px">${p.room?'ห้อง '+p.room+' · ':''}HCP ${hcp} · ${holes}/18 หลุม</div>
          <div style="height:3px;background:var(--bg4);border-radius:2px;margin-top:6px;overflow:hidden"><div style="height:3px;background:${blue};border-radius:2px;width:${Math.round(holes/18*100)}%"></div></div>
        </div>
      </div>
      <div style="display:flex;align-items:stretch;gap:6px;margin-top:10px;padding-top:10px;border-top:0.5px solid var(--sep)">
        ${sBlock('9 แรก',f9!==null?String(f9):'—',false)}
        <div style="width:0.5px;background:var(--sep)"></div>
        ${sBlock('9 หลัง',b9!==null?String(b9):'—',false)}
        <div style="width:0.5px;background:var(--sep)"></div>
        ${sBlock('Gross',gross?String(gross):'—',false)}
        <div style="width:0.5px;background:var(--sep)"></div>
        ${sBlock('Net',gross?String(net)+(done?'':'*'):'—',true)}
      </div>
      ${statChips?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:8px;border-top:0.5px solid var(--sep)">${statChips}</div>`:''}
    </div>`;
  }).join('');
  const shortN=name=>name.length>6?name.slice(0,6)+'…':name;
  let thead=`<thead><tr>
    <th style="padding:6px 2px;font-size:${hfs}px;font-weight:600;color:var(--lbl2);background:var(--bg3);text-align:center;width:10%">H</th>
    <th style="padding:6px 2px;font-size:${hfs}px;font-weight:600;color:var(--lbl2);background:var(--bg3);text-align:center;width:8%">P</th>
    ${list.map(p=>`<th style="padding:6px 2px;font-size:${hfs}px;font-weight:600;color:var(--lbl2);background:var(--bg3);text-align:center">${shortN(p.name)}</th>`).join('')}
  </tr></thead>`;
  let tbody='<tbody>';
  for(let h=0;h<18;h++){
    const par=pars[h];
    tbody+=`<tr style="border-bottom:0.5px solid var(--sep)">
      <td style="text-align:center;font-size:${fs}px;color:var(--lbl2);padding:4px 2px">${h+1}</td>
      <td style="text-align:center;font-size:${fs}px;color:var(--lbl2);padding:4px 2px">${par}</td>
      ${list.map(p=>lbScoreChip(p.scores?p.scores[h]:null,par,fs)).join('')}
    </tr>`;
    if(h===8){tbody+=`<tr style="background:rgba(10,132,255,0.1);border-top:1px solid rgba(10,132,255,0.3)"><td colspan="2" style="text-align:center;font-size:${fs}px;font-weight:700;color:${blue};padding:6px 2px">9 แรก</td>${list.map(p=>{const v=p.scores&&p.scores.slice(0,9).some(v=>v!==null);const f=p.scores?p.scores.slice(0,9).reduce((a,v)=>a+(v||0),0):0;return`<td style="text-align:center;font-size:${fs}px;font-weight:700;color:${blue};padding:6px 2px">${v?f:'—'}</td>`;}).join('')}</tr>`;}
    if(h===17){tbody+=`<tr style="background:rgba(10,132,255,0.1);border-top:1px solid rgba(10,132,255,0.2)"><td colspan="2" style="text-align:center;font-size:${fs}px;font-weight:700;color:${blue};padding:6px 2px">9 หลัง</td>${list.map(p=>{const v=p.scores&&p.scores.slice(9).some(v=>v!==null);const b=p.scores?p.scores.slice(9).reduce((a,v)=>a+(v||0),0):0;return`<td style="text-align:center;font-size:${fs}px;font-weight:700;color:${blue};padding:6px 2px">${v?b:'—'}</td>`;}).join('')}</tr>
      <tr style="background:rgba(10,132,255,0.18);border-top:1.5px solid var(--blue)"><td colspan="2" style="text-align:center;font-size:${fs}px;font-weight:800;color:${blue};padding:7px 2px">รวม</td>${list.map(p=>{const net=(p.total||0)-(p.hcp||0);const nc=net<0?green:net>0?red:'var(--lbl2)';return`<td style="text-align:center;font-size:${fs}px;font-weight:800;padding:7px 2px"><div style="color:var(--lbl)">${p.total||'—'}</div>${p.hcp?`<div style="font-size:${fs}px;color:${nc}">Net ${net}</div>`:''}</td>`;}).join('')}</tr>`;}
  }
  tbody+='</tbody>';
  el.innerHTML=cards+(lbRoom?`<div style="font-size:13px;font-weight:700;color:var(--lbl);margin:10px 0 6px">📋 สกอร์รายหลุม</div><div style="background:var(--bg2);border-radius:12px;overflow:hidden;margin-bottom:8px"><table style="width:100%;border-collapse:collapse;table-layout:fixed">${thead}${tbody}</table></div>`:'');
}

export function lbRenderStats(list,el){
  const pars=(lbAllP.find(x=>x.pars&&x.pars.length===18)||{pars:LB_PARS_DEFAULT}).pars;
  const sorted=[...list].sort((a,b)=>{
    const ac=countScoreTypes(a.scores||[],pars),bc=countScoreTypes(b.scores||[],pars);
    if(bc.bir!==ac.bir)return bc.bir-ac.bir;if(bc.egl!==ac.egl)return bc.egl-ac.egl;return ac.le-bc.le;
  });
  const ROWS=[
    {l:'🏆 HIO',k:'hio',dc:'#ffd700',lc:'#b8860b'},
    {l:'🌟 Alba',k:'alb',dc:'#ffd700',lc:'#8a6c00'},
    {l:'🦅 Eagle',k:'egl',dc:'#60b4ff',lc:'#1d5fa0'},
    {l:'🐦 Birdie',k:'bir',dc:'#34d399',lc:'#16803c'},
    {l:'Par',k:'par',dc:'rgba(255,215,0,0.7)',lc:'#b8860b'},
    {l:'Bogey',k:'bog',dc:'#666',lc:'#aaa'},
    {l:'Double',k:'dbl',dc:'#666',lc:'#aaa'},
    {l:'เละ',k:'le',dc:'#ff6b61',lc:'#cc2222'},
  ];
  const counts=sorted.map(p=>countScoreTypes(p.scores||[],pars));
  const n=sorted.length;
  const shortN=name=>name.length>6?name.slice(0,6)+'…':name;
  const roomLabel=lbRoom?` — ${lbRoom}`:'';
  const L=document.body.classList.contains('light');
  const thBg=L?'#1a4a8a':'#1a3a6e', thBd=L?'#0d3070':'#2a4a8e';
  const tdBd=L?'1px solid #dde':'1px solid #1e2d45';
  const rowO=L?'background:#fff':'background:#131f30';
  const rowE=L?'background:#f5f7fa':'background:#0f1a28';
  const wBg=L?'background:#fff':'background:#0d1320';
  let html=`<div style="${wBg};border-radius:12px;overflow:hidden;margin-bottom:8px"><table style="width:100%;border-collapse:collapse;table-layout:fixed">
    <thead><tr>
      <th style="padding:10px 12px;font-size:12px;font-weight:700;color:${L?'#fff':'#ffd700'};background:${thBg};text-align:left;width:32%;border:1px solid ${thBd}">📊 สถิติ${roomLabel}</th>
      ${sorted.map(p=>`<th style="padding:10px 3px;font-size:12px;font-weight:700;color:${L?'#fff':'#ffd700'};background:${thBg};text-align:center;border:1px solid ${thBd}">${shortN(p.name)}</th>`).join('')}
    </tr></thead><tbody>`;
  ROWS.forEach((r,ri)=>{
    const rowBg=ri%2===0?rowO:rowE;
    const sc=L?r.lc:r.dc;
    html+=`<tr style="${rowBg}">
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:${sc};text-align:left;border:${tdBd}">${r.l}</td>
      ${counts.map(c=>{const v=c[r.k];return`<td style="text-align:center;font-size:13px;font-weight:${v>0?700:400};padding:8px 3px;color:${v>0?sc:'var(--lbl3)'};border:${tdBd}">${v||'—'}</td>`;}).join('')}
    </tr>`;
  });
  html+='</tbody></table></div>';
  el.innerHTML=html;
}

export function countScoreTypes(scores,pars){
  const c={hio:0,alb:0,egl:0,bir:0,par:0,bog:0,dbl:0,le:0};
  scores.forEach((s,i)=>{
    if(s===null||s===undefined)return;
    const d=s-pars[i];
    if(s===1)c.hio++;else if(d<=-3)c.alb++;else if(d===-2)c.egl++;else if(d===-1)c.bir++;
    else if(d===0)c.par++;else if(d===1)c.bog++;else if(d===2)c.dbl++;else c.le++;
  });
  return c;
}

export function lbRenderSG(list,el){
  const L=document.body.classList.contains('light');
  const gc=L?'#1a7a3a':'#30d158',bc=L?'#004fc4':'#4da3ff';
  const sorted=[...list].filter(p=>p.putt!=null&&(p.holesPlayed||0)>0).sort((a,b)=>a.putt-b.putt);
  if(!sorted.length){el.innerHTML='<div style="text-align:center;padding:40px 0;color:var(--lbl2);font-size:14px">ยังไม่มีข้อมูล FW·GIR·Putt</div>';return;}
  el.innerHTML=sorted.map((p,i)=>{
    const h=p.holesPlayed||0,avg=h>0&&p.putt!=null?(p.putt/h).toFixed(1):'—';
    return`<div style="background:var(--bg2);border-radius:13px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:10px">
      <div style="font-size:${i<3?20:14}px;min-width:30px;text-align:center">${LB_MEDALS[i]||'#'+(i+1)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--lbl)">${p.name}</div>
        <div style="font-size:11px;color:var(--lbl2);margin-top:1px">${p.room||'—'} · ${h}/18 หลุม</div>
        <div style="height:3px;background:var(--bg4);border-radius:2px;margin-top:5px;overflow:hidden"><div style="height:3px;background:${gc};border-radius:2px;width:${Math.round(h/18*100)}%"></div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;flex-shrink:0">
        <div style="background:var(--bg3);border-radius:8px;padding:5px 4px;text-align:center;min-width:38px"><div style="font-size:15px;font-weight:800;color:${gc}">${p.putt}</div><div style="font-size:9px;color:var(--lbl2)">Putt</div></div>
        <div style="background:var(--bg3);border-radius:8px;padding:5px 4px;text-align:center;min-width:38px"><div style="font-size:15px;font-weight:700;color:${bc}">${p.gir||0}</div><div style="font-size:9px;color:var(--lbl2)">GIR</div></div>
        <div style="background:var(--bg3);border-radius:8px;padding:5px 4px;text-align:center;min-width:38px"><div style="font-size:15px;font-weight:700;color:var(--orange)">${p.fw||0}</div><div style="font-size:9px;color:var(--lbl2)">FW</div></div>
        <div style="background:var(--bg3);border-radius:8px;padding:5px 4px;text-align:center;min-width:38px"><div style="font-size:15px;font-weight:600;color:var(--lbl2)">${avg}</div><div style="font-size:9px;color:var(--lbl2)">เฉลี่ย</div></div>
      </div>
    </div>`;
  }).join('');
}

export function lbRenderTicker(){
  const vis=lbAllP.filter(p=>!lbRoom||p.room===lbRoom);
  const pars=(lbAllP.find(x=>x.pars&&x.pars.length===18)||{pars:LB_PARS_DEFAULT}).pars;
  const sorted=[...vis].sort((a,b)=>{const an=(a.total||0)-(a.hcp||0),bn=(b.total||0)-(b.hcp||0);return an-bn;});
  const lead=sorted[0];
  const puLd=[...vis].filter(p=>p.putt!=null).sort((a,b)=>a.putt-b.putt)[0];
  const now=new Date();
  const ts=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Bangkok'});
  const sep='<span style="margin:0 1em;opacity:.2">◆</span>';
  const alerts=Object.values(lbConfirmed);
  let t1='';
  if(!alerts.length){
    const ph=`<span style="color:rgba(255,255,255,0.35);padding:0 1em;font-size:12px">รอ Birdie+ แรกของวัน...</span>`;
    t1=ph+ph;
  } else {
    alerts.sort((a,b)=>a.hole-b.hole);
    const items=alerts.map(a=>`<span style="display:inline-flex;align-items:center;gap:4px;margin-right:1.5em"><span class="lb-sc ${a.cls}">${a.score}</span><span style="font-weight:800;color:#fff;font-size:12px">${a.name}</span><span style="font-size:11px;font-weight:700;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.12);color:#fff">${a.type}</span><span style="font-size:11px;color:rgba(255,255,255,0.5)">H${a.hole+1} ${a.time}</span></span>`).join(sep);
    t1=items+sep+items;
  }
  const item=(lbl,val,hi)=>`<span style="display:inline-flex;align-items:center;gap:3px;margin-right:1.5em;font-size:12px"><span style="color:rgba(255,255,255,0.5)">${lbl}</span><span style="color:${hi?'#ffd60a':'rgba(255,255,255,0.85)'};font-weight:${hi?'800':'600'}">${val}</span></span>`;
  const liveItems=[
    lead?item('🏆',lead.name+' Net '+((lead.total||0)-(lead.hcp||0)),true):null,
    puLd?item('⛳',puLd.name+' Putt '+puLd.putt,true):null,
    item('👥',vis.length+' คน',false),
    item('⏰',ts,false),
    item('📡','ทุก '+LB_REFRESH_SEC+'วิ',false),
  ].filter(Boolean).join(sep);
  const t2=liveItems+sep+liveItems;
  const t1el=document.getElementById('lb-tick1-inner'),t2el=document.getElementById('lb-tick2-inner');
  if(t1el)t1el.innerHTML=t1;if(t2el)t2el.innerHTML=t2;
  const tick2=document.getElementById('lb-tick2');
  if(tick2){const badge=tick2.querySelector('div');if(!lbIsLive){tick2.style.background='#101020';if(badge)badge.style.background='#444';}else{tick2.style.background='#090916';if(badge)badge.style.background='#0a84ff';}}
}

export function getThaiDateStr(){return lbGetAdjustedDate(0).toISOString().split('T')[0];}

export function msUntilThaiTime(h,m){
  const nowUTC=Date.now();const nowThai=new Date(nowUTC+7*3600000);
  const target=new Date(Date.UTC(nowThai.getUTCFullYear(),nowThai.getUTCMonth(),nowThai.getUTCDate()+1,h,m,0,0)-7*3600000);
  return Math.max(0,target.getTime()-nowUTC);
}

export function scheduleThaiMidnightReset(){
  if(_midnightTimer)clearTimeout(_midnightTimer);
  const ms=msUntilThaiTime(0,1);
  _midnightTimer=setTimeout(()=>{
    lbRoom='';lbDateOffset=0;lbAllP=[];lbConfirmed={};lbPending={};lbPrevSc={};lbPrevH={};
    lbUpdateDateBar();lbFetch();scheduleThaiMidnightReset();
  },ms);
}

// ── stop timers (เรียกจาก tabs.js เมื่อออกจากหน้า LB) ──
export function lbStopTimers(){
  clearInterval(lbTimer);
  clearInterval(lbClockTimer);
  lbTimer = null;
  lbClockTimer = null;
}
