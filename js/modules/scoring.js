// ============================================================
// modules/scoring.js — จดสกอร์, chPar, setParAll, swipe
// ============================================================
import { players, scores, pars, G } from '../config.js';
import { refWidget, updateTotals, showHole } from '../ui/render.js';
import { autoSave } from '../config.js';

let rptT=null, rptI=null;

export function chScore(h,p,d){
  if(scores[p][h]===null) scores[p][h]=pars[h]+d;
  else {
    const next = scores[p][h]+d;
    scores[p][h] = next < 1 ? null : Math.min(20, next); // กดค้าง − จาก 1 → null
  }
  refWidget(h,p);updateTotals();autoSave();
}
export function startRpt(h,p,d){
  stopRpt();chScore(h,p,d);
  rptT=setTimeout(()=>{rptI=setInterval(()=>chScore(h,p,d),100);},400);
}
export function stopRpt(){ clearTimeout(rptT);clearInterval(rptI); }

const SD={};
export function sws(e,h,p){ e.preventDefault();SD[`${h}_${p}`]={y:e.touches[0].clientY,mv:false}; }
export function swm(e,h,p){
  e.preventDefault();const k=`${h}_${p}`;if(!SD[k])return;
  const dy=SD[k].y-e.touches[0].clientY;
  if(Math.abs(dy)>18){chScore(h,p,dy>0?-1:1);SD[k].y=e.touches[0].clientY;SD[k].mv=true;}
}
export function swe(e,h,p){
  const k=`${h}_${p}`;
  if(SD[k]&&!SD[k].mv&&scores[p][h]===null){scores[p][h]=pars[h];refWidget(h,p);updateTotals();autoSave();}
  delete SD[k];
}
export function setParAll(h){
  players.forEach((_,p)=>{if(scores[p][h]===null)scores[p][h]=pars[h];});
  players.forEach((_,p)=>refWidget(h,p));
  updateTotals();autoSave();
}
export function chPar(h,d){
  pars[h]=Math.max(3,Math.min(5,pars[h]+d));
  const pInputs=document.querySelectorAll('.par-hole input');
  if(pInputs[h])pInputs[h].value=pars[h];
  showHole(h);
}
