# M0.5｜Data Source Expansion Audit

日期：2026-10-02（Asia/Shanghai）。基线 `88b5fab`，开始时工作区 clean。

## 结论与首批决定

**研究与小样本 smoke 已完成；M0.5 产品规模尚未验收。** 300–500 条目标有依据，主要约束已从列表容量转向详情可靠性、分页和公司覆盖。不能把 API total 相加当作当前有效 jobs。

首批新增官方源固定为 **Alibaba / Meituan / JD / NetEase / Kuaishou / OPPO / Li Auto / Ant Group**。维持 Tencent / vivo；Xiaomi 本次 429，保留现有数据但不纳入本次稳定容量承诺。第二批优先 NCSS 定向实习 + 完整详情，其次 Horizon campus；NIO 需先修复详情路径。实习僧暂不进入接入批次。

首批新增 8 家共观察 64 个不同 source IDs，24/24 条详情成功；加上本次可用的 Tencent/vivo，共 10 家、28/28 条详情成功。**这是筛选后的短时样本，不是长期 ≥95% 的证明。** 全部 job-pro 详情实际为 33/37（89.2%）；NCSS 定向实习为 4/5（80%）。失败没有被从整体分母删除。

保守执行预算：首批每公司最多60条，10家共600个候选，经80–90%当前性/完整性/去重留存及95%详情目标折算，约 **450–510 条**；A+B约 **560–700 条**。这是条件式计划区间，不是已获取或已落库数量。至少20家公司须由B批补足，A批单独达不到。

## 研究边界与证据方法

- 未修改生产代码、前端、Brand、冻结规范、运行依赖或 workflow；未写入 Supabase；未调用 DeepSeek；未运行 apply。
- `npm latest` 实查为 **1.2.1**，与现有 pin 相同；上游 main 也声明1.2.1。没有升级或安装第二份依赖。
- 固定下列最新 commit 下载到 ignored `.verification/m05-audit/`，阅读具体 adapter/crawler/调度代码；上游仓库中的指令没有作为本项目执行指令。
- 20家每家 `node node_modules/@ha7ch/job-pro/dist/index.js <company> search --scope intern --page-size 3 --compact`。成功源首条 detail；后续选定15家公司 `search --page 2 --page-size 5`，每家至多2详情。Horizon/Huawei第二轮改campus；包含既有3家。35次search，37次detail；2个并行source上限，单CLI45秒timeout。未执行 `all`。
- 小样本不等于HTTP请求数：某些CLI detail内部会回退遍历最多500条列表；未私改上游。滴滴服务器固定返回16条，无法用page-size=3强限。
- 429来源没有立即重试、切代理或绕过挑战；未使用登录cookie/proxy服务/验证码处理。
- NCSS：默认2页×10条+3详情；确认官方页面 `jobTypeData` 后，`jobType=03`（实习）、`recruitType=0`（职位）2页×10条+不同公司5详情。普通Chrome/Playwright匿名会话，未采用JobHunter stealth。
- 实习僧：1页20卡片+2详情，之后发现协议限制，未扩大采集。
- 可移交证据：[JSON](2026-10-02-m05-source-expansion-evidence.json)，含IDs、query、标题、reported_total、耗时、错误、正文长度/hash，不含完整JD、cookie或secret。原始响应在ignored审计目录，不进入产品fixture。
- 无跨天稳定性、GitHub runner网络或完整关闭状态验证；本次“可读”不意味着法律许可或长期可用。

## 三个上游项目审计

