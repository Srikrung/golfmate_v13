// ============================================================
// firebase/courses.js — Course Database V12.1
// fetch, add, update courses + offline queue support
// ============================================================
import { FB_URL } from '../config.js';
import { fetchWithTimeout } from './init.js';

const CACHE_KEY    = 'golfmate_courses';
const PENDING_KEY  = 'golfmate_pending_pars';
const CACHE_TTL    = 10 * 60 * 1000; // 10 นาที

let _cache     = null;
let _cacheTime = 0;

// ============================================================
// FETCH — ดึงสนามทั้งหมด (cache-first)
// ============================================================
export async function fetchCourses(){
  // 1) memory cache
  if(_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;

  // 2) localStorage cache
  try{
    const ls = JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');
    if(ls.data && ls.ts && Date.now() - ls.ts < CACHE_TTL){
      _cache = ls.data; _cacheTime = ls.ts;
      return _cache;
    }
  }catch(e){}

  // 3) Firebase fetch
  try{
    const res  = await fetchWithTimeout(`${FB_URL}/courses.json`,{},8000);
    if(res.status === 401){
      // Rules หมดอายุ — clear cache แจ้งผู้ใช้
      console.warn('⚠️ Firebase 401 — ตรวจสอบ Rules');
      localStorage.removeItem(CACHE_KEY);
      _cache = {}; _cacheTime = 0;
      return {};
    }
    const data = res.ok ? await res.json() : null;
    if(data && typeof data === 'object' && Object.keys(data).length > 0){
      _cache     = data;
      _cacheTime = Date.now();
      try{ localStorage.setItem(CACHE_KEY, JSON.stringify({data:_cache, ts:_cacheTime})); }catch(e){}
    } else if(!data){
      // Firebase ตอบกลับผิดปกติ — ใช้ cache เก่า
      const ls = JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');
      return ls.data || {};
    } else {
      _cache = data; _cacheTime = Date.now();
    }
    return _cache;
  }catch(e){
    // offline → คืน cache เก่า
    try{
      const ls = JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');
      return ls.data || {};
    }catch(e2){ return {}; }
  }
}

// invalidate cache เมื่อมีการแก้ไข
function _invalidateCache(){
  _cache = null;
  try{ localStorage.removeItem(CACHE_KEY); }catch(e){}
}

// ============================================================
// ADD COURSE — เพิ่มสนามใหม่
// ============================================================
export async function addCourse(data){
  const err = validateCourse(data);
  if(err) return { ok:false, msg:err };

  // เช็คชื่อซ้ำ
  const courses = await fetchCourses();
  const nameLow = data.name.trim().toLowerCase();
  const dup = Object.values(courses).find(c =>
    c.name && c.name.trim().toLowerCase() === nameLow
  );
  if(dup) return { ok:false, msg:`มีสนาม "${data.name}" อยู่แล้วครับ` };

  const id      = generateCourseId(data.name);
  const payload = { ...data, id, updatedAt: Date.now() };

  try{
    await fetchWithTimeout(`${FB_URL}/courses/${id}.json`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    },8000);
    _invalidateCache();
    return { ok:true, id };
  }catch(e){
    return { ok:false, msg:'ไม่มีสัญญาณ กรุณาลองใหม่' };
  }
}

// ============================================================
// ADD LOOP — เพิ่มคอสใหม่ให้สนาม 9hole-loop
// ============================================================
export async function addCourseLoop(courseId, loopKey, loopData){
  if(!courseId || !loopKey || !loopData) return { ok:false, msg:'ข้อมูลไม่ครบ' };

  const courses = await fetchCourses();
  const course  = courses[courseId];
  if(!course) return { ok:false, msg:'ไม่พบสนามนี้' };

  // เช็คชื่อ loop ซ้ำ
  if(course.loops && course.loops[loopKey]){
    return { ok:false, msg:`มีคอส ${loopKey} อยู่แล้ว` };
  }

  // validate par
  if(!loopData.pars || loopData.pars.length !== 9)
    return { ok:false, msg:'ต้องระบุ Par ครบ 9 หลุม' };
  if(loopData.pars.some(p => p<3||p>6))
    return { ok:false, msg:'Par แต่ละหลุมต้องอยู่ระหว่าง 3-6' };

  try{
    await fetchWithTimeout(`${FB_URL}/courses/${courseId}/loops/${loopKey}.json`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ ...loopData, updatedAt:Date.now() })
    },8000);
    _invalidateCache();
    return { ok:true };
  }catch(e){
    return { ok:false, msg:'ไม่มีสัญญาณ กรุณาลองใหม่' };
  }
}

