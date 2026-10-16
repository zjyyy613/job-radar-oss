/**
 * Job category taxonomy and deterministic title classification.
 *
 * Ported from the PRODUCT-03A offline analysis (`.verification/product03/classify.py`),
 * which was validated against the 472-row production title snapshot. The rule ORDER
 * is load-bearing and must not be rearranged without re-running the golden set in
 * `tests/radar/job-category.test.ts`:
 *
 *   1. Non-job postings are separated first and are never force-classified.
 *   2. Function head-nouns win over domain keywords, so "AI产品经理" is 产品 and
 *      "视觉策略设计师" is 设计 rather than being captured by 算法/视觉.
 *   3. 工程与制造 runs before 技术研发 and each rule carries a disqualifier, so
 *      "转向系统工程师" is a vehicle role while "软件开发工程师（机器人方向）" is
 *      still software.
 *   4. Advertising/sales words carry a technology disqualifier, so
 *      "广告算法工程师" is an algorithm role and "算法工程师（推广/搜索/广告方向）"
 *      is not captured by 商务拓展与销售.
 *   5. Substring collisions are guarded: "机器人事业部" must not match 人事.
 *
 * Properties this module guarantees:
 *   - pure and synchronous: no network, no model calls, no database, no randomness;
 *   - deterministic: the same title always yields the same category;
 *   - company-independent: no rule mentions a company or source name;
 *   - single-valued: every title gets exactly ONE primary (l1, l2) pair.
 *
 * `needJd` marks titles whose function cannot be settled from the title alone. Those
 * rows keep a tentative category but are surfaced as 「岗位类别待核实」 — this is a
 * classification caveat and must never be conflated with a qualification gate.
 */
export const CATEGORY_RULE_VERSION = "job-category-v1";

export interface CategoryDef {
  /** Stable id used in the `cat` / `sub` URL parameters. */
  id: string;
  label: string;
}

export interface JobCategory {
  /** Primary level-1 id, e.g. "tech". */
  l1: string;
  /** Primary level-2 id, e.g. "tech.algo". Always `${l1}.…`. */
  l2: string;
  /** Title alone is not conclusive; the category is tentative. */
  needJd: boolean;
  /** Id of the rule that decided the category, for traceability. */
  rule: string;
}

/** Level-1 categories, in canonical display order. */
export const CATEGORY_L1: readonly CategoryDef[] = [
  { id: "tech", label: "技术研发" },
  { id: "ops", label: "运营" },
  { id: "product", label: "产品" },
  { id: "design", label: "设计" },
  { id: "engineering", label: "工程与制造" },
  { id: "marketing", label: "市场与商务" },
  { id: "hr", label: "人力与行政" },
  { id: "finance", label: "金融与财务" },
  { id: "strategy", label: "战略与商业分析" },
  { id: "service", label: "服务与零售" },
  { id: "education", label: "教育" },
  { id: "other", label: "其他" },
];

/** Level-2 categories, in canonical order within each level-1. */
export const CATEGORY_L2: readonly CategoryDef[] = [
  { id: "tech.algo", label: "算法与AI" },
  { id: "tech.software", label: "软件开发" },
  { id: "tech.qa", label: "测试与质量" },
  { id: "tech.data", label: "数据与分析" },
  { id: "tech.security", label: "安全与隐私" },
  { id: "ops.product_user", label: "产品与用户运营" },
  { id: "ops.content", label: "内容与新媒体运营" },
  { id: "ops.business", label: "业务与策略运营" },
  { id: "ops.logistics", label: "供应链与物流运营" },
  { id: "product.pm", label: "产品经理" },
  { id: "product.project", label: "项目管理" },
  { id: "product.game_design", label: "游戏策划" },
  { id: "design.visual", label: "视觉与品牌设计" },
  { id: "design.ux", label: "交互与体验设计" },
  { id: "design.uxr", label: "用户研究" },
  { id: "design.game_art", label: "游戏美术" },
  { id: "design.video", label: "内容与视频制作" },
  { id: "engineering.mech", label: "机械与结构" },
  { id: "engineering.auto", label: "汽车与整车" },
  { id: "engineering.elec", label: "电气与电子" },
  { id: "engineering.quality", label: "工艺与质量" },
  { id: "engineering.robot", label: "机器人与自动化" },
  { id: "engineering.supply", label: "供应链与采购" },
  { id: "engineering.civil", label: "土建与测绘" },
  { id: "engineering.biomed", label: "生物医学与健康" },
  { id: "marketing.mkt", label: "市场营销" },
  { id: "marketing.sales", label: "商务拓展与销售" },
  { id: "marketing.presolve", label: "售前与解决方案" },
  { id: "hr.recruit", label: "人力资源" },
  { id: "hr.admin", label: "行政与公共事务" },
  { id: "hr.legal", label: "法务与合规" },
  { id: "finance.invest", label: "投资与金融" },
  { id: "finance.accounting", label: "财务与会计" },
  { id: "strategy.strategy", label: "战略" },
  { id: "strategy.biz_analysis", label: "商业分析" },
  { id: "service.blue_collar", label: "生产与蓝领" },
  { id: "service.store", label: "门店与服务" },
  { id: "service.logistics", label: "物流与配送" },
  { id: "education.teaching", label: "教学与教研" },
  { id: "other.unknown", label: "未分类" },
  { id: "other.announcement", label: "非岗位公告" },
];

