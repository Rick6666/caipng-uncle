// 全游戏数值与文案的单一真源，与 docs/02-game-design.md 逐项对齐。
// 逻辑代码禁止出现魔法数字/散落文案，一律从这里 import。

// 数值经 sim.js 千局校准（reasonable 存活 ~37%、lazy ~0%），详见 docs/02-game-design §11
export const CONST = {
  START_MONEY: 82,
  START_REP: 0,
  RENT_PER_DAY: 32,
  BASE_PREP_CAP: 16,
  WOK_BONUS: 8,
  BASE_CUSTOMERS: 9,
  MAX_CUSTOMERS: 22,
  HELPER_CUSTOMER_BONUS: 4,
  SIGN_CUSTOMER_BONUS: 2,
  GAME_DAYS: 7,
  LOAN_AMOUNT: 60,
  LOAN_REPAY: 90,
  LOAN_INTEREST: 10,
  RICE_COST: 1,
  RICE_PRICE: 1,
  EVENT_CHANCE: 0.55,          // 开档事件触发概率
  INSPECTION_CHANCE: 0.15,     // 卫生检查
  CATSTEAL_CHANCE: 0.1,        // 野猫偷吃
  INSPECTION_FINE: 30,
  RAIN_CUSTOMER_MUL: 0.7,
  MARKETUP_PRICE_MUL: 1.2,
  FRIDGE_KEEP: 0.6,
  FOODIE_VARIETY_MIN: 8,       // 美食家追加：当日菜品种类≥此值
  FOODIE_VARIETY_BONUS: 4,
  FOODIE_MIN_VARIETY_SPAWN: 6, // 美食家出现需当日菜品种类≥6
  HELPER_AUTO_SELL: 2,         // 帮手阿明每日自动卖出份数
  KOPI_BONUS: 1,               // 咖啡机每单额外
  WORKER_UNLOCK: 0             // 占位（worker 无门槛）
};

export const INGREDIENTS = [
  { id: 'rice',    name: '米',     emoji: '🍚', price: 1, unlockRep: 0 },
  { id: 'egg',     name: '鸡蛋',   emoji: '🥚', price: 1, unlockRep: 0 },
  { id: 'veg',     name: '青菜',   emoji: '🥬', price: 1, unlockRep: 0 },
  { id: 'cabbage', name: '高丽菜', emoji: '🥗', price: 1, unlockRep: 0 },
  { id: 'tofu',    name: '豆腐',   emoji: '🧈', price: 2, unlockRep: 0 },
  { id: 'braise',  name: '卤汁',   emoji: '🫗', price: 1, unlockRep: 0 },
  { id: 'chicken', name: '鸡肉',   emoji: '🍗', price: 3, unlockRep: 0 },
  { id: 'pork',    name: '猪肉',   emoji: '🥩', price: 3, unlockRep: 0 },
  { id: 'curry',   name: '咖喱酱', emoji: '🍛', price: 1, unlockRep: 15 },
  { id: 'fish',    name: '鲜鱼',   emoji: '🐟', price: 4, unlockRep: 30 },
  { id: 'prawn',   name: '大虾',   emoji: '🦐', price: 5, unlockRep: 55 }
];

