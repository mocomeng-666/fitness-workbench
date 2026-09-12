/* data.js — 8周计划、动作库、文案常量（代码内配置，不入库） */
'use strict';

/* ============ 动作库 ============
 * type: free(自由重量) / machine(固定器械) / bodyweight(自重) / cable(绳索) / cardio(有氧器械)
 * target: lower / upper / core / posture / cardio
 */
const EXERCISES = {
  goblet_box_squat: {
    id: 'goblet_box_squat', name: '哑铃高脚杯箱式深蹲', en: 'Dumbbell Goblet Box Squat',
    type: 'free', target: 'lower', bodyweight: false,
    cues: ['双手捧哑铃于胸前，背部挺直', '臀部向后坐向箱子，膝随脚尖方向', '以无痛幅度为准，大腿平行地面不是成功条件', '轻触箱子后发力站起，不要放松坐下'],
    mistakes: ['膝盖内扣', '弯腰弓背', '坐到箱上完全卸力'],
    kneeCaution: true
  },
  db_rdl: {
    id: 'db_rdl', name: '哑铃罗马尼亚硬拉', en: 'Dumbbell Romanian Deadlift',
    type: 'free', target: 'lower', bodyweight: false,
    cues: ['双手持哑铃置于大腿前侧', '屈髋向后推臀，小腿基本垂直', '哑铃沿大腿下滑至腘绳肌有明显拉伸感', '脚跟发力伸髋站起，背部始终平直'],
    mistakes: ['弓背弯腰', '把动作做成深蹲', '哑铃离身体太远'],
    kneeCaution: false
  },
  seated_row: {
    id: 'seated_row', name: '坐姿划船机', en: 'Seated Cable Row Machine',
    type: 'machine', target: 'upper', bodyweight: false,
    cues: ['坐姿挺胸，双脚踩稳', '拉手把至下腹部，肩胛骨向后夹', '缓慢回放至手臂伸直，保持躯干稳定'],
    mistakes: ['身体大幅后仰借力', '耸肩', '回放过快'],
    kneeCaution: false
  },
  chest_press: {
    id: 'chest_press', name: '坐姿推胸机', en: 'Machine Chest Press',
    type: 'machine', target: 'upper', bodyweight: false,
    cues: ['座椅调至把手与胸中部同高', '肩胛贴紧靠垫，向前推至手臂接近伸直', '缓慢回放，保持张力'],
    mistakes: ['耸肩', '手腕过度后折', '锁死肘关节猛推'],
    kneeCaution: false
  },
  glute_bridge: {
    id: 'glute_bridge', name: '自重臀桥', en: 'Bodyweight Glute Bridge',
    type: 'bodyweight', target: 'lower', bodyweight: true,
    cues: ['仰卧屈膝，脚跟靠近臀部', '发力顶髋至肩-髋-膝成直线', '顶端收紧臀部停 1 秒后缓慢下放'],
    mistakes: ['腰椎过伸代偿', '下放过快', '膝盖内扣'],
    kneeCaution: false
  },
  dead_bug: {
    id: 'dead_bug', name: '死虫', en: 'Dead Bug',
    type: 'bodyweight', target: 'core', bodyweight: true, perSide: true,
    cues: ['仰卧，手臂指向天花板，髋膝各 90°', '腰部轻贴地面保持核心收紧', '对侧手脚缓慢下放接近地面后还原', '全程腰不要离地'],
    mistakes: ['腰部拱起离地', '动作过快', '憋气'],
    kneeCaution: false
  },
  split_squat: {
    id: 'split_squat', name: '有支撑分腿蹲', en: 'Supported Split Squat',
    type: 'bodyweight', target: 'lower', bodyweight: true, perSide: true,
    cues: ['前后分腿站立，可单手扶支撑物', '垂直下蹲，前腿膝随脚尖方向', '以无痛幅度为准，后腿膝轻点地即可', '前脚发力站起，躯干保持直立'],
    mistakes: ['前膝过度前移内扣', '身体前倾过多', '步距过窄不稳'],
    kneeCaution: true
  },
  leg_curl: {
    id: 'leg_curl', name: '坐姿腿弯举', en: 'Seated Leg Curl',
    type: 'machine', target: 'lower', bodyweight: false,
    cues: ['调整靠垫与膝轴对齐', '勾腿至最大限度，顶峰收缩 1 秒', '缓慢回放，不要让配重片落下撞击'],
    mistakes: ['臀部离开坐垫借力', '回放过快', '摆动借力'],
    kneeCaution: false
  },
  incline_db_press: {
    id: 'incline_db_press', name: '上斜哑铃卧推', en: 'Incline Dumbbell Bench Press',
    type: 'free', target: 'upper', bodyweight: false,
    cues: ['上斜凳 30–45°，哑铃置于肩部两侧', '向上推至手臂接近伸直，哑铃不相撞', '下放至胸部两侧有拉伸感', '肩胛收紧贴凳'],
    mistakes: ['腰部过度拱起', '下放失控', '肘部过度外展'],
    kneeCaution: false
  },
  neutral_pulldown: {
    id: 'neutral_pulldown', name: '中立握高位下拉', en: 'Neutral Grip Lat Pulldown',
    type: 'machine', target: 'upper', bodyweight: false,
    cues: ['对握把手，大腿固定垫压住', '下拉至上胸部，肩胛下沉后夹', '缓慢回放至手臂伸直，躯干微后仰不超过 15°'],
    mistakes: ['大幅后仰借力', '拉至颈后', '耸肩'],
    kneeCaution: false
  },
  rear_delt_fly: {
    id: 'rear_delt_fly', name: '绳索后束划船/反向飞鸟', en: 'Cable Rear Delt Row / Reverse Fly',
    type: 'cable', target: 'upper', bodyweight: false,
    cues: ['绳索调至面部高度，双手对握', '向后拉并向两侧展开，肩胛后夹', '肘部保持微屈，缓慢回放'],
    mistakes: ['耸肩借力', '重量过大导致摆动', '肘伸过直'],
    kneeCaution: false
  },
  side_plank: {
    id: 'side_plank', name: '侧桥', en: 'Side Plank',
    type: 'bodyweight', target: 'core', bodyweight: true, perSide: true, timed: true,
    cues: ['侧卧，前臂撑地，肘在肩正下方', '顶髋至身体成一条直线', '保持呼吸，不要憋气', '难度高可屈膝做'],
    mistakes: ['髋部下塌', '身体前后旋转', '憋气'],
    kneeCaution: false
  },
  incline_scap_pushup: {
    id: 'incline_scap_pushup', name: '上斜肩胛俯卧撑', en: 'Incline Scapular Push-Up',
    type: 'bodyweight', target: 'posture', bodyweight: true,
    cues: ['手撑上斜平面，手臂伸直不弯曲', '仅做肩胛骨的前引与后缩', '动作慢，感受肩胛滑动'],
    mistakes: ['屈肘做成俯卧撑', '耸肩', '速度过快'],
    kneeCaution: false
  },
  incline_pushup: {
    id: 'incline_pushup', name: '上斜俯卧撑', en: 'Incline Push-Up',
    type: 'bodyweight', target: 'upper', bodyweight: true,
    cues: ['手撑凳沿，身体成一直线', '下放至胸接近凳面', '推起时核心收紧不塌腰'],
    mistakes: ['塌腰翘臀', '头部前伸', '幅度不足'],
    kneeCaution: false
  },
  calf_raise: {
    id: 'calf_raise', name: '自重提踵', en: 'Bodyweight Calf Raise',
    type: 'bodyweight', target: 'lower', bodyweight: true,
    cues: ['站立，前脚掌可踩台阶边缘', '提踵至最高点停 1 秒', '缓慢下放至小腿有拉伸感'],
    mistakes: ['下放过快', '借助弹震', '膝部锁死晃动'],
    kneeCaution: false
  },
  hip_hinge: {
    id: 'hip_hinge', name: '徒手髋铰链', en: 'Bodyweight Hip Hinge',
    type: 'bodyweight', target: 'posture', bodyweight: true,
    cues: ['站立，双手可置于胸前', '屈髋向后推臀，背部平直', '感受腘绳肌拉伸后伸髋还原'],
    mistakes: ['弓背', '做成深蹲', '膝盖大幅前移'],
    kneeCaution: false
  },
  thoracic_rotation: {
    id: 'thoracic_rotation', name: '胸椎旋转', en: 'Thoracic Rotation',
    type: 'bodyweight', target: 'posture', bodyweight: true, perSide: true,
    cues: ['四点跪撑或侧卧，一手放头后', '肘部向下收再向上打开，旋转胸椎', '骨盆保持稳定不动'],
    mistakes: ['腰椎代偿旋转', '速度过快', '骨盆翻转'],
    kneeCaution: false
  },
  thoracic_extension: {
    id: 'thoracic_extension', name: '胸椎伸展', en: 'Thoracic Extension',
    type: 'bodyweight', target: 'posture', bodyweight: true,
    cues: ['仰卧泡沫轴于上背部或跪姿手撑凳', '缓慢伸展上背部，头颈放松', '保持 2–3 秒后还原'],
    mistakes: ['腰椎过伸代偿', '憋气', '动作过猛'],
    kneeCaution: false
  },
  wall_slide: {
    id: 'wall_slide', name: '靠墙滑手', en: 'Wall Slide',
    type: 'bodyweight', target: 'posture', bodyweight: true,
    cues: ['背靠墙站立，头、上背、臀贴墙', '手臂贴墙缓慢上滑再下放', '腰部不要拱起离墙'],
    mistakes: ['腰部拱起', '手臂离墙', '耸肩'],
    kneeCaution: false
  },
  chin_tuck: {
    id: 'chin_tuck', name: '仰卧/靠墙下巴回收', en: 'Chin Tuck (Supine or Wall)',
    type: 'bodyweight', target: 'posture', bodyweight: true,
    cues: ['仰卧或靠墙，目视前方', '下巴水平向后收，做出“双下巴”', '保持 3–5 秒后放松', '不要低头'],
    mistakes: ['低头代替回收', '用力过猛', '憋气'],
    kneeCaution: false
  },
  treadmill_walk: {
    id: 'treadmill_walk', name: '跑步机快走', en: 'Treadmill Brisk Walk',
    type: 'cardio', target: 'cardio', bodyweight: true,
    cues: ['坡度 0–3%，速度以能快走为准', '不扶扶手，自然摆臂', '强度：能说完整句子但不能唱歌'],
    mistakes: ['扶扶手降低强度', '坡度过大', '含胸低头'],
    kneeCaution: false
  },
  elliptical: {
    id: 'elliptical', name: '椭圆仪', en: 'Elliptical Trainer',
    type: 'cardio', target: 'cardio', bodyweight: true,
    cues: ['全脚掌踩实踏板，躯干直立', '手脚协调发力', '强度：能说完整句子但不能唱歌'],
    mistakes: ['踮脚尖', '身体左右摇晃', '阻力过大硬踩'],
    kneeCaution: false
  },
  stair_climber: {
    id: 'stair_climber', name: '登山机', en: 'Stair Climber',
    type: 'cardio', target: 'cardio', bodyweight: true,
    cues: ['第 5 周后可选，膝部稳定时 5–10 分钟起步', '躯干直立，轻扶扶手保持平衡即可', '全脚掌踩实，步幅适中'],
    mistakes: ['身体前倾压扶手', '脚尖踩踏', '速度过快'],
    kneeCaution: false /* V1.4：登山机不再标注 knee；膝部保护由 C7 器械置灰承担 */
  }
};

