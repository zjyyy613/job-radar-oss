# M0.5 Phase 1A — Official Source Expansion & Real Ingestion

日期：2026-10-02。M0 保持 Frozen；只接入已验收 Batch A 八家，没有第九家、UI/Brand 修改或 Gate Extraction。

## 真实结果

**PASS：新增 396 条 source records / canonical jobs；数据库合计 404 / 404，达到本轮 300–500 目标。** 原有 8 条 source records 与 8 条 jobs 全字段哈希逐条一致，包括已有 gates 和 extraction metadata。13 家公司，自动 merge 0，保守保留所有不同源身份。

| Source | run | pages | listed | detail attempted / success | admission passed / rejected | inserted / updated | canonical jobs | duration |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| job-pro:alibaba | success | 2 | 50 | 50 / 50 | 50 / 0 | 50 / 0 | 50 | 118.6s |
| job-pro:meituan | success | 2 | 50 | 50 / 50 | 50 / 0 | 50 / 0 | 50 | 119.3s |
| job-pro:jd | success | 2 | 50 | 50 / 50 | 50 / 0 | 50 / 0 | 50 | 78.1s |
| job-pro:netease | partial | 2 | 50 | 50 / 50 | 48 / 2 | 48 / 0 | 48 | 193.6s |
| job-pro:kuaishou | partial | 2 | 50 | 50 / 50 | 49 / 1 | 49 / 0 | 49 | 135.4s |
| job-pro:oppo | success | 2 | 50 | 50 / 50 | 50 / 0 | 50 / 0 | 50 | 64.1s |
| job-pro:liauto | success | 2 | 50 | 50 / 50 | 50 / 0 | 50 / 0 | 50 | 56.9s |
| job-pro:antgroup | partial | 2 | 50 | 50 / 50 | 49 / 1 | 49 / 0 | 49 | 127.0s |

累计来源执行耗时 893.1s（不含最终审计写入和 canonicalization）。详情成功率 400/400 = 100%；准入率 396/400 = 99%。全部 stop_reason=max_jobs，未 drain 全站；没有请求失败。

拒绝详情（未写入，未以列表伪造）：
- job-pro:netease / 78999：insufficient_detail
- job-pro:netease / 69985：unreadable_detail
- job-pro:kuaishou / 0b4b70df40ac44cdb485d0c309b401af：insufficient_detail
- job-pro:antgroup / 25100206981344：insufficient_detail

最终状态：Open 256 / Unknown 148 / Closed 0。三个 partial 来源的 146 条新岗位按现有 reliability 保守为 Unknown，另有历史 Unknown 2 条；未为数量或展示放宽状态。所有 run 为 full_list=false，不增加 authoritative missing count，不推断 Closed。

## 范围与分类证据

抓取选项：scope=intern、page size=25、每源 maxPages=2 / maxJobs=50、globalMaxJobs=400，八家公司串行。使用固定 @ha7ch/job-pro@1.2.1 公开 CLI；adapter version=job-pro-1.2.1/adapter-2。

不能把 scope=intern 等同于全部纯实习。原始显式标签：快手 intern 49、OPPO 实习生 50、理想 实习 19（合计 118）；网易 校园/实习 48；蚂蚁 校招 49；理想 正式 31；其余 150 无上述标签。故 215/396（54.3%）可直接由这些原始标签识别为 internship/campus；其余保留未知/原渠道语义，不宣称纯实习比例。未改写 internship_type / recruitment_batch 的 null，也不从岗位标题猜批次。

## 安全边界与实现

- 沿用同一 allowlist / CLI wrapper / source store / canonicalization；无新 adapter framework、依赖、数据库迁移、Python service 或外部服务。
- 开发默认原三家，每源 1 页 / 5 条、全局 15；显式扩量受每源 20 页 / 500 条、全局 500 条硬上限限制。固定页大小，剩余不足整页时正常停止。
- 串行读取，350ms 间隔；45s CLI timeout、每源 5 分钟预算；传输/5xx 类失败最多两次尝试，重试等待 1500ms。403/429 停止当前源，继续其他源，不绕过访问控制。
- 准入检查稳定 ID、固定来源公司、标题、官方 URL/ID、非空有效地点、正文信息量和可读性。正文至少 80 个去标点字符、12 种字符；原始 payload 原样保留。
- Li Auto HTML 仅解码格式，不补写内容；Kuaishou 地点对象提取原 name。单详情失败隔离，partial 指标含拒绝原因。
- CLI 子进程不接收 Supabase/DeepSeek 密钥；日志只输出安全错误类别。原始 payload 留在 source_records；提交的汇总不含密钥或原始完整数据库快照。

## 幂等与冻结语义验证

- 真实 Supabase 每个新增来源取一条已写入记录，以原时间戳重放：8 updated / 0 inserted；总 records 404 不变，完整来源快照哈希不变。没有再次抓取 400 条或伪称全量 live rerun。
- 离线 runner 重跑覆盖 stable identity update；400 条规模 canonicalization 回归保持 ID、无额外 merge。真实 canonicalization 复用既有 RPC，原有 8 jobs/records 精确不变。
- 全部 396 新 jobs gates=[]、extraction 未处理；资格 readiness 仍返回 Check，不误判 Eligible。本轮没有调用 DeepSeek。

## 验证与自审

- lint PASS；typecheck PASS；全量 tests 19 files / 329 tests PASS；production build PASS（Next.js 16.3.6）。
- 新增八来源真实 search/detail fixtures 16 份及离线契约测试；覆盖分页/全局硬上限、重复运行、详情隔离、空/坏正文拒绝、partial、单源失败、重试、canonicalization 和 failed≠Closed。
- 自审修复：Kuaishou 地点对象映射；测试 locator 与模拟 ID 一致；非零 CLI 退出中的 403/429 也不重试，避免把访问拒绝当网络错误。
- README 更新默认额度、显式扩量命令和准入边界；没有修改冻结产品、资格、UI、Brand 或 workflow。

## 限制与停止点

- 4 条拒绝保留原因，不降低门槛补数字。信息量阈值是保守准入，不代表已验证全部 JD 语义完整。
- 新岗位尚未提取 gates；本轮目标是正式来源入库，不承诺已有可比较资格结果。
- 既有 snapshot 上限 1,000 records；当前 404 未触达。未来继续扩量需独立评估，未在本轮重构。
- 不执行 NCSS 扩页、实习僧、schedule、部署或 Phase 1B。

可复核指标见 [metrics](2026-10-02-m05-phase1a-metrics.json)。完整原始运行证据保留于本地 gitignored `.verification/phase1a/`，不作为运行时依赖。
