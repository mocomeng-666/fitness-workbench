# 复现 Prompt：个人健身训练工作台（PWA）

> 公开文字版说明：动作详情以文字要领为准；身高由用户填写；不预设个人训练时段。历史版本记录仅供参考，当前行为以源码和 README 为准。核心训练功能离线可用，AI 识别需要联网。
> 使用方法：把「从 👇 开始复制，到 👇 结束复制」之间的全部内容，一次性粘贴给任何通用 AI 助手（ChatGPT / Claude / 通义 / 豆包等），它会按规格分步实施、每步先给方案再写代码。规格内所有字段、色值、坐标均为最终定稿值，无需再问。

👇 开始复制

---

## 一、角色与总体要求

你是一名资深前端工程师。请严格依据本规格，从零复现一个中文「个人健身训练工作台」PWA 应用。

**实施纪律（重要）**：
1. 先通读本规格，输出你的实施方案（拆成哪几步、每步交付什么、如何自测），等确认后再动手。
2. 每完成一个里程碑，给出一段可在浏览器打开的可运行预览说明；不要一次性把所有代码堆完。
3. 全程原生 HTML/CSS/JS（ES 规范、无 TypeScript 编译步骤），**零框架、零构建依赖、无后端、无账户、无登录、无云同步、无任何第三方库**（唯一例外：可选的「拍照识别器械」功能需直连用户自备的视觉模型 API，见规格九）。
4. 规格未写明的视觉或交互细节，采用与整体风格一致的克制默认；规格写明的，不得自由发挥改动。

## 二、产品一句话定位

一个 **8 周个人力量 + 有氧训练执行与记录工具**：首次配置后自动生成每周课表，训练前根据状态给出「教练式建议卡」，逐组记录重量/次数/剩余次数，按规则自动给出下次加重/减量建议，每周自动出周报并生成可保存的分享卡。训练数据保存在本机浏览器；可选 AI 识别会将所选照片发送给用户配置的服务商。

## 三、硬边界（不做清单）

- 单用户、无账户、无登录、无云同步、无服务器；数据只在 IndexedDB。
- **不做**：健身房外活动记录、饮食记录、心率/穿戴设备、社交、医疗诊断、BMI 驱动的减脂建议、热量估算激励。
- 所有建议 UI 上标注为「建议」而非诊断；文案用「改善控制/改善体态」，禁止治疗性表述。
- 重量单位 kg（允许 1 位小数）；加重梯度全局固定 2.5kg。
- 目标视口：360px 宽可完整操作；桌面端居中限宽容器（App 列 max-width ≈480px）。

## 四、技术架构与文件结构

```
项目根/
  index.html            应用外壳（6 个 page 容器 + 底部导航 + 弹层根）
  styles.css            全部样式，CSS 变量定义配色（见规格十）
  data.js               动作库 / 8 周模板 / 每周排期建议 / 文案常量（代码内配置，不入库）
  db.js                 IndexedDB Promise 封装 + JSON 备份 + 照片 ZIP 导出
  engine.js             规则引擎：双重进阶、当日建议卡、膝/红旗、周报计算
  app.js                启动 + 路由 + 6 页面渲染 + 事件
  sw.js                 Service Worker（Cache First，离线可用）
  manifest.webmanifest  PWA 清单
  build.py              构建脚本：把 styles.css 与 data.js/db.js/engine.js/app.js 按序内联进 dist/index.html；dist/ 另含 sw.js、manifest.webmanifest（见规格十一）
```

**IndexedDB**：库名 `fitness-workbench`，版本 1；object stores：`profile`(无 keyPath，固定键 `'me'`)、`sessions`(keyPath `id`)、`measurements`(keyPath `id`)、`photos`(keyPath `id`)、`settings`(固定键 `'app'`)。启动时自动建库补表。

**页面结构（index.html）**：`#app-header`（`#page-title`）+ `#main` 内 6 个 `<section class="page">`（`page-today/page-plan/page-progress/page-library/page-settings/page-onboarding`，除当前外都加 `hidden`）+ 底部 `#tabbar` 五个 Tab：🏋️今天 / 🗓️计划（含红点 `i.tab-dot`）/ 📈进展 / 📖动作库 / ⚙️设置。另有全屏庆祝浮层 `#celebrate-overlay`、弹层根 `#modal-root`、休息倒计时浮层 `#timer-overlay`。无 profile 时隐藏 tabbar 并进入 onboarding 页；有 profile 时进入 today。

## 五、数据模型（字段级定稿）

**profile**（键 `me`）：`birthYear`(4位数字,1940–2015)、`sex`('female'|'male'|'other')、`heightCm`、`primaryGoal`('fatLoss'|'muscle'|'posture'|'energy'|'habit')、`experience`('experienced'|'restart')、`bodyStatus`('none'|'knee'|'other')、`schedule`(7 天对象，键 mon~sun，值 'strength'|'cardio'|'rest')、`scheduleConfirmed`(bool)、`chosenStartDate`('YYYY-MM-DD'，必须为周一)、`createdAt`、`updatedAt`。

