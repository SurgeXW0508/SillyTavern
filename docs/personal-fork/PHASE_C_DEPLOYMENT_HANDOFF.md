# Phase C Deployment Handoff

> C-E0历史交接：以下本地Candidate构建命令保留作过程记录，不再作为长期正式部署入口。当前正式制品和NAS更新/回滚见[Personal Release Operations](PERSONAL_RELEASE_OPERATIONS.md)及对应GitHub Release的Validated Stack。

2026-11-09 · C-E0文档交接。供用户后续在ChatGPT指导下手工操作NAS。本文所有NAS命令均未由Work执行；没有部署、生产配置修改、真实Google验证或生产回滚验证。Owner规则唯一来源：[MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)。

## 1. Frozen Component Matrix

| Component | Source / branch | 冻结Commit |
| --- | --- | --- |
| Personal ST Runtime | `https://github.com/SurgeXW0508/SillyTavern` · `stage/vertex-native-generation-contract` | `090cbba6d40e5d117ab41a9e6deb20b40e2dc336` |
| Personal Tools | `https://github.com/SurgeXW0508/ST-BaiBai-Tools` · `personal/stable` | `2f6a9c54d2c906b4a0e44d20c12d0712552e393d` |
| BaiBaoKu原版0.7.3 | `https://github.com/baibai-git/baibaoku` | `b211a4e97fdaec24dc8b90c85ddc198fac9ac200` |