/** Postings that are not vacancies: announcements, briefings, job fairs. */
const NON_JOB: readonly { l2: string; match: RegExp }[] = [
  { l2: "other.announcement", match: /招聘公告|校园招聘公告|宣讲会|双选会|招聘简章|招聘启事$/ },
];

interface Rule {
  l1: string;
  l2: string;
  match: RegExp;
  /** Vetoes the rule even when `match` hits. */
  disallow?: RegExp;
}

/** Ordered rules — FIRST MATCH WINS. */
const RULES: readonly Rule[] = [
  // 法务与合规 before 技术: "专利工程师" must not become an engineer.
  { l1: "hr", l2: "hr.legal", match: /法务|合规|律师|知识产权|专利|版权|法律|商标/, disallow: /隐私计算|密码技术/ },
  // It is 人力与行政, so "机器人事业部" must not be read as 人事.
  { l1: "hr", l2: "hr.recruit", match: /(?<!机器)人事|招聘|HR|人力资源|COE|绩效|薪酬|组织发展|员工关系|生态用工/ },
  { l1: "hr", l2: "hr.admin", match: /行政|秘书|设施设备|对外事务|公共事务|政策研究|政府关系/, disallow: /运营|产品/ },
  // 设计 before 技术: visual / experience / art roles.
  { l1: "design", l2: "design.game_art", match: /技术美术|游戏3D|角色美术|游戏美术|美术设计/ },
  { l1: "design", l2: "design.ux", match: /交互设计|体验设计|UI设计|产品体验设计|AI对话体验|用户体验/, disallow: /运营/ },
  { l1: "design", l2: "design.uxr", match: /用户研究|用研/ },
  { l1: "design", l2: "design.visual", match: /视觉设计|视觉策略|品牌设计|平面设计|创意设计|原画|动效|CMF|ID设计|GUI|影像效果设计|设计师|美学/ },
  { l1: "design", l2: "design.video", match: /视频剪辑|视频摄像|短视频制作|内容创意|内容制作/ },
  // 游戏策划 before 运营 so "运营策划" is design work, and 活动策划 stays 市场.
  { l1: "product", l2: "product.game_design", match: /战斗策划|系统策划|数值策划|关卡策划|剧情策划|外观策划|海外策划|运营策划|游戏.{0,4}策划/, disallow: /活动/ },
  { l1: "strategy", l2: "strategy.strategy", match: /战略/ },
  { l1: "strategy", l2: "strategy.biz_analysis", match: /商业分析|商分|业务增长|经营分析|Category Performance|管培/ },
  // 产品 before 技术: "AI产品经理" is a product role.
  { l1: "product", l2: "product.pm", match: /产品经理|产品专家|产品策划|产品助理|产品项目助理|产品实习|产品布道|硬件产品|产品设计实习/, disallow: /运营/ },
  { l1: "product", l2: "product.project", match: /项目管理|项目经理|PMO|项目实习生|项目运营/ },
  {
    l1: "finance",
    l2: "finance.invest",
    match: /投资分析|金融|保险|信贷|风控|支付|理财|信控|金融BP|Finance/,
    disallow: /研究型实习生|算法|大模型|模型|Agent|智能体|\bRL\b|全栈|开发/,
  },
  {
    l1: "finance",
    l2: "finance.accounting",
    match: /财务|会计|审计|税务|结算/,
    disallow: /研究型实习生|算法|大模型|模型|Agent|智能体|\bRL\b|全栈|开发/,
  },
  // 产品运营 belongs to 运营, and is matched before the generic 运营 rule below.
  { l1: "ops", l2: "ops.product_user", match: /产品运营|用户运营|社区运营|会员运营|客户运营|用户增长|乐生活用户|客服|客户体验|服务体验/ },
  { l1: "ops", l2: "ops.content", match: /内容运营|内容策略|新媒体|自媒体|UGC|直播运营|短视频品类|内容素材/ },
  { l1: "ops", l2: "ops.logistics", match: /物流|仓\/场地|运力|调度/, disallow: /采购|供应管理/ },
  { l1: "ops", l2: "ops.business", match: /运营|Operations Manager|Operation Manager|供给|补贴/ },
  { l1: "marketing", l2: "marketing.presolve", match: /解决方案|售前|行业咨询|合作商管理|KA/ },
  // Sales/marketing words carry a technology disqualifier: "广告算法工程师" is an
  // algorithm role, not marketing.
  {
    l1: "marketing",
    l2: "marketing.sales",
    match: /商务|销售|大客户|渠道|门店督导|店长|推广|拓展/,
    disallow: /算法|大模型|模型|智能体|Agent|开发|工程师/,
  },
  {
    l1: "marketing",
    l2: "marketing.mkt",
    match: /市场营销|市场部|市场内容|内容营销|品牌营销|品牌运营|营销|媒介|广告|活动策划|社媒/,
    disallow: /算法|大模型|模型|智能体|Agent|开发|工程师/,
  },
  // 工程与制造 before 技术: needs an explicit engineering domain noun, and each
  // rule refuses software/algorithm roles.
  { l1: "engineering", l2: "engineering.mech", match: /机械|结构|模具|CAE|仿真|白车身|油泥|材料|冲压/, disallow: /软件|算法|数据/ },
  { l1: "engineering", l2: "engineering.auto", match: /整车|制动|转向|电控集成|座舱|车载|增程器|行人保护/, disallow: /软件|算法|数据/ },
  {
    l1: "engineering",
    l2: "engineering.elec",
    match: /电气|电子|电声|光学|射频|传感器|器件|硬件|可靠性|通信|充电网络|充电宝/,
    disallow: /软件|算法|数据|运营|智能|具身|供应管理|采购/,
  },
  { l1: "engineering", l2: "engineering.quality", match: /工艺|品质|质量|检验|检测|制程/ },
  {
    l1: "engineering",
    l2: "engineering.robot",
    match: /机器人|自动化|机械手|运控|无人机/,
    disallow: /算法|模型|智能体|具身|软件|开发|数据/,
  },
  { l1: "engineering", l2: "engineering.civil", match: /施工|测量|土木|建筑|测绘|监理|造价/ },
  { l1: "engineering", l2: "engineering.biomed", match: /生物医学|医疗器械|临床/ },
  { l1: "engineering", l2: "engineering.supply", match: /采购|供应链|供应管理|生产管理/ },
  // 技术研发.
  { l1: "tech", l2: "tech.qa", match: /测试开发|软件测试|测试工程师|QA|自动驾驶QA|客户端测试/ },
  {
    l1: "tech",
    l2: "tech.software",
    match: /全栈|后端|前端|客户端开发|游戏客户端|游戏引擎|后台开发|应用开发|系统工程师|嵌入式|驱动工程师|架构师|运维|Infra|网络库|存储工程师|并行文件|图数据库|CDN|平台开发|服务端|软件工程师/,
  },
  {
    l1: "tech",
    l2: "tech.algo",
    match: /算法|大模型|模型|智能体|Agent|AIGC|多模态|具身|机器学习|神经网络|语音|SLAM|GNSS|定位|推理|训推|评测|基准|训练|扩散|世界模型|数据智能|全同态|密码技术|隐私计算|生物信息|研究型实习生|RSI|强化学习|\bRL\b|\bAI\b|AI/,
  },
  { l1: "tech", l2: "tech.security", match: /安全工程师|终端安全|攻防|安全隐私|安全算法/ },
  { l1: "tech", l2: "tech.software", match: /开发|研发|软件|架构|技术支持|数据开发|C\+\+|终端工程师|技术研究/ },
  { l1: "tech", l2: "tech.data", match: /数据分析|数据科学|数据科学家|数据工程|数据标注|数据管线|数据系统/ },
  { l1: "service", l2: "service.blue_collar", match: /学徒|操作工|普工|技工/ },
  { l1: "service", l2: "service.store", match: /服务员|护理|护士|烹饪|后厨|餐饮|保洁/ },
  { l1: "service", l2: "service.logistics", match: /快递|配送|派送/ },
  { l1: "education", l2: "education.teaching", match: /主讲|教师|讲师|教研|助教|课程/ },
];

