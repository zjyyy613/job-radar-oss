import { expect, it } from "vitest";
import {
  CATEGORY_L1,
  CATEGORY_L2,
  CATEGORY_RULE_VERSION,
  categorizeTitle,
  categoryLabel,
  childrenOf,
  isAnnouncement,
  isCategoryId,
  isLevel1,
  level1Label,
  parentOf,
  resolveCategoryFilter,
} from "../../src/lib/radar/job-category";

/**
 * Golden set for the title classifier. Every case is a real title from the
 * 2026-10-16 production snapshot, taken from the PRODUCT-03A verification set
 * (20 reproducible random rows + 20 deliberately hard rows) plus the specific
 * collision cases the review called out. The titles are embedded as literals on
 * purpose: the implementation must not depend on the uncommitted analysis files.
 */
it.each([
  // --- AI must not capture product / operations / design functions -------------
  ["AI研究员（内容生成推荐智能体）", "tech", "tech.algo", false],
  ["高级AI研究员（AI智能体）-博士", "tech", "tech.algo", false],
  ["互联网产品经理（AI Coding方向）", "product", "product.pm", false],
  ["AI产品经理", "product", "product.pm", false],
  ["AI 产品设计师-实习", "design", "design.visual", false],
  ["AI产品策划实习生（游戏AI 竞技机器人方向）", "product", "product.pm", false],
  ["AI对话体验设计实习生", "design", "design.ux", false],
  ["千问办公-AI产品运营实习生", "ops", "ops.product_user", false],
  ["行政系统产品运营实习生（AI方向）", "ops", "ops.product_user", false],
  ["AI 技术美术实习生", "design", "design.game_art", false],
  ["财务科技-AI全栈实习生", "tech", "tech.software", false],
  ["AI 工程师（实习生）", "tech", "tech.algo", true],
  // --- sales / marketing words must not capture algorithm roles ---------------
  ["【快Star实习】广告算法工程师-电商模型", "tech", "tech.algo", false],
  ["【快Star实习】广告算法工程师-外循环召回", "tech", "tech.algo", false],
  ["算法工程师 （推广/搜索/广告方向）", "tech", "tech.algo", false],
  ["市场营销实习生（活动方向）", "marketing", "marketing.mkt", false],
  ["游戏市场营销实习生（光遇）", "marketing", "marketing.mkt", false],
  // --- sales / business must not be filed as product --------------------------
  ["CSIG技术产品商务培训生", "marketing", "marketing.sales", false],
  ["大客户销售", "marketing", "marketing.sales", false],
  ["产品专家实习生-四川攀枝花", "product", "product.pm", true],
  ["销售产品实习生-乌鲁木齐", "product", "product.pm", true],
  ["产品布道师", "product", "product.pm", true],
  // --- legal / IP, not engineering -------------------------------------------
  ["专利工程师", "hr", "hr.legal", false],
  ["知识产权律师", "hr", "hr.legal", false],
  ["法务", "hr", "hr.legal", false],
  ["合规", "hr", "hr.legal", false],
  ["网易曲库版权实习生", "hr", "hr.legal", false],
  ["隐私计算与密码技术", "tech", "tech.algo", false],
  // --- mechanical vs software structure -------------------------------------
  ["结构工程师（机器人方向）-实习", "engineering", "engineering.mech", false],
  ["结构耐撞仿真工程师-北京", "engineering", "engineering.mech", false],
  ["机械工程师", "engineering", "engineering.mech", false],
  ["CAE工程师", "engineering", "engineering.mech", false],
  ["转向系统工程师-上海", "engineering", "engineering.auto", false],
  ["制动电控集成工程师-上海", "engineering", "engineering.auto", false],
  ["整车防腐开发工程师", "engineering", "engineering.auto", false],
  ["增程器本体开发工程师-上海", "engineering", "engineering.auto", false],
  ["行人保护工程师-北京", "engineering", "engineering.auto", false],
  ["系统工程师", "tech", "tech.software", false],
  ["软件开发工程师（机器人方向）-实习", "tech", "tech.software", false],
  ["无人机仿真软件研发实习生", "tech", "tech.software", false],
  ["系统开发工程师（机器人方向）-实习", "tech", "tech.software", false],
  ["机器人运控技术规划工程师-实习", "engineering", "engineering.robot", false],
  ["激光SLAM算法实习生", "tech", "tech.algo", false],
  ["智能安全工程师 - 主被动安全算法开发-北京", "tech", "tech.algo", false],
  ["可靠性工程师", "engineering", "engineering.elec", false],
  // --- robot division collision guard ----------------------------------------
  ["顶尖实习-具身大模型算法研究员-机器人事业部-实习", "tech", "tech.algo", false],
  ["机器人事业部-人力资源实习生", "hr", "hr.recruit", false],
  ["人事运营", "hr", "hr.recruit", false],
  ["招聘实习生", "hr", "hr.recruit", false],
  // --- research roles keep their technical home ------------------------------
  ["研究型实习生-金融领域Agentic数据生产与RL环境研究探索", "tech", "tech.algo", false],
  ["信贷事业群-风控大模型算法实习生", "tech", "tech.algo", false],
  ["蚂蚁技术研究院长期研究型实习生-深度学习/扩散语言模型方向", "tech", "tech.algo", false],
  ["金融风控", "finance", "finance.invest", false],
  ["投资分析(技术方向)", "finance", "finance.invest", false],
  // --- user research vs experience design vs product research ----------------
  ["用户研究", "design", "design.uxr", false],
  ["用户研究经理（电商方向）-实习", "design", "design.uxr", false],
  ["用户体验实习生", "design", "design.ux", false],
  ["用户体验运营", "ops", "ops.business", false],
  ["创新体验工程师（机器人方向）-实习", "engineering", "engineering.robot", false],
  ["产品体验设计师（UI设计）", "design", "design.ux", false],
  // --- game design ------------------------------------------------------------
  ["【留用实习】游戏外观策划", "product", "product.game_design", false],
  ["战斗策划实习生（王牌竞速）", "product", "product.game_design", false],
  ["系统策划实习生（在研项目）", "product", "product.game_design", false],
  ["游戏运营策划实习生（永劫无间）", "product", "product.game_design", false],
  ["灵犀互娱-海外策划实习生（海外休闲）", "product", "product.game_design", false],
  ["虎鲸文娱-鲸英班-创作者活动策划实习生", "marketing", "marketing.mkt", false],
  // --- operations -------------------------------------------------------------
  ["产品运营", "ops", "ops.product_user", false],
  ["Product Operation Manager", "ops", "ops.business", false],
  ["内容运营实习生", "ops", "ops.content", false],
  ["策略运营实习生", "ops", "ops.business", false],
  ["物流运营", "ops", "ops.logistics", true],
  ["间接采购实习生", "engineering", "engineering.supply", false],
  // --- non-vacancy postings are never force-classified -----------------------
  ["中国银行股份有限公司2027年全球校园招聘公告", "other", "other.announcement", false],
  ["时空实验室实习生", "other", "other.unknown", true],
  // --- thin but real categories stay reachable -------------------------------
  ["制袋学徒", "service", "service.blue_collar", false],
  ["生物医学工程师", "engineering", "engineering.biomed", false],
  ["高级传感器工程师（健康方向）-博士", "engineering", "engineering.elec", false],
] as const)("classifies %s -> %s / %s (needJd=%s)", (title, l1, l2, needJd) => {
  const result = categorizeTitle(title);
  expect(result.l1).toBe(l1);
  expect(result.l2).toBe(l2);
  expect(result.needJd).toBe(needJd);
  expect(result.l2.startsWith(`${result.l1}.`)).toBe(true);
});

