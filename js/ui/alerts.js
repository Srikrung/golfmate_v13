// ============================================================
// ui/alerts.js — theme, export modal
// ============================================================
import { FB_URL } from '../config.js';
import { players, scores, pars, G, srikrungData } from '../config.js';
import { getRoomCode, getApiUrl } from '../firebase/init.js';
import { getHoleMoney } from '../modules/games.js';

const THEME_KEY='golfmate_theme';
const FS_KEY='golfmate_fs';
let exportWho='mine';

export function applyTheme(t){
  document.body.classList.toggle('light',t==='light');
  const btn=document.getElementById('theme-btn');
  if(btn)btn.textContent=t==='light'?'🌙':'☀️';
  try{localStorage.setItem(THEME_KEY,t);}catch(e){}
  // rebuild results ถ้ากำลังแสดงหน้าผลลัพธ์อยู่
  const resEl=document.getElementById('scr-results');
  if(resEl && resEl.classList.contains('active')){
    import('./render.js').then(m=>{ if(m.buildResults) m.buildResults(); }).catch(()=>{});
  }
}
export function toggleTheme(){
  applyTheme(document.body.classList.contains('light')?'dark':'light');
}
export function initTheme(){
  try{applyTheme(localStorage.getItem(THEME_KEY)||'dark');}catch(e){applyTheme('dark');}
}

// ── Font Scale ──
export function applyFontScale(fs){
  document.documentElement.setAttribute('data-fs',fs||'S');
  // อัปเดต UI ปุ่ม
  ['S','M','L','XL'].forEach(k=>{
    const btn=document.getElementById('fs-btn-'+k);
    if(!btn)return;
    const on=k===(fs||'S');
    btn.style.background=on?'rgba(10,132,255,0.18)':'transparent';
    btn.style.color=on?'var(--blue)':'var(--lbl2)';
    btn.style.borderColor=on?'rgba(10,132,255,0.5)':'var(--bg4)';
  });
  // อัปเดต preview box
  const cfg={S:{name:17,score:19,btn:34,h:38,lbl:'ปกติ'},M:{name:20,score:23,btn:41,h:46,lbl:'ใหญ่'},L:{name:25,score:28,btn:49,h:55,lbl:'ใหญ่มาก'},XL:{name:30,score:33,btn:60,h:66,lbl:'ใหญ่สุด — เหมาะสายตาไม่ดี'}};
  const c=cfg[fs||'S'];
  const pn=document.getElementById('fs-prev-name');
  const sv=document.getElementById('fs-prev-sv');
  const sb=document.getElementById('fs-prev-sb');
  const sb2=document.getElementById('fs-prev-sb2');
  const lb=document.getElementById('fs-prev-lbl');
  if(pn) pn.style.fontSize=c.name+'px';
  if(sv){ sv.style.fontSize=c.score+'px'; sv.style.minWidth=c.btn+'px'; }
  if(sb){ sb.style.width=c.btn+'px'; sb.style.height=c.h+'px'; sb.style.fontSize=(c.score+3)+'px'; }
  if(sb2){ sb2.style.width=c.btn+'px'; sb2.style.height=c.h+'px'; sb2.style.fontSize=(c.score+3)+'px'; }
  if(lb) lb.textContent='ตัวอย่าง — '+c.lbl;
  try{localStorage.setItem(FS_KEY,fs||'S');}catch(e){}
}
export function initFontScale(){
  try{applyFontScale(localStorage.getItem(FS_KEY)||'S');}catch(e){applyFontScale('S');}
}

export function showExportModal(){
  const modal=document.getElementById('export-modal');
  const sheet=document.getElementById('export-sheet');
  document.getElementById('export-status').style.display='none';
  try{
    const saved=JSON.parse(localStorage.getItem('golfmate_online')||'{}');
    if(saved.url)document.getElementById('export-api-url').value=saved.url;
  }catch(e){}
  setExportWho('mine');
  modal.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{sheet.style.transform='translateY(0)';}));
}