/**
 * Titles whose function cannot be settled from the title alone: a company-specific
 * role name, or a bare noun that could be several functions. They keep a tentative
 * category and are marked 「岗位类别待核实」 instead of being guessed at.
 */
const NEEDS_JD: readonly RegExp[] = [
  /^产品专家实习生/,
  /^销售产品实习生/,
  /^产品布道师/,
  /^穿戴机器人-硬件产品/,
  /^设计数据工程师/,
  /^时空实验室实习生/,
  /^WF Business/,
  /^Nonfood/,
  /^共享出行海外服务体验/,
  /^客户体验提升$/,
  /^物流产品服务$/,
  /^产品策划经理/,
  /^战略文案经理/,
  /^安全隐私标准工程师/,
  /^智能数据科学家/,
  /^模型基准和评估$/,
  /^AI美学工程师/,
  /^AI 工程师/,
  /^(平台|商家|服务|销售|客服|广告|物流|渠道)运营$/,
  /^解决方案$/,
  /^商务支持$/,
  /^商业分析$/,
  /^行政$/,
  /^战略$/,
  /^绩效策略$/,
];

const L1_BY_ID = new Map(CATEGORY_L1.map((c) => [c.id, c]));
const L2_BY_ID = new Map(CATEGORY_L2.map((c) => [c.id, c]));