**sessions**（每次训练一条）：`id`(uuid)、`date`('YYYY-MM-DD')、`templateId`('strengthA'|'strengthB'|'tuesday'|'thursday'|'posture')、`weekIndex`(1-8)、`dayType`、`mode`('standard'|'short')、`status`('未开始'|'进行中'|'已完成'|'部分完成'|'已跳过')、`readiness`(练前状态：`sleepHours`/`energy1to5`/`fatigue1to5`/`kneePain0to10`/`sore`/`note`)、`exercises`(数组：`{exerciseId, originalId?, autoSub?, substituted?, substitutedTo?, sets:[{setIndex, plannedReps, weightKg, reps, rir, painNote}], redFlags?}`)、`cardio?`(有氧日：`{machine, minutes, rpe, speed?, level?}`，machine 可为自定义预设 id)、`postFeedback`(`{difficulty1to5, kneeChange, completed, redFlags[]?}`)、`createdAt`、`updatedAt`。

**measurements**：`{id, date, weightKg, waistCm?, hipCm?, thighCm?}`。

**photos**：`{id, date, view('front'|'side'|'back'), blob, createdAt}`（仅存 IndexedDB，不进 JSON 备份）。

**settings**（键 `app`）默认值全量：`{restTimerDefault: 90, weightIncrement: 2.5, lastPhotoExportAt: null, lastBackupAt: null, schemaVersion: '1.0', ignoredAdvice: [], vision: null, shareBrandName: '', shareBrandTemplate: 0, theme: 'cream', customCardio: [], mainCardio: null, rirHelpDate: null}`。读取时对旧数据逐字段兜底（缺失即补默认），保存时才写回。

**旧档案迁移（normalizeProfile）**：`bodyStatus` 缺失时按旧 `kneeNote==='left'` → 'knee'，否则 'none'，并删除 kneeNote；`bodyStatus` 非三值归 'none'；`scheduleConfirmed` 缺失 → true（旧用户不打扰）；`schedule` 缺失 → 默认课表。boot 时检测需迁移则保存一次。

**JSON 备份**：导出含 `{schemaVersion, exportedAt, sourceDevice, profile, sessions, measurements, weeklyReviews}`（不含 photos）。导入需校验 schemaVersion 与结构；**冲突不合并，导入即覆盖**（导入前 confirm）。

**照片 ZIP 导出**：手写 STORED 无压缩 ZIP（含 CRC32 表），文件名 `日期_视角_id前8位.png/jpg`，导出成功记 `lastPhotoExportAt`。提供浏览器下载（Blob + a[download]）。

## 六、内容配置（data.js，必须忠实）

### 6.1 动作库 EXERCISES（23 条，含 V1.4 部位标签全量）
每个动作字段：`id/name/en/type/target/bodyweight`；`type`：free自由重量/machine固定器械/bodyweight自重/cable绳索/cardio有氧器械；`target`：lower/upper/core/posture/cardio；另有 `perSide`(单侧计数)、`timed`(按秒计时)、`notes`(部位标签数组，见下表右列；有氧三项无 notes)。`kneeCaution` 字段在 V1.4 起废弃，兼容读法：有 notes 用 notes，否则回退 kneeCaution→['knee']。

| id | 中文名 | type | target | notes |
|---|---|---|---|---|
| goblet_box_squat | 哑铃高脚杯箱式深蹲 | free | lower | 膝 |
| db_rdl | 哑铃罗马尼亚硬拉 | free | lower | 腰背 |
| seated_row | 坐姿划船机 | machine | upper | 腰背 |
| chest_press | 坐姿推胸机 | machine | upper | 肩 |
| glute_bridge | 自重臀桥 | bodyweight | lower | 髋 |
| dead_bug | 死虫 | bodyweight | core | 核心（perSide） |
| split_squat | 有支撑分腿蹲 | bodyweight | lower | 膝·髋（perSide） |
| leg_curl | 坐姿腿弯举 | machine | lower | 膝 |
| incline_db_press | 上斜哑铃卧推 | free | upper | 肩·腕 |
| neutral_pulldown | 中立握高位下拉 | machine | upper | 肩 |
| rear_delt_fly | 绳索后束划船/反向飞鸟 | cable | upper | 肩 |
| side_plank | 侧桥 | bodyweight | core | 核心（perSide, timed） |
| incline_scap_pushup | 上斜肩胛俯卧撑 | bodyweight | posture | 肩 |
| incline_pushup | 上斜俯卧撑 | bodyweight | upper | 肩·腕 |
| calf_raise | 自重提踵 | bodyweight | lower | 踝 |
| hip_hinge | 徒手髋铰链 | bodyweight | posture | 髋·腰背 |
| thoracic_rotation | 胸椎旋转 | bodyweight | posture | 胸椎（perSide） |
| thoracic_extension | 胸椎伸展 | bodyweight | posture | 胸椎 |
| wall_slide | 靠墙滑手 | bodyweight | posture | 肩 |
| chin_tuck | 仰卧/靠墙下巴回收 | bodyweight | posture | 颈 |
| treadmill_walk | 跑步机快走 | cardio | cardio | — |
| elliptical | 椭圆仪 | cardio | cardio | — |
| stair_climber | 登山机 | cardio | cardio | — |

每个非有氧动作需配 3–4 条中文「要领 cues」与 3 条「常见错误 mistakes」（克制、口语、可执行，例如高脚杯深蹲要领含「以无痛幅度为准，大腿平行地面不是成功条件」）；有氧动作要领含「强度：能说完整句子但不能唱歌」。

