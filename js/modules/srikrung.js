// ============================================================
// modules/srikrung.js — Srikrung Golf Day: FW / GIR / PUTT
// ============================================================
import { players, pars, scores, srikrungData, G } from '../config.js';
import { autoSave } from '../config.js';

// ── ฟังก์ชันช่วย ──
function shortName(name, n){ return n>4 ? name.slice(0,4) : n>3 ? name.slice(0,5) : name.slice(0,7); }
function tblFs(n){ return n>5?'11px':n>4?'12px':'13px'; }
function hdrFs(n){ return n>5?'9px':n>4?'10px':'11px'; }

// ─────────────────────────────────────────
// RENDER HOLE (ใช้ในหน้าสกอร์การ์ด)
// ─────────────────────────────────────────
// ── Focus player state ──
let sgFocusPlayer = null; // null = ทุกคน, number = index คนที่เลือก

export function getSgFocusPlayer(){ return sgFocusPlayer; }
export function setSgFocusPlayer(p){ sgFocusPlayer = p; }

export function sgToggleFocus(p){
  sgFocusPlayer = (sgFocusPlayer === p) ? null : p;
  // re-render ทุกหลุมที่เปิดอยู่
  for(let h=0;h<18;h++){
    if(document.getElementById(`sg-players-${h}`)) sgRenderHole(h);
  }
}