本轮开始远端核验三项与上述一致；ST冻结提交相对release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`为Ahead 4 / Behind 0。后续文档提交使Stage HEAD前进，不改变冻结Runtime SHA。Tools的main仍为纯上游同步基线，不作为部署分支。

## 2. Code Freeze状态

**Phase C Code Freeze。** 用户已确认C-D通过独立审查。代码侧停止，只允许真实验收P1、安全问题或数据正确性问题触发新开发。性能、benchmark、UI小优化、顺手重构或Pending Owner不是解冻理由。

Tools所有Provider的Save Generate保持不装配；验收期间保持此前验证设置中的Generate Retry关闭，不新增Provider判断或Adapter。没有重新采用任何历史BaiBaoKu Vertex、BaiBai Vertex或Save Generate临时patch。

柏宝箱`AGENTS.md`已核实仍指向本ST仓库Stage canonical文档。本轮采用保留链接方案，不修改冻结Tools SHA。最终Closeout合入release并确认目标文档可访问后，必须更新链接到release；现在的release尚无该文档，不提前切换。

## 3. Candidate Build方法

**构建输入只用表中ST冻结提交的全新干净副本。** 不使用NAS现有酒馆源码目录作为build context，不对该副本应用外部patch，不把两个柏宝源码加入Image。

| 已核实入口 | 冻结源码中的实际行为 |
| --- | --- |
| 根目录`Dockerfile` | `npm ci --omit=dev --ignore-scripts`安装锁定生产依赖；`node docker/build-lib.js`预编译前端库 |
| `docker/build-lib.js` | 运行既有Webpack编译器，`forceDist:true`；不需要额外手动build步骤 |
| Build args | 只有`APP_HOME`，默认`/home/node/app`；本组合不覆盖，入口脚本也使用该路径 |
| `.dockerignore` | 排除本地data、dist、node_modules、前端第三方扩展和插件源码（保留插件package元数据） |
| `docker/docker-compose.yml` | 上游示例同时含`build: ..`和官方`latest`镜像；仅作结构参考，不能直接替换NAS stack或沿用其镜像标识 |
| 启动入口 | `tini -- ./docker-entrypoint.sh`，会初始化/补全配置；PUID/PGID模式可能调整挂载权限。切换前须保存配置及所有权基线 |

建议名称：`sillytavern-personal:phase-c-090cbba6`。名称存在时换新的明确后缀，不覆盖已有Tag；旧稳定Image及其ID必须保留。下面只是一套待用户执行的独立构建步骤，不会切换容器。先确认Git、Docker可用和构建空间足够。

```bash
ST_SOURCE_DIR="$(mktemp -d)"
git clone --no-checkout --depth 1 --branch stage/vertex-native-generation-contract https://github.com/SurgeXW0508/SillyTavern.git "$ST_SOURCE_DIR"
git -C "$ST_SOURCE_DIR" fetch --depth 1 origin 090cbba6d40e5d117ab41a9e6deb20b40e2dc336
git -C "$ST_SOURCE_DIR" checkout --detach 090cbba6d40e5d117ab41a9e6deb20b40e2dc336
git -C "$ST_SOURCE_DIR" rev-parse HEAD
git -C "$ST_SOURCE_DIR" status --short
```

只在HEAD精确匹配且工作区干净后继续。先选定新Tag并只读检查它是否已存在：

```bash
CANDIDATE_IMAGE='sillytavern-personal:phase-c-090cbba6'
docker image inspect "$CANDIDATE_IMAGE" --format '{{.Id}}'
```

“没有该镜像”是新Tag的预期结果；已有镜像则先停止，保留它，选择另一个未使用名称。构建：

```bash
docker build --pull --file "$ST_SOURCE_DIR/Dockerfile" --tag "$CANDIDATE_IMAGE" --label org.opencontainers.image.source=https://github.com/SurgeXW0508/SillyTavern --label org.opencontainers.image.revision=090cbba6d40e5d117ab41a9e6deb20b40e2dc336 "$ST_SOURCE_DIR"
docker image inspect "$CANDIDATE_IMAGE" --format 'ID={{.Id}} RepoDigests={{json .RepoDigests}} Revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
```

Dockerfile的`FROM node:lts-alpine3.23`是浮动标签，因此固定ST SHA不等于跨日期、平台逐字节相同的Image。本轮不改Dockerfile；用户构建时记录构建日志中的实际base digest、平台和最终Image ID，保留实际产物。`RepoDigests`对本地未推送镜像可能为空，不能编造Registry Digest。无额外build args、历史本地补丁或插件源码要求；依赖下载/认证/网络失败时停在构建步骤，不修改Runtime绕过。

人工操作顺序（不能整页一次复制执行）：

| 阶段 | 用户操作与进入下一步条件 |
| --- | --- |
| 1 Inspect | 按第4节读出真实容器、挂载、来源与插件状态；不改变环境 |
| 2 Record rollback state | 按第7节完成备份与旧组合记录；未具备恢复点不切换 |
| 3 Build Candidate | 按上述冻结输入构建，核验Image ID/Revision，保留旧Image |
| 4 Stop old container | 显示已确认容器状态，结束生成并一致性备份后，按原stack/UI正常Stop；不kill、不删除。不要另起共享同一数据的ST进程 |
| 5 Switch image | 仅在确认的compose/stack/UI中替换image为Candidate；保留ports/network/user/代理/挂载/停止与重启参数。插件迁移与版本固定按第5/6节另行确认 |
| 6 Start Candidate | 用原管理入口启动/重建相应服务；禁用自动build/pull回官方latest。具体命令由实机来源决定，本文不猜compose路径或服务名 |
| 7 Verify | 立即核验运行Image ID、两个插件SHA及唯一安装，再执行第8节；P1停止验收并按第7节回滚 |

## 4. NAS首次只读检查清单

先收集下表；路径、容器名、网络、安装范围当前均为**待核实**。不输出完整`docker inspect`、全部环境变量、原始配置、API Key、凭据或聊天正文。实际配置/环境覆盖只在本地查相关布尔项，分享脱敏结果。

| 检查对象 | 最小需要的信息 |
| --- | --- |
| Docker/ST | 容器名、配置Image、实际Image ID、RestartPolicy、StopSignal/Timeout、端口/网络、WorkingDir/user、Mounts及compose/stack实际管理来源 |
| Tools | 实际路径、Local/Global、脱敏origin、branch、HEAD、upstream、git status；当前用户Local与Global中是否存在同名/同来源重复副本 |
| BaiBaoKu | 实际插件目录、HEAD、git status、`interceptEnabled`、Server Plugin是否加载、ST自动更新与Self Update状态 |
| Backup | Backrest最近成功snapshot/time、包含ST实际data/config/插件代码与相关数据库目录的证据、已知恢复方法；旧Image仍存在 |

Docker元数据只读示例（`ST_CONTAINER`由你根据列表填写，不预设名称）：

```bash
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

在当前Shell设置已确认的`ST_CONTAINER`后运行；只设置变量不修改容器：

```bash
docker inspect --format 'Name={{.Name}} Image={{.Config.Image}} ID={{.Image}} Restart={{.HostConfig.RestartPolicy.Name}} StopSignal={{.Config.StopSignal}} StopTimeout={{.Config.StopTimeout}} Workdir={{.Config.WorkingDir}} User={{.Config.User}} Network={{.HostConfig.NetworkMode}} Ports={{json .NetworkSettings.Ports}}' "$ST_CONTAINER"
docker inspect --format '{{range .Mounts}}{{println .Type .Source "->" .Destination "RW=" .RW}}{{end}}' "$ST_CONTAINER"
docker inspect --format 'Project={{index .Config.Labels "com.docker.compose.project"}} Service={{index .Config.Labels "com.docker.compose.service"}} Files={{index .Config.Labels "com.docker.compose.project.config_files"}} Workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$ST_CONTAINER"
```