/* V1.4：部位标注全量表（authoritative，2026-09-08）
 * 20 个非有氧动作全部注入 notes；跑步机/椭圆仪/登山机等有氧器械保持无 notes。
 * 其余新增部位（hip/core/wrist/ankle/neck/spine）仅作为标签展示，不触发警示细条。 */
(function annotateNotes() {
  const map = {
    goblet_box_squat: ['knee'],
    db_rdl: ['back'],
    seated_row: ['back'],
    chest_press: ['shoulder'],
    glute_bridge: ['hip'],
    dead_bug: ['core'],
    split_squat: ['knee', 'hip'],
    leg_curl: ['knee'],
    incline_db_press: ['shoulder', 'wrist'],
    neutral_pulldown: ['shoulder'],
    rear_delt_fly: ['shoulder'],
    side_plank: ['core'],
    incline_scap_pushup: ['shoulder'],
    incline_pushup: ['shoulder', 'wrist'],
    calf_raise: ['ankle'],
    hip_hinge: ['hip', 'back'],
    thoracic_rotation: ['spine'],
    thoracic_extension: ['spine'],
    wall_slide: ['shoulder'],
    chin_tuck: ['neck']
  };
  for (const id in map) { if (EXERCISES[id]) EXERCISES[id].notes = map[id]; }
})();