**部位标签字典 PART_TAG**：knee膝 / back腰背 / shoulder肩 / hip髋 / core核心 / wrist腕 / ankle踝 / neck颈 / spine胸椎。**警示细条仅对 HIGH_RISK_PARTS=['knee','shoulder','back'] 触发**（防噪音），其余部位只显示标签。TYPE_CN：free自由重量/machine固定器械/bodyweight自重/cable绳索/cardio有氧器械。

### 6.2 训练模板 TEMPLATES 与 8 周阶段
每个模板条目标记 main(true/false)，`sets` 为 8 元素数组按周取值，`rir` 同理（长度 1 则全周相同）。

**力量A strengthA**（力量训练 A，50–60 分钟，中等）：
| exerciseId | reps | sets[8周] | rir[8周] | rest | main |
|---|---|---|---|---|---|
| goblet_box_squat | 8–10 | 2,2,3,3,3,3,3,2 | 3,3,2.5,2.5,2.5,2.5,2.5,3 | 90s | ✓ |
| db_rdl | 8–10 | 同上 | 同上 | 90s | ✓ |
| seated_row | 10–12 | 同上 | 同上 | 82s | ✓ |
| chest_press | 8–12 | 同上 | 同上 | 82s | ✓ |
| glute_bridge | 10–15 | 2,2,2,2,2,2,3,2 | 3×8 | 60s | ✗ |
| dead_bug | 每侧6–10 | 2,2,2,2,2,2,3,2 | 3×8 | 52s | ✗ perSide |

**力量B strengthB**（力量训练 B，50–60 分钟，中等）：
| exerciseId | reps | sets[8周] | rir[8周] | rest | main |
|---|---|---|---|---|---|
| split_squat | 每侧6–8 | 2,2,3,3,3,3,3,2 | 3,3,2.5,2.5,2.5,2.5,2.5,3 | 90s | ✓ perSide |
| leg_curl | 10–12 | 同上 | 同上 | 75s | ✓ |
| incline_db_press | 8–10 | 同上 | 同上 | 90s | ✓ |
| neutral_pulldown | 8–12 | 同上 | 同上 | 82s | ✓ |
| rear_delt_fly | 12–15 | 2,2,2,2,2,3,3,2 | 3×8 | 60s | ✗ |
| side_plank | 每侧15–30秒 | 2,2,2,2,2,2,3,2 | 3×8 | 52s | ✗ perSide timed |

**周二 tuesday**（椭圆仪＋体态/自重，30–40 分钟，轻）：cardio `{exerciseId:'elliptical', minutes:[20,30], intensityNote:'能说完整句子但不能唱歌'}`；随后体态/自重 4 项各 2 组（rir 全 3）：incline_scap_pushup 8–12/60s、glute_bridge 12/60s、dead_bug 每侧6–8/52s perSide、calf_raise 12–15/45s。

**周四 thursday**（跑步机快走＋体态/核心，30–40 分钟，轻）：cardio `{exerciseId:'treadmill_walk', minutes:[20,30], intensityNote:'坡度 0–3%，不扶扶手；能说完整句子但不能唱歌'}`；`allowRestDay: true`；随后 4 项各 2 组：incline_pushup 8–12/60s、side_plank 每侧15–30秒/52s perSide timed、hip_hinge 10/60s、thoracic_rotation 每侧6/45s perSide。

**体态小训练 posture**（8–10 分钟，轻，周二/周四内含也可单独入口）：chin_tuck 2×8 holdSec[3,5] rest30、thoracic_extension 1×6–8 rest30、incline_scap_pushup 2×8–12 rest45、wall_slide 2×8 rest45、dead_bug 每侧 1×6 rest45 perSide。

**8 周阶段 PHASES**：第1–2周「动作与耐受」所有动作 2 组，剩余次数(RIR) 3；第3–4周「建立训练量」前四个主要动作 3 组；第5–7周「稳定进步」主要动作 3 组、辅助 2–3 组；第8周「恢复与复盘」全部减为 2 组或降重。

### 6.3 周排期解析（核心逻辑，勿破坏）
- 用户自选每周 N 天（2/3/4/5）+ 目标 → `suggestSchedule(goalId, days)` 生成 schedule。映射（原则：天数越少力量占比越高；力量日不连续超 2 天）：
  - 减脂/提升精力：2d=一(力)四(有氧)；3d=一/三/五=有氧·力·有氧；4d=一有氧/二力/四有氧/五力；5d=一有氧/二力/三有氧/四力/五有氧
  - 增肌增力：2d=一力四力；3d=一三五力；4d=一力二力三有氧五力；5d=一力二力三有氧四力五力
  - 改善体态/恢复运动习惯：2d=一力四力；3d=一力三有氧五力；4d=一力二有氧四力五力；5d=一力二有氧三力四有氧五力
- **模板解析 resolveTemplateId(schedule, weekIndex, dow)**：strength 型力量日按 `(奇周 == 奇数序) ? strengthA : strengthB` 隔周 A/B 交替；cardio 有氧日按该 type 出现序奇偶 → tuesday(椭圆仪+体态)/thursday(跑步机+核心) 交替。dow 1=周一。
- 周完成率/周报/分享卡分母 = schedule 中非 rest 的天数（动态跟随，不写死 5）。

