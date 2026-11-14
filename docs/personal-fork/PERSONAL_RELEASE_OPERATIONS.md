# Personal Release / NAS Operations

接手时先读[PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json)确认真实Current，再读[MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)完成三仓库Owner Review。本文负责发布/部署/回滚流程；[RELEASE_CLOSEOUT.md](RELEASE_CLOSEOUT.md)负责本版实际验收范围。历史审查见[Final Delta Audit](FINAL_DELTA_AUDIT.md)，不再从历史聊天推断当前状态。

## 当前正式生产状态

2026-11-09用户提供的NAS结果确认：`v1.19.0-personal.1`正式GHCR镜像已经切换到容器`sillytavern`，Health为`healthy`，核验时RestartCount为0。当前Compose使用固定Digest：

```text
ghcr.io/surgexw0508/sillytavern-personal@sha256:22973f7169fa694a0894b054e2b754ccf0ea881703d32a011e473c79c87ac740
```

实际Image ID为`sha256:dfb4f08735296b0b7610e9936cbce707af8d0021ac6d4eaafadc93c074b09e01`。Release source是`1af2180585e5bbe49159bc8884d5c890641f13c3`，线上Runtime仍是`090cbba6d40e5d117ab41a9e6deb20b40e2dc336`；后续合入`release`分支的文档提交或暂缓发版的阶段性Runtime里程碑（如2026-11-12合入的Vertex收尾Runtime `e49a694083cc46dbf883f13eab664076c139011f`）在未执行正式Personal Release构建与NAS切换前，均不改变当前线上镜像source或实际运行代码。

2026-11-12再次核验：容器状态为`running`、RestartCount为0；Compose 标签确认项目名为`sillytavern`，容器名为`sillytavern`（宿主机 Compose 工作目录记为 `<NAS_ST_COMPOSE_DIR>`，配置文件为 `<NAS_ST_COMPOSE_DIR>/docker-compose.yml`）。挂载将 Compose 项目下的 `./config`、`./data`、`./plugins`、`./extensions` 分别映射到容器对应目录；外部媒体目录以只读方式挂载至 `/media/video-clips`。飞牛 Docker 已正式管理该 Compose 项目，无需迁移管理方式。

切换 `v1.19.0-personal.2` 前的 NAS 实机基线（`v1.19.0-personal.1` 组合）：Tools 为 `personal/stable@2f6a9c54d2c906b4a0e44d20c12d0712552e393d`，origin 为个人 Fork，tracking 为 `origin/personal/stable`，工作区 clean；BaiBaoKu 于 2026-11-12 完成 Git 跟踪整理，分支 `personal/stable`，origin 为 `SurgeXW0508/baibaoku`，upstream 为 `baibai-git/baibaoku`，tracking 为 `origin/personal/stable`，工作区 clean，停留在 `4814830f`（实际运行 Runtime `b211a4e9`，`0.7.3`，保留备份分支 `backup/pre-personal-stable-20261112`）。

2026-11-14 已统一发布下一正式版本 **`v1.19.0-personal.2`**（冻结 ST Runtime `9817c0e6de8647f6519b5cc2fc583df3070c4053`，配对 `ST-BaiBai-Tools` `1.2.0` `personal/stable@84345b9ac394a093bb89d8251ab197335f8f0b5b` / Runtime `1e8d5a818e19c7deafee42808aa39033c25170a1` 与 `baibaoku` `0.7.4` `personal/stable@0f8bd4d167713234ed2b9a56a62b4b37bcaea610` / Runtime `e9d95265c77187446177e839a2b97975ebb2aa0d`），待用户按本文流程在 NAS 执行三组件同步切换与实机 Smoke 后，再将 `PRODUCTION_BASELINE.json` 的 `current_production` 推进至 `v1.19.0-personal.2`。

正式镜像只确认真实环境已核验项；Candidate 与自动化测试结果单独记录，未在正式环境复验的能力不标通过。生产数据恢复和安全评估也不由 healthy 状态代替。

## 发布源与分支

- `upstream/release`：纯官方release同步基线，当前`06bde939fb1e9c4c8d8641d810f0a916b5bce127`，不放个人策略。
- `stage/*`：独立开发和验证（合入且核验 `0 ahead` 后清理）。`release`：Personal正式稳定分支。
- `personal-release.json`：审查过的版本、上游基线、Runtime SHA、两伴随仓库 `personal/stable` pin 和验收范围；修改并推送到`release`会触发`personal-release.yml`自动打Tag并构建推送GHCR镜像（当前已更新至 `v1.19.0-personal.2`）。
- Shalistera仅为参考，不自动同步。任何组件更新都要先核查另两个组件，具体流程以canonical文档为准。

