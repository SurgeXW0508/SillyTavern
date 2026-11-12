# Personal Release / NAS Operations

接手时先读[PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json)确认真实Current，再读[MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)完成三仓库Owner Review。本文负责发布/部署/回滚流程；[RELEASE_CLOSEOUT.md](RELEASE_CLOSEOUT.md)负责本版实际验收范围。历史审查见[Final Delta Audit](FINAL_DELTA_AUDIT.md)，不再从历史聊天推断当前状态。

## 当前正式生产状态

2026-11-09用户提供的NAS结果确认：`v1.19.0-personal.1`正式GHCR镜像已经切换到容器`sillytavern`，Health为`healthy`，核验时RestartCount为0。当前Compose使用固定Digest：

```text
ghcr.io/surgexw0508/sillytavern-personal@sha256:22973f7169fa694a0894b054e2b754ccf0ea881703d32a011e473c79c87ac740
```

实际Image ID为`sha256:dfb4f08735296b0b7610e9936cbce707af8d0021ac6d4eaafadc93c074b09e01`。Release source是`1af2180585e5bbe49159bc8884d5c890641f13c3`，Runtime仍是`090cbba6d40e5d117ab41a9e6deb20b40e2dc336`；后续文档HEAD不是新的镜像source。

2026-11-12再次核验：容器状态为`running`、RestartCount为0；Compose 标签确认项目名为`sillytavern`，WorkingDir为`/vol3/1000/SillyTavern`，配置文件为`/vol3/1000/SillyTavern/docker-compose.yml`。挂载仍将宿主机的`config`、`data`、`plugins`、`extensions`分别映射到容器对应目录；视频目录以只读方式挂载。飞牛 Docker 已正式管理该 Compose 项目，无需迁移管理方式。

NAS Tools实际为`personal/stable@2f6a9c54d2c906b4a0e44d20c12d0712552e393d`，origin为个人Fork，tracking为`origin/personal/stable`，工作区clean；BaiBaoKu当前Runtime为上游等价0.7.3/`b211a4e97fdaec24dc8b90c85ddc198fac9ac200`；NAS仍使用原作者origin并处于detached HEAD，个人Fork的`personal/stable`已建立但尚未切换。Tools仓库维护HEAD `ac1279a7`仅改AGENTS链接，不能把它写成NAS已安装SHA。

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

## 飞牛 OS 图形化更新流程（已实机确认）

2026-11-12已通过容器标签确认，`sillytavern` 是飞牛 Docker Compose 项目：

- Project：`sillytavern`
- WorkingDir：`/vol3/1000/SillyTavern`
- ConfigFiles：`/vol3/1000/SillyTavern/docker-compose.yml`

生产 Compose 使用固定 GHCR Digest，而不是浮动标签。后续 ST Runtime 更新可以完全通过飞牛 Docker 图形界面完成，不需要 SSH 登录 NAS。

### 正常更新步骤

1. Work 完成 Runtime 修改、审查、测试，并按授权流程合入个人 `release`。
2. 使用仓库既有 Personal Release Workflow 发布正式版本。GitHub Actions 构建并推送 GHCR 镜像；从对应 Release 的 Validated Stack / 发布信息取得本次**不可变 Digest**。
3. 打开飞牛 OS → Docker → Compose → `sillytavern` 项目，编辑现有 Compose 配置。
4. 只将 `image:` 改为本次已审查的完整 Digest，例如：

   ```yaml
   image: ghcr.io/surgexw0508/sillytavern-personal@sha256:<new-digest>
   ```

5. 保持原项目目录、服务名、网络、端口、环境变量、重启策略和所有挂载不变；在原 Compose 项目中保存并部署/重新创建服务。
6. 在飞牛 Docker 图形界面确认容器使用新镜像、状态正常、没有持续重启，并查看启动日志；再进行本次变更涉及的最小业务 Smoke。
7. 验收成功后记录新的 Digest、Image ID、实际插件 SHA 和验收范围，更新 Production Baseline。保留上一个已验证组合作为回滚目标。

### 必须保留的部署路径

```text
Compose project: sillytavern
WorkingDir:      /vol3/1000/SillyTavern
Config file:     /vol3/1000/SillyTavern/docker-compose.yml

./config    -> /home/node/app/config
./data      -> /home/node/app/data
./plugins   -> /home/node/app/plugins
./extensions -> /home/node/app/public/scripts/extensions/third-party
/vol1/1000/ST-Video/videos -> /media/video-clips (read-only)
```

### Digest 更新注意事项

- 飞牛“本地镜像”列表中显示的镜像更新提示，与 Compose 服务实际切换不是一回事。
- 当前 Compose 固定使用 `@sha256:...`。只拉取新镜像、或在本地镜像列表中对旧 Digest 点击更新，都不会自动改变 Compose 引用。
- 正确入口是编辑 `sillytavern` Compose 项目的 `image:`，替换成新 Digest，再由同一 Compose 项目部署。
- 不改成 `latest`，不使用浮动标签，不在运行容器内部修改 ST Runtime 文件，也不另起一个共享同一数据目录的临时 ST 容器。
- 回滚时在同一 Compose 配置中把 `image:` 恢复为上一个已验证 Digest，再通过飞牛图形界面重新部署。镜像回滚不等于数据回滚；不要因此覆盖用户数据。

## Companion Plugin 更新入口

- **柏宝箱**：通过 SillyTavern 原生第三方扩展管理器更新当前 `personal/stable` 分支，然后完整刷新浏览器。它是独立挂载的前端 Git Extension，不需要重建 ST 镜像。详细流程见 [ST-BaiBai-Tools Personal Maintenance](https://github.com/SurgeXW0508/ST-BaiBai-Tools/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)。
- **柏宝库**：它是独立挂载的 Server Plugin，不属于前端扩展更新按钮。完成 NAS 一次性分支整理后，在飞牛 Docker 的 `sillytavern` 容器终端中只更新目标插件，再通过图形界面重启容器。不要用会遍历所有插件的全局更新命令。详细流程见 [BaiBaoKu Personal Maintenance](https://github.com/SurgeXW0508/baibaoku/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)。

正常维护不需要 SSH。飞牛容器终端只用于柏宝库这类 Server Plugin 的定向 Git 更新；重启和 Compose 镜像切换均通过飞牛图形界面完成。

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
| 柏宝库 NAS Git 跟踪关系尚未整理 | 单独授权一次性将 NAS 插件从原作者 detached checkout 切换到个人 Fork 的 `personal/stable`；不影响当前运行版本 |
| 真实生产数据恢复演练未进行 | 用户在独立恢复任务中验证，不在本轮操作真实数据 |
| 部分Vertex及非Vertex能力未正式验收 | 对应能力变化或确有使用需要时，由维护者/用户补受影响组合验证，不追增本轮开发 |
| 既有启动日志`listen is enabled but private request filter is disabled`尚未单独评估 | 部署维护者在独立安全审查中判断；本轮只记录，不推断原因/暴露范围或调整配置 |

基本部署验收完成不等于备份、GUI、安全和所有可选能力已验收。临时资产保持保留，Production Baseline的cleanup_allowed继续为false；本轮不授权删除任何文件、镜像或备份。

## 本轮文档状态

2026-11-12本次更新仅修订维护与部署文档：确认飞牛Compose图形化更新入口、记录三仓库当前分支/安装方式，并建立柏宝箱与柏宝库的个人维护Runbook。未修改Runtime、未运行CI/构建、未创建Tag/Release、未推送GHCR镜像、未更新NAS或重启容器。当前柏宝库NAS Git分支整理仍是独立待授权事项。
