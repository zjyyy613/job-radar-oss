# Product Improvement v1 / Task 1 — Location Normalization & City Filtering

2026-10-09 · PASS（本地 production，未部署）

## 范围与实现

原契约 `location: string[]` 在 SourceRecord / CanonicalJob 中保存上游地点；job-pro adapter 仅做来源特定的最小数组拆分。本轮不修改这些契约、adapter、数据库或原始地点。新增 `src/lib/radar/location.ts`，仅在 Radar 选项和筛选时使用。

浏览层使用 reviewed 城市/省份/少量区县对应表，覆盖当前数据实际出现的内地城市、香港及境外城市，不是只允许几个热门城市。选项只来自当前岗位实际归一化结果，不把整张表变成固定选项。未知新城市保留原文，未来可通过有证据的表项增补支持；不接 geocoding 服务，不宣称支持全国任意地址。

- 精确城市及“市”后缀归一；北京顺义区、上海嘉定区/闵行区、深圳福田区、常州武进区等已观察写法通过明确别名处理。
- 逗号/中文逗号/顿号/斜杠/分号用于列举；连字符/间隔点先判断省市区层级，再判断城市列举。不是全分隔符一律 split 后当城市。
- 省市组合校验省份归属；重复市名去重。苏州—昆山市、南通—启东市取原文显式给出的上级市；裸昆山市或裸区县不反推。
- 不以 substring 匹配地名：北京路、上海镇、朝阳区、未知地名、冲突省市及带外国前缀的层级不归到北京/上海。香港/澳门不映射到内地，巴黎/慕尼黑独立。
- 多城市岗位仍只走一次既有 jobs filter/sort；不复制岗位。
- 原始 location 在 JobRow / Detail / Full Detail、搜索和数据库中不变。Qualification、Evidence、Reliability、品牌及 CSS 不变。

## 旧 URL 兼容

单一可识别城市别名如 `city=北京顺义区` 的过滤语义归为北京，下拉展示北京；保留原 URL，不引入 history/effect 循环。旧复合值如 `北京市,上海市` 不擅自扩大到两个城市的并集，继续精确匹配原始元素，并把当前值显示在下拉里。未知旧值同样可见，安全返回空结果，可清除。Search/status/sort/job/returnTo 仍用原来的 URL 契约。

## 真实只读分类（411 jobs / 13 companies）

读取现有应用 read model，无数据库写入。96 种原始地点元素已存为 `tests/fixtures/location-samples.json`；逐项输出见本报告附表 JSON。

- 已识别城市/地区：**54**（含香港和 2 个境外城市）。
- 至少一个城市被可靠识别：**410 / 411 jobs**。
- 所有地点均可归类：**409 / 411 jobs**。
- 归一后多城市岗位：**124**。原数组含多个元素的 111 条并不等于多城市岗位数，因为一个元素也可包含多个城市。
- 未可靠归类：`浙江`（1 job，仅省级）；`海南省-澄迈县`（1 job，省直辖县，不能猜为海口）。两者原文保留为筛选项；一个岗位同时含已识别城市，因此两项未识别不等于两条全未知岗位。
- 下拉共 **56** 个当前数据项：54 个规范城市/地区 + 2 个原文保留项。

| 筛选值 | 修复前精确原文命中 | 修复后规范城市命中 |
|---|---:|---:|
| 北京 | 120 | 232 |
| 上海 | 47 | 88 |
| 深圳 | 7 | 66 |

这是相同短名称选择值的 before/after；修复前“北京市”另有 52、“上海市”19、“深圳市”32、“广东省-深圳市”12、“北京顺义区”14。不能把旧别名计数直接相加，因为岗位可能重复包含多个别名。修复后以岗位 ID 去重。

## 测试与误归类检查

lint、typecheck、**23 files / 387 tests**、production build 全通过；git diff --check 通过。

新增真实 corpus 及边界测试覆盖直辖市短/长名、区县别名、重复市名、省市层级、中文/英文逗号、三个以上城市、重复城市、县级层级、未知/国外/港澳、省市冲突、裸区县、空数组、旧单城市/复合/未知 URL。selectJobs 集成测试确认原始 jobs 不变、Qualification 结果不变、搜索/排序兼容、多城市无重复。

本地 Next.js production + 真实 Supabase：Desktop 1440×950 遍历全部 54 个规范项，Mobile 390×844 检查北京/上海/深圳/香港/巴黎。每项岗位 ID 集合与只读分类相符，重复岗位 0、page errors 0。组合搜索/排序、reload、旧 alias URL、旧 composite URL、unknown URL、Detail/Full Detail/返回上下文通过；详情仍显示“北京顺义区”原文。

### 截图

- [Desktop 北京筛选](assets/location-normalization-v1/desktop-beijing.png)
- [Mobile 北京筛选](assets/location-normalization-v1/mobile-beijing.png)

## 数据口径与限制

归一表不是全量行政区数据库；未审过的别名或外国英文地名不会自动翻译，保留原文。对模糊区县不以识别率为目标推断城市。真实来源原文可能本身有误，本模块不校正其地理事实。

层级参考：[北京行政区划](https://www.beijing.gov.cn/renwen/bjgk/xzqh/)、[江苏人口区划](https://www.jiangsu.gov.cn/col/col88749/index.html)。其余当前城市层级来自本轮保存的真实 source location 显式省市字段；没有从岗位标题/公司猜城市。

未修改数据库、pipeline、Gate、资格、Evidence、状态、UI 体系或 Logo。未部署、未 push：当前分支已关联 Vercel Production 自动部署，故本轮只做独立本地 commit，等待用户验收后再决定上线。