长期流程：**Review → Stage → CI → Release/Tag → GHCR → NAS Compose → Health/Smoke**。只有经过审查和CI的候选才合入release，通过既有Personal Release Workflow生成版本化制品；不因官方或柏宝有新提交直接升级生产，也不顺手更新伴随插件。

既有Personal Release流水线创建固定Tag、构建同一source commit、推送GHCR、执行无凭据/无生产数据的镜像启动health smoke，再发布附带资产的Release。GITHUB_TOKEN生成的Tag不作为级联触发另一workflow的依赖。不发布个人latest；同版本不覆盖，失败仅重跑失败job，成功build不重建，已公开资产不追改。

镜像支持linux/amd64与linux/arm64构建，流水线启动smoke在原生amd64执行；构建成功不是其他平台实机验收。Dockerfile的base仍为浮动`node:lts-alpine3.23`，生产固定本次已验证Digest，不把未来同源码重建视为相同镜像。

## Validated Stack与生产事实

每个正式Release保留：

- `validated-stack.json`：Tag、source/Runtime SHA、上游baseline、镜像Digest/build date/Actions URL、两插件pin及发布时验收快照。
- `stack.env`：非秘密的ST_IMAGE Digest值；是否接入某个NAS管理入口需按实际环境确认。
- `verify-stack.py`：已有只读核验工具（同时校验 ST Digest/source label 以及柏宝箱、柏宝库的 `origin`、`personal/stable` 分支和 `origin/personal/stable` 跟踪关系），不pull、不checkout、不重启、不修改数据。
- `SHA256SUMS`：资产传输完整性校验。

Release资产是不可变的发行记录，已发布版本的历史资产与Tag不追改。**发布后的真实部署与验收事实更新在PRODUCTION_BASELINE.json**，不能因为资产写着pending就推断NAS尚未部署，也不能把Candidate/自动化passed升级成正式passed。

`verify-stack.py` 对柏宝箱在全部 Git 树（仅排除 `AGENTS.md`）一致时接受文档维护后继，并分别输出实际 SHA 与验证 SHA；不能豁免 source/config/build 改动。

## 后续NAS更新边界

当前Compose已经使用正式GHCR Digest。NAS不再常规clone、build或patch Runtime；不跟踪浮动latest，不手改运行文件。每次变更先选已审查的Release与三组件精确SHA，保留原挂载/配置/网络和用户数据；拉取正式Digest、切换对应服务、确认Health/Smoke后再更新Current/Previous及Production Baseline。

## 飞牛 OS 图形化更新流程（已实机确认）

2026-11-12已通过容器标签确认，`sillytavern` 是飞牛 Docker Compose 项目：

- Project：`sillytavern`
- Container：`sillytavern`
- WorkingDir：`<NAS_ST_COMPOSE_DIR>`（原 Compose 项目所在目录，日常 GUI 更新无需手输宿主机绝对路径）
- ConfigFiles：`<NAS_ST_COMPOSE_DIR>/docker-compose.yml`

生产 Compose 使用固定 GHCR Digest，而不是浮动标签。后续 ST Runtime 更新可以完全通过飞牛 Docker 图形界面完成，不需要 SSH 登录 NAS。

### 正常更新步骤

1. 完成 Runtime 修改、审查、测试，并按授权流程合入个人 `release`。
2. 使用仓库既有 Personal Release Workflow 发布正式版本。GitHub Actions 构建并推送 GHCR 镜像；从对应 Release 的 Validated Stack / 发布信息取得本次**不可变 Digest**。
3. 打开飞牛 OS → Docker → Compose → `sillytavern` 项目，编辑现有 Compose 配置。
4. 只将 `image:` 改为本次已审查的完整 Digest，例如：

   ```yaml
   image: ghcr.io/surgexw0508/sillytavern-personal@sha256:<new-digest>
   ```

