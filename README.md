# 知识到了 · 微信知识答题小游戏

> 每天知道一点新东西。一款**轻量、温和、离线可玩**的知识答题微信小游戏：休闲刷题（答错也能继续）+ 无尽排名挑战（25 秒单题倒计时、3 命答错/超时扣命、云端防作弊排行榜），靠**用户主动触发的激励视频广告**变现。

原生微信小游戏实现（**无 Cocos/Unity 等引擎**，单 Canvas 自绘 UI，CommonJS），不引入任何第三方运行时依赖，包体极小、可直接用微信开发者工具打开。

---

## 1. 这版已经有什么（可运行 MVP）

- **两种玩法**
  - 🧠 休闲刷题：答错继续，每题都有「正确答案 + 为什么 + 一句话记忆点」，轻松无压力。
  - 🏆 无尽排名挑战：全体用户当天按**同一套确定性题序**无限闯关，**每题 25 秒倒计时（超时按答错处理）、3 点生命、答错或超时扣 1 点、归零结算**；**顶部道具栏**每局送 2 个「🎯减半」（排除两个错误选项）、1 个「✨正确答案」（直接锁定正确项，算答对但不拿速度分）和 1 个「⏰延时」（本题倒计时 +10 秒，只减速度分）；排名以**答对题数**优先，同题数再比速度分（每题 90 基础分 + 最多 10 速度分，5 秒满速、25 秒无速）。命尽可看激励视频**复活续关（每局最多 3 次）**，答题中还可看视频加生命、补道具；成绩只能经云函数入库并计算名次，**客户端无法伪造**。
- **知识掌握度 0–100**：首次答对 +20、第二题 +20、换场景再答对 +30、首次答错 +5、连续答错 −10；错题**间隔几题后用“同知识点的另一道题”复测**。
- **我的知识**：总览 + 十大类掌握度进度条，点分类可针对刷题；错题本、收藏、7 个本地成就。
- **激励视频广告位（全部用户主动触发）**：失败后「看视频再挑战」、每答若干题可领「今日知识总结」、答题前「看视频要提示」。未开通流量主时自动降级为弹窗模拟广告，**任何流程都不被卡住**。
- **本地优先、离线可玩**：进度/错题/收藏/掌握度全部本地存储；排行榜与云强相关，未开云开发时显示**明确标注的“本地预览虚拟榜”，绝不伪造玩家名次**。
- **内置 200 道高质量样板题**（10 大类 × 20），字段与校验齐备，便于后续扩写到目标 500 / 840 题。
- **自动化质量保障（纯 Node，无需依赖）**：题库校验、250+ 项核心逻辑断言、全量语法检查、整页离屏渲染冒烟。

---

## 2. 快速运行（微信开发者工具）

1. 打开「微信开发者工具」→ 导入项目，目录选择本文件夹 `zhidaoliao-minigame`。
2. AppID：
   - 只是先看看：保持 `project.config.json` 里的 `"appid": "touristappid"`，用**测试号 / 游客模式**即可运行（云开发、广告等能力不可用，但休闲玩法完整）。
   - 正式开发：到 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册「小游戏」拿到 AppID，替换 `project.config.json` 的 `appid`。
3. 编译类型已设为 `game`，导入后点「编译」即可在模拟器游玩；真机用「预览」扫码。

> 第一次打开无需任何 `npm install`（客户端零依赖）。云函数的依赖在**云端安装**（上传部署时勾选“云端安装依赖”）。

---

## 3. 目录结构

```
zhidaoliao-minigame/
├── game.js                     # 小游戏入口
├── game.json                   # 设备方向 / 网络超时等
├── project.config.json         # DevTools 工程配置（appid、云函数根目录、打包忽略）
├── package.json                # 仅用于本地脚本命令（不进包）
├── src/
│   ├── config/index.js         # ★ 所有人工开关集中处（云开发 / 广告 / 计分 / 掌握度）
│   ├── core/                   # 自研 Canvas 内核：app 路由、ui 原语、主题、存储、平台薄封装
│   ├── data/
│   │   ├── categories.js       # 十大分类
│   │   ├── questions.js        # 题库聚合 + 索引（byId/byCategory/byKnowledge）
│   │   ├── knowledge.js        # 知识点目录（从题目自动派生，单一数据源）
│   │   └── questions/*.js      # 10 个分类题库文件
│   ├── services/               # 业务服务层（与界面解耦，可独立单测）
│   │   ├── quiz.js             # 休闲抽题（间隔复测+加权）& 确定性每日题
│   │   ├── mastery.js          # 掌握度
│   │   ├── progress.js         # 用户/每日/错题/收藏/挑战/成就/设置/广告计数
│   │   ├── challenges.js       # 每日题、计分、payload 构造与客户端自检
│   │   ├── ads.js              # 激励视频 + 模拟广告降级
│   │   ├── cloud.js            # CloudBase 惰性初始化/云函数调用
│   │   ├── leaderboard.js      # 云端榜 / 本地预览
│   │   ├── achievements.js     # 成就定义与判定
│   │   └── analytics.js        # 本地埋点队列（预留上报）
│   └── scenes/                 # 11 个页面（首页/休闲/挑战介绍/挑战/结果/榜单/我的知识/错题/收藏/成就/知识卡）
├── cloudfunctions/
│   ├── login/                  # 换取 openid，users 集合 upsert
│   ├── submitScore/            # ★ 权威防作弊：结构校验 + 随包题库重算 + 每人每天只留最佳
│   │   ├── index.js
│   │   ├── daily.js            # 与客户端一致的确定性每日题/计分（有跨端一致性单测）
│   │   └── bank.json           # 由脚本导出的题库副本（云端复核依据）
│   └── getLeaderboard/         # 今日 Top50 + 我的名次
├── scripts/
│   ├── export-bank.js          # 把本地题库导出到 submitScore/bank.json
│   ├── validate-bank.js        # 题库质量校验
│   └── node-check-all.js       # 全量语法检查
├── test/
│   ├── logic.test.js           # 核心逻辑单测（计分/每日题一致性/掌握度/进度/payload/榜单）
│   └── render.smoke.js         # 离屏实例化 App，逐页渲染并自动打完一局
└── docs/
    ├── CLOUD_AND_ADS.md        # 云开发 / 广告开通与配置图文步骤、成本、发布检查
    └── PM_DECISION.md          # 产品决策、成本测算、数据指标、迭代路线
```

