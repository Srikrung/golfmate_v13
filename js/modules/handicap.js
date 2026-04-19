// ============================================================
// modules/handicap.js — แต้มต่อ: float, stroke, live, end
// ============================================================
import { players, scores, pars, G, getCurrentHole, isGameStarted } from '../config.js';
import { skipData } from '../config.js';
import { getBiteMult } from './games.js';
import { autoSave } from '../config.js';

export function getStrokeShots(par){if(par>=5)return 2;if(par===4)return 1;return 0;}

export function initHcapPairs(n){
  const existing=G.hcap.pairs;
  const newPairs=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const found=existing.find(p=>p.i===i&&p.j===j);
    newPairs.push(found||{i,j,on:false,type:'float',payMode:'end',front:0,back:0,activeFrom:0,strokeShots:{3:0,4:0,5:0,6:0},dir:'ij'});
  }
  G.hcap.pairs=newPairs;
  buildHcapUI();
}

export function addHcapPairsForPlayer(newIdx){
  for(let i=0;i<newIdx;i++){
    if(!G.hcap.pairs.find(p=>p.i===i&&p.j===newIdx)){
      G.hcap.pairs.push({i,j:newIdx,on:false,type:'float',payMode:'end',front:0,back:0,activeFrom:getCurrentHole(),strokeShots:{3:0,4:0,5:0,6:0},dir:'ij'});
    }
  }
  buildHcapUI();
}

export function buildHcapUI(){
  const wrap=document.getElementById('hcap-pairs-wrap');
  if(!wrap)return;
  if(!players.length){wrap.innerHTML='<div style="font-size:13px;color:var(--lbl2);text-align:center;padding:12px 0">กด "เริ่มบันทึกสกอร์" เพื่อตั้งค่าได้เลยครับ</div>';return;}
  if(!G.hcap.pairs.length){wrap.innerHTML='<div style="font-size:13px;color:var(--lbl2);text-align:center;padding:12px 0">ไม่มีคู่ผู้เล่น</div>';return;}
  const btnSt=(on,col)=>`padding:5px 10px;border-radius:7px;border:1.5px solid ${on?col:'var(--bg4)'};background:${on?col.replace(')',',0.15)').replace('rgb','rgba'):'var(--bg3)'};color:${on?'#fff':'var(--lbl2)'};font-family:inherit;font-size:11px;font-weight:700;cursor:pointer`;
  wrap.innerHTML=G.hcap.pairs.map((p,k)=>{
    const nameI=players[p.i]?.name||`P${p.i+1}`,nameJ=players[p.j]?.name||`P${p.j+1}`;
    const dir=p.dir||'ij';
    const giver=dir==='ij'?nameI:nameJ, receiver=dir==='ij'?nameJ:nameI;
    const isFloat=p.type==='float',isStroke=p.type==='stroke';
    const isEnd=p.payMode==='end',isLive=p.payMode==='live';
    return`<div style="padding:10px 0;border-bottom:0.5px solid var(--sep)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div class="sw${p.on?' on':''}" id="sw-hcap-${k}" onclick="hcapTogglePair(${k})" style="flex-shrink:0"></div>
        <span style="font-size:14px;font-weight:700;color:var(--lbl);flex:1">${giver} <span style="color:var(--purple)">ต่อ</span> ${receiver}</span>
        <button onclick="hcapFlipDir(${k})" style="padding:4px 10px;border-radius:8px;border:1.5px solid rgba(191,90,242,0.4);background:rgba(191,90,242,0.08);color:var(--purple);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">⇄</button>
      </div>
      <div id="hcap-body-${k}" style="display:${p.on?'block':'none'}">
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button onclick="hcapSetField(${k},'type','float')" style="${btnSt(isFloat,'var(--blue)')}">ต่อลอย</button>
          <button onclick="hcapSetField(${k},'type','stroke')" style="${btnSt(isStroke,'var(--purple)')}">ต่อหลุม</button>
          <span style="flex:1"></span>
          <button onclick="hcapSetField(${k},'payMode','end')" style="${btnSt(isEnd,'var(--green)')}">สรุปตอนจบ</button>
          <button onclick="hcapSetField(${k},'payMode','live')" style="${btnSt(isLive,'var(--orange)')}">จ่ายระหว่างเกม</button>
        </div>
        ${isFloat?`<div style="display:flex;gap:12px;align-items:center;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;color:var(--lbl2)">หน้า 9</span>
            <select onchange="hcapSetField(${k},'front',+this.value)"
              style="width:64px;text-align:center;border-radius:8px;padding:5px 4px;font-size:14px;font-weight:700;border:1.5px solid rgba(10,132,255,0.4);background:rgba(10,132,255,0.1);color:var(--lbl)">
              ${[0,1,2,3,4,5,6,7,8,9].map(n=>`<option value="${n}"${p.front===n?' selected':''}>${n}</option>`).join('')}
            </select>
            <span style="font-size:12px;color:var(--lbl2)">pt</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;color:var(--lbl2)">หลัง 9</span>
            <select onchange="hcapSetField(${k},'back',+this.value)"
              style="width:64px;text-align:center;border-radius:8px;padding:5px 4px;font-size:14px;font-weight:700;border:1.5px solid rgba(10,132,255,0.4);background:rgba(10,132,255,0.1);color:var(--lbl)">
              ${[0,1,2,3,4,5,6,7,8,9].map(n=>`<option value="${n}"${p.back===n?' selected':''}>${n}</option>`).join('')}
            </select>
            <span style="font-size:12px;color:var(--lbl2)">pt</span>
          </div>
        </div>
        <div style="font-size:11px;color:var(--lbl3)">ตัวอย่าง: ต่อ 5pt → ${nameJ} ต้องชนะเกิน 5pt ถึงได้เงิน</div>`
        :`<div style="padding:4px 0">
          <div style="font-size:11px;color:var(--lbl2);margin-bottom:8px">จำนวนช็อตที่ให้ต่อ (${receiver} ได้ต่อ)</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
            ${[3,4,5,6].map(par=>{
              const val=(p.strokeShots&&p.strokeShots[par]!==undefined)?p.strokeShots[par]:0;
              return`<div style="text-align:center">
                <div style="font-size:11px;color:var(--lbl2);margin-bottom:4px">Par ${par}</div>
                <select onchange="hcapSetStroke(${k},${par},+this.value)"
                  style="width:100%;text-align:center;border-radius:8px;padding:5px 2px;font-size:14px;font-weight:700;border:1.5px solid rgba(191,90,242,0.4);background:rgba(191,90,242,0.1);color:var(--lbl)">
                  ${[0,1,2,3].map(n=>`<option value="${n}"${val===n?' selected':''}>${n}</option>`).join('')}
                </select>
              </div>`;
            }).join('')}
          </div>
          <div style="font-size:11px;color:var(--lbl3);margin-top:6px">(ลดสกอร์ ${receiver} ก่อนเปรียบกับ ${giver})</div>
        </div>`}
      </div>
    </div>`;
  }).join('');
}

