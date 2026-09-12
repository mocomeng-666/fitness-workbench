/* app.js — 路由 + 五个页面渲染 + 事件（V1.1） */
'use strict';

/* ============ 工具 ============ */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayStr() { return fmtDate(new Date()); }
function dowOf(dateStr) { // 1=周一 ... 7=周日
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay() === 0 ? 7 : d.getDay();
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function currentWeekIndex(profile) {
  if (!profile || !profile.chosenStartDate) return 1;
  const start = new Date(profile.chosenStartDate + 'T00:00:00');
  const diff = Math.floor((Date.now() - start.getTime()) / 86400000);
  return Math.min(Math.max(Math.floor(diff / 7) + 1, 1), 8);
}
function weekStartOf(profile, weekIndex) {
  return addDays(profile.chosenStartDate, (weekIndex - 1) * 7);
}
function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 兜底忽略 */ }
}

/* 🔥 连续完成天数（已完成/部分完成计） */
function computeStreak(sessions) {
  const done = new Set(sessions.filter(s => s.status === '已完成' || s.status === '部分完成').map(s => s.date));
  let cursor = todayStr();
  if (!done.has(cursor)) cursor = addDays(cursor, -1); // 今天还没练不算断
  let n = 0;
  while (done.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}

/* 🎓 毕业：第 8 周排期内所有训练日全部「已完成」 */
function isGraduated(profile, sessions) {
  const start = weekStartOf(profile, 8);
  const plan = weekPlan(profile, 8);
  const doneDates = new Set(sessions.filter(s => s.status === '已完成').map(s => s.date));
  return plan.every((d, i) => d.type === 'rest' || doneDates.has(addDays(start, i)));
}

/* ============ 全局状态 ============ */
const STATE = {
  profile: null,
  page: 'today',
  session: null,
  sessionsCache: [],
  planViewWeek: null,
  scheduleConfirmDismissed: false // D2：本页会话「稍后再说」后不再即时弹，离开计划页后复位
};
/* V1.5 ⑤：页面级 settings 缓存（renderToday 等 async 渲染写入，执行页非 async 读取主有氧/自定义项） */
let settingsCache = null;

/* V1.5 ⑤：有氧项目名解析（内置器械 → EXERCISES；自定义预设 → 固定名；未知回退原始 id） */
function cardioNameOf(id) {
  if (EXERCISES[id]) return EXERCISES[id].name;
  const p = CUSTOM_CARDIO_PRESETS.find(x => x.id === id);
  return p ? p.name : String(id);
}
/* V1.5 ⑤：主有氧是否可用（指向内置器械或已激活预设才生效，否则回退 null） */
function mainCardioUsable(cfg) {
  const mc = cfg && cfg.mainCardio;
  if (!mc) return null;
  if (EXERCISES[mc] || (cfg.customCardio || []).indexOf(mc) !== -1) return mc;
  return null;
}
/* V1.5 ⑤：有氧日标题（主有氧替换器械名，保留「＋附加」后缀；示例：椭圆仪＋体态/自重） */
function cardioDayTitle(tpl, cfg) {
  const cid = mainCardioUsable(cfg) || (tpl.cardio && tpl.cardio.exerciseId);
  const parts = String(tpl.name || '').split('＋');
  const rest = parts[1] || '';
  return (cid ? cardioNameOf(cid) : (parts[0] || '')) + (rest ? '＋' + rest : '');
}

/* ============ 弹窗 ============ */
function openModal(html) {
  $('#modal-root').innerHTML =
    '<div class="modal-mask"><div class="modal-sheet">' + html + '</div></div>';
  $('#modal-root .modal-mask').addEventListener('click', e => {
    if (e.target.classList.contains('modal-mask')) closeModal();
  });
}
function closeModal() { $('#modal-root').innerHTML = ''; }
function confirmModal(title, text, okLabel, danger) {
  return new Promise(resolve => {
    openModal('<h3>' + esc(title) + '</h3><p class="sub" style="margin-bottom:14px">' + esc(text) + '</p>' +
      '<div class="btn-row"><button class="btn btn-secondary" id="m-cancel">取消</button>' +
      '<button class="btn ' + (danger ? 'btn-danger' : '') + '" id="m-ok">' + esc(okLabel) + '</button></div>');
    $('#m-cancel').onclick = () => { closeModal(); resolve(false); };
    $('#m-ok').onclick = () => { closeModal(); resolve(true); };
  });
}

/* ============ ✅ 完成庆祝动效（C10） ============ */
function celebrate(text) {
  return new Promise(resolve => {
    const ov = $('#celebrate-overlay');
    $('#celebrate-text').textContent = text || COPY.celebration;
    ov.classList.remove('hidden');
    vibrate([80, 60, 80]);
    setTimeout(() => { ov.classList.add('hidden'); resolve(); }, 1700);
  });
}

/* ============ RIR 说明（V1.5 ④：每天首次弹一次，跨天重置，不再永久记住） ============ */
async function maybeShowRirHelp() {
  const s = await getSettings();
  if (s.rirHelpDate !== todayStr()) {
    openModal('<h3>什么是剩余次数 (RIR)？</h3><p class="sub" style="margin-bottom:14px">' + esc(COPY.rirHelp) + '</p>' +
      '<button class="btn btn-block" id="rir-ok">知道了</button>');
    $('#rir-ok').onclick = async () => {
      s.rirHelpDate = todayStr(); await saveSettings(s); closeModal();
    };
  }
}

/* ============ 休息计时 ============ */
let timerInt = null;
function startRestTimer(seconds) {
  clearInterval(timerInt);
  let left = seconds;
  const ov = $('#timer-overlay');
  ov.classList.remove('hidden');
  const disp = $('#timer-display');
  const render = () => {
    const m = Math.floor(left / 60), s = left % 60;
    disp.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };
  render();
  timerInt = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(timerInt);
      disp.textContent = '00:00';
      vibrate([200, 100, 200, 100, 300]);
      setTimeout(() => ov.classList.add('hidden'), 600);
    } else render();
  }, 1000);
  $('#timer-skip').onclick = () => { clearInterval(timerInt); ov.classList.add('hidden'); };
}

/* ============ 排期编辑器（A4：onboarding 与计划页共用） ============ */
function scheduleEditorHtml(schedule) {
  return DOW_KEYS.map((k, i) => {
    const cur = schedule[k];
    return '<div class="sched-day" data-dow="' + k + '"><div class="dow">' + DOW_NAMES[i] + '</div><div class="sched-opts">' +
      ['strength', 'cardio', 'rest'].map(t =>
        '<button type="button" class="sched-opt ' + TYPE_META[t].cls + (cur === t ? ' on' : '') + '" data-t="' + t + '">' +
        TYPE_META[t].emoji + ' ' + TYPE_META[t].label + '</button>').join('') +
      '</div></div>';
  }).join('');
}
function bindScheduleEditor(container, schedule, onChange) {
  container.querySelectorAll('.sched-opt').forEach(b => {
    b.onclick = () => {
      const dayEl = b.closest('.sched-day');
      schedule[dayEl.dataset.dow] = b.dataset.t;
      dayEl.querySelectorAll('.sched-opt').forEach(x => x.classList.toggle('on', x === b));
      if (onChange) onChange();
    };
  });
}
function typeBadge(t) {
  const m = TYPE_META[t];
  return '<span class="badge ' + m.cls + '">' + m.emoji + ' ' + m.label + '</span>';
}

/* ============ V1.3/V1.4 辅助：部位标签 / 部位细条 / 红点 ============ */
/* V1.4：动作部位的迷你标签（读 PART_TAG，全部 notes 都显示） */
function partTagsHtml(ex) {
  return exerciseNotes(ex).map(p =>
    '<span class="part-tag">' + (PART_TAG[p] || p) + '</span>').join('');
}
/* C5/V1.4 细条边界决策：细条仅对 notes 与 HIGH_RISK_PARTS 有交集的动作触发（knee/shoulder/back），
   其余部位（hip/core/wrist/ankle/neck/spine）只显示标签。关闭状态当次内存，不写库。 */
const bodyTipClosed = new Set();
function bodyTipHtml(key, ex, excludeParts) {
  const profile = STATE.profile;
  if (!profile || profile.bodyStatus === 'none' || bodyTipClosed.has(key)) return '';
  const notes = exerciseNotes(ex).filter(p =>
    HIGH_RISK_PARTS.indexOf(p) !== -1 && !(excludeParts && excludeParts.indexOf(p) !== -1));
  if (!notes.length) return '';
  const text = notes.map(p => COPY.bodyTips[p]).filter(Boolean).join('');
  if (!text) return '';
  return '<div class="body-tip" data-tipkey="' + key + '"><div>' + esc(text) + '</div>' +
    '<button type="button" class="bt-x" aria-label="关闭">✕</button></div>';
}
function bindBodyTipClose(root) {
  (root || document).querySelectorAll('.bt-x').forEach(x => {
    x.onclick = () => {
      const tip = x.closest('.body-tip');
      if (tip) {
        bodyTipClosed.add(tip.dataset.tipkey);
        tip.remove();
      }
    };
  });
}
/* D3：计划 Tab 红点（scheduleConfirmed=false 时显示） */
function updateTabDots() {
  const dot = document.querySelector('.tab[data-page="plan"] .tab-dot');
  if (dot) dot.classList.toggle('show', !!(STATE.profile && STATE.profile.scheduleConfirmed === false));
}

/* ============ 路由 ============ */
const PAGE_TITLES = { today: '今天', plan: '计划', progress: '进展', library: '动作库', settings: '设置' };
async function go(page) {
  STATE.page = page;
  STATE.scheduleConfirmDismissed = false; // 每次切换页面复位「稍后再说」标记
  $$('.page').forEach(p => p.classList.add('hidden'));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));
  $('#page-title').textContent = PAGE_TITLES[page] || '';
  $('#app-header').className = 'hdr-' + page;
  $('#tabbar').style.display = 'flex';
  const el = $('#page-' + page);
  el.classList.remove('hidden');
  updateTabDots();
  if (page === 'today') await renderToday(el);
  else if (page === 'plan') await renderPlan(el);
  else if (page === 'progress') await renderProgress(el);
  else if (page === 'library') renderLibrary(el);
  else if (page === 'settings') await renderSettings(el);
}

/* ============ 首次使用流程（V1.3：B 简化 + C1 身体三档） ============ */
async function renderOnboarding(el) {
  $$('.page').forEach(p => p.classList.add('hidden'));
  $('#tabbar').style.display = 'none';
  $('#page-title').textContent = '欢迎使用';
  $('#app-header').className = 'hdr-today';
  el.classList.remove('hidden');

  el.innerHTML =
    '<div class="card cream"><h2>嗨，欢迎来到这里 👋</h2>' +
    '<p class="sub">' + esc(COPY.disclaimer) + '</p>' +
    '<p class="sub" style="margin-top:8px">' + esc(COPY.localOnly) + '</p></div>' +

    '<div class="card"><h3>先认识一下你</h3>' +
    '<div class="grid2">' +
    '<label class="field"><span>身高（cm）</span><input id="ob-height" type="number" step="0.5" placeholder="请输入身高"></label>' +
    '<label class="field"><span>出生年份</span><input id="ob-birth" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="如 1990"></label></div>' +
    '<div class="grid2">' +
    '<label class="field"><span>性别</span><select id="ob-sex"><option value="female">女</option><option value="male">男</option><option value="other">其他</option></select></label>' +
    '<label class="field"><span>当前体重（kg）</span><input id="ob-weight" type="number" step="0.1"></label></div></div>' +

    '<div class="card"><h3>你首要的健身目标是什么？</h3><div id="ob-goals">' +
    GOALS.map((g, i) => '<button type="button" class="radio-chip' + (i === 2 ? ' on' : '') + '" data-goal="' + g.id + '">' + g.label + '</button>').join('') +
    '</div></div>' +

    '<div class="card"><h3>每周计划练几天？</h3><div id="ob-days">' +
    [2, 3, 4, 5].map(n => '<button type="button" class="radio-chip' + (n === 5 ? ' on' : '') + '" data-days="' + n + '">' + n + ' 天</button>').join('') +
    '</div><p class="small" style="margin-top:6px">' + esc(COPY.onbDaysHint) + '</p></div>' +

    '<div class="card"><h3>训练基础</h3><div id="ob-exp">' +
    '<button type="button" class="radio-chip" data-v="experienced">有训练经验</button>' +
    '<button type="button" class="radio-chip on" data-v="restart">久不训练，重新开始</button></div></div>' +

    '<div class="card"><h3>' + esc(COPY.onbBodyTitle) + '</h3><div id="ob-body">' +
    BODY_OPTIONS.map((b, i) =>
      '<div class="body-opt"><button type="button" class="radio-chip' + (i === 0 ? ' on' : '') + '" data-v="' + b.id + '">' + b.label + '</button>' +
      '<p class="opt-sub">' + esc(b.note) + '</p></div>').join('') +
    '</div></div>' +

    '<div class="card"><h3>什么时候开始？</h3>' +
    '<label class="field"><span>第 1 周的周一</span><input id="ob-start" type="date"></label>' +
    '<p class="small" style="margin-top:4px">' + esc(COPY.startDateNote) + '</p></div>' +

    '<div class="card"><h3>初始围度（可选）</h3>' +
    '<div class="grid2">' +
    '<label class="field"><span>腰围（cm）</span><input id="ob-waist" type="number" step="0.1"></label>' +
    '<label class="field"><span>臀围（cm）</span><input id="ob-hip" type="number" step="0.1"></label></div>' +
    '<label class="field"><span>大腿围（cm）</span><input id="ob-thigh" type="number" step="0.1"></label>' +
    '<p class="small">初始体态照片可稍后在「进展」页添加。</p></div>' +
    '<button class="btn btn-block" id="ob-save">开始我的 8 周计划</button>' +
    '<p class="small" style="margin-top:8px;text-align:center">无需注册，也不要求起始重量（首次训练用剩余次数(RIR)校准）。</p>';

  // 默认下周一
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  $('#ob-start').value = fmtDate(d);

  let goal = 'posture';
  let days = 5;

  const chipGroup = (id, cb) => {
    $(id).querySelectorAll('.radio-chip').forEach(b => {
      b.onclick = () => {
        $(id).querySelectorAll('.radio-chip').forEach(x => x.classList.toggle('on', x === b));
        if (cb) cb(b);
      };
    });
  };
  chipGroup('#ob-goals', b => { goal = b.dataset.goal; });
  chipGroup('#ob-days', b => { days = parseInt(b.dataset.days, 10); });
  chipGroup('#ob-exp');
  chipGroup('#ob-body');

  $('#ob-save').onclick = async () => {
    const height = parseFloat($('#ob-height').value);
    const weight = parseFloat($('#ob-weight').value);
    const birthRaw = ($('#ob-birth').value || '').trim();
    const start = $('#ob-start').value;
    if (!height || height < 100 || height > 230) { alert('身高看一下哦，填 cm 数（100–230）'); return; }
    if (!/^\d{4}$/.test(birthRaw) || +birthRaw < 1940 || +birthRaw > 2015) {
      alert('出生年份需要是 4 位数字，范围 1940–2015'); return;
    }
    if (!weight) { alert('别忘了填当前体重（kg）'); return; }
    if (!start) { alert('选一下第 1 周周一的开始日期'); return; }
    const profile = {
      birthYear: parseInt(birthRaw, 10),
      sex: $('#ob-sex').value,
      heightCm: height,
      primaryGoal: goal,
      experience: $('#ob-exp .radio-chip.on').dataset.v,
      bodyStatus: $('#ob-body .radio-chip.on').dataset.v,
      schedule: suggestSchedule(goal, days), // B3：静默生成，不再暴露编辑器
      scheduleConfirmed: false, // D1：新档案待确认
      chosenStartDate: start,
      createdAt: Date.now()
    };
    await saveProfile(profile);
    const m = { id: uuid(), date: todayStr(), weightKg: weight };
    const w = parseFloat($('#ob-waist').value); if (w) m.waistCm = w;
    const h = parseFloat($('#ob-hip').value); if (h) m.hipCm = h;
    const t = parseFloat($('#ob-thigh').value); if (t) m.thighCm = t;
    await DB.put('measurements', m);
    STATE.profile = profile;
    await maybeShowRirHelp();
    go('today');
  };
}