打包时 `test/ docs/ scripts/ README.md package.json` 已在 `project.config.json` 的 `packOptions.ignore` 中排除，**不会进入线上包**。

---

## 4. 常用命令（本机已用 Node 22 验证）

```bash
npm run validate     # 题库合法性校验（空题/选项/答案越界/解析记忆点/id 与选项重复等）
npm run export-bank  # 题库改动后，重新生成 cloudfunctions/submitScore/bank.json
npm test             # 核心逻辑单测
npm run smoke        # 整页离屏渲染冒烟
npm run check        # 对工程内所有 .js 做 node --check
```

> 题库每次新增/修改后：`npm run validate` → `npm run export-bank` → 重新上传 `submitScore` 云函数，保证云端复核口径与客户端一致。

---

## 5. 两个关键开关（都在 `src/config/index.js`）

```js
CLOUD: { USE_CLOUD: false, ENV_ID: '', SHOW_PREVIEW_BOARD_WHEN_LOCAL: true }
ADS:   { ENABLED: false, REWARDED_VIDEO_UNIT_ID: '', CASUAL_OFFER_INTERVAL: 12, MIN_INTERVAL_MS: 30000 }
```

- **成本策略：云开发「要用但延迟启用」**。开发/冷启动期 `USE_CLOUD=false`，零固定成本、休闲玩法完整；临近上线时创建免费云开发环境、填 `ENV_ID`、置 `true` 并部署 3 个云函数即可。详见 [docs/CLOUD_AND_ADS.md](docs/CLOUD_AND_ADS.md)。
- **广告同理**：流量主开通前 `ENABLED=false`，所有广告位自动用弹窗模拟，不影响任何功能。小游戏累计独立访客 **UV > 500** 后开通流量主、建激励视频广告位、填 ID 并置 `true`。

---

## 6. 如何扩充题库（目标 500 / 840 题）

题目结构（单题对象）：

```js
{
  id: 'LIFE_0011',                 // 全局唯一
  categoryId: '01',                // 见 src/data/categories.js
  knowledgeId: 'LIFE_K003',        // 同知识点可挂多道“不同场景”的题（支撑换题复测）
  knowledgeTitle: '燃气使用安全',
  knowledgeTip: '一句话记忆点',
  type: 'single',                  // single | judge | scene | sort
  difficulty: 2,                   // 1-3
  ageLevel: 'all',                 // all | child
  question: '题干',
  scenario: '可选，场景题的情境描述',
  options: ['A', 'B', 'C', 'D'],   // 判断题固定为 ['正确','错误']
  answer: 1,                       // 正确项下标
  explanation: '为什么（干货解析）',
  tip: '一句话记忆点',
  tags: ['安全', '厨房']
}
```

步骤：
1. 在对应 `src/data/questions/<分类>.js`（或新建分类文件并在 `questions.js` 中 `require` 聚合）追加题目；
2. **优先给已有知识点补“不同场景的另一道题”**——当前多数知识点只有 1 题，补成 2–3 题才能充分发挥“换题复测”；
3. 依次运行 `npm run validate`、`npm run export-bank`；
4. 重新上传 `submitScore` 云函数（带着新的 `bank.json`）。

---

## 7. 安全与防作弊（每日挑战）

客户端只做基础自检，**权威判定全部在 `submitScore` 云函数**：

1. `challengeId` 合法、作答题数为当天题序的严格前缀、无重复；
2. 用随包题库**重算**正确数与理论最高分，校验分数/正确数/选项/单题用时（超时记 `chosen=-1`；单题用时设 120 秒物理上限，已容纳「延时」叠加且延时只减速度分）；
3. 校验作答题目与“当天确定性题序”完全一致（不能偷换简单题）；
4. 总用时限定 1–7200 秒，错题数必须与“初始 3 命 + 复活次数”自洽；
5. 每人每天**只保留最佳成绩**（重复提交不会刷高、不会产生多条记录）；
6. 数据库集合设为“仅云函数可读写”，客户端无法直接改库；
7. 名次用“统计更优成绩条数 +1”实时计算，排序口径：答对题数 → 总分（速度分） → 用时 → 提交先后。

---

## 8. 还需要你在微信平台侧完成的事

- 注册/认证小游戏主体，拿到 **AppID**（个人 or 企业主体，影响可开通能力，建议确认）。
- 完成**小游戏备案、用户隐私保护指引/隐私协议**等上架合规项。
- 达到 UV>500 后开通**流量主**、创建激励视频广告位。
- 上线前开启云开发并部署函数（见 [docs/CLOUD_AND_ADS.md](docs/CLOUD_AND_ADS.md)）。
- 提审前对照该文档末尾的「发布前检查清单」逐项过一遍。

产品定位、成本测算、数据指标与迭代路线见 [docs/PM_DECISION.md](docs/PM_DECISION.md)。