### 6.4 替代动作 SUBSTITUTES（同模式同目标）
goblet_box_squat→[leg_curl, glute_bridge]；split_squat→[leg_curl, glute_bridge]；db_rdl→[hip_hinge, glute_bridge]；chest_press→[incline_pushup]；incline_db_press→[chest_press, incline_pushup]；seated_row→[neutral_pulldown]；neutral_pulldown→[seated_row]；rear_delt_fly→[seated_row]；leg_curl→[glute_bridge]；treadmill_walk→[elliptical]；elliptical→[treadmill_walk]；stair_climber→[elliptical, treadmill_walk]。

### 6.5 身体情况与文案常量要点（COPY）
- 三档 BODY_OPTIONS：没受伤（没有需要留意的旧伤或不适）/ 膝部有伤（膝盖有旧伤或不适，勾选后自动避开伤膝动作）/ 其他部位有伤（肩/腰/腕等别处有不适，训练时给你相应提示）。
- 目标 GOALS 5 项：减脂 / 增肌增力 / 改善体态 / 提升精力 / 恢复运动习惯。
- RIR 枚举 RIR_OPTIONS：`['0','1','2','3','4','5+']`。
- 红旗症状 RED_FLAG_ITEMS：卡锁 / 明显肿胀 / 无法完全伸直 / 反复打软腿 / 持续加重。
- 必备文案（统一放 COPY 常量，语气是「懂你的朋友」，以下为最终定稿）：
  - 免责声明：`这是你的个人训练小助手，不是医疗产品。所有训练内容都是「建议」，不构成诊断或治疗方案。如果疼痛加重或出现异常，先停下来，找医生或运动医学专业人士看看。`
  - 本地说明：`训练记录和体态照片保存在这台设备的浏览器里，没有账户或云同步。使用 AI 器械识别时，所选照片会发送给你配置的服务商；导出的备份请自行妥善保管。`
  - RIR 帮助（弹窗用）：`剩余次数（RIR）= 一组做完时，你觉得自己还能规范地再做几次。比如还能再做 2 次，就是剩余次数(RIR) 2。数字越接近 0，说明这一组越接近「力竭」——不是一定要练到力竭，按计划里的目标数字来就好。`
  - 说话测试：`强度怎么把握？试试说话：能完整说句子、但唱不了歌，就是刚刚好的中等强度，不需要心率表。`
  - 红旗：`如果出现：膝关节卡锁、明显肿胀、无法完全伸直、反复打软腿、疼痛持续加重——先停一停，下肢不再自动加重，建议尽快就医或做运动医学评估。照顾自己最重要。`
  - 膝贴士：`箱式深蹲和分腿蹲以「不痛」为准，大腿平不平行地面不重要；膝盖跟着脚尖方向走；分腿蹲可以单手扶东西。`
  - 部位细条 bodyTips：knee`此动作对膝部负荷较高，如膝部不适请谨慎，训练中可点「换动作」换别的。`；shoulder/back 同理措辞（肩部要求较高/腰背保持脊柱中立、痛就停）。
  - 建议卡 advice（标题+一句原因）：plan`状态在线，按计划来！`/`睡眠和精力都不错，正常执行就好。`；sleep`昨晚没睡好吧`/`睡了不到 6 小时，建议主要动作保持重量、少做 1 组，别硬撑。`；energy`今天有点累呀`/`咱们轻松点，25 分钟精简模式搞定，动了就是赢。`；sore`浑身酸痛对吧`/`今天不加重，辅助动作可以少做一点，恢复优先。`；knee`膝部有点闹脾气`/`疼痛到 3 分以上啦，下肢今天不加重，换无痛动作或缩小幅度，上肢照常练。`
  - 换动作弹层：`仅本次训练生效，不改变未来计划`；推荐替代/自己挑一个（同部位）/同部位暂无其他动作可选。
  - 加动作：`加到今天的训练`（今天休息日或无训练则显示 `今天还没开始训练，开始后可加入`）。
  - 照片提醒：`照片有阵子没备份啦，去「设置」导出个 ZIP 存好吧。`
  - 毕业：`8 周计划全部完成，这段坚持真的太棒了！想再来的话，去「设置」重新开始新周期就好。`（配 🎓 恭喜毕业！）
  - 其余对话感小文案可自拟，风格保持一致（如休息日提示、完成动效等）。
- 分享卡鼓励语料：4 桶手写中文短句（每桶 5 句，桶内随机）——full 全勤（如「五天全勤！你对自己打的承诺，一分都没打折。」）、most 完成 3–4 天（「大多数时候都在场，这就是进步的样子。」）、few 完成 1–2 天（「次数不多，但你没有放弃，这就够了。」）、back 断周回归（「欢迎回来！重新站上垫子的这一刻最难得。」）。选桶规则：done≥planned → full；上周 0 且本周>0 → back；done≥3 → most；否则 few。

## 七、规则引擎（engine.js）