function needsJd(title: string): boolean {
  return NEEDS_JD.some((pattern) => pattern.test(title));
}

/**
 * Titles repeat heavily across a snapshot, and every render classifies the whole
 * list twice (once for the list, once for facet counts), so keep a bounded cache.
 * The function stays pure: same title in, same category out.
 */
const CACHE = new Map<string, JobCategory>();
const CACHE_LIMIT = 4000;

function classify(trimmed: string): JobCategory {
  for (const rule of NON_JOB) {
    if (rule.match.test(trimmed)) {
      return { l1: "other", l2: rule.l2, needJd: false, rule: rule.l2 };
    }
  }
  for (const rule of RULES) {
    if (rule.match.test(trimmed) && !(rule.disallow?.test(trimmed) ?? false)) {
      return { l1: rule.l1, l2: rule.l2, needJd: needsJd(trimmed), rule: rule.l2 };
    }
  }
  return { l1: "other", l2: "other.unknown", needJd: needsJd(trimmed), rule: "other.unknown" };
}

/** Classify one job title. Pure, deterministic, exactly one primary category. */
export function categorizeTitle(title: string): JobCategory {
  const trimmed = title ?? "";
  const cached = CACHE.get(trimmed);
  if (cached) return cached;
  const result = classify(trimmed);
  if (CACHE.size >= CACHE_LIMIT) CACHE.clear();
  CACHE.set(trimmed, result);
  return result;
}

export interface CategoryCounts {
  byL1: Record<string, number>;
  byL2: Record<string, number>;
  /** Titles whose category is tentative, grouped by level-2 id. */
  tentativeByL2: Record<string, number>;
}

/** Count jobs per category from the real titles — never from a stored snapshot. */
export function countCategories(titles: readonly string[]): CategoryCounts {
  const byL1: Record<string, number> = {};
  const byL2: Record<string, number> = {};
  const tentativeByL2: Record<string, number> = {};
  for (const title of titles) {
    const category = categorizeTitle(title);
    byL1[category.l1] = (byL1[category.l1] ?? 0) + 1;
    byL2[category.l2] = (byL2[category.l2] ?? 0) + 1;
    if (category.needJd) {
      tentativeByL2[category.l2] = (tentativeByL2[category.l2] ?? 0) + 1;
    }
  }
  return { byL1, byL2, tentativeByL2 };
}

export function isLevel1(id: string): boolean {
  return L1_BY_ID.has(id);
}

export function isCategoryId(id: string): boolean {
  return L2_BY_ID.has(id);
}

export function level1Label(id: string): string {
  return L1_BY_ID.get(id)?.label ?? "";
}

export function categoryLabel(id: string): string {
  return L2_BY_ID.get(id)?.label ?? "";
}

export function parentOf(l2: string): string {
  return l2.split(".")[0] ?? "";
}

/** Level-2 categories of a level-1, in canonical order. */
export function childrenOf(l1: string): readonly CategoryDef[] {
  return CATEGORY_L2.filter((c) => parentOf(c.id) === l1);
}

/**
 * Validate a `cat` / `sub` pair from the URL (including stale links) and downgrade
 * anything inconsistent instead of rendering a broken state.
 */
export function resolveCategoryFilter(cat: string, sub: string): { cat: string; sub: string } {
  const level1 = isLevel1(cat) ? cat : "";
  if (!sub) return { cat: level1, sub: "" };
  if (!isCategoryId(sub)) return { cat: level1, sub: "" };
  const parent = parentOf(sub);
  if (level1 && parent !== level1) return { cat: level1, sub: "" };
  return { cat: parent, sub };
}

/** True when the category is the "not a vacancy" bucket. */
export function isAnnouncement(l2: string): boolean {
  return l2 === "other.announcement";
}

export function describeCategory(category: JobCategory): string {
  return [level1Label(category.l1), categoryLabel(category.l2)].filter(Boolean).join(" · ");
}
