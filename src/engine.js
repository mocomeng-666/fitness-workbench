/* engine.js — 规则引擎：双重进阶、当日减量、膝部安全/红旗、周报计算 */
'use strict';

/* 归一化 RIR：'5+' → 5 */
function rirVal(r) {
  if (r === '5+' || r === 5 || r === '5') return 5;
  const n = parseInt(r, 10);
  return isNaN(n) ? null : n;
}

function isLowerBody(exerciseId) {
  const ex = EXERCISES[exerciseId];
  return ex && ex.target === 'lower';
}

/* ============ 当日减量建议卡 ============
 * readiness: {sleepHours, energy1to5, fatigue1to5, kneePain0to10, sore, note}
 * template: 今日模板
 * 返回 [{id, kind, title, detail, action}]：title=结论，detail=一句原因
 */
function readinessAdvice(readiness, template) {
  const out = [];
  if (!readiness) return out;
  const isStrength = template.id === 'strengthA' || template.id === 'strengthB';
  const C = COPY.advice;

  if (readiness.kneePain0to10 >= 3) {
    out.push({ id: 'knee', kind: 'knee', title: C.knee.title, detail: C.knee.detail, action: 'knee' });
  }
  if (readiness.sleepHours !== null && readiness.sleepHours < 6 && isStrength) {
    out.push({ id: 'sleep', kind: 'reduceSet', title: C.sleep.title, detail: C.sleep.detail, action: 'reduceSet' });
  }
  if ((readiness.energy1to5 !== null && readiness.energy1to5 <= 2) ||
      (readiness.fatigue1to5 !== null && readiness.fatigue1to5 >= 4)) {
    out.push({ id: 'energy', kind: 'shortMode', title: C.energy.title, detail: C.energy.detail, action: 'shortMode' });
  }
  if (readiness.sore) {
    out.push({ id: 'sore', kind: 'sore', title: C.sore.title, detail: C.sore.detail, action: 'sore' });
  }
  if (!out.length) {
    out.push({ id: 'plan', kind: 'plan', title: C.plan.title, detail: C.plan.detail, action: 'plan' });
  }
  return out;
}

/* 应用减量建议到本次执行计划（接受建议时调用） */
function applyAdviceToPlan(planExercises, adviceAction) {
  return planExercises.map(p => {
    const q = Object.assign({}, p);
    if (adviceAction === 'reduceSet' && q.main && q.sets > 1) q.sets -= 1;
    if (adviceAction === 'shortMode') q.sets = Math.min(q.sets, 2);
    if (adviceAction === 'sore' && !q.main && q.sets > 1) q.sets -= 1;
    return q;
  });
}

/* ============ 双重进阶 ============
 * history: 同一动作历史 session 记录（新→旧），元素 {sets:[{plannedReps,reps,rir,weightKg}], weekIndex}
 * repRange: [min,max]，exercise: EXERCISES 条目
 * 返回 {action: 'add'|'keep'|'reduce'|'reduceSet'|'substitute'|'bodyweightUp'|null, deltaKg, text}
 */