/* ============ 今天 ============ */
async function getTodayContext() {
  const profile = STATE.profile;
  const weekIndex = currentWeekIndex(profile);
  const plan = weekPlan(profile, weekIndex);
  const dow = dowOf(todayStr());
  const sessions = await DB.getAll('sessions');
  STATE.sessionsCache = sessions;
  const todaySession = sessions.find(s => s.date === todayStr());
  return { weekIndex, dow, dayEntry: plan[dow - 1], sessions, todaySession };
}

async function renderToday(el) {
  const ctx = await getTodayContext();
  const { weekIndex, dayEntry, todaySession, sessions } = ctx;
  const s = await getSettings();
  settingsCache = s; // V1.5 ⑤：供 renderExecution 等非 async 渲染读取主有氧/自定义项

  let html = '';
  // 每 4 周照片导出轻提醒
  const photoOld = s.lastPhotoExportAt ? Date.now() - s.lastPhotoExportAt >= 28 * 86400000
    : (STATE.profile.createdAt && Date.now() - STATE.profile.createdAt >= 28 * 86400000);
  if (photoOld && (await DB.getAll('photos')).length) {
    html += '<div class="alert-soft">' + esc(COPY.photoReminder) + '</div>';
  }

  // 🎓 毕业卡
  if (isGraduated(STATE.profile, sessions)) {
    html += '<div class="card cream" style="text-align:center"><h2>' + esc(COPY.graduationTitle) + '</h2>' +
      '<p class="sub">' + esc(COPY.graduationText) + '</p></div>';
  }

  // 顶部：日期 + 周徽章 + 🔥连续
  const streak = computeStreak(sessions);
  html += '<div class="card cream"><div class="row between"><div>' +
    '<div class="sub">' + esc(todayStr()) + ' ｜ 第 ' + weekIndex + ' / 8 周 · ' + esc(phaseName(weekIndex)) + '</div>';

  if (!dayEntry || !dayEntry.templateId) {
    html += '<h2 style="margin-top:4px">' + TYPE_META.rest.emoji + ' 今天休息</h2>' +
      '<p class="sub">' + esc(COPY.weekendNote) + '</p></div>' +
      '<div>' + typeBadge('rest') + (streak >= 2 ? '<div class="badge accent" style="margin-top:6px">🔥 连续 ' + streak + ' 天</div>' : '') + '</div></div></div>';
    el.innerHTML = html;
    return;
  }

  const tpl = TEMPLATES[dayEntry.templateId];
  const tType = templateType(tpl.id);
  html += '<h2 style="margin-top:4px">' + TYPE_META[tType].emoji + ' ' + esc(tpl.name) + '</h2>' +
    '<p class="sub">预计 ' + esc(tpl.estMin) + ' ｜ 强度：' + esc(tpl.intensity) + '</p></div>' +
    '<div style="text-align:right">' + typeBadge(tType) +
    (streak >= 2 ? '<div class="badge accent" style="margin-top:6px">🔥 连续 ' + streak + ' 天</div>' : '') +
    '</div></div>';

  // 上次表现摘要
  const lastSame = sessions.filter(x => x.templateId === tpl.id && x.date !== todayStr())
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastSame) {
    const bits = (lastSame.exercises || []).slice(0, 3).map(e => {
      const sets = (e.sets || []).filter(x2 => x2.reps !== null && x2.reps !== undefined);
      if (!sets.length) return null;
      const maxW = Math.max.apply(null, sets.map(x2 => x2.weightKg || 0));
      const ex = EXERCISES[e.exerciseId];
      return ex.name + ' ' + (maxW ? maxW + 'kg×' : '×') + sets[0].reps;
    }).filter(Boolean);
    html += '<div class="card"><h3>上次' + esc(tpl.name) + '（' + esc(lastSame.date) + '）</h3>' +
      '<p class="small">' + (bits.length ? esc(bits.join(' ｜ ')) : '已完成') + '</p></div>';
  }

  if (todaySession && (todaySession.status === '已完成' || todaySession.status === '部分完成' || todaySession.status === '已跳过')) {
    html += '<div class="card"><h3>' + (todaySession.status === '已完成' ? '✅ 今日训练完成' : '今日训练已记录') + '</h3>' +
      '<p class="sub">状态：' + esc(todaySession.status) + '</p>' +
      (todaySession.postFeedback && todaySession.postFeedback.difficulty1to5 ?
        '<p class="small">整体难度：' + todaySession.postFeedback.difficulty1to5 + '/5</p>' : '') +
      '</div>' + nextAdviceHtml(tpl, sessions, todaySession);
    el.innerHTML = html;
    return;
  }

  if (tpl.allowRestDay) {
    html += '<div class="alert-soft">特别累的话，今天休息也完全没问题。<button class="btn btn-secondary btn-block" style="margin-top:8px" id="rest-today">😴 今天休息</button></div>';
  }

  html += '<button class="btn btn-block" id="start-training">开始训练</button>' +
    '<button class="btn btn-secondary btn-block" id="posture-only">🧘 单独做体态小训练（8–10 分钟）</button>';

  el.innerHTML = html;

  $('#start-training').onclick = () => startSessionFlow(tpl.id, weekIndex);
  $('#posture-only').onclick = () => startSessionFlow('posture', weekIndex);
  const rt = $('#rest-today');
  if (rt) rt.onclick = async () => {
    const ok = await confirmModal('今天休息', '把今天的训练标记为「已跳过」？休息也是计划的一部分。', '确认休息');
    if (ok) {
      await DB.put('sessions', {
        id: uuid(), date: todayStr(), templateId: tpl.id, weekIndex, dayType: tpl.dayLabel,
        mode: 'standard', status: '已跳过', readiness: null, exercises: [], postFeedback: null,
        createdAt: Date.now(), updatedAt: Date.now()
      });
      go('today');
    }
  };
}

/* 下次建议展示 */
function nextAdviceHtml(tpl, sessions, currentSession) {
  if (!tpl.exercises) return '';
  const kneeLocked = (currentSession && currentSession.readiness && currentSession.readiness.kneePain0to10 >= 3) ||
    hasRedFlag(currentSession) || recentRedFlag(sessions, 28);
  const items = [];
  for (const pe of tpl.exercises) {
    const ex = EXERCISES[pe.exerciseId];
    if (ex.type === 'cardio') continue;
    const hist = exerciseHistory(sessions, pe.exerciseId, null);
    const adv = progressionAdvice(pe.exerciseId, pe.reps, hist);
    if (!adv) continue;
    let text = adv.text;
    if (kneeLocked && isLowerBody(pe.exerciseId) && (adv.action === 'add' || adv.action === 'bodyweightUp')) {
      text = '膝部保护中：下肢先不加重，' + (adv.action === 'add' ? '保持当前重量就好。' : '保持当前次数/时长就好。');
    }
    items.push('<li><strong>' + esc(ex.name) + '</strong>：' + esc(text) + '</li>');
  }
  if (!items.length) return '';
  return '<div class="card"><h3>下次训练建议</h3><p class="small" style="margin-bottom:6px">' + esc(COPY.adviceIsSuggestion) + '</p>' +
    '<ul class="small" style="padding-left:18px">' + items.join('') + '</ul></div>';
}