/* V1.3 C3 / V1.4：notes 兼容读法。有 notes 用 notes；缺 notes 时才回退 kneeCaution。
   登山机自 V1.4 起不再标注部位（其膝部保护由 bodyStatus==='knee' 时的器械置灰承担）。 */
function exerciseNotes(ex) {
  if (!ex) return [];
  if (Array.isArray(ex.notes) && ex.notes.length) return ex.notes;
  return ex.kneeCaution ? ['knee'] : [];
}
function hasBodyNote(ex, part) { return exerciseNotes(ex).indexOf(part) !== -1; }

/* V1.4：部位标签显示字典（全用户可见） */
const PART_TAG = {
  knee: '膝', back: '腰背', shoulder: '肩', hip: '髋', core: '核心',
  wrist: '腕', ankle: '踝', neck: '颈', spine: '胸椎'
};

/* V1.4 细条边界决策：警示细条仅对高负荷部位触发（其余部位只显示标签） */
const HIGH_RISK_PARTS = ['knee', 'shoulder', 'back'];

/* V1.4：器械类型中文（列表/换动作自选区/详情行内展示用） */
const TYPE_CN = { free: '自由重量', machine: '固定器械', bodyweight: '自重', cable: '绳索', cardio: '有氧器械' };

/* V1.4：部位标签视觉识别配置（OpenAI 兼容；4 家预设 + 自定义，BYOK）
 * 豆包模型名按官方惯例给合理值；不同期/地区命名可能变化，可在设置里自定义模型名。 */