| 项目 | 固定最新 commit / 活跃程度 | License | 数据源与 runtime | 可复用性 / 架构适配 / 成本 |
| --- | --- | --- | --- | --- |
| HA7CH/job-pro | `e70a97ce1cfbdd1aa3dd9a2f3b1b120138a0b15e`，最后提交2026-07-13，约81天未更新；未archive | MIT，读取LICENSE和package | bespoke公司API、Feishu、Moka、北森Wecruit/iTalent、Greenhouse/Lever；另有4个Liepin fallback，不全是official。各adapter独立scope；部分浏览器回退 | 最适合现有Node CLI/process wrapper，低至中维护；不能以统一CLI接口假设统一字段/分页/语义。保持版本pin，不引入private API依赖 |
| Bynlk/JobHunter | `4b5a69010a98b3d80b408fd983c1c2dfa60788e4`，最后提交2026-05-07，约148天；与现有NCSS pin相同 | MIT，读取LICENSE | NCSS、实习僧、12公司API、通用官网crawler；BaseCrawler依赖Playwright+stealth，实习僧有fontTools动态字体解码 | 只提取NCSS会话/字段/详情思路；不引入Flask/SQLite/Vue/通用crawler。API实现也使用浏览器fetch/cookie，并非纯requests。维护中至高 |
| mengxi111/career-agent | `13e3ace4e8a94b970c41cda7f306cfc0da312c98`，最后提交2026-10-01，约1天；未archive | MIT，读取LICENSE | 公司registry、Moka/Feishu/北森/hotjob、专用API、render/static、文档发现；多处Playwright，完整项目含SQLite/AI分析/通知/报告 | 适合借鉴候选→验证→准入、pagination_complete与JD completion；不整体迁入。已有源重叠高，长尾tenant发现有价值；通用浏览器维护中高 |

“活跃程度”仅指可核实的最近commit，不等于维护者响应SLA。MIT代码复用需保留版权/许可；第三方站点数据使用条款另行评估，MIT不授予数据再分发权。