it("is deterministic and company-independent", () => {
  const title = "AI产品经理";
  expect(categorizeTitle(title)).toEqual(categorizeTitle(title));
  // The same title is classified identically no matter which company posts it:
  // the classifier takes only a title, so there is no company input to vary.
  expect(categorizeTitle("招聘实习生").l2).toBe("hr.recruit");
  expect(CATEGORY_RULE_VERSION).toBe("job-category-v1");
});

it("always returns exactly one declared primary category", () => {
  const titles = ["", "   ", "??", "招聘", "实习生", "工程师", "2027届校园招聘", "AI", "运营"];
  for (const title of titles) {
    const { l1, l2 } = categorizeTitle(title);
    expect(isLevel1(l1)).toBe(true);
    expect(isCategoryId(l2)).toBe(true);
    expect(parentOf(l2)).toBe(l1);
  }
});

it("keeps the taxonomy internally consistent", () => {
  const l1Ids = CATEGORY_L1.map((c) => c.id);
  const l2Ids = CATEGORY_L2.map((c) => c.id);
  expect(new Set(l1Ids).size).toBe(l1Ids.length);
  expect(new Set(l2Ids).size).toBe(l2Ids.length);
  for (const l2 of CATEGORY_L2) {
    expect(l1Ids).toContain(parentOf(l2.id));
  }
  const grouped = CATEGORY_L2.reduce<Record<string, number>>((acc, c) => {
    const l1 = parentOf(c.id);
    acc[l1] = (acc[l1] ?? 0) + 1;
    return acc;
  }, {});
  for (const l1 of CATEGORY_L1) {
    expect(childrenOf(l1.id)).toHaveLength(grouped[l1.id] ?? 0);
  }
  expect(level1Label("tech")).toBe("技术研发");
  expect(categoryLabel("tech.algo")).toBe("算法与AI");
  expect(isAnnouncement("other.announcement")).toBe(true);
  expect(isAnnouncement("other.unknown")).toBe(false);
});

it("recovers from stale or inconsistent category URLs", () => {
  expect(resolveCategoryFilter("tech", "tech.algo")).toEqual({ cat: "tech", sub: "tech.algo" });
  expect(resolveCategoryFilter("tech", "")).toEqual({ cat: "tech", sub: "" });
  expect(resolveCategoryFilter("", "tech.algo")).toEqual({ cat: "tech", sub: "tech.algo" });
  // level-2 that does not belong to the level-1 -> keep the level-1 only
  expect(resolveCategoryFilter("product", "tech.algo")).toEqual({ cat: "product", sub: "" });
  // unknown ids -> cleared instead of rendering a broken state
  expect(resolveCategoryFilter("nope", "nope.nope")).toEqual({ cat: "", sub: "" });
  expect(resolveCategoryFilter("tech", "tech.nope")).toEqual({ cat: "tech", sub: "" });
});