const VISION_VENDORS = [
  { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v-flash' },
  { id: 'dashscope', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-plus' },
  { id: 'doubao', name: '豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-vision-pro-32k-250115' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'custom', name: '自定义', baseUrl: '', model: '' }
];
function visionVendorById(id) {
  return VISION_VENDORS.find(v => v.id === id) || null;
}

/* V1.4：识别 prompt 文本（OpenAI 兼容 messages 的 text 部分）。从 EXERCISES 自动生成动作清单。 */
function buildVisionPromptText() {
  const lines = Object.keys(EXERCISES).map(id => {
    const ex = EXERCISES[id];
    const tag = { lower: '下肢', upper: '上肢', core: '核心', posture: '体态', cardio: '有氧' }[ex.target] || ex.target;
    return id + ': ' + ex.name + '（' + tag + '）';
  });
  return '你是一名健身器械识别助手。下面是动作库清单：\n' + lines.join('\n') +
    '\n\n请判断图中这台健身器械/正在做的动作最接近清单中的哪一项。' +
    '只返回 JSON，不要输出任何其他文字或代码块包裹，格式为：' +
    '{"matchId": "动作 id 或 null", "guide": "50-100字中文：这台器械主要练哪里、发力要点、注意"}。' +
    '如果图片里不是健身器械、或无法判断，matchId 填 null，guide 可写一句简短说明。';
}

/* V1.4：JSON 容错提取。容忍模型返回 ```json 包裹或前后多余文字，取第一个 { 到最后一个 } 之间的内容。 */
function extractVisionJson(text) {
  if (!text) return null;
  const s = String(text);
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  let obj;
  try { obj = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  if (!obj || typeof obj !== 'object') return null;
  return {
    matchId: (typeof obj.matchId === 'string' && obj.matchId) ? obj.matchId : null,
    guide: (typeof obj.guide === 'string' && obj.guide) ? obj.guide : ''
  };
}

/* V1.4：换动作「自己挑一个」候选——同 target，排除自身与当日计划已含动作 */
function sameTargetCandidates(exerciseId, takenIds) {
  const src = EXERCISES[exerciseId];
  if (!src) return [];
  return Object.values(EXERCISES).filter(ex =>
    ex.id !== exerciseId &&
    ex.target === src.target &&
    (!takenIds || takenIds.indexOf(ex.id) === -1)
  );
}

/* V1.4：加到今日训练的模板字段补齐——取该动作在模板字典中的首条默认
 * （sets/rir 按当前周档位，rest/perSide/timed 取字典默认；找不到时用保守兜底）。 */
function planDefaultsFor(exerciseId, weekIndex) {
  for (const tid of Object.keys(TEMPLATES)) {
    const tpl = TEMPLATES[tid];
    const cand = (tpl.exercises || []).find(e => e.exerciseId === exerciseId);
    if (cand) {
      const p = planFor(cand, weekIndex || 1);
      const ex = EXERCISES[exerciseId] || {};
      return {
        exerciseId, reps: cand.reps, sets: p.sets, rir: p.rir, rest: cand.rest,
        main: !!cand.main, perSide: !!cand.perSide || !!ex.perSide, timed: !!cand.timed || !!ex.timed
      };
    }
  }
  const ex = EXERCISES[exerciseId] || {};
  return {
    exerciseId, reps: [8, 12], sets: 2, rir: 3, rest: 60,
    main: false, perSide: !!ex.perSide, timed: !!ex.timed
  };
}

/* 替代动作（同模式同训练目标） */
const SUBSTITUTES = {
  goblet_box_squat: ['leg_curl', 'glute_bridge'],
  split_squat: ['leg_curl', 'glute_bridge'],
  db_rdl: ['hip_hinge', 'glute_bridge'],
  chest_press: ['incline_pushup'],
  incline_db_press: ['chest_press', 'incline_pushup'],
  seated_row: ['neutral_pulldown'],
  neutral_pulldown: ['seated_row'],
  rear_delt_fly: ['seated_row'],
  leg_curl: ['glute_bridge'],
  treadmill_walk: ['elliptical'],
  elliptical: ['treadmill_walk'],
  stair_climber: ['elliptical', 'treadmill_walk']
};

/* ============ 训练模板 ============
 * sets 数组按周阶段给出组数；reps [下限, 上限]；rir 目标；rest 秒
 */
const TEMPLATES = {
  strengthA: {
    id: 'strengthA', name: '力量A', dayLabel: '力量训练 A', estMin: '50–60 分钟', intensity: '中等',
    exercises: [
      { exerciseId: 'goblet_box_squat', reps: [8, 10], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 90, main: true },
      { exerciseId: 'db_rdl', reps: [8, 10], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 90, main: true },
      { exerciseId: 'seated_row', reps: [10, 12], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 82, main: true },
      { exerciseId: 'chest_press', reps: [8, 12], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 82, main: true },
      { exerciseId: 'glute_bridge', reps: [10, 15], sets: [2, 2, 2, 2, 2, 2, 3, 2], rir: [3, 3, 3, 3, 3, 3, 3, 3], rest: 60, main: false },
      { exerciseId: 'dead_bug', reps: [6, 10], sets: [2, 2, 2, 2, 2, 2, 3, 2], rir: [3, 3, 3, 3, 3, 3, 3, 3], rest: 52, main: false, perSide: true }
    ]
  },
  strengthB: {
    id: 'strengthB', name: '力量B', dayLabel: '力量训练 B', estMin: '50–60 分钟', intensity: '中等',
    exercises: [
      { exerciseId: 'split_squat', reps: [6, 8], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 90, main: true, perSide: true },
      { exerciseId: 'leg_curl', reps: [10, 12], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 75, main: true },
      { exerciseId: 'incline_db_press', reps: [8, 10], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 90, main: true },
      { exerciseId: 'neutral_pulldown', reps: [8, 12], sets: [2, 2, 3, 3, 3, 3, 3, 2], rir: [3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 3], rest: 82, main: true },
      { exerciseId: 'rear_delt_fly', reps: [12, 15], sets: [2, 2, 2, 2, 2, 3, 3, 2], rir: [3, 3, 3, 3, 3, 3, 3, 3], rest: 60, main: false },
      { exerciseId: 'side_plank', reps: [15, 30], sets: [2, 2, 2, 2, 2, 2, 3, 2], rir: [3, 3, 3, 3, 3, 3, 3, 3], rest: 52, main: false, perSide: true, timed: true }
    ]
  },
  tuesday: {
    id: 'tuesday', name: '椭圆仪＋体态/自重', dayLabel: '有氧＋体态', estMin: '30–40 分钟', intensity: '轻',
    cardio: { exerciseId: 'elliptical', minutes: [20, 30], intensityNote: '能说完整句子但不能唱歌' },
    exercises: [
      { exerciseId: 'incline_scap_pushup', reps: [8, 12], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 60, main: false },
      { exerciseId: 'glute_bridge', reps: [12, 12], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 60, main: false },
      { exerciseId: 'dead_bug', reps: [6, 8], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 52, main: false, perSide: true },
      { exerciseId: 'calf_raise', reps: [12, 15], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 45, main: false }
    ]
  },
  thursday: {
    id: 'thursday', name: '跑步机快走＋体态/核心', dayLabel: '有氧＋核心', estMin: '30–40 分钟', intensity: '轻',
    cardio: { exerciseId: 'treadmill_walk', minutes: [20, 30], intensityNote: '坡度 0–3%，不扶扶手；能说完整句子但不能唱歌' },
    allowRestDay: true,
    exercises: [
      { exerciseId: 'incline_pushup', reps: [8, 12], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 60, main: false },
      { exerciseId: 'side_plank', reps: [15, 30], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 52, main: false, perSide: true, timed: true },
      { exerciseId: 'hip_hinge', reps: [10, 10], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 60, main: false },
      { exerciseId: 'thoracic_rotation', reps: [6, 6], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 45, main: false, perSide: true }
    ]
  },
  posture: {
    id: 'posture', name: '体态小训练', dayLabel: '体态小训练', estMin: '8–10 分钟', intensity: '轻',
    exercises: [
      { exerciseId: 'chin_tuck', reps: [8, 8], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 30, main: false, holdSec: [3, 5] },
      { exerciseId: 'thoracic_extension', reps: [6, 8], sets: [1, 1, 1, 1, 1, 1, 1, 1], rir: [3], rest: 30, main: false },
      { exerciseId: 'incline_scap_pushup', reps: [8, 12], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 45, main: false },
      { exerciseId: 'wall_slide', reps: [8, 8], sets: [2, 2, 2, 2, 2, 2, 2, 2], rir: [3], rest: 45, main: false },
      { exerciseId: 'dead_bug', reps: [6, 6], sets: [1, 1, 1, 1, 1, 1, 1, 1], rir: [3], rest: 45, main: false, perSide: true }
    ]
  }
};

/* ============ 每周排期（V1.1：用户自定义，存 profile.schedule） ============ */
const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DOW_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const GOALS = [
  { id: 'fatLoss', label: '减脂' },
  { id: 'muscle', label: '增肌增力' },
  { id: 'posture', label: '改善体态' },
  { id: 'energy', label: '提升精力' },
  { id: 'habit', label: '恢复运动习惯' }
];

/* 按首要目标 × 每周天数生成建议排期（V1.2 SPEC A4 映射表）
   原则：天数越少力量占比越高（力量保本）；天数变化只调有氧天数；力量日不连续超 2 天 */
function suggestSchedule(goalId, days) {
  days = days || 5;
  const base = { mon: 'rest', tue: 'rest', wed: 'rest', thu: 'rest', fri: 'rest', sat: 'rest', sun: 'rest' };
  const maps = {
    fatLoss: { // 减脂：2d=1力+1有氧 3d=1力+2有氧 4d=2力+2有氧 5d=2力+3有氧
      2: { mon: 'strength', thu: 'cardio' },
      3: { mon: 'cardio', wed: 'strength', fri: 'cardio' },
      4: { mon: 'cardio', tue: 'strength', thu: 'cardio', fri: 'strength' },
      5: { mon: 'cardio', tue: 'strength', wed: 'cardio', thu: 'strength', fri: 'cardio' }
    },
    energy: { // 提升精力：同减脂
      2: { mon: 'strength', thu: 'cardio' },
      3: { mon: 'cardio', wed: 'strength', fri: 'cardio' },
      4: { mon: 'cardio', tue: 'strength', thu: 'cardio', fri: 'strength' },
      5: { mon: 'cardio', tue: 'strength', wed: 'cardio', thu: 'strength', fri: 'cardio' }
    },
    muscle: { // 增肌增力：2d=2力 3d=3力 4d=3力+1有氧 5d=4力+1有氧
      2: { mon: 'strength', thu: 'strength' },
      3: { mon: 'strength', wed: 'strength', fri: 'strength' },
      4: { mon: 'strength', tue: 'strength', wed: 'cardio', fri: 'strength' },
      5: { mon: 'strength', tue: 'strength', wed: 'cardio', thu: 'strength', fri: 'strength' }
    },
    posture: { // 改善体态：2d=2力 3d=2力+1有氧 4d=3力+1有氧 5d=3力+2有氧
      2: { mon: 'strength', thu: 'strength' },
      3: { mon: 'strength', wed: 'cardio', fri: 'strength' },
      4: { mon: 'strength', tue: 'cardio', thu: 'strength', fri: 'strength' },
      5: { mon: 'strength', tue: 'cardio', wed: 'strength', thu: 'cardio', fri: 'strength' }
    },
    habit: { // 恢复运动习惯：同改善体态
      2: { mon: 'strength', thu: 'strength' },
      3: { mon: 'strength', wed: 'cardio', fri: 'strength' },
      4: { mon: 'strength', tue: 'cardio', thu: 'strength', fri: 'strength' },
      5: { mon: 'strength', tue: 'cardio', wed: 'strength', thu: 'cardio', fri: 'strength' }
    }
  };
  const m = (maps[goalId] || maps.posture)[days] || maps.posture[5];
  return Object.assign(base, m);
}
function defaultSchedule() { return suggestSchedule('posture'); }
function trainingDayCount(schedule) { return DOW_KEYS.filter(k => schedule[k] && schedule[k] !== 'rest').length; }

/* V1.3 C1：身体情况三档（onboarding 单选 + 副标） */
const BODY_OPTIONS = [
  { id: 'none', label: '没受伤', note: '没有需要留意的旧伤或不适' },
  { id: 'knee', label: '膝部有伤', note: '膝盖有旧伤或不适，勾选后自动避开伤膝动作' },
  { id: 'other', label: '其他部位有伤', note: '肩/腰/腕等别处有不适，训练时给你相应提示' }
];

/* V1.3 C2/D1：档案字段迁移与兜底（就地修改并返回） */
function normalizeProfile(p) {
  if (!p) return p;
  if (p.bodyStatus === undefined) p.bodyStatus = p.kneeNote === 'left' ? 'knee' : (p.kneeNote || 'none');
  if (p.kneeNote !== undefined) delete p.kneeNote;
  if (p.bodyStatus !== 'knee' && p.bodyStatus !== 'other') p.bodyStatus = 'none'; // 非法值兜底
  if (p.scheduleConfirmed === undefined) p.scheduleConfirmed = true; // 旧档案不打扰
  if (!p.schedule) p.schedule = defaultSchedule();
  return p;
}
function isScheduleConfirmed(profile) { return !!(profile && profile.scheduleConfirmed !== false); }

/* V1.3 C4：膝档自动规避。返回该模板当日的动作清单；knee 且动作带 knee 标注时，
   取 SUBSTITUTES 中该模板尚未包含的首个替代动作，并打 autoSub/originalId 标记。
   加载进行中/已完成 session 时直接按存储显示，不回溯替换。 */
function resolveTemplateExercises(profile, templateId) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) return [];
  const src = tpl.exercises || [];
  if (!profile || profile.bodyStatus !== 'knee') return src;
  const taken = src.map(e => e.exerciseId);
  return src.map(pe => {
    const ex = EXERCISES[pe.exerciseId];
    if (!hasBodyNote(ex, 'knee')) return pe;
    const pick = (SUBSTITUTES[pe.exerciseId] || []).find(id => taken.indexOf(id) === -1);
    if (!pick) return pe;
    return Object.assign({}, pe, { exerciseId: pick, originalId: pe.exerciseId, autoSub: true });
  });
}

/* 日期→模板解析：力量日 A/B 按周交替，有氧日椭圆仪/跑步机内容交替 */
function resolveTemplateId(schedule, weekIndex, dow) { // dow 1=周一
  const type = schedule[DOW_KEYS[dow - 1]];
  if (!type || type === 'rest') return null;
  let pos = 0;
  for (let d = 1; d <= dow; d++) if (schedule[DOW_KEYS[d - 1]] === type) pos++;
  const oddWeek = weekIndex % 2 === 1;
  const oddPos = pos % 2 === 1;
  if (type === 'strength') return (oddWeek === oddPos) ? 'strengthA' : 'strengthB';
  return oddPos ? 'tuesday' : 'thursday'; // 有氧内容交替（椭圆仪＋体态 / 跑步机＋核心）
}
function weekPlan(profile, weekIndex) {
  const schedule = (profile && profile.schedule) || defaultSchedule();
  return DOW_KEYS.map((k, i) => ({
    dow: i + 1, type: schedule[k],
    templateId: resolveTemplateId(schedule, weekIndex, i + 1)
  }));
}

/* 训练类型识别语言（全局统一） */
const TYPE_META = {
  strength: { emoji: '💪', label: '力量', cls: 't-strength' },
  cardio: { emoji: '🚶', label: '有氧', cls: 't-cardio' },
  posture: { emoji: '🧘', label: '体态', cls: 't-posture' },
  rest: { emoji: '😴', label: '休息', cls: 't-rest' }
};
function templateType(templateId) {
  if (templateId === 'strengthA' || templateId === 'strengthB') return 'strength';
  if (templateId === 'posture') return 'posture';
  if (templateId) return 'cardio';
  return 'rest';
}

const PHASES = [
  { weeks: '第 1–2 周', name: '动作与耐受', text: '所有动作 2 组，剩余次数(RIR) 3：熟悉动作与耐受。' },
  { weeks: '第 3–4 周', name: '建立训练量', text: '前四个主要动作增至 3 组：建立训练量。' },
  { weeks: '第 5–7 周', name: '稳定进步', text: '主要动作 3 组，辅助动作 2–3 组：稳定进步。' },
  { weeks: '第 8 周', name: '恢复与复盘', text: '全部减为 2 组或降重：恢复与复盘。' }
];
function phaseName(weekIndex) {
  if (weekIndex <= 2) return PHASES[0].name;
  if (weekIndex <= 4) return PHASES[1].name;
  if (weekIndex <= 7) return PHASES[2].name;
  return PHASES[3].name;
}

/* ============ 文案常量（C11：懂你的朋友语气，集中管理） ============ */
const COPY = {
  disclaimer: '这是你的个人训练小助手，不是医疗产品。所有训练内容都是「建议」，不构成诊断或治疗方案。如果疼痛加重或出现异常，先停下来，找医生或运动医学专业人士看看。',
  localOnly: '训练记录和体态照片保存在这台设备的浏览器里，没有账户或云同步。使用 AI 器械识别时，所选照片会发送给你配置的服务商；导出的备份请自行妥善保管。',
  rirHelp: '剩余次数（RIR）= 一组做完时，你觉得自己还能规范地再做几次。比如还能再做 2 次，就是剩余次数(RIR) 2。数字越接近 0，说明这一组越接近「力竭」——不是一定要练到力竭，按计划里的目标数字来就好。',
  talkTest: '强度怎么把握？试试说话：能完整说句子、但唱不了歌，就是刚刚好的中等强度，不需要心率表。',
  redFlagTitle: '🛑 红旗症状提醒',
  redFlagText: '如果出现：膝关节卡锁、明显肿胀、无法完全伸直、反复打软腿、疼痛持续加重——先停一停，下肢不再自动加重，建议尽快就医或做运动医学评估。照顾自己最重要。',
  kneeRule: '膝部小贴士：箱式深蹲和分腿蹲以「不痛」为准，大腿平不平行地面不重要；膝盖跟着脚尖方向走；分腿蹲可以单手扶东西。',
  suggestTag: '建议',
  photoReminder: '照片有阵子没备份啦，去「设置」导出个 ZIP 存好吧。',
  weekendNote: '好好休息也是训练的一部分，健身房外的活动咱们不记录。',
  adviceIsSuggestion: '以下都是建议，不是诊断，你说了算。',
  /* V1.3 文案 */
  onbDaysHint: '只选每周练几天即可，课表会按你的目标自动排好。',
  onbBodyTitle: '有没有需要特别照顾的身体部位？',
  startDateNote: '我们已按你的目标生成初始课表，稍后可在「计划」页调整。',
  schedConfirmTitle: '我们按你的目标生成了初始排期',
  schedConfirmIntro: '每天可点选：力量 / 有氧 / 休息；也可以保留自动生成的样子。',
  schedConfirmBtn: '确认排期',
  laterBtn: '稍后再说',
  machineKneeHint: '膝部有伤：登山机暂不建议，改选椭圆仪、跑步机等低冲击项目。',
  customKneeHint: '膝部有伤：户外、球类等冲击较大的有氧请量力而行。',
  autoSubBadge: '已自动替换',
  bodyTips: {
    knee: '此动作对膝部负荷较高，如膝部不适请谨慎，训练中可点「换动作」换别的。',
    shoulder: '此动作对肩部要求较高，肩部有旧伤请谨慎，训练中可点「换动作」换别的。',
    back: '此动作对腰背要求较高，腰背不适请保持脊柱中立、痛就停。'
  },
  graduationTitle: '🎓 恭喜毕业！',
  graduationText: '8 周计划全部完成，这段坚持真的太棒了！想再来的话，去「设置」重新开始新周期就好。',
  celebration: '今天也辛苦了，干得漂亮！',
  shareHint: '长按图片保存，或点下方按钮下载',
  shareFooter: '个人健身训练工作台',
  emptySessions: '还没有训练记录，从今天开始第一节吧。',
  /* 建议卡（结论 + 一句原因） */
  advice: {
    plan: { title: '状态在线，按计划来！', detail: '睡眠和精力都不错，正常执行就好。' },
    sleep: { title: '昨晚没睡好吧', detail: '睡了不到 6 小时，建议主要动作保持重量、少做 1 组，别硬撑。' },
    energy: { title: '今天有点累呀', detail: '咱们轻松点，25 分钟精简模式搞定，动了就是赢。' },
    sore: { title: '浑身酸痛对吧', detail: '今天不加重，辅助动作可以少做一点，恢复优先。' },
    knee: { title: '膝部有点闹脾气', detail: '疼痛到 3 分以上啦，下肢今天不加重，换无痛动作或缩小幅度，上肢照常练。' }
  },
  /* 下周建议 */
  nextWeek: {
    redFlag: '出现红旗症状：下肢先不加重，建议找医生或运动医学专业人士看看。',
    kneeHigh: '膝部还在闹意见：下肢保持重量，必要时换动作或缩小幅度。',
    manySkipped: '这周跳过有点多：状态差的日子试试 25 分钟精简模式，比全跳过好。',
    lowSleep: '睡眠有点欠账：先把觉补回来，训练以完成量为主、暂不加重。',
    canProgress: n => '有 ' + n + ' 个动作可以进阶啦：下周试着加点重量或次数。',
    allGood: '一切顺利，按计划进入下一周就好。'
  },
  /* V1.4 文案（换动作 / 加到今天 / 拍器械识别） */
  swapIntro: '仅本次训练生效，不改变未来计划',
  swapRecTitle: '推荐替代',
  swapPickTitle: '自己挑一个（同部位）',
  swapPickEmpty: '同部位暂无其他动作可选',
  addTodayBtn: '加到今天的训练',
  addTodayNone: '今天还没开始训练，开始后可加入',
  addTodayDone: '已加入今日训练，去「今天」页继续',
  visionBtn: '📷 拍器械识别',
  visionLoading: '识别中… 约需几秒',
  visionIntro: '拍一张器械照片，AI 帮你认出最接近哪个动作，并附发力要点。需要自带 API Key（BYOK），在下方配置好后即可使用。',
  visionNoKeyTitle: '先配置 AI 识别',
  visionNoKeyText: '还没配 API Key。去「设置」里选厂商、填上你自己的 Key 就能用了。',
  visionSetupBtn: '去设置页配置',
  visionManualFallback: '也可以不用 AI：直接在动作库里找到你的器械看详情',
  visionPrivacy: '照片识别时，图片会发送给你所选的服务商；Key 只存这台设备。',
  visionDisclaimer: '仅供参考——识别结果可能并非该器械的精准用法',
  visionHitTip: '为你找到了最接近的动作：',
  visionNoMatch: '没认出这台器械。下面是 AI 的原话，仅供参考：',
  visionGoLibrary: '去动作库手动找找',
  visionErrAuth: '识别失败：API Key 无效或没权限（401/403），去设置检查一下 Key，或稍后再试。',
  visionErrRate: '识别失败：调用太频繁或额度用尽（429），歇一会儿再试。',
  visionErrServer: '识别失败：服务商那边出错了（5xx），稍后再试。',
  visionErrTimeout: '识别超时了，网络不太稳，稍后再试。',
  visionErrNet: '识别失败：网络异常，检查一下网络再试。',
  visionErrGeneric: '识别失败：出了点小状况，稍后再试。',
  visionModelNote: '想换模型名可点开自定义（不同版本的模型命名会有差异）。'
};

/* ============ 分享卡鼓励语料（D12：4 桶，桶内随机） ============ */
const ENCOURAGE = {
  full: [ // 全勤 5/5
    '五天全勤！你对自己的承诺，一分都没打折。',
    '这一周满分收官，稳稳的你最了不起。',
    '全勤周达成！把「坚持」两个字活成了日常。',
    '一次不落，这份自律值得给自己鼓个掌。',
    '完美的一周，身体会记住你的每一份认真。'
  ],
  most: [ // 多数完成 3–4
    '大多数时候都在场，这就是进步的样子。',
    '这周练得扎实，漏掉的那次就当给身体放个假。',
    '三四次训练落袋为安，节奏越来越稳了。',
    '不错的完成度！你看，习惯正在长出来。',
    '忙碌里还保住了训练，你已经赢过昨天的自己。'
  ],
  few: [ // 少量 1–2
    '哪怕只来了一两次，也比停在原地强。',
    '这周有点难对吧？没关系，动过的那次算数。',
    '次数不多，但你没有放弃，这就够了。',
    '忙乱的一周里还想着训练，已经很棒。',
    '一点点也算数，下周咱们慢慢来。'
  ],
  back: [ // 断周回归（上周 0 本周有）
    '欢迎回来！重新站上垫子的这一刻最难得。',
    '休息够了再出发，回来就是胜利。',
    '断了一周又怎样？你回来了，这就值得庆祝。',
    '重新开始从来都不丢人，反而很勇敢。',
    '好久不见！这一次，咱们稳稳地走。'
  ]
};
function pickEncouragement(done, planned, lastWeekDone, rand) {
  let bucket;
  if (done >= planned && planned > 0) bucket = 'full';
  else if (lastWeekDone === 0 && done > 0) bucket = 'back';
  else if (done >= 3) bucket = 'most';
  else bucket = 'few';
  const arr = ENCOURAGE[bucket];
  const r = (typeof rand === 'function') ? rand() : Math.random();
  return { bucket, text: arr[Math.min(arr.length - 1, Math.floor(r * arr.length))] };
}

/* RIR 选项 */
const RIR_OPTIONS = ['0', '1', '2', '3', '4', '5+'];

/* 有氧器械（仅健身房内三项） */
const CARDIO_MACHINES = ['treadmill_walk', 'elliptical', 'stair_climber'];

/* V1.5 ③：分享卡品牌署名模板（{name} 替换为客户名；客户名留空时回退默认 COPY.shareFooter） */
const BRAND_TEMPLATES = [
  { id: 'butler', text: '{name}的健身管家' },
  { id: 'coach', text: '{name}的私人助教' },
  { id: 'buddy', text: '{name}的陪练搭子' }
];

/* V1.5 ⑤：客户自定义有氧四固定预设（不可自由命名；激活存 settings.customCardio id 数组） */
const CUSTOM_CARDIO_PRESETS = [
  { id: 'outdoor', name: '户外' },
  { id: 'swim', name: '游泳' },
  { id: 'cycle', name: '骑行' },
  { id: 'ball', name: '球类' }
];

/* 红旗症状选项 */
const RED_FLAG_ITEMS = ['卡锁', '明显肿胀', '无法完全伸直', '反复打软腿', '持续加重'];

/* 工具：取某周某模板条目的组数与目标 RIR */
function planFor(templateEntry, weekIndex) {
  const w = Math.min(Math.max(weekIndex, 1), 8);
  const sets = Array.isArray(templateEntry.sets) ? templateEntry.sets[w - 1] : templateEntry.sets;
  const rirArr = templateEntry.rir;
  const rir = rirArr.length >= 8 ? rirArr[w - 1] : rirArr[0];
  return { sets, rir };
}