function progressionAdvice(exerciseId, repRange, history) {
  const ex = EXERCISES[exerciseId];
  if (!ex || ex.type === 'cardio') return null;
  const done = history.filter(h => h.sets && h.sets.length && h.sets.some(s => s.reps !== null && s.reps !== undefined));
  if (!done.length) return null;

  const last = done[0];
  const lastSets = last.sets.filter(s => s.reps !== null && s.reps !== undefined);
  if (!lastSets.length) return null;
  const avgRir = avg(lastSets.map(s => rirVal(s.rir)).filter(v => v !== null));
  const allAtUpper = lastSets.every(s => s.reps >= repRange[1]);
  const anyBelowLower = lastSets.some(s => s.reps < repRange[0]);
  const weight = lastSets[lastSets.length - 1].weightKg || 0;

  // 膝部安全由 session 层 kneeLocked 控制，这里仅生成基础建议
  if (anyBelowLower) {
    if (ex.bodyweight) {
      return { action: 'reduce', deltaKg: 0, text: '上次未达次数下限：建议减少每组次数目标或缩短保持时长，先保证动作质量。' };
    }
    const newW = Math.max(0, weight - 2.5);
    return { action: 'reduce', deltaKg: -2.5, text: '上次未达次数下限：建议下次减重 2.5kg（至 ' + fmtKg(newW) + '），或减少 1 组，或替换动作。' };
  }

  if (allAtUpper && avgRir !== null && avgRir <= 0.5) {
    return { action: 'keep', deltaKg: 0, text: '已达目标次数但基本练不动了（剩余次数≈0）：建议保持当前重量，等下次剩余次数回升再进阶。' };
  }

  if (allAtUpper && (avgRir === null || avgRir >= 2)) {
    if (done.length >= 2) {
      const prev = done[1].sets.filter(s => s.reps !== null && s.reps !== undefined);
      const prevAllUpper = prev.length && prev.every(s => s.reps >= repRange[1]);
      const prevAvgRir = avg(prev.map(s => rirVal(s.rir)).filter(v => v !== null));
      if (prevAllUpper && (prevAvgRir === null || prevAvgRir >= 2)) {
        if (ex.bodyweight) {
          if (avgRir !== null && avgRir >= 3) {
            return { action: 'bodyweightUp', deltaKg: 0, text: '连续两次达上限且剩余次数≥3：建议先增加每组次数或延长保持时长。' };
          }
          return { action: 'keep', deltaKg: 0, text: '连续两次达上限：建议保持当前次数，剩余次数≥3 后再加次数/时长。' };
        }
        return { action: 'add', deltaKg: 2.5, text: '连续两次达次数上限且剩余次数≥2：建议下次 +2.5kg（至 ' + fmtKg(weight + 2.5) + '）。' };
      }
    }
    return { action: 'keep', deltaKg: 0, text: '本次已达上限：继续保持，连续两次达标后将建议加重。' };
  }

  return { action: 'keep', deltaKg: 0, text: '按计划保持当前重量与次数目标。' };
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function fmtKg(n) { return (Math.round(n * 10) / 10) + 'kg'; }

/* ============ 膝部红旗 ============ */
function hasRedFlag(session) {
  if (!session) return false;
  if (session.postFeedback && session.postFeedback.redFlags && session.postFeedback.redFlags.length) return true;
  return (session.exercises || []).some(e => e.redFlags && e.redFlags.length);
}

/* 最近是否有红旗（用于停止下肢自动进阶） */
function recentRedFlag(sessions, withinDays) {
  const cutoff = Date.now() - withinDays * 86400000;
  return sessions.some(s => new Date(s.date).getTime() >= cutoff && hasRedFlag(s));
}

/* ============ 同动作历史（跨 session 提取） ============ */
function exerciseHistory(sessions, exerciseId, beforeDate) {
  const out = [];
  const sorted = sessions.slice().sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    if (beforeDate && s.date >= beforeDate) continue;
    const hit = (s.exercises || []).find(e => e.exerciseId === exerciseId);
    if (hit) out.push({ date: s.date, weekIndex: s.weekIndex, sets: hit.sets || [] });
  }
  return out;
}

/* ============ 周报 ============
 * 返回 {planVsActual, performances, progressions, cardio, knee, recovery, nextWeek[]}
 */
function buildWeeklyReviews(sessions) {
  // 按 ISO 周分组并生成全部周的回顾（用于导出）
  const byWeek = {};
  for (const s of sessions) {
    const key = s.date.slice(0, 8) + ''; // 粗分组由调用方细化；导出用整体计算
    void key;
  }
  return computeWeeklyReview(sessions, null);
}