export function hcapFlipDir(k){
  const p=G.hcap.pairs[k];
  p.dir=(p.dir||'ij')==='ij'?'ji':'ij';
  buildHcapUI();autoSave();
}

export function hcapTogglePair(k){
  G.hcap.pairs[k].on=!G.hcap.pairs[k].on;
  if(G.hcap.pairs[k].on&&isGameStarted())G.hcap.pairs[k].activeFrom=getCurrentHole();
  buildHcapUI();autoSave();
}
export function hcapSetStroke(k,par,val){
  if(!G.hcap.pairs[k].strokeShots) G.hcap.pairs[k].strokeShots={3:0,4:0,5:0,6:0};
  G.hcap.pairs[k].strokeShots[par]=val;
  autoSave();
}
export function hcapSetField(k,field,val){
  G.hcap.pairs[k][field]=val;
  buildHcapUI();autoSave();
}

export function calcBitePairRaw(h,pi,pj){
  const si=scores[pi][h],sj=scores[pj][h];
  if(si===null||sj===null)return{i:0,j:0};
  if(skipData[h]?.[pi]?.has('bite')||skipData[h]?.[pj]?.has('bite'))return{i:0,j:0};
  const r=G.bite.val,tm=(G.turbo.on&&G.turbo.holes.has(h))?G.turbo.mult:1;
  let mi=0,mj=0;
  if(si<sj){const a=r*getBiteMult(si,pars[h])*tm;mi+=a;mj-=a;}
  else if(sj<si){const a=r*getBiteMult(sj,pars[h])*tm;mj+=a;mi-=a;}
  return{i:mi,j:mj};
}