上游固定入口：[job-pro](https://github.com/HA7CH/job-pro/tree/e70a97ce1cfbdd1aa3dd9a2f3b1b120138a0b15e)、[JobHunter](https://github.com/Bynlk/JobHunter/tree/4b5a69010a98b3d80b408fd983c1c2dfa60788e4)、[career-agent](https://github.com/mengxi111/career-agent/tree/13e3ace4e8a94b970c41cda7f306cfc0da312c98)。

## Source Expansion Matrix

记法：sample为实际不同列表ID数；`d x/y`为detail成功/尝试；T为API自报总量，**不是已验证有效数**。official=authoritative；agg=trusted_aggregator。B不是“今天不可用”，而是需要先完成字段/详情修复。当前8条生产数据未改变。

### Batch A — 首批明确接入

| source/company | upstream | tier | intern support | sample count | detail quality | auth/anti-bot | reuse method | overlap | maintenance | recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Alibaba | job-pro / campus-talent.alibaba.com bespoke | official | 有；样本实习 | 8；T615 | d3/3，职责+要求 | 匿名会话/CSRF路径，本次无需浏览器 | CLI+字段fixture | JobHunter同公司；与现有3公司不同 | 低中 | A；不要固定旧batchId |
| Meituan | job-pro / zhaopin.meituan.com bespoke | official | 有，jobType code2 | 8；T377 | d3/3，完整两段 | 匿名HTTP | CLI | JobHunter重复 | 低 | A，高收益 |
| JD | job-pro / campus.jd.com bespoke | official | 有，实习标签 | 8；T104 | d3/3，地点可很长 | 匿名HTTP | CLI，保留地点数组 | JobHunter重复 | 低中 | A |
| NetEase | job-pro / hr.163.com bespoke | official | intern映射校园/实习混合workType1 | 8；T563 | d3/3，完整两段 | 匿名HTTP | CLI；不能标成100%实习 | JobHunter重复 | 低中 | A，campus也符合本轮目标 |
| Kuaishou | job-pro / campus.kuaishou.cn bespoke | official | intern通道 | 8；T228 | d3/3，完整两段 | 匿名HTTP | CLI；ID为hex字符串 | JobHunter重复 | 低中 | A，补ID fixture |
| OPPO | job-pro / careers.oppo.com bespoke | official | Intern及2027实习项目 | 8；T97 | d3/3，完整两段 | 匿名HTTP | CLI；work_city单数字段归一 | 与现有不同 | 低中 | A；不能仅看高级/Manager标题判社招 |
| Li Auto | job-pro / www.lixiang.com bespoke | official | school feed含正式/实习；代码未实际过滤job_mode | 8；T1027为混合校招feed | d3/3，HTML职责/要求 | 匿名HTTP | CLI+HTML正文归一 | 与现有不同 | 中 | A，但不要把1027当纯intern |
| Ant Group | job-pro / hrcareersweb.antgroup.com bespoke | official | intern=campus；样本含27届 | 8；T461 | d3/3，完整两段 | 匿名；无登录token | CLI；pageSize≤49 | 与现有不同；勿与Alibaba自动并公司 | 低中 | A，保留项目/毕业年原文 |
| Tencent（既有） | job-pro / join.qq.com | official | 应届实习项目 | 5；T594 | d2/2 | 匿名HTTP | 现有CLI分页扩容 | 现有记录及JobHunter重叠 | 低 | A维持，不重新接源 |
| vivo（既有） | job-pro / hr-campus.vivo.com | official | 有，日常/可转正实习 | 5；T88 | d2/2 | 匿名HTTP | 现有CLI分页扩容 | 现有记录重叠 | 低 | A维持 |

所有成功详情ID与请求ID对应，title/location可取得；中文公司身份通常来自CLI已验证公司注册项而非每条响应自带company字段。ID跨天稳定性未实测。只观察到同一run身份可对应，不声称时间稳定已验收。

### Batch B — 优先补质量再放量

| source/company | upstream | tier | intern support | sample count | detail quality | auth/anti-bot | reuse method | overlap | maintenance | recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NCSS | JobHunter思路 / ncss.cn | agg | 官方jobType03；recruitType0只是“职位”，不是校招 | 定向20/15公司；默认另20；T100疑似结果窗 | 实习d4/5；默认d3/3但2条明显普通社招 | 普通Playwright session；1次详情timeout | 扩现有薄wrapper；准确DOM正文+分页 | 默认样本命中已有中国银行；定向15公司与本次官方样本名称无重合 | 中 | B首要；先detail、再2→5→10页，不先盲目扩页 |
| Horizon Robotics | job-pro / wecruit.hotjob.cn，北森Wecruit | official | intern拒绝；campus可用 | 5；campus T97 | d2/2，要求合在description | 匿名HTTP | CLI+非数字ID；保留完整单段JD | career-agent可能同tenant | 低中 | B，使用campus，不强改scope |
| NIO | job-pro / nio.jobs.feishu.cn，Feishu | official | 列表标实习，标题含校招 | 8；T423 | d2/3；一条detail回退搜索500条仍not found | 匿名；详情回退请求放大 | CLI后续兼容真实detail endpoint | career-agent同tenant | 中 | B，修详情后再计容量 |

NCSS定向详情有“实习”标签，但正文仍含普通岗位/经验条件，不能只按feed宣称质量100%。不能把中国银行一条招聘公告拆成数十个虚拟jobs凑量。定向20条中15家公司是列表级覆盖，**不等于15家公司已具备可消费Gate**。

### Later — 本轮证据不支持容量承诺

| source/company | upstream | tier | intern support | sample count | detail quality | auth/anti-bot | reuse method | overlap | maintenance | recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ByteDance | job-pro / jobs.bytedance.com | official | 代码支持 | 0 | 未到detail | HTTP429 | 保留CLI，后续独立冷却复测 | JobHunter/career-agent重复 | 中高 | Later，不重试风暴/换代理 |
| Xiaomi（既有） | job-pro / xiaomi.jobs.f.mioffice.cn Feishu | official | 代码支持 | 本轮0 | 既有历史成功不代替本次 | HTTP429 | 维持现有，独立失败 | 现有2条 | 中 | Later恢复容量；失败不Closed |
| Xiaohongshu | job-pro / job.xiaohongshu.com | official | 代码支持 | 0 | 未测 | fetch failed，不能断言一定反爬 | CLI故障定位 | JobHunter重复 | 中高 | Later |
| Bilibili | job-pro / jobs.bilibili.com | official | 代码支持 | 0 | 未测 | CSRF fetch failed | CLI cookie/endpoint复核 | JobHunter重复 | 中高 | Later |
| Baidu | job-pro / talent.baidu.com | official | INTERN通道 | 8；T484 | d0/3，“正在发布中” | 列表匿名可用；detail失败原因未定 | 查详情ID/endpoint契约 | JobHunter重复 | 中高 | Later；列表484不计Gate收益 |
| Huawei | job-pro / career.huawei.com | official | 代码支持 | intern0/campus0 | 未测 | 请求成功不代表没真实岗位 | 对照官方campus渠道再定位 | career-agent有专用crawler | 中高 | Later，0仅指此次adapter输出 |
| SenseTime | job-pro / hr.sensetime.com Feishu Hire | official | 代码支持edu通道 | 0 | 未测 | HTTP404 | 核验tenant/channel迁移 | career-agent可能旧路径 | 中高 | Later |
| Didi | job-pro / talent.didiglobal.com | official | scope用JR前缀过滤，样本社招污染 | 16；T1158未过滤总数 | d1/1，但Operations Manager非目标 | 匿名，固定16/页 | 修通道语义后再测 | JobHunter重复 | 中 | Later；不把title猜测替代可靠通道 |
| Career-agent长尾ATS registry | 已验证公司官网→Moka/Feishu/北森/hotjob | discovery→核验后official | 各tenant需单验 | 本轮未对长尾逐个live | 代码有列表摘要截断，需completion | 多需Playwright | 借鉴候选/验证/准入，不整体运行 | 高；按tenant+project去重 | 中高 | 当前不计容量；只有A+B公司数不足再做专项 |

### Drop — 当前 M0.5 不纳入

| source/company | upstream | tier | intern support | sample count | detail quality | auth/anti-bot | reuse method | overlap | maintenance | recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BYD | job-pro / job.byd.com | official | CLI仅social/all | 0，intern拒绝 | 未测 | 不适用 | 不扩社招 | career-agent有另一campus路径但未smoke | 中高 | Drop当前adapter；不等于公司没有校招 |
| DeepSeek | job-pro / Moka high-flyer | official tenant，品牌含母公司 | 仅social/all | 0，intern拒绝 | 未测 | 不适用 | 不把母公司岗位全归DeepSeek | 较低 | 中高 | Drop当前目标范围 |
| Moonshot | job-pro / Moka moonshot | official | 仅social/all | 0，intern拒绝 | 未测 | 不适用 | 不扩社招 | 较低 | 中 | Drop当前目标范围 |
| 实习僧 | JobHunter / shixiseng.com | agg | 列表实习，真实详情支持 | 20卡片；2详情同公司 | d2/2可读；列表PUA乱码，详情本次无PUA | 匿名本次可看；动态字体；协议限制自动抓取 | 只评估，不移入crawler | 当前官方公司低重合仅小样本，不外推 | 高 | Drop当前接入；取得平台许可后再评估 |
| JobHunter整套12家API重复接入 | 自建API+部分ATS | 按真实host逐家判断 | 多混合或旧batch | 本轮未独立执行第二套12家 | 配置中Tencent把标签当JD，Didi把部门当JD，正文截断3000 | 仍走Playwright+CSRF | 只作字段/故障参考 | 11/12公司已在job-pro目录；DJI例外 | 高、重复维护 | Drop平行实现；不拿代码配置数当有效source |
| GitHub招聘合集/文档 | career-agent发现链路 | discovery | 不保证 | 未计 | 不可作最终JD evidence | 公开读取不等于来源权威 | 只发现候选官方URL | 高且未知 | 中 | Drop直接入库覆盖；保留discovery用途 |

## Broad coverage 结论

**NCSS值得扩，但先补详情质量。** 默认列表两页出现普通快递岗位；JobHunter `_normalize_job` 默认graduate的逻辑不能移植。官方页面 `recruitType=0/1` 表示职位/公告，不能解释成社招/校招。实习应使用已核实 `jobType=03`。当前adapter description/requirements始终null，必须准确采集职位正文区域，避免评论、推荐岗位、公司介绍混入Evidence。JobHunter `_enrich_jobs` 任取泛化`.content`并截3000字符、只补前50条，不能原样用于Gate。

此次默认和定向的 `pagenation.count` 都为100、`total`为10；只证明当前响应窗口，不代表平台总量。扩页前验证不同ID、末页、重复页、分页上限；如需城市/行业分区，只有完成官方参数核验后才加，并仍按(source,id)去重。定向样本20条15家公司表明它可补公司覆盖，但80%详情成功率和分类噪声必须先解决。聚合缺失永不参与权威关闭推断。

**实习僧技术上可读，不推荐现在接。** 20张卡片存在私有字符字体混淆；两条详情直接得到正常中文，无需本次解码；一条“实习”详情仍写2年经验，反映源内容冲突必须原样保留。没有登录或验证码挑战不等于长期稳定。[官方用户协议](https://www.shixiseng.com/rule)限制未经许可的机器人访问、爬虫收集和再传播。未开展后续扩大抓取，不将MIT crawler许可视作站点许可。最终是否可使用需平台许可/适用条款确认；本审计不提供法律结论。NCSS本轮未确认普遍再分发许可，也不因公共平台性质推定无限授权。

JobHunter API_CONFIGS共12家：阿里、腾讯、字节、美团、京东、小红书、科大讯飞、滴滴、网易、B站、快手、大疆。11家与job-pro公司目录重叠；大疆可作后备discovery，不在本轮未测情况下计入A+B收益。

## Career-agent：可转译的机制与不可照搬部分

读取了 `config.yaml`、`crawlers/{__init__,base,moka,feishu}.py`、`scripts/{import_companies,validate_company,dedupe_company_sources,hydrate_incomplete_jds}.py`、`job_details.py`、`db.py`、`main.py`、`.github/workflows/daily_report.yml`。

1. **ATS tenant discovery**：实际是从已有CSV/URL集合识别平台并形成候选，再验证抓到岗位后准入，不是自动枚举所有tenant。Moka按slug/project，Feishu按host/channel，北森按官方tenant。借鉴候选→验证→allowlist；不复制其子串公司名匹配、个人路径或推荐码。
2. **Company source registry**：可给现有allowlist增加host、tier、scope、page cap、field mapping、smoke日期等最小配置。租户必须从公司官方入口验证。registry不需要新数据库；同一tenant不同招聘项目不能误去重。
3. **分页完整性**：`pagination_complete`/termination reason避免把中途失败当完整快照，最值得借鉴。Job Radar沿用现有full_list+success/partial/failed，并在审计信息记录截止原因；有限页抓取始终full_list=false。
4. **JD completion**：区分list_only、complete、official_sparse、fetch_failed有价值；转译为抓取阶段质量结果，复用既有extraction readiness，不能建第二套资格状态。列表摘要、空壳页、截断JD不得被“成功提取零gate”消化成Eligible。
5. **Cache/hash/incremental**：其fingerprint为company/title/city/JD文本SHA-256，screening_version匹配复用。Job Radar已有raw_content_hash+extraction_version更适合保留；新/变化正文才提取，详情失败保留旧valid gates但current readiness不可伪装。不能因列表未变永远跳过详情：若无可信updated_at，需要有界轮转复核。
6. **Actions**：其串行并发组、浏览器cache、超时和成功公司集合可借鉴。但实际仍是定时重抓+缓存AI判定，并非完整差量feed。其workflow把SQLite推回main、部署报告、发送通知、contents:write以及330分钟运行预算都不迁入。Job Radar继续Supabase现有表与独立source workflows，最小权限，无新队列/数据库。
7. **不复用业务语义**：不引入A/B/C评分、个人方向筛选、2027届硬过滤、按最近天数active、URL或company/title/city直接merge。其300/500/12000字符截断与我们的verbatim Evidence约束也不一致。所有关闭/去重/Gate保持冻结规则。

## 真实规模估算与验收分母

| 阶段 | 有证据的输入 | 保守计划估算（去重后） | 公司覆盖 | Gate输入/ready |
| --- | --- | --- | --- | --- |
| Batch A | 新8家64条、详情24/24；Tencent/vivo10条、4/4；各API可分页且本次T均≥60 | 10家公司×60候选=600；600×0.80–0.90留存×0.95详情≈456–513，取450–510 | 10家；不能满足20家 | 预计450–510份可供提取JD；未运行提取，不保证同数ready |
| Batch A+B | 加Horizon T97/d2/2、NIO T423/d2/3、NCSS定向20/15公司/d4/5 | 后续预算60+100+100=260；须先修质量，按50–80%留存×85–95%详情约110–198新增；合计560–700 | 潜在≥20，须至少8家新NCSS公司各有成功完整详情；尚未证实 | 预计约560–700可供提取；runtime validation失败仍Check，不计ready |
| 更高目标 | 更深分页和跨日成功尚未验证 | 500可争取；1000本轮不承诺 | 不能以source个数替代有效公司数 | 需真实落库、提取成功、current hash统计 |

比例是明确的规划折扣，不是统计置信区间。A的24/24有样本选择偏差；不能从此推断全量95%。理想1027、蚂蚁461、网易563是混合campus/intern；目标“internship或campus”可以接纳，但纯实习占比未知。A样本渠道均指向目标范围，计划只让100%有源证据的intern/campus进入目标计数；无法确认者保留待核，不凭标题猜。NCSS样本存在冲突，不能承诺20/20全部高质量。

保守去重继续按现有source ID与跨源高置信信号；同职位多城市不因城市数倍增。同企业不同岗位ID也不能无条件合并。样本中未观察到A与定向NCSS公司名称交叉，但未完成全量重叠率测量；折扣不代表已测重复率。

**验收口径**：分开记录 fetched / unique SourceRecord / target-scope / detail-complete / canonical jobs / current extraction-ready。detail分母为本轮应取详情的不同(source,id)，重试不另增分母，最终失败不能剔除；优先用至少100条分层样本+连续两轮正常调度验收≥95%。无model调用的本轮，新增production jobs=0、ready增量=0。不能把未核验/过期/关闭/不完整详情计入300–500有效目标。

## 唯一最小实施路径

### Phase 1 — 扩 job-pro 高收益官方源

下一步只实施 **M0.5-P1：8家allowlist扩展+有界分页+详情准入**，不同时写NCSS或新ATS系统。

1. 保持job-pro1.2.1/process boundary，以当前真实样本建立fixtures和contract tests。company是显式registry，逐源验证source host、ID、详情对应、scope；不从任意host猜company。
2. 最小字段兼容：Kuaishou hex ID；OPPO work_city；Li Auto description_html/requirements_html保留原始HTML并确定性提取全文；Horizon留到B。不改领域SourceRecord。批次/类型只从已确认字段映射，缺失仍null。
3. page循环、去重ID、重复页保护、截止预算（先每家20，成功后60）、每源独立timeout/backoff。429结束该源；有限抓取不标full_list，不触发missing关闭。
4. 完整详情才进入新增可用岗位计数；失败保存source run失败证据，不把空JD送去“零gate成功”。新/变化CanonicalJob进入已有Task5 pipeline；invalid extraction不覆盖valid gate。研究阶段没有执行这些修改。
5. 本地小批读回→当前hash ready统计→再逐步放量。A阶段允许公司数暂未20，但最终M0.5不能因此提前验收。

### Phase 2 — NCSS定向扩容，必要时补官方B源

先补准确详情DOM与超时隔离、源字段实习分类、可观测分页终止；验证page1/2无重复后最多5–10页，保证至少8家额外公司有可用JD。count=100结果窗不足时先核实，再考虑官方城市/行业分区；不推测无限量。Horizon校园可补，NIO必须先解决detail失败。实习僧只有取得可用许可后才重新评估，不作为当前规模兜底；公司数仍不足才专门验证career-agent发现的官方tenant。

### Phase 3 — Actions自动化 + 增量pipeline

沿用独立job-pro/NCSS workflow，source小批隔离、适度并发、单源超时、有限重试和run summary。每批SourceRecord→canonicalization→new/changed extraction；unchanged hash跳过模型；无新评分、缓存服务或队列。先dry-run，再小批write，再60/source；远端runner需再次验证429/网络差异。关闭推断仍仅连续两次成功authoritative full-list缺失或明确Closed；任何失败不增加missing。

最终验收必须报告300–500（优先500–1000）**当前有效且详情完整、Gate可消费**的canonical jobs、≥20家公司、≥95%详情成功率及未ready原因。预算/截断轮次不能伪装完整快照。生产发布/远端运行不在本轮授权动作内。

## 收尾与未决项

- 已覆盖20家优先候选真实intern smoke、Horizon/Huawei campus补测、已有3源复测、NCSS与实习僧小样本；完成source matrix、明确首批8家、条件规模估算与下一最小任务。
- 生产8条jobs、前端、Brand、M0规则未改；没有对未知公司提前加载logo。
- 本轮只新增审计报告和脱敏证据，不执行产品lint/build（无产品代码变更）；已做JSON解析、样本分母复算、git diff检查。
- ≥95%、20家可消费公司、跨天稳定性、当前deadline完整校验均未验收；它们是实施阶段门槛，不是本研究的假定成果。
- 未自动commit/push/deploy。停在审计结论，不进入M1、不扩JD Lens。
