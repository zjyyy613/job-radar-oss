# Job Radar Visual Reference Study

研究日期：2026-09-30。范围：`hallmark study` 诊断；不生成 UI，不修改代码、DESIGN.md、冻结 IA 或 M0/M1 边界。以下建议不是实施授权。

**核心判断：保持现有 Browse / Inspect / Full Detail，优先改善横向扫描位置、搜索层级、少量品牌识别色，以及条件与证据的邻近关系。成熟感来自任务关系清楚，不来自更多装饰。**

证据完整性：当前 Inspect、用户补充的最佳视觉参考图、Linear / Raycast / Vercel 官方公开产品参考与 DESIGN.md 均已纳入。用户图是视觉参考，不是功能规格、真实数据证明或新的 IA；外部产品仍以此前已核验的官方公开资料为依据，并非本轮重新登录实测。

参考来源（2026-09-30 核验）：

| 编号 | 输入 / 来源 | 可观察范围与限制 |
| --- | --- | --- |
| J | [当前真实 Desktop Inspect](../reports/assets/task7-refinement-v2/desktop-inspect.png) | 1600×1000，真实岗位与本科 Profile；图像可判断节奏，不能从静态图断言交互性能 |
| U | 用户附件 `codex-clipboard-063fce99-759c-4bce-b259-f3a656ad8bc2.png` | 已观察 1536×1024 图像；原路径 `C:/Users/zhang/AppData/Local/Temp/codex-clipboard-063fce99-759c-4bce-b259-f3a656ad8bc2.png`。不验证图中岗位、计数、Profile 或状态真实性；临时路径可能失效 |
| L | [Linear Peek](https://linear.app/docs/peek)、[Display options](https://linear.app/docs/display-options)、[Search](https://linear.app/docs/search) | 当前公开文档及其嵌入产品图；Peek 图为列表上方浮层，不能冒称其为固定 split-view，也未看到完整 Sidebar。不是登录态实测 |
| R | [Raycast 当前 Manual 产品图](https://manual.raycast.com/)、[Search Bar](https://manual.raycast.com/search-bar) | 观察 Root Search 产品窗口，不把外围文档导航、营销插图当产品 UI；未操作原生 app |
| V | [Vercel 当前 Dashboard 导航发布记录](https://vercel.com/changelog/dashboard-navigation-redesign-rollout) | 2026-02-26 默认上线的 Sidebar 结构及浅色产品图；本次可访问的官方证据，不保证覆盖全部账户后续灰度。未登录 Dashboard |
| D | [DESIGN.md](../../DESIGN.md) | 产品设计基线，精确 token 来自此文件，不从外部截图反推 |

方法：采用 Hallmark 的 Surface → Type → Structure → Motion → Rhythm 逐参考研究，再做 Job Radar 适配。外部产品图按 image mode 分析，字体只判断角色，不猜具体字体/字号/hex；静态图不推断动画。官方文字只补充交互事实。用 Index-First 作为最接近的结构词，但它不是新 IA；hero / pitch / testimonial / footer 对工作台不适用。没有选用 Hallmark theme，也不输出新的 portable design system。

## Borrow

### 1. 当前真实 Job Radar Inspect：保留工作上下文

**观察。** 左侧 Sidebar、上方搜索、列表、右侧详情已经构成清楚的工作台。列表标题优先，公司/地点退后；选中 vivo 行通过底色与细竖线关联右侧同名岗位。右侧 graphite 投递按钮最醒目，资格异常用克制文字表达，原文以引文线区分。所有基础内容位于浅色中性 surface，没有卡片墙。

**机制。** 列表保存“我从哪里来”，详情解决“为什么符合或不符合”；选中态承担两者的关联。这个关系比复制某个品牌的圆角更有价值。现有 evidence-first 路径和本地 Profile 即时判断应继续成为差异化，而不是被“高级感”遮住。

**诊断。** 左列大部分信息堆在每行左上，右半侧主要只剩箭头；一眼比较地点、公司时，需要上下读小段文本。右侧“岗位预览”条、岗位头部、资格结论、明确要求之间的分隔与留白接近，层级容易读成几个并列组件。灰度 logo 虽一致，却消除了部分品牌快速识别线索。这些是本图观察，不是性能或用户研究结果。

### 2. Linear：位置稳定比信息堆满更重要

**观察。** 官方 Peek 图中，列表的属性沿横向排布，次要属性降低对比；预览先展示标题，再给上下文。文档确认 Peek 可在不进入完整条目时检查内容，Display options 则区分“显示哪些属性”和“过滤哪些对象”。[来源 L](https://linear.app/docs/peek)

**可借机制。** 同一信息角色占据可预测位置，用户不必每行重新寻找。预览保留当前集合，避免为了判断一个条目丢掉比较上下文。复制的是这一原则，不是标签数量、键盘绑定或浮层形态。

**适用性边界。** 图中 Sidebar 不完整，不能据此声称观察了 Linear 全局导航尺寸。Search 文档把全局搜索放在 Sidebar；Job Radar 的主要任务就是找岗位，入口权重应结合自身任务，不照搬这个位置。[Search](https://linear.app/docs/search)

### 3. Raycast：搜索主导，彩色图标做身份锚点

**观察。** Root Search 产品图把一个搜索输入置于内容顶部；结果采用图标、主名称、低对比附属描述及右侧类型的横向组织。彩色 app 图标面积小，周围仍是中性 surface；当前行用连续底色定位。官方说明搜索是统一入口。[来源 R](https://manual.raycast.com/search-bar)

**可借机制。** 搜索不需要 hero 大小就能成为主要入口：位置先于结果、宽度充分、输入边界清楚，其他操作退后。小面积品牌色帮助快速认出对象，不承担任务状态。左主右次的行结构可减少逐段阅读。

**适用性边界。** 原生启动器行内容短；Job Radar 有长中文职位、多地点和资格异常，不能复制其单行高度。截图不能证明彩色图标一定更快，适配仍需以后用真实岗位验证。

### 4. Vercel：导航是框架，阅读内容才是 surface 主角

**观察。** 2026 官方发布记录说明横向导航迁入可调整、可隐藏的 Sidebar。浅色产品图用低对比导航背景、清楚的当前入口和更亮的内容区域建立层次；标题、局部导航和正文并非同一层。研究对象是图里的 Dashboard，不是外层 Changelog 页面。[来源 V](https://vercel.com/changelog/dashboard-navigation-redesign-rollout)

**可借机制。** 用背景层级表达“全局位置 / 当前对象 / 对象内容”，不用每个区块都画厚边框。导航选中可见，但不与主操作竞争。我们只需借层级，不需要复制其全部基础设施导航。

### 5. Hallmark study 结构化摘要

以下是逐图 diagnosis 的字段摘要；没有将多个参考熔成一套新主题。精确外部字体与色值均 unknown；motion 均 not-visible。

| 输入 | Macrostructure / archetypes | Surface / accent | Type roles | Rhythm / confidence |
| --- | --- | --- | --- | --- |
| J | Index-First 近似；Sidebar + result rows + reading pane；无 hero/footer | 浅暖中性、graphite 主动作、少量砖红异常 | 中性 sans，标题/正文/meta 用大小与字重分级 | 左侧重复纵向段落，右侧较宽松；图像判断高置信 |
| U | 三区工作台：导航 + 横向列表 + 详情阅读面；Index-First 近似 | 浅暖中性、彩色品牌图标、少量但明显的状态色 | sans 字重分层、稳定主次基线；具体字体 unknown | 列表紧凑重复、详情局部展开形成节奏；静态视觉可见，交互未验证 |
| L | 紧凑列表 + 临时预览；不是固定双栏 | 暗中性工作面，少量属性色；图片外部有装饰背景 | 中性 sans 标题/正文，低对比属性 | 列表密集、预览相对舒展；仅局部界面可见 |
| R | 搜索 + command/result list；无产品 Sidebar | 暗中性、小面积多色身份图标、低差选中 | 同类 sans 主次分工，右侧类型弱化 | 紧凑重复横行；截图可判断，原生交互未测 |
| V | Sidebar + 当前对象内容面；工作台而非 KPI 模板 | 浅中性壳层与明亮内容区 | sans 小标题、局部导航、正文分层 | 导航紧凑、主体舒展；公开图局部可见 |

## Do Not Borrow

| 来源 | 不借鉴的表层或机制 | 对 Job Radar 的原因 |
| --- | --- | --- |
| 当前 J | 把每行继续当三四行“小文章”；所有详情分区用近似间距与线条 | 空间虽干净但横向比较慢，条件与证据关系不够紧密；不应只靠进一步压缩字号解决 |
| 用户 U | Saved、收藏星标、行复选框、更多操作、自定义视图及计数、头像账户区、补全资料收益卡 | 超出本轮冻结 Task 7 范围；即使产品后续可能包含，也不因出现在参考图中提前实现 |
| 用户 U | 公司/实习类型/发布时间等新增筛选、筛选 chip、多 tab 详情、⌘K 提示 | 图示不构成功能授权；保留当前搜索/地点/资格/排序和 Peek → Full Detail，不暗示未实现快捷键 |
| 用户 U | 约 48px 大 logo 列、深蓝文字体系、整片暖黄提醒、每项绿色圆勾和“符合”药丸、招聘中绿点 | 保留小图标与 graphite 基线；正向资格安静，不复制 traffic-light 表达或增加徽章密度 |
| 用户 U | 128 岗位、相对发布时间、2 小时前验证、5 个条件、公司/岗位与 Profile 示例 | 未经真实数据核实，不得迁入融合图作为产品事实；收录时间不能改称发布时间 |
| Linear | 多种彩色状态、标签胶囊、项目/周期/负责人等属性体系；Space-only Peek；图片周边紫色装饰 | Job Radar 冻结字段少，列表正向资格应安静；既有 click→Peek 与移动详情不能改变 |
| Raycast | 黑色半透明 launcher 外壳、壁纸、AI 入口、Action Panel、全局快捷命令、极短单行行高 | 这些属于另一种产品和 IA；彩色身份标识不等于接受 glass 或新功能 |
| Vercel | 团队/项目切换、多级导航、发布状态点、部署统计卡、移动浮动底栏 | 不属于 M0；部署 Ready 也不能套用为岗位 Eligible 的显眼绿色状态 |
| Hallmark 通用默认 | 轮换 theme、hero 类型、结构多样性、装饰动效、自动 build/redesign、生成新 design.md | 用户已冻结 IA 和设计基线；此次只有 study 授权，通用生成协议不适用 |

不新增 UI score / match score，不将“配色更多”作为成熟度指标。品牌色不用于选中、资格、来源可靠性；公司图标不能替代 Source 文本，也不能暗示官方认证。未知资格仍必须“待确认”，不能因为视觉精简而隐藏。

不从静态产品图推断字体品牌、确切 token、动画时长、可访问性合规或真实操作性能。网站文档外围的大标题、营销配图与页脚都不作为工作台参考。

## Job Radar Adaptation

### 1. 信息扫描与 JobRow 横向组织

研究建议：同一 row 内形成稳定的信息轨道，而非增加字段。宽桌面优先让“标题 + 公司”成为主要身份区，“地点”成为可比较的次级区，“收录时间 / 最高价值异常”有稳定次级位置。公司 logo 继续位于公司名前，不移动到巨大的独立首列。标题仍最醒目。

这不是将 Radar 改成新表格 IA，也不新增列配置。Peek 打开、长中文标题或多地点导致可用宽度不足时，回到现有紧凑多行结构；不要为整齐截掉唯一异常提示，或把地点与日期硬挤成不可读小字。密度衡量应是“能比较多少真实岗位”，不只是“屏幕装了几行”。

评审方法（未来实施才执行）：用现有长银行标题、腾讯多地点和 vivo 异常行，检查用户能否沿固定位置比较公司/地点，再决定是否读取资格信号；保留移动触控目标。此研究不承诺未经测试的最优行高或百分比。

### 2. Sidebar 与搜索主入口

Sidebar 只负责 Radar / Profile 定位，不用填满空白来证明产品丰富。借 Vercel 的壳层分工，保留 DESIGN Sidebar 背景与低权重导航；不能弱到焦点或当前页面不可识别。两项导航不需要新增分组、头像、团队切换。

借 Raycast 的搜索优先级：搜索先被看见、先被理解为可输入；筛选和排序为从属动作。当前虽然搜索占宽，但整条同质工具区容易把它读成几个平级表单。可研究通过输入区域的 surface、内边距与对比层次强化入口，仍用既有中性 token；不把搜索挪到 Sidebar，不加入 command palette，也不新增宣传语。弱化的是装饰标签，不是无障碍名称。

### 3. 彩色公司 Logo：允许身份色，不扩张语义色

建议以后对比“原始品牌色的小图标”和当前灰度版本，优先测试保留原始颜色。理由来自 Raycast：中性环境里的少量身份色有助于辨识对象，未必破坏 Calm Precision。

具体适配边界：保持现有 16–20px 视觉图形和统一中性轻底；颜色只存在于 logo 资产内部，容器、row、公司文字不随品牌染色。不叠加饱和滤镜，不把不同长宽比 logo 拉伸，不为未知公司猜图标。不要求每家公司都多彩；缺失/错误仍统一首字符 fallback。公司名必须独立可读。

这是研究建议，不修改现有 grayscale，也不是授权重新下载一套商标。品牌色与 muted ochre / brick red 的资格表达明确分开；小米橙、品牌红不代表 Check 或 Blocked。

### 4. Selected row 与 list/detail relationship

选中态最重要的是“这行对应右边这个岗位”，而不是制造一张新卡片。保留全行稳定底色与一条细边界即可；hover、selected 和 keyboard focus 应能区分，但不叠加彩色药丸、粗框与跳跃箭头。选中不能只靠灰度深浅传意，正文标题与焦点位置仍要明确。

借 Linear 的上下文保留原则，不复制浮层形态：Job Radar 继续 Browse-first，点击打开可收起/调宽的 desktop Peek；medium overlay、mobile full-screen、显式 Full Detail 保持。60:40 是可试起点，不是机械指标；以列表还能比较、详情能读中文证据为约束，保留已存宽度与阅读上下限。不要为比例把 list 硬挤成狭窄卡片列。

列表和详情是一个工作区的两种阅读速度。对齐顶部起点、弱化中线，区别只到“哪个 surface 用来读完整内容”为止；不能把详情画成悬浮营销卡。仍需可发现的关闭与调宽操作，不用纯装饰隐藏可操作边界。

### 5. Typography 与 surface/background

保留 DESIGN 的 15px/600 job title、14px body、12px meta 和 12–13px/500 status；中文使用已指定字体栈。不要从英文 app 图推导更细、更小的中文正文。层级优先靠对齐、字重与角色位置建立，不靠突然增加大标题或 mono 装饰。

用既有 Canvas #F7F7F5、Sidebar #F1F1EE、Surface #FCFCFA / #FFFFFF 构造有限层次。应能看懂壳层、列表、阅读面，但不需要每层再套 border/card。Tertiary 只服务非关键辅助文字；证据、条件、地点等必须阅读的信息不应因“克制”变得太淡。界面舒适不等于低对比到看不见。

### 6. Semantic color 的预算

列表保留最高价值异常文字，Eligible 大多静默；Unknown 中性、Check muted ochre、Blocked muted brick red，Closed 与资格结果语义分离。不借 Linear 多标签色和 Vercel traffic-light 部署点，也不让品牌色承担状态。

异常应“可定位但不报警”：不把整行染红，不把资格区做红色警告卡。保持文字说明；qualification_data_unavailable 仍可理解且不能被减色隐藏。视觉层级不能越过 Task 5 / 6 的 readiness、required/preferred/ambiguous 和决策顺序。

### 7. Evidence/detail reading rhythm

详情需要两种间距：不同阅读阶段之间可以较松，同一条件与其证据之间应更紧。当前图里结论、明确要求、每条 gate 的分隔趋同；未来优先检查是否能减少同级框线，而不是拆出更多组件块。

继续 Gate → 逐字 Evidence → Context → Full JD。Gate 名与值首先清楚，证据紧随该条件；Context 使用更轻的展开入口和缩进，Full JD 仍是后续深入阅读。无需学习 Linear 的评论流或 Vercel 的详情卡片结构。相同原文支撑多个 Gate 时，读者仍应知道各自证据归属，不能为了视觉去重擅自改 extraction 或 gate 结构。

资格结论与原因可采用标题/辅助句的层次，保留克制的异常文字。官网投递仍是 graphite 主 CTA；Full Detail 为次级显式入口。来源与 freshness 放在相关内容附近，不生成装饰卡。不在此轮改变默认 disclosure 状态或增删操作。

### 8. 决策顺序与证据结论

下一次若用户授权实施，建议先验证横向扫描组织和搜索入口，再对比小面积原色 logo，最后微调详情条件—证据的邻近关系；不通过继续压缩全局字号解决所有问题。它们是同一冻结 IA 内的视觉候选，不是新功能清单。

用户图补齐后，支持横向位置稳定、搜索优先、有限品牌色和局部证据展开的研究方向；但其大 logo、多导航、多筛选、状态药丸与 tabs 不适合当前冻结范围。下面的 Current Best Visual Reference 将这些差异转为一次融合稿的具体边界，不授权生成或实施。

### 9. 安装、冲突与研究自审

Hallmark v1.1.0 已安装至 `.agents/skills/hallmark/`，上游 [Nutlope/hallmark](https://github.com/Nutlope/hallmark/tree/13ac0ec7e148655948100b6396439e481361d690/skills/hallmark)，固定 commit `13ac0ec7e148655948100b6396439e481361d690`。保留 107 个上游 Markdown 文件及 MIT license，增加本地 UPSTREAM.md / AGENTS.md 记录来源与 study-only 限制。没有全局安装，没有运行时依赖，没有调用外部生成模型。

`hallmark study` 在这里是读取 SKILL.md 与 references/study.md 后执行诊断工作流，不是调用一个生成 UI 的 CLI。未运行 default/build/redesign/audit，也没有生成新 design.md 或 theme。DESIGN.md 旧的 Hallmark 暂缓条款只被本次明确 study 授权限定覆盖，其余基线不变。

已应用 anti-ui-slop 的产品特定机制分析和 web-design-guidelines 的可访问性边界；未运行 UI finish gate、未声称本研究验证了外部产品的 accessibility。Hallmark 默认的结构多样性、theme、动画与生成协议不适用；按用户要求以 Borrow / Do Not Borrow / Job Radar Adaptation 组织，而非其营销页诊断模板。静态图的 motion 记录为不可判断，不执行默认 reveal。

自审：区分观察与推论；Vercel 使用 2026 官方导航证据，未用旧版顶栏冒充当前；Linear Peek 不误称固定 split-view；未把文档网站 UI 当产品；不猜字体和精确实现尺寸；用户图已补充，视觉估计与冻结 token 分开记录。研究质量自评（非产品评分）：Philosophy 4 / Hierarchy 4 / Execution 4 / Specificity 4 / Restraint 5 / Variety 3；无登录态外部交互验证，不代表用户验证。

首次研究新增文档与项目 Skill；本次补图仅更新本研究文档，现有 Task 7 未提交成果保持原状。未修改 package.json / lockfile、功能代码、测试、数据库或 DESIGN.md；无代码改动，因此不重复运行 lint/test/build，也不将前一轮结果冒称本轮重跑。停止研究，不进入实现。


### Current Best Visual Reference

#### 第一眼完成度：三个不同速度的区域，而不是三块同等重要的内容

图 U 的左区低对比、文字稀疏；中区有规则重复的彩色图标和横向条目；右区更明亮，标题、主 CTA、异常与展开证据形成几个有限的注意力落点。观察到的三块宽度约为 15% / 50% / 35%，仅为图像估计，不是新布局指标。它让眼睛先识别对象，再扫岗位，最后理解当前选择。当前 v2 已有正确三块结构，但左侧内容过度纵向堆叠、右侧各段的分隔接近等权，整体更像一组排好的文本。

“完成度更高”在此是视觉判断，不是证明这张图更易用。其丰富的虚构或未核实内容、更多功能入口也增加了饱满感；删去这些后仍成立的机制，才值得借鉴。

| 研究维度 | 图 U 中可见的机制 | 与当前 v2 / 官方参考对照 | Job Radar 可保留的部分 |
| --- | --- | --- | --- |
| 彩色公司 Logo | 每行相同位置出现不同品牌色；颜色、轮廓与公司名构成可重复识别点 | 像 Raycast 的 app 图标；v2 灰度图标保留形状但削弱颜色线索 | 小面积原色身份图标，固定容器、公司名仍可独立阅读；不复制大图标首列 |
| 三块视觉权重 | Sidebar 退后，中区连续行占最大宽度，右侧独立亮面承接当前岗位 | Vercel 提供壳层/内容的分工；Linear 提供保留集合再看细节的原则 | 主列表持续可比较；详情有阅读宽度，Sidebar 不增加内容填空 |
| JobRow 横向组织 | logo/公司、岗位及 meta、资格信号、时间各有相对稳定的位置 | Linear 的属性位置、Raycast 的主名称/右侧类型都体现位置预测；v2 每行需读三四行 | 用当前已有字段形成主身份区与次级轨道；不是引入复选框、动作列或可配置表格 |
| Selected row | 第一条连续浅底 + 左侧细深线，在规律重复中打断节奏；右侧重复小米身份 | v2 也有细线，但选中行附近留白和内容位置不够横向统一 | 视觉事件来自“唯一被选中”与身份对应，不来自更重阴影或换主题色 |
| 搜索与 surface | 独立输入面居上；轻量筛选居下；结果融于 canvas；右侧是一张连续阅读面 | Raycast 的入口优先，Vercel 的层级分工；v2 工具控件较同质 | 搜索先于附属控件被看见，保留当前控件集合；不复制第二套筛选 chip |
| Typography | 公司、岗位、gate 标题有明确字重；地点、说明、时间退后，位置稳定 | 主要是同类 sans 的角色差异，不是奢华字体配对；v2 meta 太集中在左端 | 冻结字号下优化角色与对齐；图中深蓝墨色不替代 DESIGN graphite |
| Qualification signal | 列表中异常有固定位置、简短文字与图标，常规条目更安静 | 位置值得学；橙红与右侧多绿色标记比 v2 更热闹 | 每行只保留现有最高价值信号，文字表达不能依赖颜色；不增加新的 gate 摘要逻辑 |
| Detail 顶部 | logo、公司、岗位形成身份组；meta 紧随；投递按钮靠近该组且不挡标题 | v2 身份信息和 CTA 更纵向分散；图 U 的关系更紧 | 标题是主角、小 logo 辅助，CTA 保持可见；不复制星标/更多操作或大品牌块 |
| Gate / Evidence | 未展开条目简短；一个有疑问的 gate 展开，解释、原文、上下文在同一局部形成完整阅读单元 | v2 多处同级分隔弱化条件与证据邻近；Linear 的紧凑摘要不能代替原文证据 | 条件和值 → 当前原因 → 逐字 quote → 上下文；局部展开，不做多层卡片 |

#### 为什么克制但不单薄

它把变化集中在少数有角色的位置：品牌图标提供身份差异，selected row 提供当前操作落点，投递按钮提供行动落点，单个展开 gate 提供阅读深度。其余位置使用重复的基线、细 divider 和中性背景。中区的规律给“秩序”，右区的局部展开给“变化”；并不是所有地方都增加视觉重量。

因此可借的是“低噪声背景 + 有意义的局部差异”。不能将结论误读为多放几个彩色元素、大幅增大 logo、把 Sidebar 填满，或复制整块提醒卡。图 U 的绿色圆勾、状态药丸和橙色提醒已经超出 Job Radar 希望的语义色用量。

#### 语义核对：漂亮的图也可能表达错误

- 图中“标题出现 2027 届，正文未明确限制”的待确认说明，方向与冻结 title-only ambiguous/program 一致；但仅凭截图不能确认真实 JD、scope、Profile 和 extraction readiness，不能直接借用其 gate 数据。
- 图中“专业”条目写“建筑类、土木类等相关专业优先”，却配“符合”与绿色勾。Preferred 不应被塑造成硬性条件已通过，更不能据此 Block。下面另有“优先项”也不能成为重复或相互矛盾的归类依据。
- “每周实习时间 每周 5 天 / 符合”依赖真实 required gate 与 Profile；不能为填充详情自行补出五项资格条件。
- “来源小米招聘官网 / 招聘中 / 最近验证 2 小时前”均是数据声明。公司 logo 不证明 authoritative，也不能证明岗位 Open；network failure 或 missing aggregator 仍不能改为 Closed。
- Saved、收藏、复选框、自定义视图、账号头像、补充资料可再判断 18 个岗位，以及详情四个 tabs，都只作为图中事实记录。它们不进入当前 Task 7 的融合范围；不把“好看”当作跨阶段授权。

#### Visual Synthesis Rules

以下为下一步**唯一一张 Desktop Inspect image-model 融合稿**的研究约束，本轮不执行。不是新的 DESIGN.md，不授权 build/redesign 或产品功能变化。

1. **输入职责固定。** 当前真实 v2 Inspect 为结构、控件、数据与语义基底；图 U 只贡献横向扫描、有限身份色、选中事件和局部阅读节奏；Linear 贡献位置规律，Raycast 贡献搜索权重，Vercel 贡献壳层/内容层级。禁止拼接这些产品的品牌视觉或外围营销背景。
2. **单一画面。** 1600×1000 Desktop Inspect，直接呈现工作台，不加浏览器假框、手机框、设计说明贴纸、对比拼图或营销文案。不另造 Browse 或 mobile 版本，不自动生成第二方案。
3. **保留三块结构。** Sidebar 约 202px，只含 Job Radar、Radar、Profile 与已有本地资料说明。余下工作区仍为搜索/现有筛选和 list/detail；先以 60:40 理解二者关系，详情按现有 520–760px 阅读边界处理。不复制 U 的 15:50:35 为硬性新规范。
4. **保持真实状态。** 使用 v2 的真实 8 条岗位和在校、2027、本科、机械工程 Profile；选中真实 vivo“Agent 算法工程师- 27届蓝极星”。结论保持“存在明确不符合项”，不可为了使用暖黄强调改成 Check。只显示既有 gate，不填补缺字段或制造岗位计数。需要更多内容时从当前已核验数据取，不从 U 的 128 条示例取。
5. **搜索第一。** 列表工作区顶部的搜索输入是主要入口，输入 surface 清楚、占据工具区主要宽度；地点/资格/排序视觉退后、基线统一。仅保留实际已实现的控件；无公司/类型/日期新增筛选，无 ⌘K，无额外 chips。不要用更大的 Radar 标题竞争输入权重。
6. **公司 Logo 小而有色。** 公司名前使用现有已核实本地 logo，图形 18–20px、约 24px 中性容器，原始品牌色只在资产内部；未知公司用统一首字符。禁止 48px 独立大 logo 列、品牌色背景铺满 row、重新编造商标。参考图中的图标不是新资产授权。
7. **横向组织服务标题。** 足够宽时，row 左区为职位标题，紧邻次行公司 logo/公司；中/右侧为已有地点、收录时间与现有最高价值资格异常，跨行位置稳定。不能为了横向排布缩小标题到 meta 大小。Peek 后窄列表允许回到紧凑多行；不新增列头、复选框、星标或省略号菜单。
8. **真实长文本保留。** 使用银行长职位和腾讯多地点检验节奏，不能为了整齐把真实标题改短或删掉唯一异常。普通行可在约 88–100px 的视觉范围探索，长内容自然增高；这是单张稿的密度目标，不是 CSS 验收值。图 U 的短示例不能成为全部真实行都单行的依据。
9. **选中事件唯一。** 被选中的 vivo 行采用连续低对比中性底色 + 约 2px 细侧线，边缘与普通行对齐；不画独立厚卡片，不叠加彩色边框、阴影和大箭头。右侧重复同一岗位与公司身份，明确对应。
10. **Surface 只用已有层级。** Canvas #F7F7F5、Sidebar #F1F1EE、阅读面 #FCFCFA / #FFFFFF，divider rgba(25,25,22,.08)。搜索输入与详情可以比列表明亮，不新增渐变、glass、纹理、悬浮厚影或卡片套卡片。radius 只允许 6/8/10px；品牌图片自身形状不作新圆角 token。
11. **排版锁定。** 列表职位 15px/600，正文 14px/400，meta 12px/400，状态 12–13px/500；详情标题可延续当前约 20px 层级。使用 DESIGN 已有中英 sans 方向、graphite 字色，不改深蓝主色、不加 serif/mono 装饰。必要信息不靠极浅 tertiary 表达。
12. **详情头部紧凑成组。** 小 logo + 公司、职位标题、地点/薪资等已知 meta 彼此靠近；官网投递 ↗ 为唯一 graphite 主按钮，旁边保留显式 Full Detail 次级入口和已有关闭操作。不能加入 U 的收藏、更多菜单或四个详情 tabs；当前标题不应被 logo 抢走。
13. **证据形成局部阅读单元。** 资格结论与原因后进入明确要求；同一 gate 的字段/值、原因、quote 间距小于不同 section 间距。展开一条真实证据“2027届获得博士学历”，上下文只取实际原文；不足时不编写。用轻引文线/缩进显示归属，不复制厚证据卡或多层 accordion。Full JD 保持后续显式路径。
14. **颜色预算按语义，不按装饰。** Eligible mostly silent；Check muted ochre、Blocked muted brick red、Unknown neutral。当前选中岗位是 Blocked，只在必要状态文字使用克制砖红，无大红横幅；不复制整块橙黄提醒、绿色圆勾、重复“符合”药丸或招聘状态交通灯。所有结果保留文字，品牌色完全独立于资格。
15. **不得借图新增内容。** 排除 Saved/Hide、收藏、批量操作、自定义视图/计数、账号头像、资料完整度或收益卡、公司信息 tabs、match/AI score。图 U 的发布日期、来源认证、招聘中和最近验证时间不能作为真实数据填入；已有收录日期仍叫收录日期。
16. **交付前检查而非生成循环。** 单稿完成后检查：现有控件和路由关系未变；8 条数据没有换成参考图示例；selected/详情身份一致；title-only ambiguity 与 required contradiction 未混淆；证据逐字；主要视觉新增集中在扫描与层级。若 image model 画错中文或 logo，明确标注为渲染缺陷，不能把错误写回产品。此规则不触发本轮生成，也不自动进入实现或多轮图稿探索。