// price = 基准价；cat 决定荤素分类与替代逻辑；img 走 assets/，加载失败回退 emoji
// price = 售价（已抬高至每道菜 $2~4 毛利，成本见 recipe 食材单价之和）
export const DISHES = [
  { id: 'stirVeg',       name: '炒青菜',   emoji: '🥬', recipe: ['veg'],            price: 3, weight: 10, cat: 'veg',     img: 'assets/dishes/stirVeg.webp' },
  { id: 'cabbageStew',   name: '焖高丽菜', emoji: '🥗', recipe: ['cabbage'],        price: 3, weight: 8,  cat: 'veg',     img: 'assets/dishes/cabbageStew.webp' },
  { id: 'braisedEgg',    name: '卤蛋',     emoji: '🥚', recipe: ['egg', 'braise'],  price: 4, weight: 10, cat: 'egg',     img: 'assets/dishes/braisedEgg.webp' },
  { id: 'bitterEgg',     name: '苦瓜炒蛋', emoji: '🍳', recipe: ['veg', 'egg'],     price: 4, weight: 6,  cat: 'egg',     img: 'assets/dishes/bitterEgg.webp' },
  { id: 'mapoTofu',      name: '麻婆豆腐', emoji: '🥘', recipe: ['tofu'],           price: 4, weight: 7,  cat: 'veg',     img: 'assets/dishes/mapoTofu.webp' },
  { id: 'friedWing',     name: '炸鸡翅',   emoji: '🍗', recipe: ['chicken'],        price: 6, weight: 10, cat: 'meat',    img: 'assets/dishes/friedWing.webp' },
  { id: 'curryChicken',  name: '咖喱鸡',   emoji: '🍛', recipe: ['chicken', 'curry'], price: 7, weight: 9, cat: 'meat',   img: 'assets/dishes/curryChicken.webp' },
  { id: 'braisedPork',   name: '卤肉',     emoji: '🥩', recipe: ['pork', 'braise'], price: 7, weight: 8,  cat: 'meat',    img: 'assets/dishes/braisedPork.webp' },
  { id: 'sweetSourPork', name: '咕咾肉',   emoji: '🍖', recipe: ['pork'],           price: 6, weight: 7,  cat: 'meat',    img: 'assets/dishes/sweetSourPork.webp' },
  { id: 'steamedFish',   name: '清蒸鱼',   emoji: '🐟', recipe: ['fish'],           price: 8, weight: 6,  cat: 'premium', img: 'assets/dishes/steamedFish.webp' },
  { id: 'curryFishHead', name: '咖喱鱼头', emoji: '🐠', recipe: ['fish', 'curry'],  price: 9, weight: 5,  cat: 'premium', img: 'assets/dishes/curryFishHead.webp' },
  { id: 'chiliPrawn',    name: '辣椒虾',   emoji: '🦐', recipe: ['prawn'],          price: 9, weight: 5,  cat: 'premium', img: 'assets/dishes/chiliPrawn.webp' }
];

export const CUSTOMER_TYPES = [
  { id: 'student',    name: '穷学生',   emoji: '🧑‍🎓', weight: 10, dishCount: 2, unlockRep: 0,  img: 'assets/customers/student.webp' },
  { id: 'worker',     name: '上班族',   emoji: '🧑‍💼', weight: 10, dishCount: 2, unlockRep: 0,  img: 'assets/customers/worker.webp' },
  { id: 'ahma',       name: '阿嬷',     emoji: '👵',   weight: 8,  dishCount: 2, unlockRep: 0,  img: 'assets/customers/ahma.webp' },
  { id: 'uncle2',     name: '隔壁老伯', emoji: '👴',   weight: 6,  dishCount: 2, unlockRep: 0,  img: 'assets/customers/uncle2.webp' },
  { id: 'labourer',   name: '建筑工人', emoji: '👷',   weight: 7,  dishCount: 3, unlockRep: 15, img: 'assets/customers/labourer.webp' },
  { id: 'influencer', name: '网红',     emoji: '🤳',   weight: 4,  dishCount: 2, unlockRep: 30, img: 'assets/customers/influencer.webp' },
  { id: 'foodie',     name: '美食家',   emoji: '🧐',   weight: 2,  dishCount: 3, unlockRep: 55, img: 'assets/customers/foodie.webp' }
];