export function calcBitePairStroke(h,pi,pj,pairObj){
  const si=scores[pi][h],sj_raw=scores[pj][h];
  if(si===null||sj_raw===null)return{i:0,j:0};
  if(skipData[h]?.[pi]?.has('bite')||skipData[h]?.[pj]?.has('bite'))return{i:0,j:0};
  const par=pars[h];
  const shots=pairObj&&pairObj.strokeShots?(pairObj.strokeShots[par]??getStrokeShots(par)):getStrokeShots(par);
  // dir:'ij' = j ได้รับช็อต (default), dir:'ji' = i ได้รับช็อต
  const dir=pairObj?.dir||'ij';
  const si_adj=dir==='ji'?si-shots:si;
  const sj=dir==='ij'?sj_raw-shots:sj_raw;
  const r=G.bite.val,tm=(G.turbo.on&&G.turbo.holes.has(h))?G.turbo.mult:1;
  let mi=0,mj=0;
  if(si_adj<sj){const a=r*getBiteMult(si_adj,par)*tm;mi+=a;mj-=a;}
  else if(sj<si_adj){const a=r*getBiteMult(sj,par)*tm;mj+=a;mi-=a;}
  return{i:mi,j:mj};
}

export function calcHcapHole(h){
  const m=Array(players.length).fill(0);
  if(!G.hcap.on||!G.bite.on)return m;
  for(const p of G.hcap.pairs){
    if(!p.on||p.type!=='stroke'||h<p.activeFrom)continue;
    const isBack=h>=9;
    const active=isBack?(p.back>0||p.back===undefined):((p.front??1)>0);
    if(!active)continue;
    const {i,j}=p;
    const raw=calcBitePairRaw(h,i,j);
    const strk=calcBitePairStroke(h,i,j,p);
    m[i]+=strk.i-raw.i;
    m[j]+=strk.j-raw.j;
  }
  return m;
}

export function computeHcapLiveAll(){
  const n=players.length;
  const result=Array(18).fill(null).map(()=>Array(n).fill(0));
  if(!G.hcap.on||!G.bite.on)return result;
  for(let k=0;k<G.hcap.pairs.length;k++){
    const p=G.hcap.pairs[k];
    if(!p.on||p.type!=='float'||p.payMode!=='live')continue;
    const {i,j}=p;
    let buffer=p.front;let cumPaid=0;
    for(let h=p.activeFrom;h<18;h++){
      if(h===9){buffer=p.back;cumPaid=0;}
      const raw=calcBitePairRaw(h,i,j);
      if(raw.i===0&&raw.j===0)continue;
      const jPts=Math.round(raw.j/G.bite.val);
      buffer+=jPts;
      if(buffer<0){
        const owedMoney=Math.abs(buffer)*G.bite.val;
        result[h][j]-=owedMoney;result[h][i]+=owedMoney;
        cumPaid+=owedMoney;buffer=0;
      } else if(buffer>0&&cumPaid>0){
        const refund=Math.min(buffer*G.bite.val,cumPaid);
        result[h][j]+=refund;result[h][i]-=refund;
        cumPaid=Math.max(0,cumPaid-refund);
        buffer-=Math.round(refund/G.bite.val);
      }
    }
  }
  return result;
}

export function calcHcapFinalEnd(){
  const n=players.length;
  const m=Array(n).fill(0);
  if(!G.hcap.on||!G.bite.on)return m;
  for(const p of G.hcap.pairs){
    if(!p.on||p.type!=='float'||p.payMode!=='end')continue;
    const {i,j}=p;
    let frontPts=0,backPts=0;
    for(let h=p.activeFrom;h<18;h++){
      const raw=calcBitePairRaw(h,i,j);
      const jPts=Math.round(raw.j/G.bite.val);
      if(h<9)frontPts+=jPts; else backPts+=jPts;
    }
    const frontNet=p.front>0?frontPts-p.front:frontPts;
    const backNet=p.back>0?backPts-p.back:backPts;
    const totalMoney=(frontNet+backNet)*G.bite.val;
    m[j]+=totalMoney;m[i]-=totalMoney;
  }
  return m;
}