export function sgRenderHole(h){
  const wrap = document.getElementById(`sg-players-${h}`);
  if(!wrap) return;
  const isPar3 = pars[h] === 3;

  wrap.innerHTML = players.map((pl, p) => {
    const d = srikrungData[h]?.[p];
    if(!d) return '';

    // Focus mode: ซ่อนคนอื่น ถ้าเลือก "ของฉัน"
    const isFocused = sgFocusPlayer !== null;
    const isMe = sgFocusPlayer === p;
    const canEdit = !isFocused || isMe;

    // Join mode: กดได้แค่คนที่ join
    const { isJoinMode, getJoinPlayerName } = window._sgJoinHelper || {};
    const joinMode = typeof isJoinMode === 'function' && isJoinMode();
    const joinName = typeof getJoinPlayerName === 'function' && getJoinPlayerName();
    const isJoinMe = joinMode && pl.name.trim() === joinName?.trim();
    const editable = joinMode ? isJoinMe : canEdit;

    const fwOn  = d.fw  === true;
    const girOn = d.gir === true;

    const btnBase = `flex:1;padding:7px 0;border-radius:8px;border:none;font-family:inherit;font-size:12px;font-weight:600;background:var(--bg4);color:var(--lbl2);${editable?'cursor:pointer':'cursor:default;opacity:0.45;pointer-events:none'}`;
    const btnOn   = `flex:1;padding:7px 0;border-radius:8px;border:1px solid rgba(52,199,89,0.5);font-family:inherit;font-size:12px;font-weight:700;background:rgba(52,199,89,0.2);color:var(--green);${editable?'cursor:pointer':'cursor:default;opacity:0.7;pointer-events:none'}`;
    const editAttr = editable ? '' : 'disabled';

    const fwBtn  = isPar3 ? '' :
      `<button style="${fwOn?btnOn:btnBase}" ${editable?`onclick="sgToggle(${h},${p},'fw')"`:''} ${editAttr}>${fwOn?'FW ✓':'FW'}</button>`;
    const girBtn =
      `<button style="${girOn?btnOn:btnBase}" ${editable?`onclick="sgToggle(${h},${p},'gir')"`:''} ${editAttr}>${girOn?'GIR ✓':'GIR'}</button>`;

    const putt = d.putt;
    const puttRecorded = putt !== null && putt !== undefined;
    const puttOpacity = editable ? '' : 'opacity:0.45;pointer-events:none';

    const puttWidget = `
      <div style="display:flex;align-items:center;background:var(--bg4);border-radius:8px;overflow:hidden;
        border:1px solid ${puttRecorded?'rgba(10,132,255,0.3)':'var(--bg4)'};flex-shrink:0;${puttOpacity}">
        <button style="width:28px;height:30px;background:none;border:none;color:var(--blue);
          font-size:18px;font-weight:300;${editable?'cursor:pointer':'cursor:default'}" ${editable?`onclick="sgChPutt(${h},${p},-1)"`:''}  ${editAttr}>−</button>
        <div style="min-width:32px;height:30px;display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:${puttRecorded?'700':'400'};
          color:${putt===0?'var(--orange)':puttRecorded?'var(--lbl)':'var(--lbl3)'};
          ${editable?'cursor:pointer;':''}user-select:none" ${editable?`onclick="sgSetPutt1(${h},${p})"`:''}>
          ${putt===0?'C':puttRecorded?putt:'—'}
        </div>
        <button style="width:28px;height:30px;background:none;border:none;color:var(--blue);
          font-size:18px;font-weight:300;${editable?'cursor:pointer':'cursor:default'}" ${editable?`onclick="sgChPutt(${h},${p},1)"`:''}  ${editAttr}>+</button>
      </div>
      <div style="font-size:10px;color:var(--lbl2);min-width:28px;text-align:center">
        ${putt===0?'Chip':puttRecorded?putt+'พัต':'ยังไม่จด'}
      </div>`;

    return `<div class="oly-r-row">
      <div class="oly-r-name">${pl.name}</div>
      ${fwBtn}
      ${girBtn}
      ${puttWidget}
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// TOGGLE / CHANGE
// ─────────────────────────────────────────
export function sgToggle(h, p, field){
  if(!srikrungData[h]?.[p]) return;
  srikrungData[h][p][field] = !srikrungData[h][p][field];
  sgRenderHole(h);
  autoSave();
  saveSrikrungLocal();
}

export function sgChPutt(h, p, d){
  if(!srikrungData[h]?.[p]) return;
  const cur = srikrungData[h][p].putt;
  srikrungData[h][p].putt = Math.max(0, Math.min(6, (cur === null ? 1 : cur) + d));
  sgRenderHole(h);
  autoSave();
  saveSrikrungLocal();
}

export function sgSetPutt1(h, p){
  if(!srikrungData[h]?.[p]) return;
  srikrungData[h][p].putt = 1;
  sgRenderHole(h);
  autoSave();
  saveSrikrungLocal();
}

// บันทึก srikrungData ลง localStorage แยก (ป้องกัน refresh หาย)
export function saveSrikrungLocal(){
  try{
    localStorage.setItem('golfmate_srikrung', JSON.stringify({
      data: srikrungData,
      updatedAt: Date.now()
    }));
  }catch(e){}
}

// ─────────────────────────────────────────
// CALC STATS (ใช้ใน buildResults)
// ─────────────────────────────────────────
export function calcSgStats(){
  return players.map((_, p) => {
    let fw=0, fwHoles=0, gir=0, putt=0, holes=0;
    for(let h=0; h<18; h++){
      const d = srikrungData[h]?.[p];
      if(!d || scores[p][h] === null) continue;
      holes++;
      if(pars[h] !== 3){ fwHoles++; if(d.fw) fw++; }
      if(d.gir) gir++;
      putt += (d.putt ?? 0);
    }
    return { p, name:players[p].name, fw, fwHoles, gir, putt, holes };
  });
}

// ─────────────────────────────────────────
// BUILD SRIKRUNG RESULTS HTML
// ─────────────────────────────────────────
export function buildSrikrungResultsHTML(){
  if(!G.srikrung.on || !srikrungData.length) return '';

  const n    = players.length;
  const fs   = tblFs(n);
  const hfs  = hdrFs(n);

  const sgStats = calcSgStats();
  const ranked  = [...sgStats].sort((a,b) => a.putt - b.putt || b.gir - a.gir || b.fw - a.fw);
  const medals  = ['🥇','🥈','🥉'];
  const winner  = ranked[0];

  // ── subStyle ──
  const subStyle  = `background:rgba(10,132,255,0.07);border-top:1px solid rgba(10,132,255,0.25);border-bottom:1px solid rgba(10,132,255,0.25)`;
  const subTdStyle = `text-align:center;font-size:${fs};font-weight:700;color:var(--blue);padding:7px 2px`;

  // ── รายหลุม ──
  let rows = '';
  for(let h=0; h<18; h++){
    const isPar3 = pars[h] === 3;
    rows += `<tr style="border-bottom:0.5px solid var(--sep)">
      <td style="text-align:center;font-size:${fs};color:var(--lbl2);padding:5px 2px">${h+1}</td>
      <td style="text-align:center;font-size:${fs};color:var(--lbl2);padding:5px 2px">${pars[h]}</td>
      ${players.map((_,p)=>{
        const d = srikrungData[h]?.[p];
        const hasScore = scores[p][h] !== null;
        if(!d || !hasScore)
          return `<td style="text-align:center;color:var(--lbl3);padding:5px 1px">·</td>
                  <td style="text-align:center;color:var(--lbl3);padding:5px 1px">·</td>
                  <td style="text-align:center;color:var(--lbl3);padding:5px 1px">·</td>`;
        const fwCell = isPar3
          ? `<td style="text-align:center;font-size:${fs};color:var(--lbl3);padding:5px 1px">—</td>`
          : `<td style="text-align:center;font-size:${fs};padding:5px 1px;color:${d.fw?'var(--green)':'var(--lbl3)'}">${d.fw?'✓':'·'}</td>`;
        const girCell = `<td style="text-align:center;font-size:${fs};padding:5px 1px;color:${d.gir?'var(--blue)':'var(--lbl3)'}">${d.gir?'✓':'·'}</td>`;
        const puttCell = `<td style="text-align:center;font-size:${fs};font-weight:700;padding:5px 1px;
          color:${d.putt===0?'var(--orange)':d.putt<=1?'var(--green)':d.putt>=3?'var(--red)':'var(--lbl)'}">
          ${d.putt===0?'C':d.putt??'—'}</td>`;
        return fwCell + girCell + puttCell;
      }).join('')}
    </tr>`;

    // subtotal หน้า 9
    if(h === 8){
      rows += `<tr style="${subStyle}">
        <td colspan="2" style="${subTdStyle}">หน้า 9</td>
        ${players.map((_,p)=>{
          let fw=0,gir=0,putt=0,played=0;
          for(let i=0;i<9;i++){
            const d=srikrungData[i]?.[p];
            if(!d||scores[p][i]===null)continue;
            played++;
            if(pars[i]!==3&&d.fw)fw++;
            if(d.gir)gir++;
            putt+=d.putt??0;
          }
          if(!played) return `<td style="${subTdStyle}" colspan="3">—</td>`;
          return `<td style="text-align:center;font-size:${fs};font-weight:700;color:var(--green);padding:7px 1px">${fw}</td>
                  <td style="text-align:center;font-size:${fs};font-weight:700;color:var(--blue);padding:7px 1px">${gir}</td>
                  <td style="text-align:center;font-size:${fs};font-weight:700;color:var(--lbl);padding:7px 1px">${putt}</td>`;
        }).join('')}
      </tr>`;
    }
  }

  // subtotal หลัง 9
  rows += `<tr style="${subStyle}">
    <td colspan="2" style="${subTdStyle}">หลัง 9</td>
    ${players.map((_,p)=>{
      let fw=0,gir=0,putt=0,played=0;
      for(let i=9;i<18;i++){
        const d=srikrungData[i]?.[p];
        if(!d||scores[p][i]===null)continue;
        played++;
        if(pars[i]!==3&&d.fw)fw++;
        if(d.gir)gir++;
        putt+=d.putt??0;
      }
      if(!played) return `<td style="${subTdStyle}" colspan="3">—</td>`;
      return `<td style="text-align:center;font-size:${fs};font-weight:700;color:var(--green);padding:7px 1px">${fw}</td>
              <td style="text-align:center;font-size:${fs};font-weight:700;color:var(--blue);padding:7px 1px">${gir}</td>
              <td style="text-align:center;font-size:${fs};font-weight:700;color:var(--lbl);padding:7px 1px">${putt}</td>`;
    }).join('')}
  </tr>`;

  // รวมทั้งหมด
  rows += `<tr style="background:rgba(10,132,255,0.14);border-top:1.5px solid var(--blue)">
    <td colspan="2" style="${subTdStyle}">รวม</td>
    ${players.map((_,p)=>{
      const st = sgStats.find(s=>s.p===p);
      if(!st||!st.holes) return `<td colspan="3" style="${subTdStyle}">—</td>`;
      return `<td style="text-align:center;font-size:${fs};font-weight:800;color:var(--green);padding:8px 1px">${st.fw}</td>
              <td style="text-align:center;font-size:${fs};font-weight:800;color:var(--blue);padding:8px 1px">${st.gir}</td>
              <td style="text-align:center;font-size:${fs};font-weight:800;color:var(--lbl);padding:8px 1px">${st.putt}</td>`;
    }).join('')}
  </tr>`;

  return `
    <div style="font-size:16px;font-weight:700;color:var(--green);margin:20px 0 10px">⛳ Srikrung Golf Day</div>

    <!-- Winner Card -->
    <div style="background:rgba(52,199,89,0.1);border:1px solid rgba(52,199,89,0.35);border-radius:14px;
      padding:14px 16px;margin-bottom:12px;text-align:center">
      <div style="font-size:13px;color:var(--green);font-weight:600;letter-spacing:0.5px;margin-bottom:6px">🏆 ผู้ชนะ</div>
      <div style="font-size:28px;font-weight:800;color:var(--lbl)">${winner.name}</div>
      <div style="font-size:13px;color:var(--lbl2);margin-top:6px">
        ${winner.putt} พัต · GIR ${winner.gir}/${winner.holes} · FW ${winner.fw}/${winner.fwHoles}
      </div>
    </div>

    <!-- Summary Table -->
    <div class="tbl-wrap"><table class="tbl-inner">
      <thead><tr>
        <th style="text-align:left;padding:8px 10px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)">ผู้เล่น</th>
        <th style="padding:8px 4px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)">Putt</th>
        <th style="padding:8px 4px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)">GIR</th>
        <th style="padding:8px 4px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)">FW%</th>
        <th style="padding:8px 4px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)">เฉลี่ยพัต</th>
      </tr></thead><tbody>
      ${ranked.map((st,rk)=>`
        <tr style="border-bottom:0.5px solid var(--sep)">
          <td style="text-align:left;padding:9px 10px;font-size:${fs};font-weight:600;color:var(--lbl)">${medals[rk]||'#'+(rk+1)} ${st.name}</td>
          <td style="text-align:center;font-size:${fs};font-weight:700;padding:9px 4px;color:${rk===0?'var(--green)':'var(--lbl)'}">
            ${st.putt}
          </td>
          <td style="text-align:center;font-size:${fs};color:var(--lbl);padding:9px 4px">${st.gir}/${st.holes}</td>
          <td style="text-align:center;font-size:${fs};color:var(--lbl);padding:9px 4px">
            ${st.fwHoles>0?Math.round(st.fw/st.fwHoles*100)+'%':'—'}
          </td>
          <td style="text-align:center;font-size:${fs};color:var(--lbl);padding:9px 4px">
            ${st.holes>0?(st.putt/st.holes).toFixed(1):'—'}
          </td>
        </tr>`).join('')}
      </tbody></table></div>

    <!-- Per-Hole Table -->
    <div style="font-size:16px;font-weight:700;color:var(--lbl);margin:16px 0 8px">⛳ รายหลุม FW · GIR · Putt</div>
    <div class="tbl-wrap"><table class="tbl-inner">
      <thead>
        <tr>
          <th style="padding:7px 2px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)">H</th>
          <th style="padding:7px 2px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)">P</th>
          ${players.map(pl=>`<th style="padding:7px 2px;font-size:${hfs};color:var(--lbl2);background:var(--bg3)" colspan="3">${shortName(pl.name,n)}</th>`).join('')}
        </tr>
        <tr style="background:var(--bg3)">
          <th style="padding:4px 2px;font-size:9px;color:var(--lbl2)"></th>
          <th style="padding:4px 2px;font-size:9px;color:var(--lbl2)"></th>
          ${players.map(()=>`
            <th style="padding:4px 1px;font-size:9px;color:var(--green)">FW</th>
            <th style="padding:4px 1px;font-size:9px;color:var(--blue)">GIR</th>
            <th style="padding:4px 1px;font-size:9px;color:var(--lbl2)">Putt</th>
          `).join('')}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}