// 反应矩阵：kind/normal = { pay, rep }；slash = { pay, repPaid, repWalk }；
// ahma.slash 特殊：{ haggle: true }，砍价子选择在 haggle 字段
export const REACTION = {
  student:    { kind: { pay: 1.0, rep: 2 }, normal: { pay: 0.9, rep: 0 }, slash: { pay: 0.3, repPaid: -3, repWalk: -2 } },
  worker:     { kind: { pay: 1.0, rep: 1 }, normal: { pay: 1.0, rep: 0 }, slash: { pay: 0.85, repPaid: -1, repWalk: -2 } },
  ahma:       { kind: { pay: 1.0, rep: 3 }, normal: { pay: 0.9, rep: 0 }, slash: { haggle: true },
                haggle: { accept: { rep: 0 }, gamble: { payChance: 0.5, repPaid: -1, repWalk: -3 } } },
  uncle2:     { kind: { pay: 1.0, rep: 2 }, normal: { pay: 1.0, rep: 0 }, slash: { pay: 0.5, repPaid: -2, repWalk: -2 } },
  labourer:   { kind: { pay: 1.0, rep: 2 }, normal: { pay: 1.0, rep: 1 }, slash: { pay: 0.75, repPaid: -1, repWalk: -2 } },
  influencer: { kind: { pay: 1.0, rep: 6 }, normal: { pay: 1.0, rep: 1 }, slash: { pay: 1.0, repPaid: -6, repWalk: -6 } },
  foodie:     { kind: { pay: 1.0, rep: 4 }, normal: { pay: 1.0, rep: 2 }, slash: { pay: 0.6, repPaid: -5, repWalk: -4 } }
};

export const REP_LEVELS = [
  { threshold: 0,   title: '路边小摊' },
  { threshold: 15,  title: '巷口熟客' },
  { threshold: 30,  title: '街坊招牌' },
  { threshold: 55,  title: '排队名摊' },
  { threshold: 85,  title: '本地传奇' },
  { threshold: 120, title: '全城最强杂菜饭' }
];

export const UPGRADES = [
  { id: 'awning',  name: '遮阳棚',   emoji: '⛱️', price: 60,  desc: '雨天客流不减' },
  { id: 'speaker', name: '老歌音响', emoji: '📻', price: 90,  desc: '每天开档声望 +1' },
  { id: 'fridge',  name: '二手冰箱', emoji: '🧊', price: 80,  desc: '剩菜保留六成到明天' },
  { id: 'wok',     name: '大炒锅',   emoji: '🍳', price: 100, desc: '备菜上限 +8' },
  { id: 'sign',    name: '霓虹招牌', emoji: '🪧', price: 120, desc: '每天客人 +2' },
  { id: 'kopi',    name: '咖啡机',   emoji: '☕', price: 150, desc: '每位付款客人多给 $1 kopi 钱' },
  { id: 'helper',  name: '帮手阿明', emoji: '🧑‍🍳', price: 200, desc: '客流上限 +4；收档时阿明再卖 2 份剩菜' }
];

// 开档事件（weighted 抽取，cond 为可选出现条件）；收档事件单独判定
export const EVENTS = {
  open: [
    { id: 'rain',     name: '落大雨',       weight: 10 },
    { id: 'holiday',  name: '学校放假',     weight: 6 },
    { id: 'rival',    name: '隔壁摊大促销', weight: 7 },
    { id: 'marketUp', name: '巴刹涨价',     weight: 6 },
    { id: 'payday',   name: '发薪日',       weight: 6 },
    { id: 'tv',       name: '电视台采访',   weight: 3, minRep: 55 }
  ],
  close: [
    { id: 'inspection', name: '卫生检查' },
    { id: 'catSteal',   name: '野猫偷吃' }
  ]
};