5. 保持原项目目录、服务名、网络、端口、环境变量、重启策略和所有挂载不变；在原 Compose 项目中保存并部署/重新创建服务。
6. 在飞牛 Docker 图形界面确认容器使用新镜像、状态正常、没有持续重启，并查看启动日志；再进行本次变更涉及的最小业务 Smoke。
7. 验收成功后记录新的 Digest、Image ID、实际插件 SHA 和验收范围，更新 Production Baseline。保留上一个已验证组合作为回滚目标。

### 必须保留的部署挂载关系

```text
Compose project: sillytavern
Container name:  sillytavern
WorkingDir:      <NAS_ST_COMPOSE_DIR>
Config file:     <NAS_ST_COMPOSE_DIR>/docker-compose.yml

./config     -> /home/node/app/config
./data       -> /home/node/app/data
./plugins    -> /home/node/app/plugins
./extensions -> /home/node/app/public/scripts/extensions/third-party
<NAS_MEDIA_RO_DIR> -> /media/video-clips (read-only)
```

### Digest 更新注意事项

- 飞牛“本地镜像”列表中显示的镜像更新提示，与 Compose 服务实际切换不是一回事。
- 当前 Compose 固定使用 `@sha256:...`。只拉取新镜像、或在本地镜像列表中对旧 Digest 点击更新，都不会自动改变 Compose 引用。
- 正确入口是编辑 `sillytavern` Compose 项目的 `image:`，替换成新 Digest，再由同一 Compose 项目部署。
- 不改成 `latest`，不使用浮动标签，不在运行容器内部修改 ST Runtime 文件，也不另起一个共享同一数据目录的临时 ST 容器。
- 回滚时在同一 Compose 配置中把 `image:` 恢复为上一个已验证 Digest，再通过飞牛图形界面重新部署。镜像回滚不等于数据回滚；不要因此覆盖用户数据。

## Companion Plugin 更新入口