function computeWeeklyReview(sessions, weekStartDate /* 'YYYY-MM-DD' 或 null=最近7天 */, plannedDays) {
  const planned = plannedDays || 5;
  let start, end;
  if (weekStartDate) {
    start = new Date(weekStartDate + 'T00:00:00');
  } else if (sessions.length) {
    const latest = sessions.map(s => s.date).sort().pop();
    start = new Date(latest + 'T00:00:00');
    start.setDate(start.getDate() - 6);
  } else {
    start = new Date();
  }
  end = new Date(start); end.setDate(end.getDate() + 7);
  const inRange = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d >= start && d < end;
  });

  // 计划 vs 实际（E13：分母=实际排期训练日数）
  const planVsActual = { completed: 0, partial: 0, skipped: 0, planned };
  for (const s of inRange) {
    if (s.status === '已完成') planVsActual.completed++;
    else if (s.status === '部分完成') planVsActual.partial++;
    else if (s.status === '已跳过') planVsActual.skipped++;
  }

  // 动作表现与变化（A/B 各动作最近一次）
  const perfMap = {};
  const sorted = inRange.slice().sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    for (const e of (s.exercises || [])) {
      const sets = (e.sets || []).filter(x => x.reps !== null && x.reps !== undefined);
      if (!sets.length) continue;
      const maxW = Math.max.apply(null, sets.map(x => x.weightKg || 0));
      const totalReps = sets.reduce((a, x) => a + (x.reps || 0), 0);
      perfMap[e.exerciseId] = perfMap[e.exerciseId] || [];
      perfMap[e.exerciseId].push({ date: s.date, maxW, totalReps, sets: sets.length });
    }
  }
  const performances = Object.keys(perfMap).map(id => {
    const arr = perfMap[id];
    const last = arr[arr.length - 1];
    const first = arr[0];
    return {
      exerciseId: id, name: EXERCISES[id] ? EXERCISES[id].name : id,
      last, change: arr.length > 1 ? { dW: last.maxW - first.maxW, dReps: last.totalReps - first.totalReps } : null
    };
  });

  // 进阶/保持/减量列表（含触发原因）
  const progressions = [];
  const doneStrength = sessions.filter(s => s.status === '已完成' || s.status === '部分完成');
  const seen = {};
  for (const s of doneStrength.slice().sort((a, b) => b.date.localeCompare(a.date))) {
    const tpl = TEMPLATES[s.templateId];
    if (!tpl || !tpl.exercises) continue;
    for (const pe of tpl.exercises) {
      if (seen[pe.exerciseId]) continue;
      seen[pe.exerciseId] = true;
      const hist = exerciseHistory(sessions, pe.exerciseId, null);
      const adv = progressionAdvice(pe.exerciseId, pe.reps, hist);
      if (adv) {
        const cat = adv.action === 'add' || adv.action === 'bodyweightUp' ? '加重/进阶'
          : adv.action === 'reduce' || adv.action === 'reduceSet' || adv.action === 'substitute' ? '减量' : '保持';
        progressions.push({ exerciseId: pe.exerciseId, name: EXERCISES[pe.exerciseId].name, category: cat, reason: adv.text });
      }
    }
  }

  // 有氧统计
  const cardio = { totalMin: 0, machines: {} };
  for (const s of inRange) {
    if (s.cardio && s.cardio.minutes) {
      cardio.totalMin += s.cardio.minutes;
      const m = s.cardio.machine;
      cardio.machines[m] = (cardio.machines[m] || 0) + s.cardio.minutes;
    }
  }

  // 膝部趋势
  const knee = { points: [], redFlag: false };
  for (const s of inRange.slice().sort((a, b) => a.date.localeCompare(b.date))) {
    if (s.readiness && s.readiness.kneePain0to10 !== null && s.readiness.kneePain0to10 !== undefined) {
      knee.points.push({ date: s.date, pain: s.readiness.kneePain0to10 });
    }
    if (hasRedFlag(s)) knee.redFlag = true;
  }

  // 睡眠/精力观察（不推断因果）
  const rec = { sleepAvg: null, energyAvg: null, note: '' };
  const sleeps = inRange.map(s => s.readiness && s.readiness.sleepHours).filter(v => v !== null && v !== undefined);
  const energies = inRange.map(s => s.readiness && s.readiness.energy1to5).filter(v => v !== null && v !== undefined);
  rec.sleepAvg = avg(sleeps);
  rec.energyAvg = avg(energies);
  const doneCount = planVsActual.completed + planVsActual.partial;
  if (sleeps.length >= 2) {
    const good = inRange.filter(s => s.readiness && s.readiness.sleepHours >= 7);
    const goodDone = good.filter(s => s.status === '已完成').length;
    rec.note = '观察：睡眠≥7小时的 ' + good.length + ' 次训练中完成 ' + goodDone + ' 次；本周共完成/部分完成 ' + doneCount + ' 次。（仅为观察描述，不代表因果关系）';
  } else {
    rec.note = '本周共完成/部分完成 ' + doneCount + ' 次训练。';
  }

  // 下周建议（最多 3 项，朋友语气）
  const NW = COPY.nextWeek;
  const nextWeek = [];
  if (knee.redFlag) nextWeek.push(NW.redFlag);
  else if (knee.points.length && knee.points[knee.points.length - 1].pain >= 3) {
    nextWeek.push(NW.kneeHigh);
  }
  if (planVsActual.skipped >= 2) nextWeek.push(NW.manySkipped);
  if (rec.sleepAvg !== null && rec.sleepAvg < 6.5) nextWeek.push(NW.lowSleep);
  const adds = progressions.filter(p => p.category === '加重/进阶');
  if (adds.length && nextWeek.length < 3) nextWeek.push(NW.canProgress(adds.length));
  if (!nextWeek.length) nextWeek.push(NW.allGood);

  return { planVsActual, performances, progressions, cardio, knee, recovery: rec, nextWeek: nextWeek.slice(0, 3) };
}