export function hideExportModal(){
  const sheet=document.getElementById('export-sheet');
  sheet.style.transform='translateY(100%)';
  setTimeout(()=>{document.getElementById('export-modal').style.display='none';},300);
}

export function setExportWho(who){
  exportWho=who;
  ['mine','all','tournament'].forEach(w=>{
    const btn=document.getElementById(`exp-btn-${w}`);if(!btn)return;
    const on=w===who,isT=w==='tournament';
    btn.style.borderColor=on?(isT?'var(--yellow)':'var(--blue)'):'var(--bg4)';
    btn.style.background=on?(isT?'rgba(255,214,10,0.12)':'rgba(10,132,255,0.15)'):'var(--bg3)';
    btn.style.color=on?(isT?'var(--yellow)':'var(--blue)'):'var(--lbl2)';
  });
}

export async function doExport(){
  const url=document.getElementById('export-api-url').value.trim();
  const status=document.getElementById('export-status');
  if(!url||!url.startsWith('http')){
    status.style.display='block';status.style.background='rgba(255,69,58,0.15)';
    status.style.color='var(--red)';status.textContent='กรุณาใส่ Apps Script URL ก่อน';return;
  }
  status.style.display='block';
  status.style.background='rgba(10,132,255,0.1)';status.style.color='var(--blue)';
  const room=getRoomCode();
  const cn=document.getElementById('course-name').value||'—';
  const gameDate=document.getElementById('game-date').value||new Date().toISOString().split('T')[0];
  const safeDateKey=gameDate.replace(/-/g,'');

  if(exportWho==='tournament'){
    status.textContent='⟳ กำลังดึงข้อมูลทุกกลุ่ม...';
    try{
      const r=await fetch(`${FB_URL}/scores/${safeDateKey}.json`);
      const d=await r.json();
      if(!d){status.style.background='rgba(255,159,10,0.15)';status.style.color='var(--orange)';status.textContent='⚠ ยังไม่มีข้อมูลในวันนี้';return;}
      let allP=[];
      Object.entries(d).forEach(([rm,rmData])=>{if(!rmData)return;Object.values(rmData).forEach(p=>{if(p&&p.name)allP.push(p);});});
      const rankNet=[...allP].sort((a,b)=>{if(a.net==null&&b.net==null)return 0;if(a.net==null)return 1;if(b.net==null)return -1;return a.net-b.net;});
      const hasSG=allP.filter(p=>p.putt!=null);
      const rankSG=[...hasSG].sort((a,b)=>{if(a.putt!==b.putt)return a.putt-b.putt;if(b.gir!==a.gir)return b.gir-a.gir;return b.fw-a.fw;});
      const winnerNet=rankNet[0],winnerSG=rankSG[0];
      const payload={action:'tournament',gameDate,course:cn,totalPlayers:allP.length,allPlayers:allP,
        rankNet:rankNet.map((p,i)=>({rank:i+1,name:p.name,room:p.room,hcp:p.hcp||0,gross:p.total||0,net:p.net||0,holesPlayed:p.holesPlayed||0})),
        rankSG:rankSG.map((p,i)=>({rank:i+1,name:p.name,room:p.room,putt:p.putt||0,gir:p.gir||0,fw:p.fw||0,holesPlayed:p.holesPlayed||0})),
        winnerNet:winnerNet?{name:winnerNet.name,room:winnerNet.room,net:winnerNet.net,gross:winnerNet.total}:null,
        winnerSG:winnerSG?{name:winnerSG.name,room:winnerSG.room,putt:winnerSG.putt,gir:winnerSG.gir,fw:winnerSG.fw}:null};
      status.textContent=`⟳ กำลังส่งรายงาน ${allP.length} คน...`;
      const res=await fetch(url,{method:'POST',body:JSON.stringify(payload)});
      const resp=await res.json();
      if(resp.ok){status.style.background='rgba(48,209,88,0.15)';status.style.color='var(--green)';status.textContent=`✓ ส่งรายงานสำเร็จ ${allP.length} คน`;}
      else{status.style.background='rgba(255,159,10,0.15)';status.style.color='var(--orange)';status.textContent='⚠ ข้อผิดพลาด: '+(resp.msg||'unknown');}
    }catch(e){status.style.background='rgba(255,69,58,0.15)';status.style.color='var(--red)';status.textContent='✗ เชื่อมต่อไม่ได้';}
    return;
  }

  if(exportWho==='all'){
    status.textContent='⟳ กำลังส่งข้อมูล...';
    try{
      const r=await fetch(`${FB_URL}/scores/${safeDateKey}/${room}.json`);const d=await r.json();
      if(d){let sent=0;
        for(const[,p] of Object.entries(d)){if(!p||!p.name)continue;
          const payload={action:'exportFull',room,name:p.name,hcp:p.hcp||0,course:p.course||cn,gameDate,scores:p.scores||[],pars:p.pars||pars,total:p.total||0,net:p.net||0,moneyBite:0,moneyOlympic:0,moneyTeam:0,moneyFarNear:0,moneyTotal:0,moneyDetail:Array(18).fill(0),fw:p.fw||0,gir:p.gir||0,putt:p.putt||0,srikrung:p.srikrung||[]};
          try{await fetch(url,{method:'POST',body:JSON.stringify(payload)});sent++;}catch(e){}
        }
        status.style.background='rgba(48,209,88,0.15)';status.style.color='var(--green)';status.textContent=`✓ ส่งสำเร็จ ${sent} คน`;return;
      }
    }catch(e){}
  }

  status.textContent='⟳ กำลังส่งข้อมูล...';
  let ok=0;
  for(let p=0;p<players.length;p++){
    const pl=players[p],sc=scores[p],hcp=pl.hcp||0;
    const total=sc.reduce((s,v)=>s+(v||0),0),net=total-hcp;
    const sg=G.srikrung.on?(srikrungData.map(h=>h[p]||{fw:null,gir:null,putt:0})):[];
    let mBite=0,mOly=0,mTeam=0,mFn=0;const mDetail=Array(18).fill(0);
    for(let h=0;h<18;h++){
      const hm=getHoleMoney(h);
      if(hm&&hm.rows){const row=hm.rows.find(r=>r.p===p);if(row){mBite+=row.bite||0;mOly+=row.olympic||0;mTeam+=row.team||0;mFn+=row.farNear||0;mDetail[h]=(row.bite||0)+(row.olympic||0)+(row.team||0)+(row.farNear||0);}}
    }
    const payload={action:'exportFull',room,name:pl.name,hcp,course:cn,gameDate,scores:sc,pars,total,net,moneyBite:mBite,moneyOlympic:mOly,moneyTeam:mTeam,moneyFarNear:mFn,moneyTotal:mBite+mOly+mTeam+mFn,moneyDetail:mDetail,fw:sg.reduce((s,h)=>s+(h&&h.fw?1:0),0),gir:sg.reduce((s,h)=>s+(h&&h.gir?1:0),0),putt:sg.some(h=>h&&h.putt!==null)?sg.reduce((s,h)=>s+(h&&h.putt!==null?h.putt:0),0):null,srikrung:sg};
    try{const res=await fetch(url,{method:'POST',body:JSON.stringify(payload)});const d=await res.json();if(d.ok)ok++;}catch(e){}
  }
  status.style.background=ok>0?'rgba(48,209,88,0.15)':'rgba(255,69,58,0.15)';
  status.style.color=ok>0?'var(--green)':'var(--red)';
  status.textContent=ok>0?`✓ ส่งสำเร็จ ${ok} คน`:'✗ ส่งไม่สำเร็จ ตรวจสอบ URL';
}
