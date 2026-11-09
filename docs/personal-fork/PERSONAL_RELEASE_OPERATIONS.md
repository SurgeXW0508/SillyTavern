# Personal Release / NAS Operations

接手时先读[PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json)确认真实Current，再读[MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)完成三仓库Owner Review。本文负责发布/部署/回滚流程；[RELEASE_CLOSEOUT.md](RELEASE_CLOSEOUT.md)负责本版实际验收范围。历史审查见[Final Delta Audit](FINAL_DELTA_AUDIT.md)，不再从历史聊天推断当前状态。

## 当前正式生产状态

2026-11-09用户提供的NAS结果确认：`v1.19.0-personal.1`正式GHCR镜像已经切换到容器`sillytavern`，Health为`healthy`，核验时RestartCount为0。当前Compose使用固定Digest：

```text
ghcr.io/surgexw0508/sillytavern-personal@sha256:22973f7169fa694a0894b054e2b754ccf0ea881703d32a011e473c79c87ac740
```

实际Image ID为`sha256:dfb4f08735296b0b7610e9936cbce707af8d0021ac6d4eaafadc93c074b09e01`。Release source是`1af2180585e5bbe49159bc8884d5c890641f13c3`，Runtime仍是`090cbba6d40e5d117ab41a9e6deb20b40e2dc336`；后续文档HEAD不是新的镜像source。

NAS Tools实际为`personal/stable@2f6a9c54d2c906b4a0e44d20c12d0712552e393d`，origin为个人Fork，tracking为`origin/personal/stable`，工作区clean；BaiBaoKu为原版0.7.3/`b211a4e97fdaec24dc8b90c85ddc198fac9ac200`。Tools仓库维护HEAD `ac1279a7`仅改AGENTS链接，不能把它写成NAS已安装SHA。

正式镜像只确认启动、Health、Vertex普通RP正文生成和刷新后聊天记录保留。Candidate多轮/Stop/Regenerate等历史测试单独记录，未在正式环境复验的能力不标通过。生产数据恢复和安全评估也不由healthy状态代替。

## 发布源与分支

- `upstream/release`：纯官方release同步基线，当前`06bde939fb1e9c4c8d8641d810f0a916b5bce127`，不放个人策略。
- `stage/*`：独立开发和验证。`release`：Personal正式稳定分支。
- `personal-release.json`：审查过的版本、上游基线、Runtime SHA、插件pin和当时验收范围；发布授权后按既有流程使用。本轮没有修改该文件。
- Shalistera仅为参考，不自动同步。任何组件更新都要先核查另两个组件，具体流程以canonical文档为准。

长期流程：**Review → Stage → CI → Release/Tag → GHCR → NAS Compose → Health/Smoke**。只有经过审查和CI的候选才合入release，通过既有Personal Release Workflow生成版本化制品；不因官方或柏宝有新提交直接升级生产，也不顺手更新伴随插件。

既有Personal Release流水线创建固定Tag、构建同一source commit、推送GHCR、执行无凭据/无生产数据的镜像启动health smoke，再发布附带资产的Release。GITHUB_TOKEN生成的Tag不作为级联触发另一workflow的依赖。不发布个人latest；同版本不覆盖，失败仅重跑失败job，成功build不重建，已公开资产不追改。本轮不重跑、修改或发布任何制品。

镜像支持linux/amd64与linux/arm64构建，历史流水线启动smoke仅在原生amd64执行；构建成功不是其他平台实机验收。Dockerfile的base仍为浮动`node:lts-alpine3.23`，生产固定本次已验证Digest，不把未来同源码重建视为相同镜像。

## Validated Stack与生产事实

每个正式Release保留：

- `validated-stack.json`：Tag、source/Runtime SHA、上游baseline、镜像Digest/build date/Actions URL、两插件pin及发布时验收快照。
- `stack.env`：非秘密的ST_IMAGE Digest值；是否接入某个NAS管理入口需按实际环境确认。
- `verify-stack.py`：已有只读核验工具，不pull、不checkout、不重启、不修改数据。
- `SHA256SUMS`：资产传输完整性校验。

Release资产是不可变的发行记录，本次不修改Tag/Release、镜像、personal-release.json或资产中的历史pending字段。**发布后的真实部署与验收事实更新在PRODUCTION_BASELINE.json和Release Closeout**，不能因为旧资产写着pending就推断NAS尚未部署，也不能把Candidate passed升级成正式passed。