/* ============ 训练流程 ============ */
async function startSessionFlow(templateId, weekIndex) {
  const tpl = TEMPLATES[templateId];
  const existing = STATE.sessionsCache.find(s => s.date === todayStr() && s.templateId === templateId);
  if (existing && existing.status === '进行中') { STATE.session = existing; renderExecution(); return; }

  // V1.3 C4：膝档先做自动规避，再展开为按周组数的 planExercises
  const resolved = resolveTemplateExercises(STATE.profile, templateId);
  const planExercises = (resolved && resolved.length ? resolved : (tpl.exercises || [])).map(pe => {
    const p = planFor(pe, weekIndex);
    const item = { exerciseId: pe.exerciseId, reps: pe.reps, sets: p.sets, rir: p.rir, rest: pe.rest, main: !!pe.main, perSide: !!pe.perSide, timed: !!pe.timed || !!EXERCISES[pe.exerciseId].timed };
    if (pe.autoSub) { item.autoSub = true; item.originalId = pe.originalId || pe.exerciseId; }
    return item;
  });

  openModal(
    '<h3>开始之前，先聊聊今天的状态</h3>' +
    '<div class="grid2">' +
    '<label class="field"><span>睡眠（小时，可小数）</span><input id="rd-sleep" type="number" step="0.5" min="0" max="14"></label>' +
    '<label class="field"><span>膝部疼痛（0–10）</span><input id="rd-knee" type="number" min="0" max="10" value="0"></label></div>' +
    '<div class="grid2">' +
    '<label class="field"><span>精力（1–5）</span><input id="rd-energy" type="number" min="1" max="5" value="3"></label>' +
    '<label class="field"><span>疲劳（1–5）</span><input id="rd-fatigue" type="number" min="1" max="5" value="3"></label></div>' +
    '<label class="field row" style="align-items:center"><input id="rd-sore" type="checkbox" style="width:auto;min-height:auto;margin-right:8px"><span style="margin:0">明显全身酸痛</span></label>' +
    '<label class="field"><span>备注（可选）</span><input id="rd-note" type="text"></label>' +
    '<button class="btn btn-block" id="rd-go">生成建议并开始</button>');

  $('#rd-go').onclick = async () => {
    const readiness = {
      sleepHours: $('#rd-sleep').value === '' ? null : parseFloat($('#rd-sleep').value),
      energy1to5: parseInt($('#rd-energy').value, 10) || null,
      fatigue1to5: parseInt($('#rd-fatigue').value, 10) || null,
      kneePain0to10: parseInt($('#rd-knee').value, 10) || 0,
      sore: $('#rd-sore').checked,
      note: $('#rd-note').value || ''
    };
    const session = {
      id: uuid(), date: todayStr(), templateId, weekIndex, dayType: tpl.dayLabel,
      mode: 'standard', status: '进行中', readiness,
      planExercises, appliedAdvice: [], ignoredAdvice: [],
      exercises: [], cardio: null, postFeedback: null,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await DB.put('sessions', session);
    STATE.session = session;
    showAdviceCards(readiness, tpl);
  };
}

/* 第 2 步：建议卡（B7：结论 + 一句原因，「为什么」可展开） */
function showAdviceCards(readiness, tpl) {
  const cards = readinessAdvice(readiness, tpl);
  const whyMap = {
    knee: '规则是这样的：膝部疼痛到 3 分以上时，下肢动作不自动进阶，避免带痛硬练。',
    sleep: '规则是这样的：睡眠不足 6 小时时，主要动作保持重量、减少 1 组，强度让位给恢复。',
    energy: '规则是这样的：精力 1–2 或疲劳 4–5 时，优先提供 25 分钟精简模式。',
    sore: '规则是这样的：明显全身酸痛时不加重，可以缩减辅助动作。',
    plan: '状态评估都正常，不需要减量。'
  };
  const html = '<h3>今日建议</h3>' +
    '<p class="small" style="margin-bottom:8px">' + esc(COPY.adviceIsSuggestion) + '</p>' +
    cards.map((c, i) =>
      '<div class="card" style="margin-bottom:8px"><p style="font-weight:700">' + esc(c.title) + '</p>' +
      '<p class="sub" style="font-size:14px">' + esc(c.detail) + '</p>' +
      '<details class="fold"><summary>为什么这样建议？</summary><p class="small">' + esc(whyMap[c.id] || '') + '</p></details>' +
      '<div class="btn-row" style="margin-top:8px">' +
      (c.action !== 'plan' ? '<button class="btn" data-accept="' + i + '">接受</button>' : '') +
      '<button class="btn btn-secondary" data-ignore="' + i + '">' + (c.action === 'plan' ? '好' : '忽略') + '</button>' +
      '</div></div>').join('');
  openModal(html);
  $('#modal-root').querySelectorAll('[data-accept]').forEach(btn => {
    btn.onclick = async () => {
      const c = cards[parseInt(btn.dataset.accept, 10)];
      STATE.session.planExercises = applyAdviceToPlan(STATE.session.planExercises, c.action);
      if (c.action === 'shortMode') STATE.session.mode = 'short';
      STATE.session.appliedAdvice.push(c.id);
      STATE.session.updatedAt = Date.now();
      await DB.put('sessions', STATE.session);
      closeModal();
      renderExecution();
    };
  });
  $('#modal-root').querySelectorAll('[data-ignore]').forEach(btn => {
    btn.onclick = async () => {
      const c = cards[parseInt(btn.dataset.ignore, 10)];
      if (c.action !== 'plan') {
        STATE.session.ignoredAdvice.push(c.id); // 忽略要记录
        STATE.session.updatedAt = Date.now();
        await DB.put('sessions', STATE.session);
      }
      closeModal();
      renderExecution();
    };
  });
}

/* 第 3 步：执行页 */
function renderExecution() {
  const s = STATE.session;
  const tpl = TEMPLATES[s.templateId];
  $$('.page').forEach(p => p.classList.add('hidden'));
  const el = $('#page-today');
  el.classList.remove('hidden');
  $('#page-title').textContent = tpl.name + '（进行中）';

  let html = '<div class="card cream"><div class="row between">' +
    '<div><strong>' + TYPE_META[templateType(tpl.id)].emoji + ' ' + esc(tpl.name) + '</strong> ' +
    '<span class="badge ' + TYPE_META[templateType(tpl.id)].cls + '">' + (s.mode === 'short' ? '精简模式 25 分钟' : '标准 60 分钟') + '</span></div>' +
    '<button class="btn btn-secondary" id="finish-btn" style="min-height:40px">结束训练</button></div></div>';

  if (s.readiness && s.readiness.kneePain0to10 >= 3) {
    html += '<div class="alert-orange">' + esc(COPY.kneeRule) + '</div>';
  }

  // 有氧部分（V1.5 ⑤：主有氧默认 + 四固定自定义预设可选）
  if (tpl.cardio) {
    const c = (STATE.session && STATE.session.cardio) || {};
    const kneeBody = STATE.profile && STATE.profile.bodyStatus === 'knee';
    const cfg = settingsCache || {};
    const activeCustom = (cfg.customCardio || []).filter(id => CUSTOM_CARDIO_PRESETS.some(p => p.id === id));
    const mc = mainCardioUsable(cfg);
    const defId = c.machine || mc || tpl.cardio.exerciseId;
    const isCustomSel = id => activeCustom.indexOf(id) !== -1;
    const optInner = CARDIO_MACHINES.map(m => {
      const dis = kneeBody && m === 'stair_climber'; // C7：knee 档禁选登山机
      return '<option value="' + m + '"' + (defId === m ? ' selected' : '') + (dis ? ' disabled' : '') + '>' +
        esc(EXERCISES[m].name) + (dis ? '（暂不建议）' : '') + '</option>';
    }).join('') +
      (activeCustom.length ? '<optgroup label="我的有氧">' + activeCustom.map(id =>
        '<option value="' + id + '"' + (defId === id ? ' selected' : '') + '>' + esc(cardioNameOf(id)) + '</option>').join('') + '</optgroup>' : '');
    const defCustom = isCustomSel(defId);
    html += '<div class="card ex-card t-cardio"><h3>🚶 ' + esc(cardioNameOf(defId)) +
      ' <span class="badge t-cardio">有氧 ' + tpl.cardio.minutes[0] + '–' + tpl.cardio.minutes[1] + ' 分钟</span></h3>' +
      '<p class="small" style="margin-bottom:8px">' + esc(tpl.cardio.intensityNote) + '<br>' + esc(COPY.talkTest) + '</p>' +
      '<label class="field"><span>项目</span><select id="cardio-machine">' + optInner + '</select></label>' +
      (kneeBody
        ? '<p class="small" id="cardio-knee-hint" style="margin:-4px 0 8px">' + esc(defCustom ? COPY.customKneeHint : COPY.machineKneeHint) + '</p>'
        : '<p class="small" id="cardio-knee-hint" hidden>' + esc(COPY.customKneeHint) + '</p>') +
      '<div class="grid2">' +
      '<label class="field"><span>持续时间（分钟）*</span><input id="cardio-min" type="number" min="1" value="' + (c.minutes || '') + '"></label>' +
      '<label class="field"><span>主观强度（1–10）*</span><input id="cardio-rpe" type="number" min="1" max="10" value="' + (c.rpe || '') + '"></label></div>' +
      '<div class="grid2" id="cardio-extra"' + (defCustom ? ' style="display:none"' : '') + '>' +
      '<label class="field"><span>速度（选填）</span><input id="cardio-speed" type="number" step="0.1" value="' + (c.speed || '') + '"></label>' +
      '<label class="field"><span>坡度/阻力（选填）</span><input id="cardio-level" type="number" step="0.5" value="' + (c.level || '') + '"></label></div>' +
      '<button class="btn btn-secondary btn-block" id="cardio-save">保存有氧记录</button></div>';
  }

  // 力量动作卡
  s.planExercises.forEach((pe, pi) => {
    const ex = EXERCISES[pe.exerciseId];
    const rec = (s.exercises || []).find(e => e.exerciseId === pe.exerciseId);
    const sets = rec ? rec.sets : [];
    const repsTxt = pe.timed ? pe.reps[0] + '–' + pe.reps[1] + ' 秒' : pe.reps[0] + '–' + pe.reps[1] + ' 次';
    const partTags = partTagsHtml(ex);
    const autoTag = pe.autoSub ? ' <span class="badge accent">' + esc(COPY.autoSubBadge) + '</span>' : '';
    const tipHtml = bodyTipHtml('s:' + s.id + ':' + pe.exerciseId, ex); // C5：部位细条
    html += '<div class="card ex-card" data-pi="' + pi + '">' +
      '<div class="row between"><h3>' + esc(ex.name) + partTags + autoTag + '</h3>' +
      '<button class="btn btn-secondary" style="min-height:36px;font-size:13px" data-sub="' + pi + '">换动作</button></div>' +
      tipHtml +
      '<p class="small">计划 ' + pe.sets + ' 组 × ' + repsTxt + (pe.perSide ? '（每侧）' : '') +
      ' ｜ 目标剩余次数(RIR) ' + pe.rir + ' ｜ 休息 ' + pe.rest + 's' +
      (rec && rec.substituted ? ' ｜ <span class="badge subtle">已替换</span>' : '') + '</p>' +
      '<div class="sets-box">';
    for (let i = 0; i < pe.sets; i++) {
      const st = sets[i] || {};
      html += '<div class="set-row" data-pi="' + pi + '" data-si="' + i + '">' +
        '<div class="set-label">第' + (i + 1) + '组</div>' +
        (ex.bodyweight ? '<input type="number" placeholder="负重kg(选)" value="' + (st.weightKg || '') + '" data-f="weightKg">' :
          '<input type="number" step="0.5" min="0" placeholder="重量kg" value="' + (st.weightKg === 0 || st.weightKg ? st.weightKg : '') + '" data-f="weightKg">') +
        '<input type="number" min="0" placeholder="' + (pe.timed ? '秒' : '次数') + '" value="' + (st.reps === 0 || st.reps ? st.reps : '') + '" data-f="reps">' +
        '<select data-f="rir"><option value="">剩余次数(RIR)</option>' +
        RIR_OPTIONS.map(r => '<option' + (st.rir === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>' +
        '</div>';
    }
    html += '</div>' +
      '<label class="field" style="margin-top:6px"><span>疼痛/异常备注（可选）</span>' +
      '<input type="text" data-pain="' + pi + '" value="' + esc(rec && rec.painNote ? rec.painNote : '') + '" placeholder="如：膝部第2组刺痛"></label>' +
      '<div class="btn-row">' +
      '<button class="btn" data-savesets="' + pi + '">保存该动作</button>' +
      '<button class="btn btn-secondary" data-rest="' + pe.rest + '">休息 ' + pe.rest + 's</button>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:6px"><button class="btn btn-secondary" data-anomaly="' + pi + '" style="font-size:13px">动作异常反馈</button></div>' +
      '</div>';
  });

  el.innerHTML = html;
  bindExecutionEvents(el, tpl);
}

function bindExecutionEvents(el, tpl) {
  const s = STATE.session;

  el.querySelectorAll('[data-rest]').forEach(b => {
    b.onclick = () => startRestTimer(parseInt(b.dataset.rest, 10));
  });

  el.querySelectorAll('[data-sub]').forEach(b => {
    b.onclick = () => openSwapModal(parseInt(b.dataset.sub, 10));
  });

  el.querySelectorAll('[data-savesets]').forEach(b => {
    b.onclick = async () => {
      const pi = parseInt(b.dataset.savesets, 10);
      const pe = s.planExercises[pi];
      const card = el.querySelector('[data-pi="' + pi + '"]');
      const rows = card.querySelectorAll('.set-row');
      const sets = [];
      rows.forEach((row, i) => {
        const w = row.querySelector('[data-f="weightKg"]').value;
        const r = row.querySelector('[data-f="reps"]').value;
        const rir = row.querySelector('[data-f="rir"]').value;
        sets.push({
          setIndex: i,
          plannedReps: pe.reps[1],
          weightKg: w === '' ? null : parseFloat(w),
          reps: r === '' ? null : parseInt(r, 10),
          rir: rir || null
        });
      });
      let rec = s.exercises.find(e => e.exerciseId === pe.exerciseId);
      if (!rec) { rec = { exerciseId: pe.exerciseId, sets: [] }; s.exercises.push(rec); }
      rec.sets = sets;
      rec.painNote = el.querySelector('[data-pain="' + pi + '"]').value || '';
      s.updatedAt = Date.now();
      await DB.put('sessions', s);
      b.textContent = '已保存 ✓';
      setTimeout(() => { b.textContent = '保存该动作'; }, 1200);
    };
  });

  el.querySelectorAll('[data-anomaly]').forEach(b => {
    b.onclick = () => {
      const pi = parseInt(b.dataset.anomaly, 10);
      const pe = s.planExercises[pi];
      openModal('<h3>动作异常：' + esc(EXERCISES[pe.exerciseId].name) + '</h3>' +
        '<label class="field"><span>动作中疼痛（0–10）</span><input id="an-pain" type="number" min="0" max="10"></label>' +
        '<label class="field"><span>说明（可选）</span><input id="an-note" type="text"></label>' +
        '<div class="alert-orange" style="margin-top:8px"><strong>🛑 红旗自查</strong>（勾选符合项）：<br>' +
        RED_FLAG_ITEMS.map((f, i) => '<label class="row" style="margin-top:4px"><input type="checkbox" style="width:auto;min-height:auto" data-rf="' + i + '"><span style="font-size:14px">' + esc(f) + '</span></label>').join('') +
        '</div>' +
        '<button class="btn btn-block" id="an-save">保存</button>');
      $('#an-save').onclick = async () => {
        let rec = s.exercises.find(e => e.exerciseId === pe.exerciseId);
        if (!rec) { rec = { exerciseId: pe.exerciseId, sets: [] }; s.exercises.push(rec); }
        const pain = parseInt($('#an-pain').value, 10);
        rec.painDuring = isNaN(pain) ? null : pain;
        rec.anomalyNote = $('#an-note').value || '';
        rec.redFlags = $$('#modal-root [data-rf]').filter(c => c.checked).map(c => RED_FLAG_ITEMS[parseInt(c.dataset.rf, 10)]);
        s.updatedAt = Date.now();
        await DB.put('sessions', s);
        closeModal();
        if (rec.redFlags.length) {
          openModal('<h3 style="color:var(--danger)">' + esc(COPY.redFlagTitle) + '</h3>' +
            '<div class="alert-red">' + esc(COPY.redFlagText) + '</div>' +
            '<button class="btn btn-block" id="rf-ok">我已了解</button>');
          $('#rf-ok').onclick = () => { closeModal(); renderExecution(); };
        } else if (rec.painDuring !== null && rec.painDuring >= 3) {
          openModal('<h3>疼痛提示</h3><div class="alert-orange">动作中疼痛≥3：建议减重、缩小幅度或替换动作（建议，非诊断）。</div>' +
            '<button class="btn btn-block" id="pn-ok">知道了</button>');
          $('#pn-ok').onclick = () => { closeModal(); renderExecution(); };
        } else renderExecution();
      };
    };
  });

  // V1.5 ⑤：有氧项目切换 → 自定义项只留「时长+强度」，knee 提示按所选项目切换
  const cardioSel = el.querySelector('#cardio-machine');
  if (cardioSel) {
    const updateCardioUi = () => {
      const cfg = settingsCache || {};
      const isCus = (cfg.customCardio || []).indexOf(cardioSel.value) !== -1;
      const extra = el.querySelector('#cardio-extra');
      if (extra) extra.style.display = isCus ? 'none' : '';
      const hint = el.querySelector('#cardio-knee-hint');
      if (hint) {
        const kneeBody = STATE.profile && STATE.profile.bodyStatus === 'knee';
        if (!kneeBody) { hint.hidden = true; return; }
        hint.hidden = false;
        hint.textContent = isCus ? COPY.customKneeHint : COPY.machineKneeHint;
      }
    };
    cardioSel.addEventListener('change', updateCardioUi);
  }

  const cardioSave = el.querySelector('#cardio-save');
  if (cardioSave) {
    cardioSave.onclick = async () => {
      const min = parseInt($('#cardio-min').value, 10);
      const rpe = parseInt($('#cardio-rpe').value, 10);
      if (!min || !rpe) { alert('持续时间与主观强度为必填'); return; }
      const sel = $('#cardio-machine');
      if (!sel.value) { alert('请选择项目'); return; }
      s.cardio = {
        machine: sel.value, minutes: min, rpe,
        speed: $('#cardio-speed').value === '' ? null : parseFloat($('#cardio-speed').value),
        level: $('#cardio-level').value === '' ? null : parseFloat($('#cardio-level').value)
      };
      s.updatedAt = Date.now();
      await DB.put('sessions', s);
      cardioSave.textContent = '已保存 ✓';
      setTimeout(() => { cardioSave.textContent = '保存有氧记录'; }, 1200);
    };
  }

  bindBodyTipClose(el); // C5：细条 ✕ 关闭（当次 session 内存）

  $('#finish-btn').onclick = () => renderPostFeedback();
}

/* V1.4 R3：换动作弹层（推荐替代 + 自己挑一个）。仅当次 session 生效，沿用 rec.substituted 写入路径。 */
function applySwap(session, pi, newId) {
  const pe = session.planExercises[pi];
  let rec = session.exercises.find(e => e.exerciseId === pe.exerciseId);
  if (!rec) { rec = { exerciseId: pe.exerciseId, sets: [], substituted: false }; session.exercises.push(rec); }
  rec.substituted = true;
  rec.substitutedTo = newId;
  pe.exerciseId = newId;
  // V1.3 换回逻辑：若换回自动替换前的原动作，清除 autoSub/originalId 标记
  if (newId === pe.originalId) { delete pe.autoSub; delete pe.originalId; }
  session.updatedAt = Date.now();
}
function swapRowHtml(id) {
  const ex = EXERCISES[id];
  if (!ex) return '';
  return '<button type="button" class="swap-row" data-sel="' + id + '">' +
    '<span class="swap-name">' + esc(ex.name) + partTagsHtml(ex) + '</span>' +
    '<span class="swap-type">' + (TYPE_CN[ex.type] || ex.type) + '</span></button>';
}
function openSwapModal(pi) {
  const s = STATE.session;
  if (!s || !s.planExercises) return;
  const pe = s.planExercises[pi];
  if (!pe) return;
  // 上区：推荐替代（SUBSTITUTES 原逻辑；autoSub 动作允许换回原动作）
  const cands = (SUBSTITUTES[pe.exerciseId] || []).slice();
  if (pe.autoSub && pe.originalId && pe.originalId !== pe.exerciseId &&
      cands.indexOf(pe.originalId) === -1) cands.push(pe.originalId);
  // 下区：自己挑一个——同 target 全库候选，排除自身与当日计划已含
  const taken = s.planExercises.map(x => x.exerciseId);
  const picks = sameTargetCandidates(pe.exerciseId, taken);
  openModal('<h3>换动作</h3>' +
    '<p class="small" style="margin-bottom:8px">' + esc(COPY.swapIntro) + '</p>' +
    '<div class="swap-sec-head">' + esc(COPY.swapRecTitle) + '</div>' +
    (cands.length ? '<div class="swap-list">' + cands.map(swapRowHtml).join('') + '</div>'
      : '<p class="small" style="margin:2px 0 8px">暂无推荐替代，看看下面自己挑的。</p>') +
    '<div class="swap-divider"></div>' +
    '<div class="swap-sec-head">' + esc(COPY.swapPickTitle) + '</div>' +
    (picks.length ? '<div class="swap-list">' + picks.map(p => swapRowHtml(p.id)).join('') + '</div>'
      : '<p class="small" style="margin:2px 0">' + esc(COPY.swapPickEmpty) + '</p>'));
  $('#modal-root').querySelectorAll('[data-sel]').forEach(sb => {
    sb.onclick = async () => {
      applySwap(s, pi, sb.dataset.sel);
      await DB.put('sessions', s);
      closeModal();
      renderExecution();
    };
  });
}

/* 第 4 步：练后反馈 */
function renderPostFeedback() {
  const s = STATE.session;
  openModal('<h3>练完啦，感觉怎么样？</h3>' +
    '<label class="field"><span>整体难度（1–5）</span><input id="pf-diff" type="number" min="1" max="5" value="3"></label>' +
    '<label class="field"><span>膝部变化</span><select id="pf-knee">' +
    '<option value="same">无变化</option><option value="better">好转</option><option value="worse">加重</option></select></label>' +
    '<label class="field"><span>完成状态</span><select id="pf-status">' +
    '<option value="已完成">已完成</option><option value="部分完成">部分完成</option><option value="已跳过">已跳过</option></select></label>' +
    '<div class="alert-orange"><strong>🛑 红旗自查</strong>（勾选符合项）：<br>' +
    RED_FLAG_ITEMS.map((f, i) => '<label class="row" style="margin-top:4px"><input type="checkbox" style="width:auto;min-height:auto" data-prf="' + i + '"><span style="font-size:14px">' + esc(f) + '</span></label>').join('') +
    '</div>' +
    '<button class="btn btn-block" id="pf-save">完成并生成摘要</button>');

  $('#pf-save').onclick = async () => {
    s.postFeedback = {
      difficulty1to5: parseInt($('#pf-diff').value, 10) || null,
      kneeChange: $('#pf-knee').value,
      completed: $('#pf-status').value === '已完成',
      redFlags: $$('#modal-root [data-prf]').filter(c => c.checked).map(c => RED_FLAG_ITEMS[parseInt(c.dataset.prf, 10)])
    };
    s.status = $('#pf-status').value;
    s.updatedAt = Date.now();
    await DB.put('sessions', s);
    closeModal();
    const after = () => {
      if (s.postFeedback.redFlags.length) {
        openModal('<h3 style="color:var(--danger)">' + esc(COPY.redFlagTitle) + '</h3>' +
          '<div class="alert-red">' + esc(COPY.redFlagText) + '</div>' +
          '<button class="btn btn-block" id="rf2-ok">我已了解</button>');
        $('#rf2-ok').onclick = () => { closeModal(); go('today'); };
      } else {
        go('today');
      }
    };
    if (s.status === '已完成') celebrate().then(after);
    else after();
  };
}

/* ============ 计划（B9 卡片式周视图） ============ */
async function renderPlan(el) {
  const profile = STATE.profile;
  const curWeek = currentWeekIndex(profile);
  if (!STATE.planViewWeek) STATE.planViewWeek = curWeek;
  const viewWeek = STATE.planViewWeek;
  const sessions = await DB.getAll('sessions');
  const doneDates = new Set(sessions.filter(x => x.status === '已完成' || x.status === '部分完成').map(x => x.date));
  const cfg = await getSettings(); // V1.5 ⑤：主有氧/自定义项影响计划页标题展示

  // 顶部进度条 + 当前周徽章
  let html = '<div class="card"><div class="row between"><h2 style="margin:0">8 周计划</h2>' +
    '<span class="badge subtle">第 ' + curWeek + ' 周 / 共 8 周 · ' + esc(phaseName(curWeek)) + '</span></div>' +
    '<div class="week-progress">' +
    Array.from({ length: 8 }, (_, i) => '<div class="seg' + (i + 1 < curWeek ? ' done' : i + 1 === curWeek ? ' cur' : '') + '"></div>').join('') +
    '</div>';

  // 切周导航
  html += '<div class="week-nav"><button class="btn btn-secondary" id="wk-prev"' + (viewWeek <= 1 ? ' disabled' : '') + '>◀ 上一周</button>' +
    '<strong>第 ' + viewWeek + ' 周</strong>' +
    '<button class="btn btn-secondary" id="wk-next"' + (viewWeek >= 8 ? ' disabled' : '') + '>下一周 ▶</button></div>';

  // 7 天卡片
  const start = weekStartOf(profile, viewWeek);
  const plan = weekPlan(profile, viewWeek);
  html += '<div class="day-cards">';
  plan.forEach((d, i) => {
    const dateStr = addDays(start, i);
    const isToday = dateStr === todayStr();
    const t = d.type;
    const tpl = d.templateId ? TEMPLATES[d.templateId] : null;
    const line = tpl
      ? (tpl.cardio ? cardioDayTitle(tpl, cfg) : tpl.name) + ' · ' + tpl.estMin.split('–')[1].replace(' 分钟', '') + '分'
      : '休息';
    const done = doneDates.has(dateStr);
    html += '<div class="day-card ' + TYPE_META[t].cls + (isToday ? ' is-today' : '') + '">' +
      (done ? '<span class="dc-done">✅</span>' : '') +
      '<div class="dc-dow">' + DOW_NAMES[i].slice(1) + '</div>' +
      '<div class="dc-emoji">' + TYPE_META[t].emoji + '</div>' +
      '<div class="dc-line">' + esc(line) + '</div></div>';
  });
  html += '</div>' +
    '<button class="btn btn-secondary btn-block" id="edit-sched" style="margin-top:10px">调整每周排期</button></div>';

  // 力量 A/B 动作清单（卡片化；C4：膝档显示替换后的动作）
  for (const tid of ['strengthA', 'strengthB']) {
    const tpl = TEMPLATES[tid];
    const exs = resolveTemplateExercises(profile, tid);
    html += '<div class="card"><h2>💪 ' + esc(tpl.name) + ' <span class="small">（' + esc(tpl.estMin) + '，' + esc(tpl.intensity) + '）</span></h2>' +
      exs.map(pe => {
        const ex = EXERCISES[pe.exerciseId];
        const autoNote = pe.autoSub ? '<p class="small">' + esc(COPY.autoSubBadge) + '（为你换成对膝部更友好的动作）</p>' : '';
        return '<div class="plan-ex"><div>' + esc(ex.name) + partTagsHtml(ex) + autoNote + '</div>' +
          '<div class="pe-meta">' + (pe.timed ? pe.reps[0] + '–' + pe.reps[1] + 's' : pe.reps[0] + '–' + pe.reps[1] + '次') + (pe.perSide ? '/侧' : '') +
          ' ｜ ' + pe.sets[0] + '→' + pe.sets[7] + '组 ｜ 剩余次数(RIR) ' + (pe.rir.length >= 8 ? pe.rir[0] + '→' + pe.rir[7] : pe.rir[0]) + ' ｜ ' + pe.rest + 's</div></div>';
      }).join('') + '</div>';
  }

  // 有氧日内容（折叠减字；V1.5 ⑤：主有氧替换默认器械名展示）
  for (const tid of ['tuesday', 'thursday']) {
    const tpl = TEMPLATES[tid];
    const cName = cardioNameOf(mainCardioUsable(cfg) || tpl.cardio.exerciseId);
    html += '<div class="card"><h2>🚶 ' + esc(tpl.dayLabel) + ' · ' + esc(cName) + '</h2>' +
      '<p class="small"><strong>' + esc(cName) + '</strong> ' + tpl.cardio.minutes[0] + '–' + tpl.cardio.minutes[1] + ' 分钟</p>' +
      '<details class="fold"><summary>查看详细内容</summary><ul class="small">' +
      '<li>' + esc(tpl.cardio.intensityNote) + '</li>' +
      tpl.exercises.map(pe => '<li>' + esc(EXERCISES[pe.exerciseId].name) + ' ' + pe.sets[0] + '×' + pe.reps[0] + (pe.reps[1] !== pe.reps[0] ? '–' + pe.reps[1] : '') + (pe.perSide ? '（每侧）' : '') + (pe.timed ? '秒' : '') + '</li>').join('') +
      '</ul>' + (tpl.allowRestDay ? '<p class="small" style="margin-top:6px">明显疲劳时这一天可以休息。</p>' : '') + '</details></div>';
  }

  // 阶段说明 / 体态小训练 / 有氧顺序（折叠）
  const pt = TEMPLATES.posture;
  html += '<div class="card"><h2>📋 周期与补充</h2>' +
    '<details class="fold"><summary>周期阶段说明</summary><ul class="small">' +
    PHASES.map(p => '<li><strong>' + esc(p.weeks) + '（' + esc(p.name) + '）</strong>：' + esc(p.text) + '</li>').join('') + '</ul></details>' +
    '<details class="fold"><summary>🧘 体态小训练（' + esc(pt.estMin) + '）</summary><ul class="small">' +
    pt.exercises.map(pe => '<li>' + esc(EXERCISES[pe.exerciseId].name) + ' ' + pe.sets[0] + '×' + pe.reps[0] + (pe.reps[1] !== pe.reps[0] ? '–' + pe.reps[1] : '') + (pe.perSide ? '（每侧）' : '') + (pe.holdSec ? '，保持 ' + pe.holdSec[0] + '–' + pe.holdSec[1] + 's' : '') + '</li>').join('') +
    '</ul></details>' +
    '<details class="fold"><summary>有氧项目说明</summary><p class="small">' +
    (((cfg.customCardio || []).length) ? '你的有氧：' + cfg.customCardio.map(cardioNameOf).join('、') + '。<br>' : '') +
    '内置：椭圆仪＝前 4 周首选；跑步机＝快走为主，平地/小坡度；登山机＝第 5 周后可选，膝部稳定时 5–10 分钟起步。</p></details></div>';

  el.innerHTML = html;

  $('#wk-prev').onclick = () => { STATE.planViewWeek = Math.max(1, viewWeek - 1); renderPlan(el); };
  $('#wk-next').onclick = () => { STATE.planViewWeek = Math.min(8, viewWeek + 1); renderPlan(el); };

  // 计划页修改排期（A4，V1.2 支持改每周天数）
  $('#edit-sched').onclick = () => {
    const sched = Object.assign({}, (profile.schedule || defaultSchedule()));
    let days = trainingDayCount(sched);
    openModal('<h3>调整每周排期</h3>' +
      '<p class="small" style="margin-bottom:6px">每周训练天数：</p>' +
      '<div id="ms-days" style="margin-bottom:10px">' +
      [2, 3, 4, 5].map(n => '<button type="button" class="radio-chip' + (n === days ? ' on' : '') + '" data-days="' + n + '">' + n + ' 天</button>').join('') +
      '</div>' +
      '<p class="small" style="margin-bottom:8px">唯一规则：每周恰好 <strong id="ms-days-rule">' + days + ' 个训练日</strong>。</p>' +
      '<div id="ms-sched">' + scheduleEditorHtml(sched) + '</div>' +
      '<p class="small" id="ms-count" style="margin:8px 0"></p>' +
      '<button class="btn btn-block" id="ms-save">保存排期</button>');
    const refresh = () => {
      const n = trainingDayCount(sched);
      $('#ms-days-rule').textContent = days + ' 个训练日';
      $('#ms-count').innerHTML = n === days ? '✅ 已选 ' + days + ' 个训练日。' : '当前 <strong>' + n + '</strong> 个训练日，需要恰好 ' + days + ' 个。';
    };
    bindScheduleEditor($('#ms-sched'), sched, refresh);
    refresh();
    $('#ms-days').querySelectorAll('.radio-chip').forEach(b => {
      b.onclick = () => {
        const nd = parseInt(b.dataset.days, 10);
        if (nd === days) return;
        if (!confirm('改成每周 ' + nd + ' 天会按你的目标重新生成建议排期，当前的自定义调整会被覆盖，确定吗？')) return;
        days = nd;
        $('#ms-days').querySelectorAll('.radio-chip').forEach(x => x.classList.toggle('on', x === b));
        Object.keys(sched).forEach(k => delete sched[k]);
        Object.assign(sched, suggestSchedule(profile.primaryGoal || 'posture', days));
        $('#ms-sched').innerHTML = scheduleEditorHtml(sched);
        bindScheduleEditor($('#ms-sched'), sched, refresh);
        refresh();
      };
    });
    $('#ms-save').onclick = async () => {
      if (trainingDayCount(sched) !== days) { alert('每周需要恰好 ' + days + ' 个训练日'); return; }
      STATE.profile.schedule = sched;
      STATE.profile.scheduleConfirmed = true; // D4：改排期即视为已确认
      await saveProfile(STATE.profile);
      closeModal();
      updateTabDots();
      renderPlan(el);
    };
  };

  // D2：新档首进计划页的全屏排期确认
  showScheduleConfirmIfNeeded(el);
}

/* D2：排期确认视图（复用 7 天三态编辑器组件；「稍后再说」不置位） */
function showScheduleConfirmIfNeeded(el) {
  const profile = STATE.profile;
  if (!profile || profile.scheduleConfirmed !== false || STATE.scheduleConfirmDismissed) return;
  const sched = Object.assign({}, profile.schedule || defaultSchedule());
  const targetDays = trainingDayCount(sched);
  const confirmBtnId = 'sc-confirm-' + Date.now();
  el.insertAdjacentHTML('beforeend',
    '<div class="sc-mask" id="sc-mask">' +
      '<div class="sc-panel">' +
        '<div class="sc-head"><h3>' + esc(COPY.schedConfirmTitle) + '</h3>' +
        '<button type="button" class="btn btn-secondary" id="sc-later">' + esc(COPY.laterBtn) + '</button></div>' +
        '<p class="small" style="margin-bottom:10px">' + esc(COPY.schedConfirmIntro) + '</p>' +
        '<div id="sc-sched">' + scheduleEditorHtml(sched) + '</div>' +
        '<p class="small sc-count-line" id="sc-count"></p>' +
        '<button class="btn btn-block" id="' + confirmBtnId + '">' + esc(COPY.schedConfirmBtn) + '</button>' +
      '</div></div>');
  const countEl = $('#sc-count');
  const refresh = () => {
    const n = trainingDayCount(sched);
    countEl.innerHTML = (n === targetDays ? '✅ ' : '') + '当前 ' + n + ' 个训练日（需恰好 ' + targetDays + ' 个）。';
  };
  bindScheduleEditor($('#sc-sched'), sched, refresh);
  refresh();
  $('#' + confirmBtnId).onclick = async () => {
    if (trainingDayCount(sched) !== targetDays) {
      alert('每周需要恰好 ' + targetDays + ' 个训练日才能确认，请再调整一下。');
      return;
    }
    profile.schedule = sched;
    profile.scheduleConfirmed = true;
    await saveProfile(profile);
    updateTabDots();
    renderPlan(el);
  };
  $('#sc-later').onclick = () => {
    STATE.scheduleConfirmDismissed = true; // 本次浏览不再弹（红点保留）
    const m = $('#sc-mask');
    if (m) m.remove();
  };
}

/* ============ 进展 ============ */
function svgLine(points, w, h, color) {
  if (!points.length) return '<p class="small">暂无数据</p>';
  const vals = points.map(p => p.v);
  const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  const span = (max - min) || 1;
  const stepX = points.length > 1 ? (w - 20) / (points.length - 1) : 0;
  const d = points.map((p, i) => {
    const x = 10 + i * stepX;
    const y = h - 10 - ((p.v - min) / span) * (h - 20);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const dots = points.map((p, i) => {
    const x = 10 + i * stepX;
    const y = h - 10 - ((p.v - min) / span) * (h - 20);
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + color + '"><title>' + esc(p.label) + ': ' + p.v + '</title></circle>';
  }).join('');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;background:var(--cream);border-radius:8px">' +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2"/>' + dots + '</svg>' +
    '<p class="small">' + esc(points[0].label) + ' → ' + esc(points[points.length - 1].label) + ' ｜ ' + min + ' ~ ' + max + '</p>';
}

/* 力量进步亮点（分享卡用，1–2 条） */
function strengthHighlights(review) {
  const out = [];
  for (const p of review.performances) {
    if (p.change && p.change.dW > 0) {
      const firstW = p.last.maxW - p.change.dW;
      out.push(p.name + ' ' + firstW + '→' + p.last.maxW + 'kg');
    }
    if (out.length >= 2) break;
  }
  return out;
}

/* D12：Canvas 本地绘制 1080×1350 分享卡 */
function drawShareCard(data) {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 奶油底
  ctx.fillStyle = '#FCFAF3';
  ctx.fillRect(0, 0, W, H);
  // 顶部抹茶绿条
  ctx.fillStyle = '#7FB069';
  ctx.fillRect(0, 0, W, 220);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 56px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('本周训练小结', 60, 105);
  ctx.font = '400 34px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(data.weekLabel, 60, 165);

  // V1.5 ①：完成天数 D 方案（数字 150px + 说明分行 + 细线分隔，连续天数独立成段）
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5A8F4A';
  ctx.font = '700 150px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(data.done + ' / ' + data.planned, W / 2, 445);
  ctx.font = '400 40px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = '#8B8577';
  ctx.fillText('本周完成训练', W / 2, 532);
  ctx.strokeStyle = '#DDD3BD';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo((W - 440) / 2, 578); ctx.lineTo((W + 440) / 2, 578);
  ctx.stroke();
  ctx.font = '600 52px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = '#6F5F9E';
  ctx.fillText('🔥 连续完成 ' + data.streak + ' 天', W / 2, 662);

  // 力量亮点
  ctx.textAlign = 'left';
  ctx.font = '600 44px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = '#3A362C';
  let y = 792;
  if (data.highlights.length) {
    ctx.fillText('⭐ 力量进步', 80, y);
    ctx.font = '400 42px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = '#5A8F4A';
    data.highlights.forEach(hl => { y += 74; ctx.fillText(hl, 110, y); });
    y += 62;
  }

  // V1.5 ②：鼓励语居中放大加深，句下抹茶绿短细线（A 方案）
  y = Math.max(y + 92, 1012);
  ctx.font = '600 48px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = '#2E2A21';
  const motto = '「' + data.encourage + '」';
  const lastY = wrapCanvasCenter(ctx, motto, W / 2, W - 150, 70, y);
  ctx.strokeStyle = '#7FB069';
  ctx.lineWidth = 5;
  const lw = Math.min(ctx.measureText(motto).width, 560);
  ctx.beginPath();
  ctx.moveTo((W - lw) / 2, lastY + 34); ctx.lineTo((W + lw) / 2, lastY + 34);
  ctx.stroke();

  // 底部小字（V1.5 ③：可由调用方传入品牌署名，缺省用默认）
  ctx.textAlign = 'center';
  ctx.font = '400 30px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = '#8B8577';
  ctx.fillText(data.footer || COPY.shareFooter, W / 2, H - 50);
  ctx.textAlign = 'left';
  return canvas;
}
/* 居中换行绘制：cx 为水平中心；返回最后一行 baseline Y */
function wrapCanvasCenter(ctx, text, cx, maxW, lineH, startY) {
  ctx.textAlign = 'center';
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (cur && ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineH));
  return startY + (lines.length - 1) * lineH;
}

/* V1.5 ③：按设置生成分享卡底部署名（客户名空 → 回退默认；超长截断防溢出） */
function shareFooterFor(s) {
  const name = String(s.shareBrandName || '').trim();
  if (!name) return COPY.shareFooter;
  const tpl = (BRAND_TEMPLATES[s.shareBrandTemplate] || BRAND_TEMPLATES[0]).text;
  let out = tpl.replace('{name}', name);
  if (out.length > 26) out = out.slice(0, 25) + '…';
  return out;
}

async function renderProgress(el) {
  const sessions = await DB.getAll('sessions');
  const measurements = (await DB.getAll('measurements')).sort((a, b) => a.date.localeCompare(b.date));
  const profile = STATE.profile;
  const curWeek = currentWeekIndex(profile);
  const planned = trainingDayCount(profile.schedule || defaultSchedule());
  const review = computeWeeklyReview(sessions, weekStartOf(profile, curWeek), planned);
  const streak = computeStreak(sessions);
  const lastWeekDone = curWeek > 1 ?
    computeWeeklyReview(sessions, weekStartOf(profile, curWeek - 1), planned).planVsActual.completed : null;

  let html = '<div class="card"><div class="row between"><h2 style="margin:0">本周周报（第 ' + curWeek + ' 周）</h2>' +
    (streak >= 1 ? '<span class="badge accent">🔥 连续 ' + streak + ' 天</span>' : '') + '</div>';

  const pva = review.planVsActual;
  html += '<h3 style="margin-top:10px">1. 计划 vs 实际</h3><p class="small">计划 ' + pva.planned + ' 次 ｜ 完成 ' + pva.completed + ' ｜ 部分完成 ' + pva.partial + ' ｜ 跳过 ' + pva.skipped + '</p>';

  html += '<h3 style="margin-top:10px">2. 力量动作最近表现</h3>';
  if (review.performances.length) {
    html += review.performances.map(p =>
      '<div class="plan-ex"><div>' + esc(p.name) + '</div><div class="pe-meta">' +
      (p.last.maxW ? p.last.maxW + 'kg ' : '') + p.last.sets + '组/' + p.last.totalReps + '次' +
      (p.change ? ' ｜ ' + (p.change.dW > 0 ? '+' : '') + p.change.dW + 'kg' : '') + '</div></div>').join('');
  } else html += '<p class="small">本周暂无力量记录</p>';

  html += '<h3 style="margin-top:10px">3. 加重 / 保持 / 减量（建议）</h3>';
  if (review.progressions.length) {
    html += '<ul class="small" style="padding-left:18px">' +
      review.progressions.map(p => '<li><span class="badge ' + (p.category === '减量' ? 'orange' : 't-strength') + '">' + p.category + '</span> ' + esc(p.name) + '：' + esc(p.reason) + '</li>').join('') + '</ul>';
  } else html += '<p class="small">完成一次训练后这里会有建议。</p>';

  const machineNames = Object.keys(review.cardio.machines).map(m => cardioNameOf(m) + ' ' + review.cardio.machines[m] + ' 分钟').join('、');
  html += '<h3 style="margin-top:10px">4. 有氧</h3><p class="small">总计 ' + review.cardio.totalMin + ' 分钟' + (machineNames ? '（' + esc(machineNames) + '）' : '') + '</p>';

  html += '<h3 style="margin-top:10px">5. 膝部</h3>';
  if (review.knee.redFlag) html += '<div class="alert-red">' + esc(COPY.redFlagText) + '</div>';
  html += '<p class="small">' + (review.knee.points.length ?
    '疼痛趋势：' + review.knee.points.map(p => p.date.slice(5) + '→' + p.pain).join('，') : '本周没有疼痛记录，挺好。') + '</p>';

  html += '<h3 style="margin-top:10px">6. 恢复观察</h3><p class="small">' +
    (review.recovery.sleepAvg !== null ? '平均睡眠 ' + review.recovery.sleepAvg.toFixed(1) + 'h ｜ ' : '') +
    (review.recovery.energyAvg !== null ? '平均精力 ' + review.recovery.energyAvg.toFixed(1) + '/5 ｜ ' : '') +
    esc(review.recovery.note) + '</p>';

  html += '<h3 style="margin-top:10px">7. 下周建议</h3><ul class="small" style="padding-left:18px">' +
    review.nextWeek.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<button class="btn btn-block" id="share-btn" style="margin-top:10px">🎨 生成分享卡</button>' +
    '<div id="share-out" style="margin-top:10px"></div></div>';

  // 趋势
  const doneSessions = sessions.filter(s2 => s2.status === '已完成' || s2.status === '部分完成').sort((a, b) => a.date.localeCompare(b.date));
  const byWeekCount = {};
  doneSessions.forEach(s2 => { const wk = s2.weekIndex || 1; byWeekCount[wk] = (byWeekCount[wk] || 0) + 1; });
  // E13：完成率分母=排期训练日数
  const recordedWeeks = Math.max(1, curWeek);
  const rate = Math.round(doneSessions.length / (recordedWeeks * planned) * 100);
  html += '<div class="card"><h2>趋势</h2>' +
    '<h3>每周训练次数 / 完成率</h3>' +
    svgLine(Object.keys(byWeekCount).sort().map(k => ({ label: '第' + k + '周', v: byWeekCount[k] })), 340, 110, '#5A8F4A') +
    '<p class="small">累计完成率：' + rate + '%（按每周 ' + planned + ' 个训练日计）</p>';

  const mainIds = ['goblet_box_squat', 'db_rdl', 'split_squat', 'incline_db_press'];
  for (const id of mainIds) {
    const pts = [];
    doneSessions.forEach(s2 => {
      const rec = (s2.exercises || []).find(e => e.exerciseId === id);
      if (rec) {
        const sets = (rec.sets || []).filter(x => x.weightKg !== null && x.weightKg !== undefined);
        if (sets.length) pts.push({ label: s2.date.slice(5), v: Math.max.apply(null, sets.map(x => x.weightKg)) });
      }
    });
    if (pts.length) html += '<h3 style="margin-top:8px">' + esc(EXERCISES[id].name) + ' 最大重量(kg)</h3>' + svgLine(pts, 340, 110, '#5A8F4A');
  }

  if (measurements.length) {
    const wkMap = {};
    measurements.forEach(m => {
      const wk = m.date.slice(0, 7) + '-W' + Math.ceil(parseInt(m.date.slice(8, 10), 10) / 7);
      wkMap[wk] = wkMap[wk] || [];
      wkMap[wk].push(m.weightKg);
    });
    const pts = Object.keys(wkMap).sort().map(k => ({ label: k, v: Math.round(avg(wkMap[k]) * 10) / 10 }));
    html += '<h3 style="margin-top:8px">体重周均值(kg)</h3>' + svgLine(pts, 340, 110, '#5A8F4A') +
      '<p class="small">体重建议每周测 3–7 次，看周均值趋势就好，单日波动不用管。</p>';
  }
  html += '</div>';

  // 身体数据录入
  html += '<div class="card"><h2>身体数据录入</h2>' +
    '<div class="grid2">' +
    '<label class="field"><span>体重（kg）*</span><input id="ms-weight" type="number" step="0.1"></label>' +
    '<label class="field"><span>腰围（cm）</span><input id="ms-waist" type="number" step="0.1"></label></div>' +
    '<div class="grid2">' +
    '<label class="field"><span>臀围（cm）</span><input id="ms-hip" type="number" step="0.1"></label>' +
    '<label class="field"><span>大腿围（cm）</span><input id="ms-thigh" type="number" step="0.1"></label></div>' +
    '<button class="btn btn-block" id="ms-save">保存</button></div>';

  // 体态照片
  const photos = (await DB.getAll('photos')).sort((a, b) => b.date.localeCompare(a.date));
  html += '<div class="card"><h2>体态照片</h2>' +
    '<p class="small">正面/侧面/背面，拍照或从相册导入；只存本机，不进 JSON 备份。</p>' +
    '<div class="btn-row" style="margin:8px 0">' +
    '<button class="btn btn-secondary" data-view="front">正面</button>' +
    '<button class="btn btn-secondary" data-view="side">侧面</button>' +
    '<button class="btn btn-secondary" data-view="back">背面</button></div>' +
    '<input type="file" id="photo-input" accept="image/*" class="hidden">';
  for (const view of ['front', 'side', 'back']) {
    const list = photos.filter(p => p.view === view);
    if (!list.length) continue;
    const latest = list[0];
    const fourWeeksAgo = list.find(p => (new Date(latest.date) - new Date(p.date)) >= 26 * 86400000);
    html += '<h3 style="margin-top:8px">' + ({ front: '正面', side: '侧面', back: '背面' })[view] + '（' + list.length + ' 张）</h3>' +
      '<div class="photo-grid">';
    const show = fourWeeksAgo ? [fourWeeksAgo, latest] : list.slice(0, 3);
    for (const p of show) {
      html += '<div><img data-pid="' + p.id + '" alt="' + view + '"><p class="small" style="text-align:center">' + esc(p.date) + '</p></div>';
    }
    html += '</div>' + (fourWeeksAgo ? '<p class="small">同视角约 4 周对比</p>' : '');
  }
  html += '</div>';

  el.innerHTML = html;

  el.querySelectorAll('img[data-pid]').forEach(async img => {
    const p = photos.find(x => x.id === img.dataset.pid);
    if (p && p.blob) img.src = URL.createObjectURL(p.blob);
  });

  el.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => {
      const input = $('#photo-input');
      input.dataset.view = b.dataset.view;
      input.click();
    };
  });
  $('#photo-input').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    await DB.put('photos', { id: uuid(), date: todayStr(), view: e.target.dataset.view, blob: file, createdAt: Date.now() });
    renderProgress(el);
  };

  $('#ms-save').onclick = async () => {
    const w = parseFloat($('#ms-weight').value);
    if (!w) { alert('体重为必填'); return; }
    const m = { id: uuid(), date: todayStr(), weightKg: w };
    const wa = parseFloat($('#ms-waist').value); if (wa) m.waistCm = wa;
    const hp = parseFloat($('#ms-hip').value); if (hp) m.hipCm = hp;
    const th = parseFloat($('#ms-thigh').value); if (th) m.thighCm = th;
    await DB.put('measurements', m);
    renderProgress(el);
  };

  // D12 分享卡（V1.5 ③：底部署名按设置渲染）
  $('#share-btn').onclick = async () => {
    const enc = pickEncouragement(pva.completed, planned, lastWeekDone === null ? -1 : lastWeekDone);
    const canvas = drawShareCard({
      done: pva.completed, planned,
      streak,
      highlights: strengthHighlights(review),
      encourage: enc.text,
      weekLabel: '第 ' + curWeek + ' 周 / 共 8 周 · ' + phaseName(curWeek),
      footer: shareFooterFor(await getSettings())
    });
    const url = canvas.toDataURL('image/png');
    $('#share-out').innerHTML =
      '<img class="share-img" src="' + url + '" alt="本周分享卡">' +
      '<p class="small" style="text-align:center;margin:6px 0">' + esc(COPY.shareHint) + '</p>' +
      '<button class="btn btn-secondary btn-block" id="share-dl">下载 PNG</button>';
    $('#share-dl').onclick = () => {
      canvas.toBlob(blob => downloadBlob(blob, 'week-' + curWeek + '-share.png'), 'image/png');
    };
  };
}

/* ============ 动作库（B7 折叠；V1.4：📷 拍器械识别入口 + 详情弹层复用） ============ */
function renderLibrary(el, filter) {
  filter = filter || {};
  const kw = (filter.kw || '').trim().toLowerCase();
  const dayMap = {};
  for (const tid of Object.keys(TEMPLATES)) {
    const tpl = TEMPLATES[tid];
    (tpl.exercises || []).forEach(pe => {
      dayMap[pe.exerciseId] = dayMap[pe.exerciseId] || new Set();
      dayMap[pe.exerciseId].add(tpl.name);
    });
    if (tpl.cardio) {
      dayMap[tpl.cardio.exerciseId] = dayMap[tpl.cardio.exerciseId] || new Set();
      dayMap[tpl.cardio.exerciseId].add(tpl.name);
    }
  }

  let list = Object.values(EXERCISES);
  if (kw) list = list.filter(ex => ex.name.toLowerCase().includes(kw) || (ex.en || '').toLowerCase().includes(kw));
  if (filter.type) list = list.filter(ex => ex.type === filter.type);
  if (filter.day) list = list.filter(ex => dayMap[ex.id] && Array.from(dayMap[ex.id]).some(n => n.includes(filter.day)));

  el.innerHTML =
    // V1.4 B4：识别入口（搜索三件套上方）
    '<div class="card vision-cta">' +
    '<button type="button" class="btn btn-block" id="lib-vision">' + esc(COPY.visionBtn) + '</button>' +
    '<p class="small" style="margin-top:6px">' + esc(COPY.visionPrivacy) + '</p>' +
    '<input type="file" id="vision-file" accept="image/*" class="hidden"></div>' +
    '<div class="card">' +
    '<input id="lib-kw" placeholder="按名称（中/英）检索" value="' + esc(filter.kw || '') + '">' +
    '<div class="grid2" style="margin-top:8px">' +
    '<select id="lib-day"><option value="">全部训练日</option>' +
    ['力量A', '力量B', '椭圆仪', '跑步机', '体态'].map(d => '<option' + (filter.day === d ? ' selected' : '') + '>' + d + '</option>').join('') + '</select>' +
    '<select id="lib-type"><option value="">全部器械</option>' +
    Object.keys(TYPE_CN).map(t => '<option value="' + t + '"' + (filter.type === t ? ' selected' : '') + '>' + TYPE_CN[t] + '</option>').join('') + '</select>' +
    '</div></div>' +
    '<div class="card"><h2>动作（' + list.length + '）</h2>' +
    (list.length ? list.map(ex =>
      '<div class="lib-item"><div class="row between"><div><strong>' + esc(ex.name) + '</strong>' +
      partTagsHtml(ex) +
      '<p class="small">' + esc(ex.en || '') + ' ｜ ' + (TYPE_CN[ex.type] || ex.type) + '</p></div>' +
      '<button class="btn btn-secondary" style="min-height:36px;font-size:13px" data-detail="' + ex.id + '">详情</button></div></div>'
    ).join('') : '<p class="small">无匹配动作</p>') + '</div>';

  const re = () => renderLibrary(el, { kw: $('#lib-kw').value, day: $('#lib-day').value, type: $('#lib-type').value });
  $('#lib-kw').oninput = re;
  $('#lib-day').onchange = re;
  $('#lib-type').onchange = re;

  el.querySelectorAll('[data-detail]').forEach(b => {
    b.onclick = () => openExerciseDetail(b.dataset.detail);
  });

  // V1.4 B4：拍器械识别入口（未配置 → 引导去设置）
  const visionBtn = $('#lib-vision');
  const visionFile = $('#vision-file');
  if (visionBtn) {
    visionBtn.onclick = async () => {
      const cfg = await configuredVisionCfg();
      if (!cfg) { showVisionSetupGuide(); return; }
      visionFile.value = '';
      visionFile.click();
    };
  }
  if (visionFile) visionFile.onchange = e => runVisionOnFile(e);
}

/* V1.4 R2：动作库详情弹层（普通详情/识别命中共用；顶部可带「仅供参考」条）
 * 内含「加到今天的训练」按钮：有进行中 session 才可用。 */
function openExerciseDetail(exId, opts) {
  opts = opts || {};
  const ex = EXERCISES[exId];
  if (!ex) return;
  const prof = STATE.profile;
  const kneeUser = prof && prof.bodyStatus === 'knee';
  const kneeAlert = (kneeUser && hasBodyNote(ex, 'knee')) ?
    '<div class="alert-orange" style="margin-top:8px">' + esc(COPY.kneeRule) + '</div>' : '';
  // 有 kneeRule 橙条时，细条不再重复提示 knee（肩/背等照常）
  const tip = (prof && prof.bodyStatus !== 'none') ?
    bodyTipHtml('lib:' + ex.id, ex, kneeAlert ? ['knee'] : null) : '';
  const visionNote = opts.vision ?
    '<div class="alert-orange vision-note">' + esc(COPY.visionDisclaimer) + '</div>' : '';
  openModal('<h3>' + esc(ex.name) + partTagsHtml(ex) + '</h3>' +
    visionNote +
    '<p class="small" style="margin-bottom:8px">' + esc(ex.en || '') + ' ｜ ' + (TYPE_CN[ex.type] || ex.type) + '</p>' +
    kneeAlert + tip +
    '<details class="fold" open><summary>动作要领</summary><ul class="small">' +
    ex.cues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></details>' +
    '<details class="fold"><summary>常见错误</summary><ul class="small">' +
    ex.mistakes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></details>' +
    '<button class="btn btn-secondary btn-block" id="add-today" disabled style="margin-top:12px">' + esc(COPY.addTodayBtn) + '</button>' +
    '<p class="small" id="add-today-hint" style="margin-top:4px">' + esc(COPY.addTodayNone) + '</p>' +
    '<button class="btn btn-block" style="margin-top:10px" id="lib-close">关闭</button>');
  bindBodyTipClose($('#modal-root'));
  $('#lib-close').onclick = closeModal;
  bindAddTodayButton(exId);
}

/* 找到今天「进行中」的 session（含当前执行中的内存态），用于「加到今天的训练」 */
async function activeRunningSession() {
  const cur = STATE.session;
  if (cur && cur.date === todayStr() && cur.status === '进行中') return cur;
  const all = await DB.getAll('sessions');
  const hit = all.find(x => x.date === todayStr() && x.status === '进行中');
  if (hit) STATE.session = hit; // 让执行页「继续」逻辑能直接接上
  return hit || null;
}
function bindAddTodayButton(exId) {
  const btn = $('#add-today');
  if (!btn) return;
  const hint = $('#add-today-hint');
  activeRunningSession().then(act => {
    if (!document.contains(btn)) return; // 弹层已被关闭
    if (!act) { if (hint) hint.textContent = COPY.addTodayNone; return; }
    btn.disabled = false;
    if (hint) hint.textContent = '';
    btn.onclick = async () => {
      btn.disabled = true;
      const item = planDefaultsFor(exId, act.weekIndex || currentWeekIndex(STATE.profile));
      if (!act.planExercises) act.planExercises = [];
      act.planExercises.push(item); // 追加到今日力量组末尾
      act.updatedAt = Date.now();
      if (STATE.session && STATE.session.id === act.id) STATE.session = act;
      await DB.put('sessions', act);
      closeModal();
      go('today');
      alert(COPY.addTodayDone);
    };
  });
}

/* ============ V1.4 拍器械识别（B8 调用 / B4 结果处理） ============ */
async function configuredVisionCfg() {
  const s = await getSettings();
  const v = s.vision;
  return (v && v.baseUrl && v.model && v.apiKey) ? v : null;
}
/* 无配置引导：说明 BYOK + 去设置按钮 + 路线 2 兜底 */
function showVisionSetupGuide() {
  openModal('<h3>' + esc(COPY.visionNoKeyTitle) + '</h3>' +
    '<p class="small" style="margin-bottom:12px">' + esc(COPY.visionNoKeyText) + '</p>' +
    '<button class="btn btn-block" id="vf-setup">' + esc(COPY.visionSetupBtn) + '</button>' +
    '<p class="small" style="margin-top:12px">' + esc(COPY.visionManualFallback) + '</p>');
  $('#vf-setup').onclick = () => { closeModal(); go('settings'); };
}
/* 未命中/解析失败：展示 guide 原文（若拿到）+ 兜底按钮 */
function showVisionResultCard(res) {
  openModal('<h3>📷 识别结果</h3>' +
    (res.guide ?
      '<p class="small" style="margin-bottom:10px">' + esc(COPY.visionNoMatch) + '</p><div class="card cream" style="margin-bottom:8px"><p style="font-size:14px">' + esc(res.guide) + '</p></div>'
      : '<p class="small" style="margin-bottom:10px">' + esc(COPY.visionNoMatch) + '</p>') +
    '<button class="btn btn-block" id="vf-close">' + esc(COPY.visionGoLibrary) + '</button>');
  $('#vf-close').onclick = closeModal;
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('read-fail'));
    r.readAsDataURL(file);
  });
}
/* 图片压缩：画到 canvas，最大边 1024，JPEG 0.85，减小请求体积 */
function compressImageData(dataUrl, maxSide, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const max = maxSide || 1024;
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const k = Math.min(1, max / Math.max(w, h));
        if (k < 1) { w = Math.round(w * k); h = Math.round(h * k); }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', typeof quality === 'number' ? quality : 0.85));
      } catch (e) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