无compose标签就从原NAS管理界面/原部署记录确认来源；不自行找一个yml替代。`StopSignal`/`StopTimeout`空值按原部署与Docker有效默认解释，不能把冻结Dockerfile的tini等同于显式STOPSIGNAL配置。WorkingDir、挂载只用于定位；若源代码整棵bind mount遮盖Image，或插件只在容器可写层中，先解决代码来源/持久化与备份缺口再切换，不能仅换Image标签认定冻结代码已运行。

插件目录先从扩展管理器安装范围、上述挂载及已确认的数据根目录定位。冻结ST的Global相对应用目录为`public/scripts/extensions/third-party`，Local为对应账户目录下`extensions`；这些是源码布局参考，不是NAS实际路径断言。以下`TOOLS_DIR`只填已确认的容器内目录，容器需已在运行；不要为盘点而启动停止中的服务。容器不运行时，按已确认的host映射用只读Git检查。

```bash
docker exec "$ST_CONTAINER" git --no-optional-locks -C "$TOOLS_DIR" status --short
docker exec "$ST_CONTAINER" git -C "$TOOLS_DIR" remote get-url origin | sed -E 's#(https?://)[^/@]*@#\1[redacted]@#g; s|[?#].*$||'
docker exec "$ST_CONTAINER" git -C "$TOOLS_DIR" branch --show-current
docker exec "$ST_CONTAINER" git -C "$TOOLS_DIR" rev-parse HEAD
docker exec "$ST_CONTAINER" git -C "$TOOLS_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
```

没有upstream、dirty、目录不是Git或origin不是预期都只记录并暂停选择迁移方式，不自动reset/checkout。对于已确认的`BBK_DIR`，只读检查其`status --short`、`rev-parse HEAD`及`git config --get baibaoku.selfUpdate`；该配置未设置不代表关闭。其余状态按第6节在本地只读取目标字段，不能粘贴全部Git/config/代理设置。不要仅靠目录名或manifest版本区分分支/重复安装。

## 5. Tools迁移原则

目标：表中Fork origin、`personal/stable`、冻结HEAD、tracking `origin/personal/stable`，只加载一份。真正选路径要等NAS实际Git/安装范围结果；本轮不给自动执行的卸载或remote改写脚本。

| 路径 | 适用条件与保护点 |
| --- | --- |
| A：原生管理器移除旧代码后重装Fork | 原生管理器可正常管理，已确认设置不存源码目录；先保存旧代码/Git及账户设置，保持原Local/Global范围，然后指定Fork+`personal/stable`安装并核验SHA。不要使用“删除设置/数据”操作；有本地数据先保护再移除代码 |
| B：现有目录改remote并checkout | 仅限干净Git repo、无本地修改、路径和tracking明确、没有重复副本；先备份Git/代码与旧origin/branch/SHA，再按实机输出安排fetch/branch tracking。不得强制reset/清理以制造干净状态 |

已有同名目录会使原生重新安装返回冲突；不要因此在另一个范围多装一份。只切branch不会改变origin。扩展源码若不持久化，先明确新容器如何保留其状态。安装后全页重载，确认固定关闭Save Generate，不能指望旧页面热卸载Hook。旧后台Job/数据库记录不删除、不自动恢复；切换前在旧环境结束/保留所需任务。

验收期间不点一键全更新、不跟踪Tools main；若远端stable未来推进，分支名不等于冻结SHA，须按Preflight重新判断。柏宝库更新接管如已启用，仅验证其仍跟踪personal/stable，不为了验收强制开启。

## 6. BaiBaoKu固定策略

保持表中原版0.7.3，不加个人patch、不建立Fork。启动Candidate前必须确认不会静默升级；当前生产值待查，不能把源码默认值当实机值。

| 字段 / 来源 | 后续用户需要确认的有效状态 |
| --- | --- |
| ST `enableServerPlugins` | 柏宝库实际加载；保留原来所需服务能力，不为盘点改开关 |
| ST `enableServerPluginsAutoUpdate` | 验收期间false；同时检查环境/启动覆盖。这是ST启动更新器的开关 |
| `git config baibaoku.selfUpdate` | 记录实际值；未设置默认可能开启。固定期间可明确false，但该项不能替代ST自动更新关闭 |
| `interceptEnabled` | 从既有UI“插件安装优化”或相应配置只读取此布尔值；保留当前是否使用的选择。b211版缺省配置归一为true，不能因没有字段就断言关闭 |
| Tools自身前端自动更新 | 冻结manifest的`auto_update:false`不等于全局禁止更新；核验ST `extensions.autoUpdate`及其他外部更新机制不会推进冻结组合 |