// ============================================================
// UPDATE PARS — อัปเดต Par (Local First + Offline Queue)
// ============================================================
export async function updateCoursePars(courseId, pars){
  if(!courseId || courseId === 'custom' || !pars) return;

  const payload = { pars, updatedAt: Date.now() };

  // บันทึก queue ก่อนเสมอ (offline safe)
  _addToQueue(courseId, payload);

  // พยายาม sync ทันที
  await flushPendingParUpdates();
}

// ============================================================
// OFFLINE QUEUE
// ============================================================
function _addToQueue(courseId, payload){
  try{
    const q = JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');
    const filtered = q.filter(p => p.courseId !== courseId);
    filtered.push({ courseId, payload, addedAt:Date.now() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(filtered));
  }catch(e){}
}

export async function flushPendingParUpdates(){
  if(!navigator.onLine) return;
  try{
    const q = JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');
    if(!q.length) return;

    const done = [];
    for(const item of q){
      try{
        const res = await fetchWithTimeout(`${FB_URL}/courses/${item.courseId}.json`,{
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(item.payload)
        },8000);
        if(res.ok) done.push(item.courseId);
      }catch(e){}
    }
    if(done.length){
      const remaining = q.filter(p => !done.includes(p.courseId));
      localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
      _invalidateCache();
    }
  }catch(e){}
}

// flush อัตโนมัติเมื่อมีสัญญาณกลับมา
window.addEventListener('online', () => flushPendingParUpdates());

// ============================================================
// VALIDATE
// ============================================================
export function validateCourse(data){
  if(!data.name || data.name.trim().length < 3)
    return 'ชื่อสนามต้องมีอย่างน้อย 3 ตัวอักษร';

  if(data.type === '18hole'){
    if(!data.pars || data.pars.length !== 18)
      return 'ต้องระบุ Par ครบ 18 หลุม';
    if(data.pars.some(p => p<3||p>6))
      return 'Par แต่ละหลุมต้องอยู่ระหว่าง 3-6';
    const total = data.pars.reduce((s,v)=>s+v,0);
    if(total<54||total>76)
      return `Par รวม ${total} ไม่ถูกต้อง (ควรอยู่ระหว่าง 54-76)`;
  } else if(data.type === '9hole-loop'){
    if(!data.loops || !Object.keys(data.loops).length)
      return 'ต้องมีอย่างน้อย 1 คอส';
    for(const [key,loop] of Object.entries(data.loops)){
      if(!loop.pars || loop.pars.length !== 9)
        return `คอส ${key}: ต้องระบุ Par ครบ 9 หลุม`;
      if(loop.pars.some(p=>p<3||p>6))
        return `คอส ${key}: Par แต่ละหลุมต้องอยู่ระหว่าง 3-6`;
    }
  } else {
    return 'ต้องระบุประเภทสนาม (18หลุม หรือ 9หลุม)';
  }
  return null;
}

export function generateCourseId(name){
  const base = name.trim()
    .toLowerCase()
    .replace(/\s+/g,'-')
    .replace(/[^a-z0-9ก-ฮ-]/g,'')
    .slice(0,30);
  return base + '-' + Date.now().toString(36);
}

// ============================================================
// HELPERS
// ============================================================
export function hasPars(course){
  if(!course) return false;
  if(course.type === '9hole-loop'){
    return course.loops && Object.values(course.loops).some(l=>l.pars?.length===9);
  }
  return Array.isArray(course.pars) && course.pars.length === 18;
}

export function getSelectedCoursePars(course, f9Key, b9Key){
  if(!course) return null;
  if(course.type === '9hole-loop'){
    const f = course.loops?.[f9Key]?.pars;
    const b = course.loops?.[b9Key]?.pars;
    if(f && b) return [...f,...b];
    return null;
  }
  return course.pars || null;
}