/* V1.4 B8：OpenAI 兼容识别调用；解析容错，任何失败抛带 kind/status 的错误 */
async function visionRecognize(dataUrl, cfg) {
  const base = String(cfg.baseUrl || '').trim().replace(/\/+$/, '');
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 45000) : null;
  let resp;
  try {
    resp = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildVisionPromptText() },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }],
        max_tokens: 400
      }),
      signal: controller ? controller.signal : undefined
    });
  } catch (err) {
    const e = new Error('network');
    e.kind = (err && err.name === 'AbortError') ? 'timeout' : 'network';
    throw e;
  } finally { if (timer) clearTimeout(timer); }
  if (!resp.ok) { const e = new Error('http ' + resp.status); e.status = resp.status; throw e; }
  let payload;
  try { payload = await resp.json(); } catch (e) { const x = new Error('bad-json'); x.kind = 'parse'; throw x; }
  const msg = payload && payload.choices && payload.choices[0] && payload.choices[0].message;
  const content = msg ? msg.content : null;
  let text = '';
  if (Array.isArray(content)) {
    text = content.map(c => typeof c === 'string' ? c : (c && c.text ? c.text : '')).filter(Boolean).join('\n');
  } else if (content) text = String(content);
  if (!text) { const x = new Error('empty'); x.kind = 'empty'; throw x; }
  const parsed = extractVisionJson(text);
  return parsed ? { matchId: parsed.matchId, guide: parsed.guide || text } : { matchId: null, guide: text };
}
function visionErrorMessage(err) {
  if (err && err.kind === 'timeout') return COPY.visionErrTimeout;
  if (err && err.kind === 'network') return COPY.visionErrNet;
  const st = err && err.status;
  if (st === 401 || st === 403) return COPY.visionErrAuth;
  if (st === 429) return COPY.visionErrRate;
  if (st && st >= 500) return COPY.visionErrServer;
  return COPY.visionErrGeneric;
}
/* 选图 → 压缩 → 识别 → 结果处理（loading / 错误 / 命中 / 未命中） */
async function runVisionOnFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const cfg = await configuredVisionCfg();
  if (!cfg) { showVisionSetupGuide(); return; }
  const btn = document.getElementById('lib-vision');
  const btnLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = COPY.visionLoading; }
  try {
    const dataUrl = await compressImageData(await readFileAsDataURL(file));
    const res = await visionRecognize(dataUrl, { baseUrl: cfg.baseUrl, model: cfg.model, apiKey: cfg.apiKey });
    if (btn && document.contains(btn)) { btn.disabled = false; btn.textContent = btnLabel; }
    if (res.matchId && EXERCISES[res.matchId]) {
      openExerciseDetail(res.matchId, { vision: true });
    } else {
      showVisionResultCard(res);
    }
  } catch (err) {
    if (btn && document.contains(btn)) { btn.disabled = false; btn.textContent = btnLabel; }
    alert(visionErrorMessage(err));
  }
}

