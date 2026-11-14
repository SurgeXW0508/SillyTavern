# Phase C Release Closeout — 2026-11-09

> [!NOTE]
> 本文为 `v1.19.0-personal.1`（2026-11-09）发行与首次 NAS 实机切换归档快照。后续三仓库分支推进（含柏宝库个人 Fork 建仓及 2026-11-12 ~ 2026-11-14 阶段合入/候选验证）详见 [PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json) 与 [MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)。

**正式GHCR镜像已完成NAS切换和基本实机验收；最终文档提交等待独立审查。** 本轮只登记用户提供的真实结果，没有新的Runtime、插件或生产操作。

## 当前生产组合

| 项目 | 已登记事实 |
| --- | --- |
| Release / source | [v1.19.0-personal.1](https://github.com/SurgeXW0508/SillyTavern/releases/tag/v1.19.0-personal.1)，source `1af2180585e5bbe49159bc8884d5c890641f13c3` |
| Frozen Runtime | `090cbba6d40e5d117ab41a9e6deb20b40e2dc336`；文档HEAD不替代Runtime或镜像source |
| GHCR | `ghcr.io/surgexw0508/sillytavern-personal` |
| Digest | `sha256:22973f7169fa694a0894b054e2b754ccf0ea881703d32a011e473c79c87ac740`；NAS Compose已使用该正式Digest |
| 实际Docker Image ID | `sha256:dfb4f08735296b0b7610e9936cbce707af8d0021ac6d4eaafadc93c074b09e01` |
| 容器/状态 | `sillytavern`，实际Health为`healthy`，核验时RestartCount为`0` |
| Tools实际部署 | `SurgeXW0508/ST-BaiBai-Tools:personal/stable@2f6a9c54d2c906b4a0e44d20c12d0712552e393d`；origin为个人Fork，tracking为`origin/personal/stable`，工作区clean |
| Tools仓库维护HEAD | `ac1279a7535a424c3dc3b2f7a5b2913783fdf7e8`仅改AGENTS链接，不是NAS实际SHA；生产源码/dist与验证基线相同 |
| BaiBaoKu实际部署 | `baibai-git/baibaoku@b211a4e97fdaec24dc8b90c85ddc198fac9ac200`，0.7.3，上游原版，无个人Fork |

上述生产数据来源是用户本轮提供的NAS实际输出，Work没有重新连接NAS核验。机器可读的当前事实见[PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json)。Compose具体路径、网络细节和未提供的旧镜像ID不作推测。

## 正式镜像实机验收

| 检查 | 正式GHCR镜像结果 |
| --- | --- |
| 容器正常启动 | 已通过 |
| Health正常 | 已通过；healthy，核验时RestartCount=0 |
| Vertex普通RP正文生成 | 已通过 |
| 刷新页面后聊天记录保留 | 已通过；不据此额外声明刷新后再次生成已单独复验 |

**正式镜像尚未单独验收的范围**包括：连续多轮、刷新后继续生成、Stop、Regenerate、Swipe、Continue、真实工具、多轮Thinking/Signature、JSON非流式/图片等可选能力、非Vertex smoke及部分Core故障场景。只记录为未在正式环境验证，不写成通过或失败。

Candidate阶段曾确认RP、多轮、刷新后继续、Stop和Regenerate；这些历史结果保留在Production Baseline的candidate_acceptance中，不合并进formal_acceptance。代码审查、自动化与CI镜像health smoke同样不能替代真实NAS各项验收。

## 已完成的发布历史

[Final Delta Audit](FINAL_DELTA_AUDIT.md)通过，未发现需要重开Runtime的P1/security/data correctness/Owner blocker。Stage `1af21805`在behind 0及CI通过后快进合入release，来源提交保留；官方纯基线在`upstream/release@06bde939fb1e9c4c8d8641d810f0a916b5bce127`。

[Personal Core CI](https://github.com/SurgeXW0508/SillyTavern/actions/runs/42593431772)和[Personal Release](https://github.com/SurgeXW0508/SillyTavern/actions/runs/42593642846)此前成功，正式版本镜像、隔离health smoke与资产校验完成。本轮未重跑这些流程，未修改Tag/Release/镜像/CI或personal-release.json。

[Validated Stack](https://github.com/SurgeXW0508/SillyTavern/releases/download/v1.19.0-personal.1/validated-stack.json)保留发布时的source、Digest、插件pin和当时验收快照，保持不可变；后续NAS结果只补到当前生产文档，不追改其历史pending字段。

## 维护交接与保留事项

三仓库维护关系、单Owner与关闭重复功能的规则见[MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)，更新/发布/回滚及后续责任见[PERSONAL_RELEASE_OPERATIONS.md](PERSONAL_RELEASE_OPERATIONS.md)。不依赖本次开发历史或另一个对话解释当前版本。

Candidate/临时目录、旧官方1.19.0镜像和完整目录备份仍保留；Backrest自动备份/恢复验证、生产数据恢复演练、飞牛GUI更新方式及部分正式能力验收均未完成。既有`listen is enabled but private request filter is disabled`警告尚未单独评估；没有用healthy或基本RP结果代替安全结论。网络出口稳定性仍独立于Core correctness记录。

本轮只修改上述维护入口、生产基线和相关文档；不改Runtime/插件/Dockerfile/依赖/CI，不操作NAS/Compose，不构建发布、不删除资产。文档分支不直接合并，等待独立审查。