**当日建议卡 readinessAdvice(readiness, template)**：kneePain0to10≥3 → knee 卡；睡眠<6 且力量日 → sleep 卡(减组)；精力≤2 或疲劳≥4 → energy 卡(精简模式)；sore → sore 卡(不加重缩辅助)；全无 → plan 卡(按计划)。接受建议后应用到本次计划：reduceSet → 主要动作且组数>1 则减 1 组；shortMode → 每组≤2 组（约 25 分钟）；sore → 非主要动作组数>1 减 1 组。卡片可「接受」或「忽略」（忽略记入 settings.ignoredAdvice）。

**双重进阶 progressionAdvice(exerciseId, repRange, history)**：取该动作最近两次完成记录，连续两次**全部达到次数上限**且平均 RIR≥2 → 建议 +2.5kg（自重动作需 RIR≥3 才建议加次数/时长）；已达上限但 RIR≈0 → 保持等回升；有任意一组低于下限 → 建议减 2.5kg 或减组或替换；RIR 归一化 '5+'→5。**每次只改一个变量**。膝部安全由 session 层 kneeLocked 控制。

**膝/红旗**：练后反馈或动作异常记录含任意红旗 → `recentRedFlag` 28 天内锁定下肢动作自动进阶；红旗出现时醒目提示 + 周报下周建议提示就医。knee 档用户下肢不自动进阶。

**周报 computeWeeklyReview(sessions, weekStartDate)** 输出：`{planVsActual(completed/partial/skipped/planned), performances(每动作最近一次 maxW/totalReps/sets + 与本周首次的 dW/dReps), progressions(加重进阶/减量/保持三类 + 触发原因文案), cardio(totalMin + machines 分器械分钟), knee(points 疼痛序列 + redFlag), recovery(sleepAvg/energyAvg + 观察描述, 不推断因果), nextWeek(最多 3 条：红旗→就医 / 膝痛高→保持 / 跳过≥2→精简模式 / 睡眠<6.5→补觉 / 可进阶 N 个→加重 / 全好→照常)}`。

## 八、页面规格（app.js）

**启动 boot()**：支持 `?reset=1` 测试参数（清空 IndexedDB 全部数据并回 onboarding，随后 replaceState 去参）；读取 settings 应用已存皮肤 `document.body.dataset.theme`；读 profile，旧档走迁移；注册 sw.js；无 profile → onboarding，有 profile → 每日首次弹 RIR 帮助（当天弹过不弹，记 `rirHelpDate` 为当天日期，**跨天重置**），进入 today。

**首次配置 onboarding**（无档案时，全屏无 tabbar）：
1. 欢迎卡：免责声明 + 本地数据说明。
2. 基本档案：身高 cm（number，不预填）、出生年份（inputmode=numeric 纯数字、4 位校验 1940–2015、无步进箭头）、性别（女/男/其他）、当前体重 kg。
3. 首要目标 5 选 1（默认「改善体态」）。
4. 每周计划练几天（2/3/4/5 单选，默认 5）+ 小字「只选每周练几天即可，课表会按你的目标自动排好。」
5. 训练基础 2 选 1（有训练经验 / 久不训练，重新开始，默认后者）。
6. 身体情况三档（默认没受伤），选项副标小字见 6.5。
7. 开始日期：选第 1 周周一的日期（默认下周一），下方固定小字「我们已按你的目标生成初始课表，稍后可在「计划」页调整。」
8. 初始围度（可选）：腰围/臀围/大腿围；小字「初始体态照片可稍后在「进展」页添加。」
9. 提交按钮「开始我的 8 周计划」+ 小字「无需注册，也不要求起始重量（首次训练用剩余次数(RIR)校准）。」
校验失败用 alert 提示具体原因。保存后写 profile + 当天 measurements(体重)，scheduleConfirmed=false（新档案待计划页确认），静默 `schedule = suggestSchedule(goal, days)`。

**今天页 today**：
- 顶部：日期 + 周次徽章（如 第 N 周 / 共 8 周 · 阶段名）；每 4 周照片导出轻提醒条。
- 训练卡（当周当天模板）：类型 emoji + 名称 + 预计用时 + 「开始训练」主按钮（两次点击内可达，符合 AC-02）。
- 点开始 → 练前状态提交（睡眠小时可小数 / 精力1-5 / 疲劳1-5 / 膝痛0-10 / 明显酸痛开关）→ 显示建议卡（见规格七）→ 进入执行页。
- 已有今日 session 未完成时显示「继续训练」。已完成则显示完成摘要 + 上次表现。
- 休息日显示休息卡（emoji 😴 + 「好好休息也是训练的一部分，健身房外的活动咱们不记录。」）。