/* ============ V1.4 设置页「AI 器械识别」卡（B7） ============ */
let visionEditOpen = false; // 已配置状态下点「更换」进入编辑
function visionSettingsCard(s) {
  const cfg = s.vision && s.vision.baseUrl && s.vision.model && s.vision.apiKey;
  if (cfg && !visionEditOpen) {
    const vendor = visionVendorById(s.vision.vendorId);
    return '<div class="card"><h2>AI 器械识别</h2>' +
      '<p class="small">' + esc(COPY.visionIntro) + '</p>' +
      '<div class="plan-ex" style="margin-top:8px"><div><strong>' + esc((vendor && vendor.name) || '自定义') +
      '</strong> <span class="badge subtle">' + esc(s.vision.model) + '</span></div>' +
      '<div class="pe-meta">Key 已保存</div></div>' +
      '<p class="small" style="margin:6px 0 10px">' + esc(COPY.visionPrivacy) + '</p>' +
      '<div class="btn-row"><button class="btn btn-secondary" id="vs-edit">更换</button>' +
      '<button class="btn btn-secondary" id="vs-clear">清除</button></div></div>';
  }
  const prev = (s.vision && s.vision.vendorId) ? s.vision : null;
  const curVendor = prev ? (visionVendorById(prev.vendorId) || VISION_VENDORS[VISION_VENDORS.length - 1]) : VISION_VENDORS[0];
  const opts = VISION_VENDORS.map(v =>
    '<option value="' + v.id + '"' + (v.id === curVendor.id ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('');
  return '<div class="card"><h2>AI 器械识别</h2>' +
    '<p class="small" style="margin-bottom:8px">' + esc(COPY.visionIntro) + '</p>' +
    '<label class="field"><span>服务商</span><select id="vs-vendor">' + opts + '</select></label>' +
    '<div id="vs-custom"' + (curVendor.id === 'custom' ? '' : ' class="hidden"') + '>' +
    '<label class="field"><span>接口地址 baseUrl</span><input id="vs-url" type="text" placeholder="https://…/v1" value="' + esc(prev && curVendor.id === 'custom' ? prev.baseUrl : '') + '"></label>' +
    '<label class="field"><span>模型名</span><input id="vs-model" type="text" placeholder="如 xxx-vl" value="' + esc(prev && curVendor.id === 'custom' ? prev.model : '') + '"></label></div>' +
    (curVendor.id === 'custom' ? '' :
      '<details class="fold" id="vs-fold"><summary>自定义模型名（预设厂商）</summary>' +
      '<input id="vs-model-opt" type="text" value="' + esc((prev && prev.model && prev.model !== curVendor.model) ? prev.model : '') + '" placeholder="不填用该厂商默认：' + esc(curVendor.model) + '"></details>') +
    '<label class="field"><span>API Key</span><input id="vs-key" type="password" autocomplete="off" placeholder="sk-…" value="' + esc(prev ? prev.apiKey : '') + '"></label>' +
    '<p class="small" style="margin:0 0 10px">' + esc(COPY.visionPrivacy) + '　' + esc(COPY.visionModelNote) + '</p>' +
    '<button class="btn btn-block" id="vs-save">保存</button></div>';
}
function bindVisionSettings(s) {
  const vendorSel = $('#vs-vendor');
  if (!vendorSel) return;
  const urlIn = $('#vs-url'), modelIn = $('#vs-model'), optIn = $('#vs-model-opt'),
    customWrap = $('#vs-custom'), fold = $('#vs-fold');
  const syncMode = () => {
    const v = visionVendorById(vendorSel.value);
    const isCustom = !!(v && v.id === 'custom');
    if (customWrap) customWrap.classList.toggle('hidden', !isCustom);
    if (fold) fold.classList.toggle('hidden', !!isCustom);
    if (optIn && v && !isCustom) {
      optIn.placeholder = '不填用该厂商默认：' + v.model;
      if (!optIn.dataset.keep && !optIn.value) optIn.value = v.model;
    }
  };
  if (vendorSel) vendorSel.onchange = () => {
    // 切换厂商：模型输入同步为新厂商默认（用户手工改过则重置记录）
    const v = visionVendorById(vendorSel.value);
    if (optIn && v && v.id !== 'custom') { optIn.value = v.model; delete optIn.dataset.keep; }
    syncMode();
  };
  if (optIn) optIn.addEventListener('input', () => { optIn.dataset.keep = '1'; });
  syncMode();
  const keyIn = $('#vs-key');
  $('#vs-save').onclick = async () => {
    const v = visionVendorById(vendorSel.value);
    let baseUrl, model;
    if (!v) return;
    if (v.id === 'custom') {
      baseUrl = urlIn ? urlIn.value.trim() : '';
      model = modelIn ? modelIn.value.trim() : '';
    } else {
      baseUrl = v.baseUrl;
      model = (optIn ? optIn.value.trim() : '') || v.model;
    }
    const key = keyIn ? keyIn.value.trim() : '';
    if (!baseUrl) { alert('填一下接口地址'); return; }
    if (!model) { alert('填一下模型名'); return; }
    if (!key) { alert('填上 API Key 才能识别'); return; }
    s.vision = { vendorId: v.id, baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey: key };
    await saveSettings(s);
    visionEditOpen = false;
    renderSettings(elSettingsRef);
  };
}
let elSettingsRef = null;

/* V1.5 ⑥：设置页「外观」卡 HTML（三皮肤单选，切换即时生效；分享卡不随皮肤） */
function themeCardHtml(s) {
  const cur = s.theme || 'cream';
  const items = [
    { id: 'cream', name: '奶油', desc: '经典米色 · 克制生活感', sw: ['#F5F0E6', '#7FB069'] },
    { id: 'berry', name: '莓果', desc: '浅藕紫红 · 浓艳元气', sw: ['#FAF0F5', '#C4457A'] },
    { id: 'night', name: '暗夜', desc: '墨绿深色 · 低调运动', sw: ['#1B221D', '#A6C94E'] }
  ];
  const cards = items.map(t =>
    '<label style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:10px 12px;border:1px solid ' + (cur === t.id ? 'var(--main)' : 'var(--border)') + ';border-radius:12px;background:' + (cur === t.id ? 'var(--main-bg)' : 'transparent') + '">' +
    '<span style="flex:0 0 46px;height:30px;border-radius:8px;border:1px solid var(--border);display:inline-flex;overflow:hidden">' +
    '<span style="flex:1;background:' + t.sw[0] + '"></span><span style="flex:1;background:' + t.sw[1] + '"></span></span>' +
    '<span style="flex:1"><strong>' + t.name + '</strong><span class="small"> · ' + t.desc + '</span></span>' +
    '<input type="radio" name="theme-radio" value="' + t.id + '"' + (cur === t.id ? ' checked' : '') + ' style="width:auto;min-height:auto"></label>').join('');
  return '<div class="card"><h2>外观</h2>' +
    '<p class="small">皮肤只作用于应用界面，分享卡保持统一米色风格。</p>' + cards + '</div>';
}

/* V1.5 ⑤：设置页「我的有氧项目」卡 HTML（四固定预设勾选激活 + 主有氧单选） */
function cardioCardHtml(s) {
  const active = s.customCardio || [];
  const cards = CUSTOM_CARDIO_PRESETS.map(p => {
    const on = active.indexOf(p.id) !== -1;
    return '<label style="display:block;margin:8px 0;padding:10px 12px;border:1px solid ' + (on ? 'var(--main)' : 'var(--border)') + ';border-radius:12px;background:' + (on ? 'var(--main-bg)' : 'transparent') + '">' +
      '<span style="display:flex;align-items:center;justify-content:space-between"><strong>' + esc(p.name) + '</strong>' +
      '<input type="checkbox" data-co="' + p.id + '"' + (on ? ' checked' : '') + ' style="width:auto;min-height:auto"></span>' +
      '<span style="display:block;margin-top:8px"><label><input type="radio" name="main-cardio" value="' + p.id + '"' + (s.mainCardio === p.id ? ' checked' : '') + (on ? '' : ' disabled') + ' style="width:auto;min-height:auto;margin-right:6px">设为主有氧（有氧日默认练它）</label></span>' +
      '</label>';
  }).join('');
  return '<div class="card"><h2>我的有氧项目</h2>' +
    '<p class="small">勾选你常做的有氧（户外 / 游泳 / 骑行 / 球类），训练记录时就能选；可把其中一项设为主有氧，替换计划里有氧日的默认器械（不设则维持椭圆仪 / 跑步机交替）。</p>' +
    cards +
    '<button class="btn btn-block" id="co-save" style="margin-top:6px">保存有氧项目</button></div>';
}

/* V1.5 ③：设置页「分享卡署名」卡 HTML（客户名 + 三模板单选） */
function brandCardHtml(s) {
  const name = esc(String(s.shareBrandName || '').trim());
  const demoName = name || '客户名';
  const rows = BRAND_TEMPLATES.map((t, i) =>
    '<label style="display:block;margin:6px 0;line-height:1.6"><input type="radio" name="sb-tpl" value="' + i + '"' + ((s.shareBrandTemplate === i) ? ' checked' : '') + '> ' +
    esc(t.text.replace('{name}', demoName)) + '</label>').join('');
  return '<div class="card"><h2>分享卡署名</h2>' +
    '<p class="small">分享卡底部的品牌署名；客户名留空则用默认「' + esc(COPY.shareFooter) + '」。</p>' +
    '<label class="field"><span>客户名</span><input id="sb-name" maxlength="12" placeholder="如：李雷" value="' + name + '"></label>' +
    '<div class="field"><span>署名样式（预览中的名字即客户名）</span>' + rows + '</div>' +
    '<button class="btn btn-block" id="sb-save" style="margin-top:4px">保存署名</button></div>';
}

/* ============ 设置 ============ */
async function renderSettings(el) {
  elSettingsRef = el;
  const s = await getSettings();
  const profile = STATE.profile;
  const goalLabel = (GOALS.find(g => g.id === profile.primaryGoal) || {}).label || '—';
  let html =
    themeCardHtml(s) +

    '<div class="card"><h2>数据说明</h2><p class="small">' + esc(COPY.localOnly) + '</p>' +
    '<p class="small" style="margin-top:4px">加重梯度：' + s.weightIncrement + 'kg ｜ 首要目标：' + esc(goalLabel) + '</p></div>' +

    '<div class="card"><h2>备份与导出</h2>' +
    '<button class="btn btn-block" id="exp-json">导出完整 JSON（不含照片）</button>' +
    '<button class="btn btn-secondary btn-block" id="exp-zip">导出照片 ZIP</button>' +
    '<h3 style="margin-top:12px">CSV 导出</h3>' +
    '<div class="btn-row"><button class="btn btn-secondary" id="csv-sets">训练组</button>' +
    '<button class="btn btn-secondary" id="csv-cardio">有氧</button>' +
    '<button class="btn btn-secondary" id="csv-ms">测量</button></div></div>' +

    '<div class="card"><h2>导入</h2>' +
    '<p class="small">导入 JSON 将<strong>覆盖</strong>现有数据（冲突不合并），导入前需确认；将校验 schemaVersion 与结构。</p>' +
    '<input type="file" id="imp-json" accept="application/json,.json" class="hidden">' +
    '<button class="btn btn-secondary btn-block" id="imp-btn" style="margin-top:8px">选择 JSON 文件导入</button></div>' +

    visionSettingsCard(s) +

    cardioCardHtml(s) +

    brandCardHtml(s) +

    '<div class="card"><h2>周期</h2>' +
    '<p class="small">开始日期：' + esc(profile.chosenStartDate || '—') + '（第 ' + currentWeekIndex(profile) + ' / 8 周）</p>' +
    '<button class="btn btn-secondary btn-block" id="restart-cycle" style="margin-top:8px">重新开始周期（重选开始日期）</button></div>' +

    '<div class="card"><h2>危险操作</h2>' +
    '<button class="btn btn-danger btn-block" id="wipe">清空全部数据</button></div>';

  el.innerHTML = html;

  // V1.4：AI 器械识别卡（配置表单 / 已配置视图）
  bindVisionSettings(s);
  const vsEdit = $('#vs-edit');
  if (vsEdit) vsEdit.onclick = () => { visionEditOpen = true; renderSettings(el); };
  const vsClear = $('#vs-clear');
  if (vsClear) vsClear.onclick = async () => {
    s.vision = null; await saveSettings(s); visionEditOpen = false; renderSettings(el);
  };

  $('#exp-json').onclick = async () => {
    const data = await exportJSON();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'fitness-workbench-backup-' + todayStr() + '.json');
  };

  $('#exp-zip').onclick = async () => {
    try {
      const blob = await exportPhotosZip();
      downloadBlob(blob, 'fitness-photos-' + todayStr() + '.zip');
    } catch (e) { alert(e.message); }
  };

  $('#csv-sets').onclick = async () => {
    const sessions = await DB.getAll('sessions');
    let csv = 'date,template,exercise,set,weightKg,reps,rir,painNote\n';
    for (const se of sessions) {
      for (const ex of (se.exercises || [])) {
        const name = EXERCISES[ex.exerciseId] ? EXERCISES[ex.exerciseId].name : ex.exerciseId;
        (ex.sets || []).forEach(st => {
          csv += [se.date, se.templateId, name, st.setIndex + 1, st.weightKg === null ? '' : st.weightKg,
            st.reps === null ? '' : st.reps, st.rir || '', (ex.painNote || '').replace(/[",\n]/g, ' ')].join(',') + '\n';
        });
      }
    }
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv' }), 'training-sets-' + todayStr() + '.csv');
  };

  $('#csv-cardio').onclick = async () => {
    const sessions = await DB.getAll('sessions');
    let csv = 'date,machine,minutes,rpe,speed,level\n';
    for (const se of sessions) {
      if (se.cardio) {
        const c = se.cardio;
        csv += [se.date, cardioNameOf(c.machine), c.minutes, c.rpe,
          c.speed === null ? '' : c.speed, c.level === null ? '' : c.level].join(',') + '\n';
      }
    }
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv' }), 'cardio-' + todayStr() + '.csv');
  };

  $('#csv-ms').onclick = async () => {
    const ms = await DB.getAll('measurements');
    let csv = 'date,weightKg,waistCm,hipCm,thighCm\n';
    for (const m of ms.sort((a, b) => a.date.localeCompare(b.date))) {
      csv += [m.date, m.weightKg, m.waistCm || '', m.hipCm || '', m.thighCm || ''].join(',') + '\n';
    }
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv' }), 'measurements-' + todayStr() + '.csv');
  };

  $('#imp-btn').onclick = () => $('#imp-json').click();

  // V1.5 ⑥：外观皮肤即时切换（保存 + 应用 body 主题 + 刷新选中态；分享卡不随皮肤）
  el.querySelectorAll('input[name="theme-radio"]').forEach(r => {
    r.addEventListener('change', async () => {
      s.theme = r.value;
      await saveSettings(s);
      document.body.dataset.theme = r.value;
      renderSettings(el);
    });
  });

  // V1.5 ⑤：我的有氧项目保存（勾选启用后该行「主有氧」单选才可用）
  const coSave = $('#co-save');
  if (coSave) {
    el.querySelectorAll('input[data-co]').forEach(cb => {
      cb.addEventListener('change', () => {
        const radio = el.querySelector('input[name="main-cardio"][value="' + cb.dataset.co + '"]');
        if (radio) radio.disabled = !cb.checked;
      });
    });
    coSave.onclick = async () => {
      const picked = Array.from(el.querySelectorAll('input[data-co]:checked')).map(cb => cb.dataset.co);
      const sel = document.querySelector('input[name="main-cardio"]:checked');
      s.customCardio = picked;
      s.mainCardio = (sel && picked.indexOf(sel.value) !== -1) ? sel.value : null;
      await saveSettings(s);
      renderSettings(el);
    };
  }

  // V1.5 ③：分享卡署名保存（存 settings 后重渲染，预览同步刷新）
  const sbSave = $('#sb-save');
  if (sbSave) sbSave.onclick = async () => {
    const sbName = $('#sb-name');
    s.shareBrandName = (sbName ? sbName.value : '').trim();
    const sel = document.querySelector('input[name="sb-tpl"]:checked');
    s.shareBrandTemplate = sel ? parseInt(sel.value, 10) : 0;
    await saveSettings(s);
    renderSettings(el);
  };

  $('#imp-json').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let obj;
      try { obj = JSON.parse(reader.result); } catch (err) { alert('JSON 解析失败'); return; }
      const err = validateImport(obj);
      if (err) { alert('导入校验失败：' + err); return; }
      const ok = await confirmModal('确认导入', '将覆盖现有训练记录、测量与档案（照片不受影响）。确定继续？', '覆盖导入', true);
      if (!ok) return;
      try {
        await importJSON(obj);
        const imported = normalizeProfile(await getProfile()); // V1.3：缺 bodyStatus/scheduleConfirmed 兜底
        if (imported) await saveProfile(imported);
        STATE.profile = imported;
        alert('导入完成');
        go('today');
      } catch (e2) { alert('导入失败：' + e2.message); }
    };
    reader.readAsText(file);
  };

  $('#restart-cycle').onclick = () => {
    openModal('<h3>重新开始周期</h3>' +
      '<label class="field"><span>新周期第 1 周周一</span><input id="rc-date" type="date"></label>' +
      '<p class="small">历史训练记录保留，仅重置周期定位。</p>' +
      '<button class="btn btn-block" id="rc-save" style="margin-top:8px">确认重启</button>');
    const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    $('#rc-date').value = fmtDate(d);
    $('#rc-save').onclick = async () => {
      const v = $('#rc-date').value;
      if (!v) { alert('请选择日期'); return; }
      STATE.profile.chosenStartDate = v;
      await saveProfile(STATE.profile);
      closeModal();
      go('today');
    };
  };

  $('#wipe').onclick = async () => {
    const ok1 = await confirmModal('清空全部数据', '将删除档案、全部训练记录、测量与照片。此操作不可恢复！', '继续', true);
    if (!ok1) return;
    const ok2 = await confirmModal('二次确认', '请再次确认：删除后无法找回。建议先导出 JSON 与照片 ZIP。', '永久删除', true);
    if (!ok2) return;
    await DB.clearAll();
    STATE.profile = null;
    location.reload();
  };
}

/* ============ 启动 ============ */
async function boot() {
  // 测试辅助：访问路径带 ?reset=1 时清空 IndexedDB 全部本地数据并回到信息采集页
  // （随后立即用 replaceState 去掉参数，避免每次刷新都重复清空）
  if (new URLSearchParams(location.search).has('reset')) {
    try { await DB.clearAll(); } catch (e) { /* 忽略清理异常 */ }
    history.replaceState(null, '', location.pathname);
  }
  // V1.5 ⑥：应用已保存皮肤（默认奶油）
  const bootSettings = await getSettings();
  document.body.dataset.theme = bootSettings.theme || 'cream';
  const raw = await getProfile();
  // V1.3 C2/D1：旧档案迁移 bodyStatus / scheduleConfirmed（就地补齐并持久化）
  if (raw) {
    const needsMigrate = raw.bodyStatus === undefined || raw.scheduleConfirmed === undefined || !raw.schedule;
    STATE.profile = normalizeProfile(raw);
    if (needsMigrate) await saveProfile(STATE.profile);
  } else {
    STATE.profile = raw;
  }
  $$('.tab').forEach(t => { t.onclick = () => go(t.dataset.page); });

  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* 离线兜底 */ }
  }

  if (!STATE.profile) {
    await renderOnboarding($('#page-onboarding'));
  } else {
    await maybeShowRirHelp();
    go('today');
  }
}

document.addEventListener('DOMContentLoaded', boot);