b211的Self Update受ST `enableServerPluginsAutoUpdate`共同约束（`self-update.js:readStAutoUpdate`）；单独关Self Update仍不足以阻止ST先拉取插件。自动更新如需调整，只在备份后由用户对已确认配置入口修改并启动前复核，本轮不写配置。

b211的Extension Manager配置源码路径为`<实际DATA_ROOT>/_baibaoku/extension-manager/config.json`；这不是NAS硬编码路径，不输出其中proxy等其他字段。不要用运行插件初始化代码的方法“读取”状态，避免触发更新或注入。

## 7. Rollback Checklist

切换前必须记录、保存并能定位恢复以下整组合；旧Image单独存在不等于完整回滚已经可行：

- [ ] 旧ST Image ID/原Tag（Digest如有）及容器元数据；确认旧Image仍可本地使用，不做image prune。
- [ ] 原compose/stack来源及受保护副本，包括ports/network/user/stop/restart、必要环境与挂载；秘密留在受控本地，不贴聊天。
- [ ] 旧Tools路径、Local/Global、origin、branch、SHA、tracking、干净/本地修改状态；有可恢复的完整代码/Git副本。
- [ ] 旧BaiBaoKu SHA、代码/Git与有效更新/接管配置；数据库及相关文件包含在备份中。
- [ ] Backrest成功snapshot ID/time/覆盖路径；生成停止后的一致性data/config/插件相关数据恢复点，确认恢复办法和空间。最近一次“成功”但没覆盖这些路径不算。
- [ ] 保存UID/GID等必要所有权信息。Candidate首次启动可能补写配置、更新内容或由插件写库；不假设退Image会还原这些变化。

P1时：停止Candidate和所有对同一数据的写入，恢复旧Image **+** 旧Tools **+** 旧BaiBaoKu **+** 配套数据/配置，再按旧管理入口启动并核验。先保留验收期间新数据的受保护副本，恢复到单独位置核对后再按实机方案回置，避免盲目覆盖备份点后的聊天；不用硬编码路径脚本、危险通配符或`rm -rf`正式目录。恢复操作同样由用户后续手工确认，不在正式环境Hot Fix。

## 8. Real-World Acceptance Checklist

只在新建验收Chat/测试角色中操作，异常注入留在隔离配置/测试会话，不改正式连接凭据或真实聊天文件；Tokenizer失败在无法安全构造时记待验证，不能宣称通过。

- [ ] 基础：ST正常启动；角色、聊天、世界书、Preset可读；柏宝箱/柏宝库正常加载；Save Generate固定关闭。
- [ ] Plugin：只加载一份Tools；origin/branch/HEAD/tracking与冻结组合一致；柏宝库HEAD不漂移；接管若已启用，更新检查仍识别personal/stable，不拉未来新代码。
- [ ] Vertex：Streaming普通生成、JSON非流式生成，各无重复请求。
- [ ] Thinking：连续两轮，刷新后继续对话，Signature不导致失败。
- [ ] Tool Call一次，只执行一次；Stop生效并保留已收正文，不继续工具/重发请求。
- [ ] Regenerate、Swipe、Continue；编辑历史后继续，编辑内容生效。
- [ ] Core：Reasoning编辑→保存→刷新；Tokenizer/Token Count可控失败不挂起且后续可继续；测试Chat连续导入生成不同文件，原文件不变。
- [ ] 对照：一个现有非Vertex Provider普通生成；必要的真实代理链正常。

P1：Candidate不能启动、数据不可读、聊天丢失/覆盖、重复模型请求/工具执行、Signature使正常聊天失败、Stop无效、插件重复加载、分支错误切回main、凭据或安全问题。**立即停止验收，优先整组合回滚，不在生产Hot Fix。** P2如UI小问题、非核心提示、未使用可选能力只记录，不自动解冻。每项留简短结果；本文件没有预填任何实机通过。

## 9. Closeout前待办

以下仅在实机通过后、下一阶段获得授权才能执行，本轮全部未做：

- [ ] 将已验收ST Candidate合入release。
- [ ] 确认canonical文档在release存在，将Tools AGENTS链接改为release；不复制Owner矩阵。
- [ ] 固化最终ST SHA及三组件精确组合，区分文档提交与Runtime。
- [ ] 根据项目惯例决定Tag/Release，构建正式Docker Image，记录Image ID/Registry Digest（如有）。
- [ ] 更新真实Production Baseline、部署描述与备份恢复证据；保留上一版本完整回滚组合。

下一步由用户开始：**Inspect → Backup/rollback anchor → Build Candidate → Switch → Real-world acceptance**。Work不SSH、不推断NAS路径、不修改Runtime或生产配置、不继续吸收SH优化。