**执行页（今日/进行中）**：
- 每个动作一张卡：序号 + 名称 + 类型徽章（💪力量/🚶有氧/🧘体态/自重等）+ 部位标签小字（PART_TAG）+ 计划「组数×次数 · 目标剩余次数(RIR) X · 休息 Ys」。
- `bodyStatus !== 'none'` 且动作 notes 含 knee/shoulder/back → 动作名下浅色可关闭细条（文案见 6.5），关闭状态记 session（本次不再显示）。动作库详情同规则。
- 逐组记录行：重量 kg、实际次数、剩余次数(RIR) 下拉(0-5+)、疼痛备注；「新增组默认复制上一组」；每保存一组可启休息倒计时（默认该动作休息秒数，结束震动 `navigator.vibrate`）。
- 动作卡右上/按钮「换动作」：弹层上区「推荐替代」（SUBSTITUTES 原逻辑，排除当日已含）；下区「自己挑一个（同部位）」= 同 target 全库挑选器，排除自身与当日已含动作，行内显示部位标签+器械类型。**手动替换仅本次 session 生效**（不写模板、无记忆开关），记录 substituted/substitutedTo。knee 档自动规避的动作显示「已自动替换」徽章，仍可手动换回。
- 有氧卡：器械下拉 = optgroup「健身房器械」内置跑步机快走/椭圆仪/登山机（knee 档登山机 disabled + 提示「膝部有伤：登山机暂不建议，改选椭圆仪、跑步机等低冲击项目。」）+ optgroup「我的有氧」已激活预设（户外/游泳/骑行/球类，未激活不出现）；有 `mainCardio` 时默认选它，否则默认内置默认项。选中**内置器械**显示 4 字段：持续时间*、主观强度1-10*、速度(选填)、坡度/阻力(选填)；选中**自定义预设**只显示 持续时间* + 主观强度*（隐藏速度/坡度区），并（knee 档）轻提示「膝部有伤：户外、球类等冲击较大的有氧请量力而行。」（不拦截）。保存成功提示。
- 练后反馈：整体难度 1-5、膝部变化（可含红旗勾选）、完成状态（已完成/部分完成/已跳过）→ 保存；生成本次摘要 + 下次建议；力量动作按双重进阶生成下次建议展示。第 8 周毕业时展示毕业文案（🎓），完成动效（✅ 庆祝浮层 + 震动）。

**计划页 plan**：
- 8 周进度条 + 当前周徽章；卡片式周视图：7 天圆角色块（类型色+emoji+一句话），今天放大高亮，已完成盖 ✅，休息日灰显；上下滑切周（也可左右箭头）。
- `scheduleConfirmed===false` 时进入本页先弹全屏「排期确认视图」：标题「我们按你的计划生成了初始排期」+「每天可点选：力量 / 有氧 / 休息」+ 7 天三态编辑器 + 训练日计数；主按钮「确认排期」（校验恰好 N 天 → scheduleConfirmed=true → 正常计划页），右上「稍后再说」（不置位）；确认前计划 Tab 红点常亮。
- 下方力量A/B 动作表（含部位标签）、阶段说明、体态小训练折叠。
- 「调整每周排期」编辑入口：可改每周 2-5 天（切天数按目标重生成，覆盖自定义需 confirm）；改天数保存视为已确认。

**进展页 progress**：
- 周报 7 项：计划 vs 实际（完成/部分/跳过/分母动态）、力量进步亮点（⭐ 力量进步 + 条目）、动作加重/保持/减量列表+原因、有氧总分钟与器械分布、膝痛趋势与红旗、睡眠/精力观察描述（不推断因果）、下周建议（≤3 条）。
- 本周完成训练 N/M + 🔥 连续完成 N 天；「生成分享卡」按钮（Canvas，见规格十二）。
- 趋势：训练次数、完成率、各主力量动作重量曲线（内联 SVG 折线即可）、体重曲线（周均值）。
- 身体数据录入：体重/腰围/臀围/大腿围。
- 体态照片：正面/侧面/背面拍照或相册导入；同视角 4 周对比查看。

**动作库页 library**：
- 顶部入口「📷 拍器械识别」大卡（说明 BYOK：自带 API Key、各用各 key、照片会发送给所选服务商）。
- 搜索（名称/中文名）+ 按训练日或器械类型筛选；列表行：emoji/名称/部位标签/器械类型。
- 点条目 → 详情弹层：中文名/英文名/要领/常见错误/部位标签；bodyStatus 非 none 且含高负荷部位时显示可关闭细条。
- 无 key 点识别 → 引导去设置页配置；未命中 → 显示 AI 文字 + 「去动作库手动找找」。

**设置页 settings**（多张卡，顺序：外观 → 我的有氧项目 → AI 器械识别 → 分享卡署名 → 周期 → 数据）：
1. **外观卡**：三选一 radio（奶油/莓果/暗夜，各带色点预览）→ 选中即存 settings.theme + `document.body.dataset.theme` 即时切换全站。
2. **我的有氧项目卡**：固定四预设「户外/游泳/骑行/球类」四张选项卡，点选=激活/取消（无自由命名入口）；激活项可点「设为主有氧」单选（仅激活项可用，主有氧失活自动回退）；内置器械三项固定不可动。
3. **AI 器械识别卡**：厂商预设 4 家（智谱 AI 默认 glm-4v-flash / 通义千问 qwen-vl-plus / 豆包 doubao-1-5-vision-pro-32k-250115 / OpenAI gpt-4o-mini）+ 自定义（baseUrl + model，折叠）+ API Key 输入（存 settings.vision）+ 清除；隐私小字「照片识别时，图片会发送给你所选的服务商；Key 只存这台设备。」
4. **分享卡署名卡**：客户名输入 + 三模板单选 `{name}的健身管家 / {name}的私人助教 / {name}的陪练搭子`；保存后分享卡底部即变。
5. **周期卡**：显示当前开始日期；「重新开始周期」可重选开始日期（confirm）。
6. **数据卡**：本地说明；导出完整 JSON（含 schemaVersion/exportedAt/sourceDevice/profile/sessions/measurements/weeklyReviews）；CSV 导出（训练组/有氧/测量分别）；导入 JSON（校验后覆盖，冲突不合并，导入前 confirm）；导出照片 ZIP；重量梯度说明 2.5kg；清空数据（二次确认）。
7. 数据说明卡：`训练记录和体态照片保存在这台设备的浏览器里，没有账户或云同步。使用 AI 器械识别时，所选照片会发送给你配置的服务商；导出的备份请自行妥善保管。`。

