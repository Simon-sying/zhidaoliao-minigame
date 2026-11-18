/**
 * 全局配置：所有需要人工填写 / 随环境切换的开关都集中在这里。
 * 上线前只需修改本文件 + 在微信公众平台 / 云开发控制台完成对应配置。
 */
module.exports = {
  APP: {
    NAME: '知识到了',
    SLOGAN: '每天知道一点新东西',
    VERSION: '1.3.0',
    QUESTION_VERSION: '1.3.0',
    // 发布版保持 false：不向玩家显示“开发模式”、版本号/题库数、本地虚拟榜单等调试信息；
    // 仅在本地开发联调时手动改为 true。
    DEBUG: false
  },

  /* ------------------------------------------------------------------
   * 云开发（CloudBase）—— 成本策略：延迟启用
   * 开发 / 内测期：USE_CLOUD = false，排行榜用本地预览数据，¥0 成本。
   * 临近上线：创建云开发免费环境 -> 把 ENV_ID 填进来 -> USE_CLOUD = true。
   * 用户量很小的时候免费额度（3000 资源点/月）基本够用；超出再升级个人版。
   * ------------------------------------------------------------------ */
  CLOUD: {
    USE_CLOUD: false,
    ENV_ID: '', // 例如 'zhidaoliao-9g8xxxxxx'
    // 云端未开启 / 无网络时，排行榜是否展示“预览数据”（仅用于开发联调，绝不给玩家伪造名次）
    SHOW_PREVIEW_BOARD_WHEN_LOCAL: true
  },

  /* ------------------------------------------------------------------
   * 广告（激励视频）—— 流量主开通前自动降级为“模拟广告”，不卡任何流程
   * 累计独立访客 UV > 500 后，在公众平台开通流量主、新建激励视频广告位，
   * 把 ENABLED 置为 true 并填入广告位 ID 即可。
   * ------------------------------------------------------------------ */
  ADS: {
    ENABLED: false,
    REWARDED_VIDEO_UNIT_ID: '', // 例如 'adunit-xxxxxxxxxxxxxxxx'
    // 休闲模式：每答约 N 题最多“主动提供”一次激励机会（不自动弹）
    CASUAL_OFFER_INTERVAL: 12,
    // 单局内重复展示广告的最小间隔（毫秒）
    MIN_INTERVAL_MS: 30 * 1000
  },

  /* ------------------------------------------------------------------
   * 排名挑战规则（无尽闯关版）
   * 全体玩家当天同一套确定性题序，3 点生命，答错扣命、归零结算，
   * 看谁答对题数最多；同题数再比速度分与用时。
   * ------------------------------------------------------------------ */
  CHALLENGE: {
    START_LIVES: 3, // 初始生命
    PER_QUESTION_SEC: 25, // 每题倒计时，超时按答错处理并扣 1 命
    // 道具（顶部道具栏）
    HINT_5050_PER_GAME: 2, // 每局免费「减半」数量：排除 2 个错误选项
    HINT_ANSWER_PER_GAME: 1, // 每局免费「正确答案」数量：直接锁定正确项（算答对但不拿速度分）
    HINT_TIME_PER_GAME: 1, // 每局免费「延时」数量：本题倒计时增加若干秒
    HINT_EXCLUDE_OPTIONS: 2, // 「减半」排除的错误选项数
    TIME_EXTEND_SECONDS: 10, // 一个「延时」道具给本题增加的秒数
    MAX_LIVES_CAP: 5, // 看广告临时加命的生命上限
    MAX_REVIVE_PER_GAME: 3, // 每局最多复活次数（云端据此防无限续命刷榜）
    // 每题基础分 + 速度奖励（秒），与 25 秒倒计时对齐：5 秒满速，25 秒无速
    BASE_SCORE_PER_Q: 90,
    MAX_SPEED_BONUS_PER_Q: 10,
    SPEED_FULL_BONUS_SECONDS: 5, // 5 秒内作答拿满速度奖励
    SPEED_NO_BONUS_SECONDS: 25, // 25 秒（含超时）无速度奖励
    // 单题作答/超时的物理用时硬上限（含「延时」叠加；延时只减速度分、无刷分利益，仅拦异常数据）
    MAX_ANSWER_SECONDS: 120,
    // 防作弊边界
    MIN_DURATION_SEC: 1,
    MAX_DURATION_SEC: 7200,
    // 每日第一次正式挑战不主动插广告（符合文档广告原则）
    FIRST_DAILY_NO_PROACTIVE_AD: true,
    // 命尽后是否允许“看广告复活，继续本局”
    ENABLE_REVIVE_BY_AD: true
  },

  /* ------------------------------------------------------------------
   * 知识掌握度规则（0~100）
   * ------------------------------------------------------------------ */
  MASTERY: {
    FIRST_CORRECT: 20,
    FIRST_WRONG: 5,
    SECOND_CORRECT: 20,
    THIRD_SCENE_CORRECT: 30,
    CONSECUTIVE_WRONG_PENALTY: 10,
    MAX: 100,
    BANDS: [
      { min: 0, max: 29, key: 'new', label: '未掌握' },
      { min: 30, max: 59, key: 'learning', label: '了解' },
      { min: 60, max: 79, key: 'familiar', label: '熟悉' },
      { min: 80, max: 99, key: 'mastered', label: '掌握' },
      { min: 100, max: 100, key: 'full', label: '已掌握' }
    ],
    // 错题对应的知识点，间隔 N 题后优先用“另一道同知识点题”复测
    RECHECK_GAP: 4,
    REVIEW_INTERVAL_DAYS: [1, 3, 7, 15, 30]
  },

  STORAGE_PREFIX: 'zdl_',
  STORAGE_KEYS: {
    PREFIX: 'zdl_',
    userState: 'userState',
    dailyLocalState: 'dailyLocalState',
    wrongQuestions: 'wrongQuestions',
    favoriteQuestions: 'favoriteQuestions',
    achievements: 'achievements',
    userSettings: 'userSettings',
    knowledgeMastery: 'knowledgeMastery',
    analyticsQueue: 'analyticsQueue'
  },

  // 情绪语言体系（品牌资产，全游戏统一文案）
  EMOTION: {
    RIGHT: '知道了！',
    WRONG: '原来如此！',
    STREAK: '又知道一点！',
    CHALLENGE_DONE: '今天也学到了不少',
    RETRY: '再试一次！'
  }
}
