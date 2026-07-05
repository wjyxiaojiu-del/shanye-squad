// ============================================================
// 安全小课堂 · 章节内容仓库（PPT 提炼，文字化 → 测验题）
// ============================================================
// 来源：户外基础安全课程PPT_儿童版（共 17 页）。每章一段 60-120 字的
// 通识阅读 + 一道 4 选 1 选择题。答对方可解锁对应安全徽章。

export interface QuizChoice {
  /** 选项标签 A/B/C/D */
  key: string;
  text: string;
}

export interface Quiz {
  question: string;
  choices: QuizChoice[];
  /** 正确答案的 key */
  answer: string;
  /** 答错时的鼓励与知识点提示 */
  hint: string;
}

export interface SafetyChapter {
  id: string;
  /** 徽章 id（同 stickers.ts 的 id） */
  badgeId: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  /** PPT 幻灯片图片（2-3 张），展示在阅读页 */
  slides: string[];
  /** 每张幻灯片的简短图说（可选，与 slides 对齐） */
  captions?: string[];
  /** 通识阅读（2-3 段），作为幻灯片补充说明 */
  body: string[];
  quiz: Quiz;
}

export const SAFETY_CHAPTERS: SafetyChapter[] = [
  {
    id: 'gear',
    badgeId: 'safety-gear',
    title: '户外必备装备清单',
    subtitle: '出门前检查你的"安全百宝箱"',
    emoji: '🎒',
    color: '#8FA5AD',
    slides: ['/safety/safety-03-gear.webp', '/safety/safety-04-gear.webp'],
    captions: ['户外安全装备必备清单 — 背包篇 · 穿戴篇 · 辅助用品篇', '出行安全必需品：60L+ 背包、登山鞋、雨衣、哨子、水壶'],
    body: [
      '去山野探险前，一定要准备好"安全四件套"：能装下所有物品的大背包（建议 60L 以上）、防滑的登山鞋或运动鞋、装满水的水壶，以及随时应对下雨的雨衣或防水外套。',
      '别忘记几件小但关键的物品：口哨（走丢时求救比喊叫省力十倍）、小手电或头灯（天黑时照亮路）、简单的小创可贴和纸巾。这些小东西在你需要时会发挥大作用。',
    ],
    quiz: {
      question: '去户外时，下面哪样不是"必要安全物品"？',
      choices: [
        { key: 'A', text: '口哨（求救用）' },
        { key: 'B', text: '大包零食' },
        { key: 'C', text: '雨衣或防水外套' },
        { key: 'D', text: '装满水的水壶' },
      ],
      answer: 'B',
      hint: '零食能带来好心情但不能救命；口哨、雨衣、水壶都是关键时刻的安全保障！',
    },
  },
  {
    id: 'pack',
    badgeId: 'safety-pack',
    title: '学会正确背包',
    subtitle: '背得对，走路不累还安全',
    emoji: '🎒',
    color: '#C1786A',
    slides: ['/safety/safety-05-pack.webp', '/safety/safety-06-pack.webp'],
    captions: ['背包三重秘诀：物品分类、重心平衡、重量分配', '学会正确背包 — 重物在背部中央、调整肩带与腰带'],
    body: [
      '背包有三个小秘密：第一，重的物品（比如水和食物）要放在背包中部、靠近后背的位置，这样重心稳，走路不容易往后仰。第二，常用的小物品（如雨衣、口哨）放在顶袋或侧袋，拿起来最方便。第三，把物品分类用袋子装好，这样既防水又好找。',
      '调好肩带和腰带：肩带不能太松，让背包贴住后背；腰带扣上后承担一部分重量，肩膀就没那么累。试试原地跳两跳，如果背包跟着稳当蹦、不晃来晃去，就是背好了！',
    ],
    quiz: {
      question: '背包装填时，重的东西应该放在哪里最合适？',
      choices: [
        { key: 'A', text: '最底部' },
        { key: 'B', text: '最顶部' },
        { key: 'C', text: '中部、靠近后背处' },
        { key: 'D', text: '随便放哪里都可以' },
      ],
      answer: 'C',
      hint: '重物放在中部靠背处，重心刚好在腰背上，走路最稳最省力～',
    },
  },
  {
    id: 'water',
    badgeId: 'safety-water',
    title: '野外安全饮水',
    subtitle: '找对水源 + 喝对水，肚子不受罪',
    emoji: '💧',
    color: '#6BA0B5',
    slides: ['/safety/safety-08-water.webp', '/safety/safety-09-water.webp'],
    captions: ['安全饮水不怕野外 — 寻找水源的正确方法', '野外水源净化三步骤：沉淀/过滤/煮沸'],
    body: [
      '在野外找水，优先选择流动的山泉、小溪——活水比池塘里的"死水"干净得多。看到源头清亮、没有异味的流动水源，才考虑取水。',
      '不过，再清澈的溪水也不能直接喝！水里可能藏着看不见的细菌和寄生虫。正确做法是用净水片净化，或者用便携滤水器过滤后再喝。最保险的方法是烧开水 1 分钟以上再喝。',
    ],
    quiz: {
      question: '野外口渴时，应该优先选哪种水源？',
      choices: [
        { key: 'A', text: '静止的小水塘' },
        { key: 'B', text: '流动的溪水（净化后再喝）' },
        { key: 'C', text: '闻起来没味道就行' },
        { key: 'D', text: '路上的积水坑' },
      ],
      answer: 'B',
      hint: '活水比死水干净，但野外水源无论多清澈，都要净化后才能喝哦！',
    },
  },
  {
    id: 'tent',
    badgeId: 'safety-tent',
    title: '科学搭帐篷',
    subtitle: '选对地方，睡得又暖又安全',
    emoji: '⛺',
    color: '#7A8B6F',
    slides: ['/safety/safety-10-tent.webp', '/safety/safety-11-tent.webp'],
    captions: ['科学搭帐篷 — 选址"四不要"规则（不近水、不低洼、不枯树、不风口）', '科学搭帐篷 4 步法：整理地面 → 固定四角 → 支起内帐 → 系好防风绳'],
    body: [
      '搭帐篷前先看地面——记住"四不要"：1）不要在大树下（防风防雷）；2）不要在低洼溪床（下雨会淹）；3）不要靠近枯树枯枝（会掉下来砸到）；4）不要在山顶风口（太冷太危险）。最好选平整、稍高、避风的草地。',
      '搭好帐篷有 4 步秘籍：先整理地面（拣掉石头树枝），再摊开帐篷整平，接着用营钉把四个角牢牢固定，最后系好防风绳——防风绳就像帐篷的"脚"，没有它风一吹帐篷就跑！',
    ],
    quiz: {
      question: '下面哪个地方不适合搭帐篷？',
      choices: [
        { key: 'A', text: '平整避风的草地' },
        { key: 'B', text: '平坦的大树下' },
        { key: 'C', text: '地势略高的小坡' },
        { key: 'D', text: '远离溪流的平地' },
      ],
      answer: 'B',
      hint: '大树易遭雷击、枯枝会掉下砸到人；选开阔平坦避风的地方最安全！',
    },
  },
  {
    id: 'knot',
    badgeId: 'safety-knot',
    title: '安全绳结：双套结',
    subtitle: '一根绳子，关键时刻能救命',
    emoji: '🪢',
    color: '#B08968',
    slides: ['/safety/safety-12-knot.webp'],
    captions: ['安全绳结：双套结（Clove Hitch）→ 4 步口诀图解'],
    body: [
      '双套结（Clove Hitch）是最常用的户外绳结之一，特别适合把绳子快速系在柱子、木桩或帐篷的营钉上。它的好处是简单好绑、受力后也不容易松脱。',
      '绑法四步口诀：① 绳子绕柱子一圈；② 绳头再绕一圈，压住第一圈；③ 绳头从第二圈下方的圈眼里穿过去；④ 双手同时拉紧两端——完成！赶快试试，当绳子能在柱子上稳稳挂住不掉就成功了。',
    ],
    quiz: {
      question: '双套结在户外最常用来做什么？',
      choices: [
        { key: 'A', text: '连接两根一样粗的绳子' },
        { key: 'B', text: '把绳子系在柱子或营钉上' },
        { key: 'C', text: '绑鞋带' },
        { key: 'D', text: '包扎伤口固定绷带' },
      ],
      answer: 'B',
      hint: '双套结的优点是"系在柱子上"快速又牢固，常用来固定帐篷的防风绳！',
    },
  },
  {
    id: 'sos',
    badgeId: 'safety-sos',
    title: '迷路了怎么办？',
    subtitle: '冷静求助，让别人找到你',
    emoji: '🆘',
    color: '#B0574A',
    slides: ['/safety/safety-13-sos.webp', '/safety/safety-14-sos.webp'],
    captions: ['方向迷失求助求救 — 冷静是第一步', '三种求救方式：手机电话 · 自然标志识别 · 哨声 SOS "三短三长三短"'],
    body: [
      '万一在山野里迷路了，第一件事：停下来！不要慌张乱走，原地坐下或站在安全地方。慌张只会让你走得更远。',
      '求救有三种好方法：1）有手机就拨打 110 或爸妈电话，说清地名或特征；2）没有手机就吹口哨——国际通用的求救信号是"三短三长三短"（短、短、短；长、长、长；短、短、短），重复吹，比一直喊更省力传得更远；3）挥动颜色鲜艳的衣服或手电光，让救援人员看到你。',
    ],
    quiz: {
      question: '国际通用的求救哨声节奏是下列哪一种？',
      choices: [
        { key: 'A', text: '三短三长三短（短短短-长长长-短短短）' },
        { key: 'B', text: '一直急促地短吹' },
        { key: 'C', text: '只吹一声长长的' },
        { key: 'D', text: '随便乱吹让别人注意' },
      ],
      answer: 'A',
      hint: '"三短三长三短"是全世界都认识的求救信号，比乱吹更容易被发现和识别！',
    },
  },
  {
    id: 'firstaid',
    badgeId: 'safety-firstaid',
    title: '户外伤护小课堂',
    subtitle: '小伤不乱来，科学处理更安心',
    emoji: '🩹',
    color: '#C1786A',
    slides: ['/safety/safety-15-firstaid.webp'],
    captions: ['户外常见伤护理：蚊虫叮咬 · 划伤擦伤 · 扭伤拉伤的预防与处理'],
    body: [
      '在户外活动，小伤小痛难免：蚊虫叮咬后用脏手抓破会感染，应该涂风油精或炉甘石洗剂止痒；跑步摔倒擦破皮时，先用干净的水冲洗伤口，再贴创可贴或纱布包扎；扭到脚或手腕要停止运动，用绷带固定、冷敷一下，别硬撑继续走。',
      '随身的小急救包里应该备几样必需品：创可贴、纱布绷带、碘伏棉棒（给伤口消毒）、风油精、医用胶布。出发前和爸爸妈妈一起检查一遍，万一需要时拿起来就能用。',
    ],
    quiz: {
      question: '被蚊虫叮咬后，正确的做法是？',
      choices: [
        { key: 'A', text: '用脏手使劲抓挠' },
        { key: 'B', text: '不管它，忍一忍就过去了' },
        { key: 'C', text: '涂风油精或炉甘石洗剂止痒' },
        { key: 'D', text: '用嘴巴吹吹就好' },
      ],
      answer: 'C',
      hint: '用脏手抓挠会感染，应该涂止痒药膏或炉甘石洗剂～',
    },
  },
  {
    id: 'weather',
    badgeId: 'safety-weather',
    title: '应对突发天气 · 防雷',
    subtitle: '雷雨天记住一个动作：蹲低抱膝低头',
    emoji: '⛈️',
    color: '#6B6B8A',
    slides: ['/safety/safety-16-weather.webp'],
    captions: ['应对突发天气 · 防雷安全 — 雷电来临时"蹲低、抱膝、低头"'],
    body: [
      '夏天雷阵雨常常突然而来。遇到雷电天气时，有几个"绝对不要"：不要躲在大树下（树容易遭雷击）、不要站在山顶或高地、不要举着金属物品（如伞、登山杖）站在空旷处、不要在水面附近逗留。',
      '正确的"防雷安全姿势"：立即蹲下，尽量蹲低，双手抱住膝盖，头埋低。这样身体与地面接触面积小而低矮，不容易被雷击中——记住口诀"蹲低、抱膝、低头"，危急时刻可以保护你。',
    ],
    quiz: {
      question: '雷雨天突然打雷，正确的应对动作是？',
      choices: [
        { key: 'A', text: '跑到最近的大树下躲雨' },
        { key: 'B', text: '立刻蹲低，抱膝低头' },
        { key: 'C', text: '撑着金属雨伞继续走路' },
        { key: 'D', text: '站在山顶挥动颜色鲜艳的衣服求救' },
      ],
      answer: 'B',
      hint: '记住口诀：蹲低、抱膝、低头。不要躲树下、不要爬高处！',
    },
  },
];

export function chapterById(id: string): SafetyChapter | undefined {
  return SAFETY_CHAPTERS.find((c) => c.id === id);
}

export function chapterCount(): number {
  return SAFETY_CHAPTERS.length;
}
