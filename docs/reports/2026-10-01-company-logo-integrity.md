# Post-M0 Patch — Company Logo Integrity

2026-10-01。M0/Task 7 Visual Design 保持 Frozen，仅修正公司身份资产解析；未进入 M1、部署或基础设施工作。

## 发现与处理

旧实现已经是本地 display-name 映射，没有运行时 domain resolver；缺陷在资产准入：把网站 favicon 来源当作公司身份确认。腾讯错误图标因此进入本地映射。本轮删除错误文件及引用，不下载替代商标。

真实数据库只读核对仍为8条岗位、5个公司身份：

| 公司 | 岗位数 | 原资产来源 | 本轮结果 |
| --- | ---: | --- | --- |
| 腾讯 | 2 | tencent.com 声明的 favicon → tencent.png | 用户确认子产品类图标；移除，使用 腾。仓库无使用条件可确认的公司级替代资产。 |
| 小米 | 2 | mi.com/favicon.ico → xiaomi.ico | 既有橙色 mi 公司标识可识别，保持文件原样。 |
| vivo | 2 | vivo.com/favicon.ico → vivo.ico | 蓝色 V 形 favicon 的现有出处不足以确认公司级身份；移除，使用 V。未断言它必属其他品牌。 |
| 中国银行股份有限公司 | 1 | boc.cn/favicon.ico → boc.ico | 既有中国银行红色标志可识别，保持文件原样。 |
| 保禄翊腾（浙江）包装新材料有限公司 | 1 | 无 | 保持 保 fallback。 |

此表以本轮对本地资产的实际视觉检查和用户对腾讯的纠错为准。网站 favicon 出处本身不是公司身份验证，也不等于商标许可。没有从图片搜索、第三方logo网站或未知CDN采集资产。保留资产的身份/用途记录见 `public/company-marks/README.md`；不声称取得广泛商标使用许可。

## 实现

- `src/lib/radar/company-brand.ts`：最小 curated mapping，仅小米与中国银行两个本地资产；key 沿用 canonicalization 的 NFKC / trim / 空白折叠 / lowercase 规则，不改领域实现、不去公司后缀、不猜别名。
- resolver仅接收company字符串，source/recruiting/ATS hostname没有覆盖入口。固定 `verified curated asset → neutral company-initial fallback`，无未知favicon、网络API、数据库表或新依赖。
- `CompanyMark`复用原组件容器、Image和onError路径；失败按normalized identity记忆，回到原首字符样式。
- 删除public下错误Tencent和存疑vivo资产；历史报告/截图保留为历史，不被生产UI引用。
- CSS、Desktop28px/34px、Mobile18px/24px、fallback样式、品牌、IA、资格和真实数据均不改。

## 验证与自审

- lint / typecheck / tests / build 全通过，18 files / 298 tests。
- 新增6项离线测试：腾讯排除、两个curated命中且文件存在、保守归一化/不猜公司、未知稳定fallback、域名不能覆盖公司身份。
- `tests/browser/company_logo_integrity.py`：真实8jobs；两条腾讯无图片且显示腾，两条vivo显示V，3个curated图片加载成功；拦截小米图片请求后实际React onError显示小。无pageerror。
- 桌面graphic28px/container34px、移动container24px实测通过，无横向溢出。测试Profile仍2027本科机械工程，3Blocked，不修改数据库或extraction。
- 新Desktop截图已实际查看，腾讯两条岗位均可见：[Desktop Radar](assets/company-logo-integrity/desktop-radar.png)。
- diff自审：无CSS、package/lockfile、冻结文档、领域语义变更；两个保留图标字节未变；无secret或外部asset加载新增。

腾讯/vivo后续仅在有明确身份确认的本地资产时再单独准入，不将补齐Logo作为本patch阻塞项。停止于本次身份正确性修复。