Tools部署pin仍为已验证的`2f6a9c54`。已有核验工具仅在全部Git树（只排除AGENTS.md）相同时接受维护后继，并分别输出实际SHA与验证SHA；不能豁免source/config/build改动。本轮没有更新NAS Tools，也没有执行该工具。

## 后续NAS更新边界

当前Compose已经使用正式GHCR Digest。NAS不再常规clone、build或patch Runtime；不跟踪浮动latest，不手改运行文件。每次变更先选已审查的Release与三组件精确SHA，保留原挂载/配置/网络和用户数据；拉取正式Digest、切换对应服务、确认Health/Smoke后再更新Current/Previous及Production Baseline。

**飞牛OS GUI更新方式尚未最终确认。** 本文不规定按钮、界面路径、环境文件接入方案或一键更新承诺。需要后续单独核实实际管理入口后再固化操作步骤，本轮不设计或执行GUI/Compose操作。

仓库已有的可选只读入口如下，实际是否在NAS使用未在本轮提供；不据此宣称自动/GUI更新已实现：

```bash
python3 verify-stack.py --stack validated-stack.json --config nas-paths.json
```

`nas-paths.json`应只放已确认的容器名和两插件容器内路径，无凭据。默认release模式检查Digest和source label，Candidate模式不证明正式镜像匹配。工具不能证明没有重复安装，也不代替Save Generate/Generate Retry独立开关、自更新、扩展管理接管和模型行为的检查；Extension Manager未使用则无需为了验证强制开启。

本版此前已验证GHCR manifest可匿名读取；未来版本仍按实际包权限检查，不在聊天、Compose或命令参数写PAT。不得以仓库公开推断所有镜像权限。

## Current + Previous与恢复边界

以后每次成功升级，记录当前与上一个已验证正式Personal镜像的Digest、Validated Stack、实际插件SHA及相应配置。当前Previous正式Personal版本尚未登记，不把临时Candidate冒充Previous；旧官方1.19.0回滚镜像仍保留，到下一次Personal Release成功后再按Current + Previous规则轮换。

Runtime故障优先回到上一个已验证镜像，同时确认Tools/BaiBaoKu与该组合一致；插件有漂移时需恢复相应代码/配置，不能只回滚ST留下新Hook/Branch。数据恢复与Runtime回滚分开，不自动覆盖聊天数据。

当前完整目录备份仍保留，Backrest自动备份和恢复验证尚未完成，真实生产数据恢复演练也未进行。因此只登记已有回滚资产，不宣称完整恢复能力已验证；数据正确性事故先停止写入、保留现场，再在独立任务中按已核实恢复点处理。本轮不进行恢复或清理。

## 保留事项与后续责任

| 现状 | 后续责任与范围 |
| --- | --- |
| Candidate镜像和临时目录尚未清理 | 用户在独立NAS清理任务中确认具体资产，不在本轮处理 |
| 官方1.19.0回滚镜像仍保留 | 用户在下一次Personal Release成功后按Current/Previous规则评估轮换 |
| 完整目录备份仍保留 | 用户确认恢复保障和保留策略后另行决定；不把现有目录备份写成已验证恢复点 |
| Backrest自动备份和恢复验证未完成 | 用户在独立备份任务中完善并留验收证据 |
| 飞牛OS GUI更新方式未最终确认 | 部署维护者与用户后续核实实际入口；不宣称已实现 |
| 真实生产数据恢复演练未进行 | 用户在独立恢复任务中验证，不在本轮操作真实数据 |
| 部分Vertex及非Vertex能力未正式验收 | 对应能力变化或确有使用需要时，由维护者/用户补受影响组合验证，不追增本轮开发 |
| 既有启动日志`listen is enabled but private request filter is disabled`尚未单独评估 | 部署维护者在独立安全审查中判断；本轮只记录，不推断原因/暴露范围或调整配置 |

基本部署验收完成不等于备份、GUI、安全和所有可选能力已验收。临时资产保持保留，Production Baseline的cleanup_allowed继续为false；本轮不授权删除任何文件、镜像或备份。

## 本轮文档状态

正式部署与上述基本Smoke结果已按用户提供的NAS输出登记。最终文档从最新release建立独立分支，提交后等待独立审查；本轮不直接合并、不发布、不部署。入口与Owner规则只有一份canonical维护文档，历史部署交接保留作过程记录，不另建操作体系。