- **柏宝箱**：通过 SillyTavern 第三方扩展管理器更新当前 `personal/stable` 分支，然后完整刷新浏览器。它是独立挂载的前端 Git Extension，不需要重建 ST 镜像（注意：柏宝库默认开启扩展管理接管，若出现 `LOCAL_CHANGES` / `DIVERGED` / `DETACHED_HEAD` 提示，切勿点击“强制更新”，先核对 `origin` 与 `personal/stable` 跟踪关系）。详细流程见 [ST-BaiBai-Tools Personal Maintenance](https://github.com/SurgeXW0508/ST-BaiBai-Tools/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)。
- **柏宝库**：它是独立挂载的 Server Plugin，不属于前端扩展更新按钮。NAS 已完成一次性分支整理；日常在飞牛 Docker 的 `sillytavern` 容器终端中对固定容器路径 `/home/node/app/plugins/baibaoku` 执行定向 `git pull --ff-only origin personal/stable`，再通过图形界面重启容器（或随 ST Compose 新镜像一并重新部署重启）。不要用会遍历所有插件的全局更新命令。详细流程见 [BaiBaoKu Personal Maintenance](https://github.com/SurgeXW0508/baibaoku/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)。

正常维护不需要 SSH 登录。飞牛 Docker 容器终端只用于柏宝库这类 Server Plugin 的定向 Git 更新；重启和 Compose 镜像切换均通过飞牛图形界面完成。

仓库已有的可选只读入口如下：

```bash
python3 verify-stack.py --stack validated-stack.json --config nas-paths.json
```

`nas-paths.json` 留存本地不入库，只放已确认的容器名（`sillytavern`）和两插件容器内固定路径（`/home/node/app/public/scripts/extensions/third-party/ST-BaiBai-Tools`、`/home/node/app/plugins/baibaoku`），无凭据。默认 release 模式检查 Digest、source label 与两插件 `origin`/`personal/stable` 跟踪关系。工具不能证明没有重复安装，也不代替 Save Generate/Generate Retry 独立开关、自更新、扩展管理接管和模型行为的检查。

本版此前已验证GHCR manifest可匿名读取；未来版本仍按实际包权限检查，不在聊天、Compose或命令参数写PAT。不得以仓库公开推断所有镜像权限。

## Current + Previous与恢复边界

以后每次成功升级，记录当前与上一个已验证正式Personal镜像的Digest、Validated Stack、实际插件SHA及相应配置。待 `v1.19.0-personal.2` 在 NAS 完成实机切换验收后，`v1.19.0-personal.1`（Digest `sha256:22973f7169fa694a0894b054e2b754ccf0ea881703d32a011e473c79c87ac740`）将转为 `previous_verified_personal_release` 回滚锚点，届时用户可按 Current + Previous 规则轮换旧官方 `1.19.0` 镜像。

Runtime故障优先回到上一个已验证镜像，同时确认Tools/BaiBaoKu与该组合一致；插件有漂移时需恢复相应代码/配置，不能只回滚ST留下新Hook/Branch。数据恢复与Runtime回滚分开，不自动覆盖聊天数据。

当前完整目录备份继续保留；Backrest自动备份暂未启用且按2026-11-13维护决定不再挂入常规Pending清单（后续如需建设自动备份再单独规划）。数据正确性事故仍遵循先停止写入、保留现场，与Runtime镜像回滚严格分离。

## 保留事项与后续责任

| 现状 | 后续责任与范围 |
| --- | --- |
| Candidate镜像和临时目录尚未清理 | 用户在独立NAS清理任务中确认具体资产，不在开发分支处理 |
| 官方1.19.0回滚镜像仍保留 | 待 `v1.19.0-personal.2` 实机验收通过后，由用户按 Current/Previous 规则评估轮换 |
| 完整目录备份仍保留 | 由用户按需自行保留管理；镜像回滚不自动覆盖用户数据 |
| 真实 Google API 新特性与部分能力待线上核验 | 部署 `v1.19.0-personal.2` 后重点顺手核验 Gemini 4 前缀变化签名重放（`prefixMismatchBehavior=DROP`）与 `4H Flex` |

补充结案说明（2026-11-13 / 2026-11-14）：飞牛Compose GUI更新流程与柏宝库NAS Git跟踪关系（`personal/stable`）均已确认落地；公开仓库现行文档中的宿主机存储池绝对路径与具体组网工具名已收敛为泛化占位描述（容器名 `sillytavern`、Compose 项目名 `sillytavern`、相对挂载 `./config` 等及容器内路径 `/home/node/app/...` 保持精确不变，零损部署可操作性）；启动日志`listen is enabled but private request filter is disabled`经确认NAS酒馆仅通过内网/专用组网单人自用、无公网暴露，属于容器端口映射的预期状态，不再列为安全待办；Backrest备份事项不再作为Pending跟踪。临时资产保持保留，Production Baseline的`cleanup_allowed`继续为`false`；未经明确授权不删除任何文件、镜像或备份。

## 当前仓库与发布状态

2026-11-12至2026-11-14阶段合入与 **`v1.19.0-personal.2` 统一发版**记录：

1. **Vertex 协议矩阵、RPC 诊断与原生重放收尾**（2026-11-12，`stage/vertex-protocol-and-ux` → `release`，阶段 Runtime `e49a6940`）。
2. **三仓库世界书/切卡性能优化与能力归属收敛**（2026-11-13，`stage/perf-worldinfo` / `candidate/perf-worldinfo` → `release` / `personal/stable`）。
3. **柏宝箱 `1.2.0` + 柏宝库 `0.7.4` 同步、三项 Pending Ownership 代码收口与三轮外审加固**（2026-11-14，`SillyTavern` Runtime `5c02da4f`、柏宝箱 Runtime/`dist` `1e8d5a81`、柏宝库 Runtime `e9d95265`）。
4. **Shalistera Core 性能二次吸收（8 项零持久缓存热路径优化）**（2026-11-14，`stage/core-perf-intake` → `release`，阶段 Runtime `28797486`）。
5. **Vertex Gemini 4 `Carbon` / `Hydrogen` 型号能力表、共享预设参数忽略与前缀变化思考签名 `DROP` 重放加固**（2026-11-14，`stage/vertex-gemini4-models` → `release`，冻结 Runtime `9817c0e6de8647f6519b5cc2fc583df3070c4053`，全部候选分支在核验 `0 ahead` 后均已清理）。
6. **`v1.19.0-personal.2` 正式版本发布**（2026-11-14）：经三库终审确认无阻断项，已更新 `personal-release.json`（配对 `ST-BaiBai-Tools@84345b9ac394a093bb89d8251ab197335f8f0b5b` 与 `baibaoku@0f8bd4d167713234ed2b9a56a62b4b37bcaea610`）并由 GitHub Actions `Personal Release` 流水线构建多架构 GHCR 镜像与不可变 `validated-stack.json` 发行资产，交由用户在飞牛 NAS 执行三组件同步部署。