## 九、拍器械识别（BYOK，可选功能，V1.4）

- 入口在动作库页；**动作库内置 23 条动作的 id 清单**作为识别候选，识别调用为 OpenAI 兼容 chat/completions，图片 base64。
- 厂商配置（见设置页）；请求 messages：`[{role:'user', content:[{type:'text', text: <内置 prompt>}, {type:'image_url', image_url:{url:'data:...'}}]}]`。
- 内置识别 prompt 文本：列出「id: 中文名（target 中文）」清单后要求：`请判断图中这台健身器械/正在做的动作最接近清单中的哪一项。只返回 JSON，不要输出任何其他文字或代码块包裹，格式为：{"matchId": "动作 id 或 null", "guide": "50-100字中文：这台器械主要练哪里、发力要点、注意"}。如果图片里不是健身器械、或无法判断，matchId 填 null，guide 可写一句简短说明。`
- 解析容错：剥掉 ```json 包裹与前后杂文，取第一个 { 到最后一个 } 解析。
- 上传前压缩：最大边 1024、JPEG 0.85。超时与错误分类提示（401/403 → 查 Key；429 → 歇会；5xx → 稍后；网络 → 检查网络）。
- **命中** → 动作库详情弹层，顶部注明「仅供参考——识别结果可能并非该器械的精准用法」；详情含「加到今天的训练」按钮 = 追加到今日力量组末尾（仅当今天有进行中 session；否则置灰 + 提示）；**未命中** → 展示 guide 文字卡（注明仅供参考）。
- 隐私：拍照/上传前始终可见「照片将发送给你所选的服务商用于识别」。

## 十、视觉规格（三套皮肤，V1.5 定稿）

**设计语言（奶油款 = 默认）**：克制、高级、生活感（米色生活杂志风，大量留白）。顶部页头不随模块变色，一律页面底色。导航激活态：主色加粗 + 文字前小圆点。emoji 点缀（导航 🏋️🗓️📈📖⚙️；类型 💪/🚶/🧘/😴/✅🔥⭐），正文与数据不用 emoji 不用黄。黄色仅积极反馈/轻提醒徽章。

**CSS 变量 token（全站唯一取色源）**——三套仅在 `body[data-theme="cream"|"berry"|"night"]` 下覆盖同名变量，不动 HTML 结构：

| token | 奶油 cream（默认） | 莓果 berry | 暗夜 night |
|---|---|---|---|
| --bg 页面底 | #F5F0E6 | #FAF0F5 | #1B221D |
| --card 卡片 | #FCFAF3 | #FFFBFE | #242E27 |
| --cream 高亮/弹层内底 | #FFFDF8 | #FFFDF8 | #2B3630 |
| --ink 正文 | #3A362C | #542E43 | #EDF1EA |
| --ink-sub 说明 | #8B8577 | #96798E | #A3AFA2 |
| --main 主色 | #7FB069 | #C4457A | #A6C94E |
| --main-dark 主色深 | #5A8F4A | #A02E5F | #8FAD3E |
| --accent 强调 | #6F5F9E | #B0872F | #E0B04F |
| --accent-soft 强调浅底 | #EFEBF5 | #F6E9DC | #3A3527 |
| --warn | #C2410C | #C2410C | #E8890C |
| --danger | #B91C1C | #B91C1C | #E06060 |
| --btn-text 按钮字 | #FFFFFF | #FFFFFF | #16201A |
| --danger-bg 警示浅底 | #F6E0DE | #F6E0DE | #3A2222 |
| --warn-bg | #F7E6D6 | #F7E6D6 | #3A2E1E |
| --warn-ink | #7C2D12 | #7C2D12 | #F0B37A |
| 类型浅底 t-strength/t-cardio/t-posture/t-rest | #E9F0E2/#E3EBF0/#F4E6DA/#ECEAE4 | 按主题微调 | 深色底降饱和 |
| 类型深字 | #5A8F4A/#557E9E/#B96A38/#6F6D68 | 同左微调 | 浅色版 |

> 备注：--accent-soft 暗夜款取约 #3A3527（琥珀 12% 底）。表中 cream 列为权威定稿值；berry/night 的 --warn/--danger/警示浅底/类型色属「按主题校准」项（原版即按此口径实现），施工时以保证深色款正文对比度、浅字不落浅底为准，可微调 1–2 档明度。暗夜款所有浅底类（badge/alert/类型底）一律改用深色底 + 浅色字，**正文对比度单独把关**：说明文字 #A3AFA2 级别以上。主按钮文字色用 --btn-text。

**其他 token**：圆角 卡片 20px / 按钮 12px / 徽章 10px；卡间距 20–24px；卡片内边距 ≥20px；阴影一律 `0 1px 2px rgba(0,0,0,.04)`（层次靠底色差）；字体系统无衬线栈（`-apple-system,"PingFang SC",sans-serif`），标题字重 600–700、letter-spacing .02em；按钮触控区 ≥44px。弹窗、计划卡、执行页等全部跟随变量。**分享卡 Canvas 不随皮肤**（固定米色品牌款）。

## 十一、构建与 PWA

- `build.py`（python3 即可）：读 src/ 下 index.html 模板，把 `<link stylesheet>` 替换为内联 `<style>`、4 个 `<script src>` 替换为内联 `<script>`（顺序 data→db→engine→app），输出 `dist/index.html`；复制 sw.js、manifest.webmanifest、assets/ 到 dist/。
- `sw.js`：常量 `CACHE = 'fitness-workbench-v7'`（未来每次改版 +1）；install 预缓存外壳与关键资源，fetch 走 Cache First（网络失败回缓存），activate 清旧缓存。
- `manifest.webmanifest`：name「个人健身训练工作台」short_name「健身工作台」，display standalone、orientation portrait、lang zh-CN、background #FAFAF7、theme #7FB069，icons 用内嵌 SVG data-URI（抹茶绿圆角底 + 白色哑铃杠 + 两片杠铃片 + 左上黄圆点）。
- 本地预览：`python3 -m http.server 8765 --bind 127.0.0.1 --directory dist`；全流程自测从 `http://127.0.0.1:8765/?reset=1` 开始（回到信息采集页）。

