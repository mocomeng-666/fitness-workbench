/* db.js — IndexedDB Promise 封装 + JSON/ZIP 导入导出 */
'use strict';

const DB_NAME = 'fitness-workbench';
const DB_VERSION = 1;
const SCHEMA_VERSION = '1.0';
const STORES = ['profile', 'sessions', 'measurements', 'photos', 'settings'];

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile');
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('measurements')) db.createObjectStore('measurements', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const out = fn(s);
    if (out && out.onsuccess !== undefined) {
      out.onsuccess = () => { result = out.result; };
    }
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const DB = {
  async get(store, key) {
    const db = await openDB();
    return tx(db, store, 'readonly', s => s.get(key));
  },
  async getAll(store) {
    const db = await openDB();
    return tx(db, store, 'readonly', s => s.getAll());
  },
  async put(store, value, key) {
    const db = await openDB();
    return tx(db, store, 'readwrite', s => key !== undefined ? s.put(value, key) : s.put(value));
  },
  async del(store, key) {
    const db = await openDB();
    return tx(db, store, 'readwrite', s => s.delete(key));
  },
  async clear(store) {
    const db = await openDB();
    return tx(db, store, 'readwrite', s => s.clear());
  },
  async clearAll() {
    for (const s of STORES) await DB.clear(s);
  }
};

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ============ 档案 / 设置快捷访问 ============ */
async function getProfile() { return DB.get('profile', 'me'); }
async function saveProfile(p) { p.updatedAt = Date.now(); return DB.put('profile', p, 'me'); }

async function getSettings() {
  let s = await DB.get('settings', 'app');
  if (!s) {
    s = { restTimerDefault: 90, weightIncrement: 2.5, lastPhotoExportAt: null, lastBackupAt: null, schemaVersion: SCHEMA_VERSION, ignoredAdvice: [], vision: null, shareBrandName: '', shareBrandTemplate: 0, theme: 'cream', customCardio: [], mainCardio: null, rirHelpDate: null };
    await DB.put('settings', s, 'app');
  } else {
    // V1.4/1.5：旧数据读不到新字段时逐一兜底（就地补齐不持久化，保存时才写回）
    if (s.vision === undefined) s.vision = null;
    if (s.shareBrandName === undefined) s.shareBrandName = '';
    if (s.shareBrandTemplate === undefined) s.shareBrandTemplate = 0;
    if (s.theme === undefined) s.theme = 'cream';
    if (s.customCardio === undefined) s.customCardio = [];
    if (s.mainCardio === undefined) s.mainCardio = null;
    if (s.rirHelpDate === undefined) s.rirHelpDate = null;
  }
  return s;
}
async function saveSettings(s) { return DB.put('settings', s, 'app'); }

/* ============ JSON 导出 / 导入 ============ */
async function exportJSON() {
  const [profile, sessions, measurements, settings] = await Promise.all([
    getProfile(), DB.getAll('sessions'), DB.getAll('measurements'), getSettings()
  ]);
  const weeklyReviews = buildWeeklyReviews(sessions);
  const settingsOut = Object.assign({}, settings, { lastBackupAt: Date.now() });
  await saveSettings(settingsOut);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sourceDevice: navigator.userAgent || 'unknown',
    profile: profile || null,
    sessions: sessions || [],
    measurements: measurements || [],
    weeklyReviews
    // 照片不进 JSON 备份（决策 7）
  };
}

function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return '文件不是有效的 JSON 对象';
  if (obj.schemaVersion !== SCHEMA_VERSION) return 'schemaVersion 不匹配（期望 ' + SCHEMA_VERSION + '，实际 ' + (obj.schemaVersion || '缺失') + '）';
  if (!Array.isArray(obj.sessions)) return 'sessions 结构缺失或不是数组';
  if (!Array.isArray(obj.measurements)) return 'measurements 结构缺失或不是数组';
  return null;
}

/* 冲突不合并：导入即覆盖（调用方需先确认） */
async function importJSON(obj) {
  const err = validateImport(obj);
  if (err) throw new Error(err);
  await DB.clear('sessions');
  await DB.clear('measurements');
  await DB.clear('profile');
  if (obj.profile) await DB.put('profile', obj.profile, 'me');
  for (const s of obj.sessions) if (s && s.id) await DB.put('sessions', s);
  for (const m of obj.measurements) if (m && m.id) await DB.put('measurements', m);
}

/* ============ 简易 ZIP（STORED 无压缩）============ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* entries: [{name: string, data: Uint8Array}] → Uint8Array (zip) */
function buildZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);          // version needed
    lh.setUint16(6, 0x0800, true);      // UTF-8 flag
    lh.setUint16(8, 0, true);           // STORED
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameBytes, e.data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);

  let total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  for (const c of central) { out.set(c, pos); pos += c.length; }
  out.set(new Uint8Array(eocd.buffer), pos);
  return out;
}

/* 导出照片 ZIP */
async function exportPhotosZip() {
  const photos = await DB.getAll('photos');
  if (!photos.length) throw new Error('没有可导出的照片');
  const entries = [];
  for (const p of photos) {
    const buf = new Uint8Array(await p.blob.arrayBuffer());
    const ext = (p.blob.type && p.blob.type.includes('png')) ? 'png' : 'jpg';
    entries.push({ name: p.date + '_' + p.view + '_' + p.id.slice(0, 8) + '.' + ext, data: buf });
  }
  const zip = buildZip(entries);
  const s = await getSettings();
  s.lastPhotoExportAt = Date.now();
  await saveSettings(s);
  return new Blob([zip], { type: 'application/zip' });
}

/* 触发浏览器下载 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