export const LINES = {
  names: ['阿伟', '志明', '春娇', '阿珍', '小龙', '美玲', '阿强', '淑芬', '建国', '丽华', '阿明', '秀兰', '大雄', '雅婷', '国荣'],

  greetings: {
    student: [
      'Uncle，我要便宜一点的 lah，穷学生一个 😅',
      '这个多少钱？我钱包剩没几块了 leh',
      'Uncle 打多点饭好吗，吃不饱明天上课没精神',
      '有没有 student price？开个玩笑啦哈哈',
      'Uncle 我只带了这点钱，尽量帮我配 lor'
    ],
    worker: [
      'Uncle 快一点 leh，等下开会要迟到了',
      '老样子，两个菜打包，赶时间',
      'Uncle 我 lunch 时间只有半小时，麻烦快手',
      '随便帮我配就好，好吃就行',
      '给我来个快的，钱不是问题 lah'
    ],
    ahma: [
      'Uncle 啊，今天这个菜新鲜吗？',
      '阿嬷我吃得少，帮我打少少就好 lah',
      '这个多少钱？现在什么都涨价 hor',
      'Uncle 你这个卤蛋看起来不错 leh',
      '慢慢来慢慢来，阿嬷不赶时间'
    ],
    uncle2: [
      'Eh Uncle，今天生意好吗？',
      '老朋友了，帮我配得好一点 lah',
      'Uncle 我跟你讲，昨天那个新闻你看了没',
      '来来来，跟平时一样',
      'Uncle 你这个摊子开几年咯？做得不错 hor'
    ],
    labourer: [
      'Uncle 饭要多，做工肚子饿得快！',
      '给我三个菜，要够力的那种 lah',
      'Uncle 加多一勺，兄弟今天出了大力',
      '肉多一点 leh，光吃菜没力气搬砖',
      'Uncle 我们工地一整天了，要吃饱饱'
    ],
    influencer: [
      'Uncle 这个可以拍照吗？我发小红书 📸',
      '哇你这个摆盘我要拍一下先',
      'Uncle 出名的就是你家对吗？粉丝叫我来的',
      '等下我 tag 你哦，生意会爆的 lah',
      'Uncle 摆好看一点，我要 po story'
    ],
    foodie: [
      'Uncle 你这个咖喱是自己调的吗？',
      '我吃过很多家，今天来试试你的手艺',
      'Uncle 火候很重要，我看你怎么处理',
      '正宗的杂菜饭应该是什么味道，你懂的 lah',
      '菜色齐不齐，一眼就看得出功夫 hor'
    ]
  },

  // 每档位反应台词，抽一条展示
  reactions: {
    student: {
      kind: ['Uncle 你太好人了！下次带同学来 🙏', 'Shiok！这个价钱真的够意思', '谢谢 Uncle，你是好人一生平安'],
      normal: ['OK 啦，这个价钱可以接受', '嗯…还行，付钱付钱', '好吧，正常价我认了'],
      slash: ['Walao 这么贵！抢钱啊 😡', '这个价钱我下次不来了 lah', 'Uncle 你太黑了吧…算了算了']
    },
    worker: {
      kind: ['便宜又快，Uncle 你最赞', '这价钱良心，明天还来', 'Nice，省下的钱喝杯 kopi'],
      normal: ['OK 收到，赶时间先走了', '正常价，没问题', '好，找我钱谢谢'],
      slash: ['有点贵 leh…算了赶时间', '这价钱…下次考虑别家', '被斩一刀，但没空计较 lah']
    },
    ahma: {
      kind: ['Uncle 你有心，阿嬷记得你的好 ❤️', '这么便宜，阿嬷多买一份', '好人啊你，生意会兴旺的'],
      normal: ['嗯，就这个价咯', '好啦好啦，付你', '正常价，阿嬷不计较'],
      slash: ['哎哟这么贵！便宜点啦 Uncle', '阿嬷跟你讲这个不值这个钱 hor', '太贵咯，能不能算便宜点']
    },
    uncle2: {
      kind: ['够意思！老朋友就是不一样', 'Uncle 你这个价钱做得下去吗哈哈', '好人，下次再来捧场'],
      normal: ['OK 老价钱，收到', '嗯，跟平时一样', '好，钱给你'],
      slash: ['Eh 今天怎么起价了？', '老朋友还斩我…下次少来 lah', '这个价钱不厚道 hor']
    },
    labourer: {
      kind: ['够力！Uncle 你太够意思了 💪', '便宜又大碗，明天带兄弟来', 'Shiok，吃饱有力气做工'],
      normal: ['OK 可以，份量够就好', '正常价，能吃饱就行', '好，谢谢 Uncle'],
      slash: ['有点贵…但饿了忍了', '这价钱…下次换一家 lah', '被斩了，但要吃饱先算了']
    },
    influencer: {
      kind: ['Uncle 我要帮你发帖！这么划算 🔥', '哇好评好评，粉丝会冲的', '这波我一定 po，Uncle 加油'],
      normal: ['嗯 OK，还行啦', '正常价，拍个照先', '可以可以，付钱'],
      slash: ['这么贵我要发避雷帖了 😤', 'Walao 斩客，粉丝我劝退了', '这个价钱…我要 po 出来 lor']
    },
    foodie: {
      kind: ['有诚意！手艺配得上这个价 👍', '良心价还这么用心，难得', 'Uncle 你这个值得推荐'],
      normal: ['嗯，味道对得起价钱', '正常价，水准在线', '可以，火候不错'],
      slash: ['这个价钱…名不副实 hor', '手艺是有，但斩太狠了', '懂行的不会付这个价 lah']
    }
  },

  // Uncle 旁白（第二人称）与事件文案
  narration: {
    morningStart: ['天刚亮，巴刹的灯还没全开，你已经在挑今天的食材了。', '新的一天，摊子擦干净，等着开张。'],
    prepStart: ['锅气升起，你系上围裙，开始今天的备菜。'],
    openStall: ['卷帘门拉开，第一位客人已经在探头了。'],
    emptyQueue: ['收档时间到，卷帘门缓缓拉下。']
  },

  events: {
    rain: '☔ 落大雨咯！街上没什么人，生意怕是要淡。',
    holiday: '🎒 学校放假，学生仔特别多，今天热闹！',
    rival: '🏷️ 隔壁摊大promotion，抢走了你一些客人。',
    marketUp: '📈 今天巴刹涨价，食材成本高了些。',
    payday: '💵 发薪日！打工人手头松，舍得吃好一点。',
    tv: '📺 电视台来采访你的摊子！明天怕是要排长龙了。',
    inspectionPass: '✅ 卫生检查——你的摊子干干净净，检查员点头表扬，声望 +2。',
    inspectionFail: '⚠️ 卫生检查——剩菜没收好又没冰箱，被罚 $30、声望 −2。',
    catSteal: '🐱 一只野猫窜上摊子，叼走了一份剩菜就跑，气死。'
  },

  // 每日结算手感评价（§9.3 dailyVerdict 三档）
  verdicts: {
    good: ['今天生意红火，Uncle 看了都点头。', '收入不错，声望也涨，好日子！'],
    ok: ['今天马马虎虎，混过去了。', '不好不坏，平平淡淡一天。'],
    bad: ['今天有点惨淡，得想想办法了。', '亏了，明天要振作。']
  },

  // 存活结局评分附言（§9 grade）
  gradeFlavor: {
    S: '封神了！这七天你把摊子经营成了传奇。',
    A: '漂亮！邻居 Uncle 回来看到会竖大拇指。',
    B: '还行，代班这一周没砸招牌。',
    C: '勉强撑完，下次能做得更好。'
  },

  // rep≥120 特殊附言
  legend: '🏆 这一局，你干到了「全城最强杂菜饭」！',

  // 破产墓志铭（§9.2，与 epitaph 的 id 对应）
  epitaphs: {
    early:   { title: '💀 早夭 Uncle', line: '接手摊子没两天就撑不住，邻居 Uncle 看了直摇头。' },
    karma:   { title: '🦈 现世报 Uncle', line: '一路斩客斩上瘾，资金链没扛住，也是活该。' },
    soClose: { title: '😭 一步之遥 Uncle', line: '就差一两天就能全须全尾交摊子了，天不助我。' },
    honest:  { title: '😮‍💨 苦撑 Uncle', line: '老老实实做生意，还是没扛过这个坎。' }
  },

  // 存活结局人设标签（§9.1，与 uncleTitle 的 id 对应）
  titles: {
    shark:   { title: '🦈 奸商 Uncle', flavor: '逢人就宰，回头客都被你吓跑了。' },
    awkward: { title: '😅 社死 Uncle', flavor: '被气走的顾客比留下的还多，风评有点危险。' },
    kind:    { title: '😇 良心 Uncle', flavor: '几乎不斩客，街坊都念你的好。' },
    broke:   { title: '😩 苦命 Uncle', flavor: '惨淡经营，还在摸索门道。' },
    worldly: { title: '😎 江湖 Uncle', flavor: '精明世故，眼里有生意也有人情。' }
  }
};