## 十二、分享卡 Canvas（1080×1350，V1.5 定稿坐标，勿动）

函数 `drawShareCard({done, planned, streak, highlights[], encourage, weekLabel, footer})`：
1. 奶油底 `#FCFAF3` 全幅；顶部抹茶绿条 `#7FB069` 高 220px；白字标题「本周训练小结」700 56px @(60,105)；副标 weekLabel（如「第 1 周 / 共 8 周 · 动作与耐受」）400 34px @(60,165)，文本左对齐。
2. 完成天数 D 方案（居中）：`done + ' / ' + planned`，主色 `#5A8F4A`、700 150px、baseline y=445（W/2 居中）。
3. 「本周完成训练」400 40px `#8B8577` @(W/2, 532)。
4. 分隔线：`#DDD3BD` 线宽 3，从 `(W-440)/2, 578` 到 `(W+440)/2, 578`。
5. 「🔥 连续完成 N 天」600 52px `#6F5F9E` @(W/2, 662)。
6. 力量亮点区（左对齐从 x=80 起，标题 600 44px `#3A362C` @y=792）：有 highlights 时标题「⭐ 力量进步」@(80,792)，每条 400 42px `#5A8F4A` 从 x=110、行距 74 递增，末条后 y += 62。
7. 鼓励语 A 方案：`y = max(亮点末y + 92, 1012)`；金句文案包书名号「{encourage}」600 48px `#2E2A21`，**居中换行**（`wrapCanvasCenter`：按字符断行、每行居中、行距 70，返回末行 baseline）；句下短细线 `#7FB069` 线宽 5、宽度 = min(整句 measureText 宽, 560)、画在 末行Y+34。
8. 底部品牌署名：400 30px `#8B8577` @(W/2, H-50)，取 `data.footer`（由设置渲染：客户名 + 三模板，空名回退「个人健身训练工作台」，成品超 26 字符截断加 …）。
生成 PNG 供长按保存/分享；无网络无第三方。

## 十三、验收锚点（实现后逐条自测）

- AC-01 免注册建立档案；AC-02 两次点击进训练；AC-03 断网完成一次训练（SW 生效）；AC-04 连续两次达标→加重建议（+2.5kg）；AC-05 睡眠<6h / 精力≤2 → 减组或精简建议；AC-06 膝痛≥3 → 下肢不进阶；AC-07 全产品无健身房外活动记录项；AC-08 JSON 导出→导入可恢复；AC-09 无登录/同步代码；AC-10 动作文字要领离线可读。
- 三档身体 × 模板解析：knee 档力量日自动把膝部动作替换为 SUBSTITUTES 中当日未含的首个替代（带「已自动替换」徽章且不重复）；`?reset=1` 全流程走通：信息采集 → 计划页确认排期 → 今天执行 → 进展页周报 → 分享卡 → 设置页切三皮肤/配品牌名/自定义有氧/配 AI Key。
- RIR：当天首次进入 App 弹白话说明（跨天重置）；UI 全量显示「剩余次数 (RIR)」双写（执行页下拉占位、计划行「目标 剩余次数(RIR)」、阶段表、建议文案用「剩余次数≈0/≥2/≥3」白话）。

## 十四、分步交付建议（供你给目标 AI 拆分参考）

1. 数据层 + 内容层（data.js/db.js/engine.js 纯逻辑，可 node 冒烟）
2. 外壳 + 启动 + onboarding + 皮肤变量（跑通建档到 today）
3. 今天页 + 执行页 + 建议卡 + 休息计时
4. 计划页（排期确认 + 编辑）+ 动作库（详情/换动作/拍识别入口）
5. 进展页（周报/趋势/身体/照片）+ 分享卡 Canvas
6. 设置页全卡 + 备份导入导出 + 收尾验收

👇 结束复制
