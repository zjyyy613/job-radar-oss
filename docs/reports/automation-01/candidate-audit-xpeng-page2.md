# 候选审查报告（xpeng / intern）

> 结果：**REVIEW** ｜ 模式：**read-only**（无数据库写入、无模型调用）

- 窗口：start_page=2 · page_size=25 · max_pages=1 · max_jobs=25 · global=25（有效上限 25）
- 候选：**24** 条 / 唯一 ID **24** / 重复 0
- 详情：尝试 25 · 成功 25 · 准入 **24**（96.0%）· 拒绝 1
- 「其他/未分类」：**12**（50.0%）
- 耗时：总计 75.1s（search 4.1s / detail 71.0s）· 每条 3131ms · 预计满额 78s / 预算 300s（26.1%）

## 判定依据

- [REVIEW] `production_dedup_unverified` — 未与生产 source_records 比对（本工作流无只读库凭据），不能确认净新增
- [REVIEW] `unclassified_heavy` — 未分类 12/24（50.0%）≥ 30%，需人工判断这些岗位是否值得收录
- [REVIEW] `rejected_candidates` — 1 条候选未通过准入：insufficient_detail

## 必须人工知悉

- 净新增未确认：候选数不等于新增数，需在具备只读凭据的环境核对 ID 差集

## 净新增状态

**未确认** — 候选 ≠ 净新增；需只读比对生产 source_records 的 ID 差集后才能声明新增

## 一级类别分布

| 一级 | 数量 |
| --- | --- |
| 技术研发 | 9 |
| 运营 | 2 |
| 产品 | 1 |
| 其他 | 12 |

## 二级类别分布

| 一级 > 二级 | 数量 |
| --- | --- |
| 技术研发 > 算法与AI | 8 |
| 技术研发 > 数据与分析 | 1 |
| 运营 > 内容与新媒体运营 | 1 |
| 运营 > 业务与策略运营 | 1 |
| 产品 > 产品经理 | 1 |
| 其他 > 未分类 | 12 |

## 未通过准入的候选

| source_job_id | 原因 |
| --- | --- |
| 7589451831748151579 | insufficient_detail |

## 候选 source_job_id 清单

| # | source_job_id | 公司 | 标题 | 地点 | 类别 | 申请链接 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 7662954587057768740 | 小鹏汽车 | VLA大模型算法实习生 | 深圳 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7662954587057768740/detail |
| 2 | 7661888157235202350 | 小鹏汽车 | 产品实习生（体验 AI 自动化评测方向） | 上海 | 产品 > 产品经理 | https://xiaopeng.jobs.feishu.cn/campus/position/7661888157235202350/detail |
| 3 | 7658229808334162222 | 小鹏汽车 | 机器人VLA大模型算法实习生 | 上海 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7658229808334162222/detail |
| 4 | 7646794393773164826 | 小鹏汽车 | 顶岗实习生—广州三电厂 | 广州 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7646794393773164826/detail |
| 5 | 7645140009230649663 | 小鹏汽车 | 售后实习生（北京大区） | 天津 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7645140009230649663/detail |
| 6 | 7641856476033648937 | 小鹏汽车 | 【27届暑期】具身智能灵巧手算法实习生 | 深圳 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7641856476033648937/detail |
| 7 | 7640096033099712804 | 小鹏汽车 | 2026年校园大使 | 广州 / 北京 / 上海 / 深圳 / 武汉 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7640096033099712804/detail |
| 8 | 7639617891126823214 | 小鹏汽车 | 救援服务实习生 | 广州 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7639617891126823214/detail |
| 9 | 7639248060526889257 | 小鹏汽车 | 【27届暑期】销售运营培训生 | 广州 | 运营 > 业务与策略运营 | https://xiaopeng.jobs.feishu.cn/campus/position/7639248060526889257/detail |
| 10 | 7638968605111929098 | 小鹏汽车 | 具身大模型量化与部署实习生 | 深圳 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7638968605111929098/detail |
| 11 | 7632196929774209316 | 小鹏汽车 | 具身大模型算法实习生（上海/深圳） | 深圳 / 上海 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7632196929774209316/detail |
| 12 | 7631028702494820614 | 小鹏汽车 | 数据工程实习生 | 北京 / 上海 / 深圳 | 技术研发 > 数据与分析 | https://xiaopeng.jobs.feishu.cn/campus/position/7631028702494820614/detail |
| 13 | 7627121367213001006 | 小鹏汽车 | 具身软件系统实习生 | 深圳 / 上海 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7627121367213001006/detail |
| 14 | 7619141202503518483 | 小鹏汽车 | 具身智能灵巧操作算法实习生 | 深圳 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7619141202503518483/detail |
| 15 | 7619137926345214235 | 小鹏汽车 | 运动控制算法实习生（强化学习方向） | 深圳 / 北京 / 上海 | 技术研发 > 算法与AI | https://xiaopeng.jobs.feishu.cn/campus/position/7619137926345214235/detail |
| 16 | 7560993811104319790 | 小鹏汽车 | 新零售实习生（东北大区） | 沈阳 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7560993811104319790/detail |
| 17 | 7548297610593241383 | 小鹏汽车 | 海外产销管理实习生 | 广州 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7548297610593241383/detail |
| 18 | 7547596064486344970 | 小鹏汽车 | 售后实习生（湘鄂赣大区） | 武汉 / 长沙 / 黄石 / 襄阳 / 十堰 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7547596064486344970/detail |
| 19 | 7537604726969174335 | 小鹏汽车 | 三电设备实习生-广州基地 | 广州 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7537604726969174335/detail |
| 20 | 7533469094504515882 | 小鹏汽车 | 新媒体实习生（上海大区） | 上海 | 运营 > 内容与新媒体运营 | https://xiaopeng.jobs.feishu.cn/campus/position/7533469094504515882/detail |
| 21 | 7520199223359932726 | 小鹏汽车 | 企业文化实习生（设计方向） | 广州 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7520199223359932726/detail |
| 22 | 7516766215387531539 | 小鹏汽车 | 2026年校园大使 | 广州 / 北京 / 上海 / 深圳 / 武汉 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7516766215387531539/detail |
| 23 | 7516746238848764199 | 小鹏汽车 | 交付实习生（渝贵大区） | 重庆 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7516746238848764199/detail |
| 24 | 7512754716649441587 | 小鹏汽车 | 新零售实习生（渝贵大区） | 重庆 | 其他 > 未分类 | https://xiaopeng.jobs.feishu.cn/campus/position/7512754716649441587/detail |

---
生成时间：2026-10-20T14:21:39.340Z

PASS 仅代表通过本报告的自动检查，不代表获得生产写入授权；STOP 表示来源不可信、关键检查失败或预算风险。