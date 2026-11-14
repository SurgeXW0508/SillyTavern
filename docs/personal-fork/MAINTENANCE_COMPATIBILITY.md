# Personal Fork 维护与能力归属

Canonical compatibility document。当前正式制品为[v1.19.0-personal.1](https://github.com/SurgeXW0508/SillyTavern/releases/tag/v1.19.0-personal.1)；生产事实与待补项见[PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json)。涉及ST、Personal Fork、柏宝箱、柏宝库、Shalistera引入的任务，开始前必须阅读本文件，完成Capability Ownership Review；其他任务书或未来插件Fork只引用本文件，不复制冲突矩阵。

## 接手入口与当前生产状态

先读[Production Baseline](PRODUCTION_BASELINE.json)确认实际部署，再对照本文Owner规则，最后按[Release Operations](PERSONAL_RELEASE_OPERATIONS.md)执行对应更新；正式镜像的实际验收范围见[Release Closeout](RELEASE_CLOSEOUT.md)。无需从历史聊天恢复当前版本。

2026-11-12用户提供的NAS结果：`v1.19.0-personal.1`正式GHCR Digest仍在使用；容器`sillytavern`状态为`running`、RestartCount为0。Compose由飞牛 OS 管理，项目`sillytavern`，工作目录`/vol3/1000/SillyTavern`，配置文件`/vol3/1000/SillyTavern/docker-compose.yml`。NAS Tools仍为`personal/stable@2f6a9c54`、origin为个人Fork、tracking为`origin/personal/stable`、工作区clean。NAS BaiBaoKu 已于2026-11-12完成Git跟踪关系整理：当前分支`personal/stable`，跟踪`origin/personal/stable`，origin为个人Fork，upstream为原作者，工作区clean；NAS当前Git HEAD `4814830f`，Runtime基线仍为`b211a4e9`/0.7.3，另有`backup/pre-personal-stable-20261112`备份分支。后续Runbook文档提交使远端stable继续前进；更新前应fetch并按文档差异判断，不要将文档HEAD误认为Runtime变化。完整SHA、Digest和挂载路径以Production Baseline与Release Operations为准。

正式镜像仅确认启动、Health、Vertex普通RP正文生成、刷新后聊天记录保留。Candidate的多轮、Stop、Regenerate等历史结果单独保留，不自动算作正式镜像已验证。飞牛GUI方案与仅局域网/Tailscale自用访问边界已确认结案，Backrest不再挂Pending，旧回滚镜像与临时目录保留边界见Operations。

2026-11-12至2026-11-14阶段性仓库状态：Vertex协议契约、封闭枚举诊断、多媒体共享凭据域名守卫与流式/重放收尾（Runtime `e49a6940`）、三仓库世界书性能优化与能力归属收敛（Runtime `e92f8dc4` / 柏宝箱 `3314098e` / 柏宝库 `61aae569`）、柏宝箱 `1.2.0`（内置柏宝砚）+ 柏宝库 `0.7.4` 同步与三项代码层 Pending Ownership 全量收口（阶段 Runtime `5c02da4f`、柏宝箱 `personal/stable@595854eeaf36fc05ecd380639d3013048693c768` / Runtime `1e8d5a818e19c7deafee42808aa39033c25170a1`、柏宝库 `personal/stable@2ba8864fa6b16cb425c05b6c66b4fefbfb5fd64c` / Runtime `e9d95265c77187446177e839a2b97975ebb2aa0d`），以及用户授权的 Shalistera Core 性能二次吸收（ST `release@8781e17923ef399682c5af89a39174417fbf6e4c` 阶段 Runtime `28797486d97375ddefa49f978390c88f1eb083fd`）已全部快进合入各自稳定主路并清理已合入临时分支；当前候选分支 `stage/vertex-gemini4-models`（Runtime `dd3d522b73848dad7cba64625750c68b2ceb17d5`）完成 Vertex `gemini-4-carbon` / `gemini-4-hydrogen` 型号能力表接入与采样/惩罚/`seed` 忽略提示策略对齐，待用户审阅确认合入 `release`。暂未修改 `personal-release.json`、暂未构建新 GHCR 镜像或更新 NAS，线上生产仍为 `v1.19.0-personal.1`（ST Runtime `090cbba6d40e5d117ab41a9e6deb20b40e2dc336`、Tools `2f6a9c54`、BaiBaoKu `4814830f` / Runtime `b211a4e9`），待用户明确授权后统一发布正式镜像与实机切换。

Decision Log、SH取舍索引及C-E0交接是对应阶段的历史证据。已发布Release资产中的compatibility是发布时快照，不修改其内容来补填后续实机结果；当前生产事实更新在Production Baseline。

## 稳定维护原则

**稳定性优先于功能完整性。** 优先级：稳定性 > 数据正确性 > 核心功能 > 体验增强 > 性能优化。

遇到ST与柏宝能力重叠时依次判断：

1. ST Core已提供可靠原生能力，优先关闭柏宝重复能力。
2. 柏宝实现更合适，且ST对应实现仅是非必要优化时，可以移除该ST优化，保留一个Owner。
3. 仍存在生命周期冲突时，可以直接放弃柏宝相关能力。
4. 宁可放弃优化或功能，也不为保留重复实现增加复杂Hook/Adapter。
5. 不允许局部功能破坏稳定环境；更新任一仓库必须检查另两个仓库的影响。当前通过不代表未来更新免检。

同时遵守以下实现与生命周期约束：

1. 单能力单Owner；原生实现完整可靠且性能可接受时优先ST。
2. 删除优于兼容。上游吸收个人改动后优先删除个人实现；成熟替代实现出现时重新选择Owner。
3. 性能优化不得改变Prompt、预算、排序或持久化语义。收益不足以抵消Hook、状态复制或升级成本时放弃优化。
4. 不因第三方插件修改ST Core公共契约；不为单一旧插件版本建立通用框架。
5. Feature Off必须退出装配、监听、拦截、轮询和任务创建；仅在回调里判断开关不算退出。
6. 一次请求只有一个生命周期Owner，终态结算一次。派发后不得通过fallback重发模型请求。
7. 保持每用户凭据/OAuth隔离、代理origin允许列表、禁止自动重定向、既有私网过滤和不记录Prompt/秘密的边界。

## 三仓库维护关系

| 组件 | 正式维护来源 / 维护方 | 分支与职责 |
| --- | --- | --- |
| SillyTavern Personal | `SurgeXW0508/SillyTavern`，个人维护者负责审查和发布；官方ST是长期上游 | `upstream/release`纯官方基线，`stage/*`独立开发/验证，`release`个人正式稳定分支；Core拥有原生生成与消息/历史正确性，生产使用验证过的GHCR Digest |
| ST-BaiBai-Tools | `SurgeXW0508/ST-BaiBai-Tools`维护最小个人策略；`baibai-git/ST-BaiBai-Tools`为功能上游 | `main`仅同步上游，`personal/stable`唯一部署分支；负责独立前端体验，Save Generate不装配，不再取得Core生成生命周期 |
| BaiBaoKu | `SurgeXW0508/baibaoku`个人Fork；`baibai-git/baibaoku`为上游 | `main`纯上游同步镜像，`personal/stable`唯一生产分支；负责独立Server Plugin/数据库/服务，核心接口接管等变更必须重新审查边界 |

三仓库分别升级，不因更新其中一个而顺手更新另一个。Shalistera仅作为参考来源；没有自动同步或整分支合入关系。

## 当前能力Owner

| Capability | Owner | 其他实现 | Policy |
| --- | --- | --- | --- |
| Vertex请求协议、认证、传输 | ST | Shalistera仅来源参考 | ST only；不整体合并参考分支；聊天与多媒体共用官方Google域名白名单；封闭枚举RPC诊断与等待/缓存状态栏；Gemini 4冻结型号能力表（`argon`/`carbon`/`hydrogen` + 未知文本型号保守回退、排除`-image`）与采样/惩罚/`seed`剥离提示 vs 结构性冲突400报错分级 |
| Thinking / Reasoning / Thought Signature | ST | 旧插件适配已撤回 | 按原始Part保存；编辑使对应正文重放失效；保留角色名前缀为独立无签名Part |
| Tool Calling原生语义与历史 | ST | 柏宝后台执行不采用 | ST调用工具；保留id/name/参数/顺序/有效调用签名；functionCall仅经成对tool_invocations载体消息重放 |
| Generate、Continue、Swipe、Regenerate | ST | Save Generate关闭 | 同一原生请求链 |
| Partial / Failed / Canceled | ST | — | partial保留可用内容和终态；流式零内容错误抛错不落空消息；异常终态不自动执行工具、不重放未执行functionCall、不续发 |
| 历史Prompt语义 | ST | — | 当前消息为语义来源，不能因旧response ID恢复已编辑/删除正文 |
| 基础聊天保存 | ST | 柏宝恢复不采用 | 保持内部错误提示与不抛错语义，`saveChat`/`saveGroupChat`/`saveGroupBookmarkChat`/`saveChatConditional` 返回 `Promise<boolean>` 落盘结果；统一经 `withChatSaveLock` 串行持有 `isChatSaving`（自动保存维持 `1s` 默认等待，用户显式发起的原生 `createBranch`/`branchChat`/`createNewBookmark` 采用 `debounce_timeout.extended` `5s` 有界等待并在锁耗尽时显式告警），在首次 `await` 前同步绑定目标角色/群组与完整序列化聊天快照供首次写入和 `OVERWRITE` 确认重试共用，检查点落盘成功且原会话仍活跃后才写 `saveItemizedPrompts` 与更新父聊天，会话切换或保存失败时不误写其他会话、不留孤儿缓存、不劫持当前会话 |
| Save Generate / 后台任务 / 消息恢复 | 柏宝，但本组合不启用 | ST正常生成 | 整个Save Generate关闭；不保留Vertex内部调用契约 |
| 世界书编辑器渲染、切换与清理 | ST | 柏宝箱仅保留UI增强 | Core负责单次容器级清理、按需增量关键词缓存、`originalData`按`uid`索引、前端克隆对齐及`/api/worldinfo/get`异步读取；柏宝箱移除空Vue根挂载与逐条强制回流补高循环 |
| 世界书 / 人设搜索 | ST | 柏宝箱搜索替换独立保留 | Core采用Shalistera `234cb02d` `Set`查找；柏宝箱编辑器搜索替换为独立UI能力 |
| 世界书下拉分组/主题与全局选择器显示 | 柏宝箱 | — | 同次打开分组去重并复用未变书单；主题单次读取批量写入且签名覆盖全部29项样式；全局选择器对`#world_editor_select`的`change`仅按帧合并刷新标签显示，不重建下拉或重排选项 |
| 自动重试/黑名单重试（Generate Retry） | 柏宝箱（可选，默认关闭） | — | 两个开关默认关闭且关闭时零解析直通；`chat_completion_source === 'vertexai'`一律直通，绝不接管Vertex生成生命周期 |
| Tokenizer批量计数 | 柏宝箱计数 + 柏宝库桥接（ST拥有语义） | 持久化Token缓存不采用 | 面向OpenAI兼容渠道保留；桥接层不提前执行`substituteParams`，含宏条目回退ST原生计数；多模态数组/`tool_calls`对齐ST原生tiktoken语义 |
| 扩展安装/更新线路 | 柏宝库（可选接管） | 关闭接管时走ST原生管理器 | 默认仅直连/代理权威来源可决定目标SHA（`allowUnverifiedMirrorDecision: false`），镜像仅作已知权威SHA下载通道；云端镜像兜底默认关闭（`cloudMirrorsEnabled: false`）；保留mihomo等代理自动探测；`system`/`builtin`双适配器完整核验`branch.<name>.remote`与`branch.<name>.merge`，跟踪非`origin`远端报`UNSUPPORTED_UPSTREAM`、配置残缺报`NO_UPSTREAM`，严禁自动切向远端默认分支，`personal/*`须显式跟踪`origin`，仅完全未配置upstream的非`personal/*`分支在权威线路确认远端存在同名分支时允许更新并补写跟踪配置；柏宝箱前端路由改写跟随后端接管开关 |
| Fast Chat渐进加载 | ST原生 | 柏宝已移除/410 | 柏宝库后端返回`410 Gone`，柏宝箱删除残留前端fetch/trigger死代码与捕获监听 |
| 主题懒加载 | 柏宝库剥离 + 柏宝箱水合 | — | 显式跨组件耦合；柏宝库进程内记录主题桥状态并以30s TTL缓存扩展目录扫描，检测不到已启用的柏宝箱或`power-user.js`主题桥时自动回退下发完整主题 |
| 流式预览失败停止边界（`previewFailed`） | ST导出标志 + 柏宝箱尊重终态 | — | `StreamingProcessor`暴露`this.previewFailed`；柏宝箱`streamingRegexDefer`在`previewFailed`时不覆盖为全量重绘 |
| 独立体验UI / 独立数据库服务 | 柏宝箱 / 柏宝库 | — | 不得获得Vertex生成生命周期所有权；备份列表fetch钩子按开关装配，重复`scrollTop`拦截合并为单一Owner |
| 楼层管理器 / AI 标注改写（柏宝砚） | 柏宝箱 | 单独安装同名扩展或关闭开关时完整让出/卸载 | 仅走显式 `chat-completions` 副渠道（移除 `generateRaw`，白名单剥离采样参数并锁定路由凭据，绝不触碰主 API / Vertex）；按需挂载保存观察槽并绑定完整 `BoundChatTarget` + `saveChat` 布尔返回（未开启自动保存或未知模式 fail-closed，全异步点复验会话，`/del` 锁前置 `tool_invocations` 并优先识别命令报错）；世界书干跑由 ST Core 在 `isDryRun=true` 时抑制 `WORLDINFO_ENTRIES_LOADED`/`WORLDINFO_SCAN_DONE`（含 Prompt Manager 干跑）与外部效果重置；`stopPen()` 零残留且不挂 `pagehide` |
| 角色列表缓存与 `DiskCache` 提升 | ST Core + 柏宝库浅表索引（按开关） | 关闭快速角色列表走 ST 原生 | ST Core 在 `DiskCache` 命中后回填 `memoryCache`（非 Android）；柏宝库 `/v1/characters/fast-all` 按每角色 `chats/<charName>` 目录 `stat` 精确失效、兼容旧版 V2 卡根层 `name`/`tags` 回退并对齐 `toShallow` 字段语义、剔除损坏或真无名卡（`SCHEMA = 3`）；柏宝箱删除死代码 `fastBootstrap.js` |
| 聊天搜索与管理列表加速 | ST Core（关键词搜索）+ 柏宝库（空查询快表/最近聊天/备份摘要） | 关闭快表走 ST 原生 `/api/chats/search` | ST Core 采用 `createChatFragmentMatcher` `O(M)` 增量匹配并在文件名全命中时免读正文；柏宝库共享尾行解析（`SCHEMA = 3`）对齐原生 `getChatInfo` 空尾行/损坏尾行降级预览与数值 `mtimeMs`、强校验 `avatar_url` 单段包含边界防路径逃逸、GC 已删群聊文件并删除 `getFastChatGet` 死代码；柏宝箱删除旧二阶段 DOM 回退 |
| 键盘焦点扫描合并与前端 `fetch` 管线 / 设置保存 | ST Core（`keyboard.js` 唯一 Owner）+ 柏宝库 / 柏宝箱 | 关闭对应开关按槽位精确摘除或空槽直通 | ST Core 原生固化选择器索引（覆盖祖先组合类名）、`WeakSet` 去重、后台 512 上限有界队列、先祖先折叠再对风暴取最近公共祖先（LCA）；柏宝库删除全局 `MutationObserver` 劫持与客户端哈希丢写，`handleFastSettingsSave` 以发包前 FIFO 门控队列 `settingsSaveDispatchQueue` + 客户端纪元请求头 `X-Baibaoku-Save-Seq` + 单调 `settingsSaveSeq` 保证异步压缩与多连接下新设置不被旧请求覆盖，禁止发出后回退重发且派发前异常同步失效挂起缓存；柏宝箱收敛单一闭包绑定 `fetchPipeline`（安全兼容未打标外层第三方 `fetch` 包装，关闭主题懒加载时卸载并清空页面缓存） |
| Token Count失败结算 / Tokenizer资源初始化 | ST | — | Core生命周期single-flight与失败结算由ST独立保证 |
| Reasoning初始化 / 编辑与基础Chat导入 | ST | — | Handler单次装配；导入只创建新文件 |
| 流式热路径降耗 / 世界书单轮扫描复用 / 宏纯文本快路径 / 闭合文件夹与楼层标签过滤 | ST Core（唯一 Owner） | Shalistera 仅参考；跨请求 `MarkdownRenderCache` 与 `stream-fadein` 分段 `morphdom` 不引入 | 后缀扫描 `getMessageDepth`、实例闭包在真实 DOM 写成功后再记录最近一次渲染状态 `lastElement`/`lastHtml`/`lastFade`（完整保留 `previewFailed` 契约）、单遍 `unhashHTMLSpans`（守卫下标越界与循环上限）、隐藏标签页 `250ms` 预览节流（切回前台立即恢复原 FPS，与柏宝箱 `content-visibility` 正交互补）；`WorldInfoBuffer` 单次扫描内两个 `BoundedTextCache`（各默认 16 项、`2,097,152` 个 UTF-16 单元软预算，超大单条允许独占缓存，覆盖 6 个上下文字段掩码，随局部实例自动 GC）；`evaluateMacros`（前置保留 `chat_id_hash`/`charPrompt`/自定义宏副作用并检查 `<`）与 `MacroEngine.evaluate`（保留前置/后置处理器）无 `{{` 纯文本快路径；`createClosedFolderFilter` 单次 `Set` 预索引与 `applyCharacterTagsToMessageDivs` `#chat > .mes` `Set` 过滤（修复 `mesIds=0` 边界） |

## Disabled Features

**当前个人稳定组合通过不装配关闭所有Provider的Save Generate。** 这是当前维护策略，不是Vertex API能力限制。用户接受失去关闭页面后继续生成及恢复的体验。

当前维护模型已经由Phase C-B转为正式Fork分支，不再在部署时应用外部patch。

| Component | Source / branch | 精确验证基线 |
| --- | --- | --- |
| Personal ST运行代码 | `SurgeXW0508/SillyTavern:release` | NAS正式生产仍为`090cbba6d40e5d117ab41a9e6deb20b40e2dc336`（`v1.19.0-personal.1`）；仓库`release`（`8781e17923ef399682c5af89a39174417fbf6e4c`）已先后快进合入三项Pending根因修复、三轮外审加固与终论保存锁修复，以及用户授权的Shalistera Core性能二次吸收（阶段Runtime `28797486d97375ddefa49f978390c88f1eb083fd`）；候选分支`stage/vertex-gemini4-models`提交Vertex `gemini-4-carbon`/`gemini-4-hydrogen`接入与参数忽略策略对齐（Runtime `dd3d522b73848dad7cba64625750c68b2ceb17d5`，暂未修改`personal-release.json`或构建新GHCR镜像） |
| 柏宝箱上游同步基线 | `baibai-git/ST-BaiBai-Tools:main` → `SurgeXW0508/ST-BaiBai-Tools:main` | 镜像`main`已快进同步至`d828d6812994414cef24be9e5f995a264e9fe370`（`1.2.0`） |
| 柏宝箱唯一个人部署分支 | `SurgeXW0508/ST-BaiBai-Tools:personal/stable` | NAS当前仍为`2f6a9c54d2c906b4a0e44d20c12d0712552e393d`（跟踪`origin/personal/stable`）；仓库`personal/stable`已快进合入至`595854eeaf36fc05ecd380639d3013048693c768`（Runtime/`dist`提交`1e8d5a818e19c7deafee42808aa39033c25170a1`，完成`1.2.0`内置柏宝砚多轮外审加固、闭包绑定`fetchPipeline`外层包装安全与终论审查修复，待ST新正式镜像发布后与三库同步部署） |
| 柏宝库唯一个人部署分支 | `SurgeXW0508/baibaoku:personal/stable` | NAS当前Git HEAD仍为`4814830f2d161dfff89e75370effa31d669586d9`（Runtime基线`b211a4e97fdaec24dc8b90c85ddc198fac9ac200` / 0.7.3，跟踪`origin/personal/stable`，原作者为`upstream`）；镜像`main`已快进同步至`d915bc8f0036fb308f02b9a9e52ae880f05d4fe4`（`0.7.4`），仓库`personal/stable`已快进合入至`2ba8864fa6b16cb425c05b6c66b4fefbfb5fd64c`（Runtime提交`e9d95265c77187446177e839a2b97975ebb2aa0d`，完成`0.7.4`同步、快速保存端到端派发/落盘保序、旧V2角色卡兼容及快表路径包含/尾行原生契约对齐，待ST新正式镜像发布后与三库同步部署） |

上述同时登记了NAS当前运行基线与GitHub仓库阶段合入HEAD；当前NAS实际运行组合以Production Baseline的`current_production`为准，Tools线上仍为`2f6a9c54`、BaiBaoKu线上Runtime仍为`b211a4e9`，在统一发布前不单独升级伴随插件。

此前审查的上游1.1.5仍无条件装配Save Generate、默认开启并存在false→true旧迁移。Personal Stable在装配入口移除导入/安装及面板通知，设置归一false、移除强制开启迁移、UI固定禁用；不物理删除上游模块，也不需要手工删源码或额外Patch。Generate Retry是另一功能，本策略没有修改其实现。生产dist从锁定依赖的源码构建，连续两次构建哈希一致。

Phase C基于1.1.2的外部策略patch，以及更早的两个Vertex兼容patch，只作为历史过程证据。它们不再是正式安装、更新或回滚步骤；不要叠加到personal/stable上。柏宝库个人Fork（`SurgeXW0508/baibaoku`）的 `main` 保持纯上游镜像，个人分支（`personal/stable` 与候选分支）承载经审查的扩展管理权威跟踪核验、前端桥接与快速列表/设置保存安全边界修复；NAS 当前线上运行版本仍见上述基线表与 `PRODUCTION_BASELINE.json`。

安装或更新Personal Stable后必须全页重新加载；不承诺已经运行的旧JS页面热卸载。旧后台任务、数据库记录和聊天数据不被删除或自动恢复；切换前必须在原环境检查并结算/导出需要保留的任务。未来升级后的进程启动/全页重载需要在对应任务中验证；本轮只登记文档，不操作正式环境。

重新启用前必须重新进行Owner Review，证明功能不可替代、禁用/销毁闭合、持久化确认和回滚可靠；优先采用能够真正关闭并独立运行的上游实现。不要重新添加Vertex Save Generate Contract来恢复此功能。

独立已知问题：柏宝旧恢复逻辑可能把未确认写入聊天的任务标为已处理；ST Core 现已由 `saveChat`/`saveGroupChat`/`saveChatConditional` 返回 `Promise<boolean>` 落盘结果（保留内部错误提示，兼容不读取返回值的调用方），但 Save Generate 仍保持不装配，任何未来重启用该功能的任务必须独立验证持久化确认与恢复边界。

## Decision Log

### 2026-11-09 — Vertex / Save Generate

Decision：Vertex生成生命周期由ST Core独立拥有。

Policy：撤回Vertex内部插件契约、能力协商及专用恢复适配；本验证组合关闭整个Save Generate。其他Provider同样回到原生生成路径。

Reason：三项目接管、持久化、恢复链不值得以升级耦合换取后台生成体验。现有开关不能干净退出，使用最小装配层禁用，不继续建立Provider兼容Adapter。

保留协议/认证传输/生成/HTTP模块分离：它们自身有Core生命周期和测试价值，不依赖柏宝内部调用。

### 2026-11-09 — Phase C-B Personal Stable

Decision：柏宝箱`main`保持纯上游基线，正式个人策略只进入`personal/stable`；不再维护部署patch。当前main与上游main完全相同。

Policy：只安装Fork URL与`personal/stable`，保持`origin/personal/stable`。以branch+commit识别个人版本，不以同为1.1.5的版本号区别上游与个人构建。manifest的`auto_update:false`保持上游设置。

Evidence：原生ST扩展安装/分支列表/切换/当前分支更新的真实HTTP+Git验证通过；实际GitHub Fork安装通过。本地受控Git远端同时推进main和stable，Update只拉取stable。完整ST+Personal Tools+原版柏宝库的隔离浏览器验证确认Vertex SSE/JSON各一次上游请求、Save Generate请求为零，旧设置与重载保持关闭；Generate Retry的受控custom请求一次失败后只重试一次。

Scope：不修改ST扩展管理实现、不修改柏宝库、不扩大其他Capability Owner。真实Google和NAS留待下一阶段。

### 2026-11-09 — Phase C-D Core reliability closeout

Decision：只吸收Token Count失败结算、Tokenizer初始化、Reasoning幂等编辑、公共Streaming边界和Chat Import防覆盖。五类能力均由ST Core拥有，脱离柏宝仍成立；不改变性能优化的Pending Owner。

Policy：公共StreamingProcessor结算已收到的正文/Reasoning及消息收尾，Vertex只附加原生Parts/Signature/终态。停止后不调用工具或自动续发；失败不重新派发模型请求，不保留已终结的processor引用。Save Generate继续不装配，两个柏宝仓库和安全/认证/代理实现不变。

Evidence：详见[Phase C-D closeout](PHASE_CD_CLOSEOUT.md)中的命令、边界和验收清单。未进行真实Google或NAS验收，不能把隔离测试当成生产验收。

## Shalistera Adoption Matrix

参考固定到`Shalistera/SillyTavern:release@f67e000034a130dc25c7fb7571b5731f4c219f89`。共同基线为`06bde939fb1e9c4c8d8641d810f0a916b5bce127`，相差31提交。它比1.19.0 tag `7e8663cd9c184a550b37238218bdd32c6efc68e9`多一项npm发布workflow修复，因此最初按tag统计的32提交不是遗漏。

以下“本轮”和`Adopt Now`对应历史Phase C-D开发，表示当时已实现，不是本轮文档任务新增Runtime或待办；混合提交只采用Reason栏明确限定的部分。没有整体merge/cherry-pick。宏观分类按实际diff的功能范围完成，不宣称对未采用模块逐行审计。

| SH Capability | Status | Owner | Reason |
| --- | --- | --- | --- |
| Vertex Native、工具和原生元数据 | Adopted（adapted） | ST | Phase C已有独立协议/传输/生成/HTTP和编辑历史语义；诊断不采用 |
| Token count failure settlement | Adopt Now | ST | HTTP/网络失败结算已有fallback；计数选择/预算不变 |
| Tokenizer init lifecycle | Adopt Now | ST | 共享pending、只发布ready实例、失败释放且后续可重试 |
| Reasoning edit guard | Adopt Now | ST | 设置刷新与装配分离，旧按钮不重复处理 |
| Generic streaming pending content | Adopt Now（部分Already Covered） | ST | 原有Vertex partial和正文tool收尾已覆盖；补公共错误、reasoning-only工具、Stop工具保护和终态引用释放 |
| Chat import collision / CAI histories | Adopt Now（仅导入） | ST | 唯一名与排他创建；不带入summary/search/cache |
| Custom model IDs | Intentional Omission | ST optional | 当前选择器与请求链已可使用`gemini-4-argon`；仅验证现有代码路径，不断言NAS实际目标/权限 |
| Indexed span semantics | Adopted（adapted，单遍还原且保留下标边界） | ST | `addShowdownPatch` 采用单遍 `¨C(\d+)C` 还原并显式校验 `nestedIndex` 整数与数组长度边界，规避 `bebe62bd` 迭代器回归；流式淡入分段 DOM 复用不引入 |
| Chat search isolation / chat & character caches / long-chat optimizations | Resolved（单Owner分工） | ST Core + 柏宝库 / 柏宝箱 | 2026-11-13完成三链路宏观收口：ST Core收口`DiskCache→memoryCache`回填、`O(M)`增量聊天片段匹配与文件名命中免解析正文、`keyboard.js`原生`rAF`去重合并；空查询快表/浅表角色索引由柏宝库按POSIX目录精确失效与降级预览对齐承担；长聊天离屏渲染由柏宝箱`content-visibility`承担，不引入SH第二套独立缓存层 |
| 用户场景命中的无跨请求缓存 Core 热路径优化（流式后缀深度/DOM 去重/隐藏标签页节流、单轮 WI 切片复用、宏纯文本快路径、闭合文件夹与楼层标签 `Set` 过滤） | Adopted（adapted，2026-11-14 用户授权二次吸收） | ST Core | 针对几千张角色卡（配合酒馆助手角色卡管理脚本）、千层长聊与 Vertex 思维链流式高频热路径，按 ST Core 单一 Owner 最小侵入落地（零修改柏宝箱/柏宝库、零跨请求持久缓存）；详见文末 2026-11-14 专节 |
| 其余跨请求渲染缓存（`MarkdownRenderCache` / `882b344f`）、`stream-fadein` 分段 `morphdom`、极大数组替换、微秒级 IO/构建/UI 改动、诊断与 benchmark 体系 | Intentional Omission / Reject | — | 流式淡入常态关闭故省略 `A4`；跨请求显示缓存有失效陈旧风险明确 Reject；6.5 万楼参数上限未触及真实场景；几毫秒级细碎 diff 不增加长期维护负担 |

31提交完整索引（短SHA链接到精确来源）：

| SH commit | 主要范围 | Status | 取舍 / Owner |
| --- | --- | --- | --- |
| [510fbb54](https://github.com/Shalistera/SillyTavern/commit/510fbb545f3c713c869e86fff106b3d1a830ce63) | Vertex与诊断 | Adopted | Vertex由ST适配保留；诊断不引入 |
| [01b87c88](https://github.com/Shalistera/SillyTavern/commit/01b87c88d08206ea056e622e955642c159f72f4c) | 消息/Reasoning深度与fade | Adopted（adapted，仅后缀深度与DOM去重）/ Omit（fade分段） | ST Core 采用后缀扫描 `getMessageDepth` 与 `createStreamingContentUpdater` 无变更 DOM 写入短路（写成功后再缓存以保持 `previewFailed` 契约）；用户常态关闭流式淡入，分段 `morphdom` 不引入 |
| [b34249a6](https://github.com/Shalistera/SillyTavern/commit/b34249a6c81e4cbffbb8cff6f45f32243c2ad2a1) | Markdown / WI / Chat Search | Resolved（Search根因）/ Adopted（adapted，单遍Span与单轮WI扫描复用）/ Reject（Markdown缓存） | ST Core 收口 `createChatFragmentMatcher` `O(M)` 搜索、Showdown 单遍 `unhashHTMLSpans` 与 `WorldInfoBuffer` 单次扫描有界切片/小写折叠复用；空查询快表归柏宝库，跨请求 `MarkdownRenderCache` 明确 Reject |
| [b1ae6199](https://github.com/Shalistera/SillyTavern/commit/b1ae6199d44b9c0626552a7e00ac4d99ef618eea) | Chat summaries与Import | Adopt Now（仅导入）/ Reject（Core二级摘要仓） | 仅采用CAI转换和导入防覆盖；快表摘要由柏宝库单一Owner承担，不在Core叠加第二套缓存 |
| [6360ee2c](https://github.com/Shalistera/SillyTavern/commit/6360ee2ce883411eb5bbe94a3be3c962ee846329) | stale search / Markdown / template | Resolved（Search分工）/ Reject（Markdown缓存） | 柏宝库补齐已删群聊GC与截断行降级预览对齐，ST Core保持无状态流式搜索；Markdown缓存明确Reject |
| [097be538](https://github.com/Shalistera/SillyTavern/commit/097be5384c3a947b0d809b9d06845ff10a88578a) | Reasoning编辑/初始化 | Adopt Now | ST；不增加第二套Reasoning状态 |
| [3ef63e86](https://github.com/Shalistera/SillyTavern/commit/3ef63e86c43a3c2637ec70fb972e09c0d93293c9) | 模型/性能文档与测试 | Intentional Omission | 非运行时依赖；使用个人验证文档 |
| [78a22e87](https://github.com/Shalistera/SillyTavern/commit/78a22e873a0ebc81db9df68c33855e040f1bb559) | 跨API自定义模型ID | Intentional Omission | 可选功能；Vertex 已有目标模型链路，OpenAI 兼容副渠道由自定义渠道模型输入与柏系列覆盖，不改十余个后端 |
| [69c6f626](https://github.com/Shalistera/SillyTavern/commit/69c6f6261b82429411ecfea7550bd5e949f7eb50) | Chat byte scan / Search summaries | Resolved（单Owner分工） | 空查询尾部扫描与SQLite摘要归柏宝库（补齐0字节/截断行语义），Core仅保留最小`O(M)`流式关键词匹配 |
| [195035e5](https://github.com/Shalistera/SillyTavern/commit/195035e5757f9dc7e7309e2739675ed7bd3bb5b4) | 角色元数据缓存 | Resolved（Core回填 + 柏宝库浅表对齐） | ST Core仅补1行`DiskCache→memoryCache`回填；浅表加速归柏宝库（修复POSIX `chats/<charName>`失效与`toShallow`字段对齐），不引入SH独立角色缓存表 |
| [f5d33ce1](https://github.com/Shalistera/SillyTavern/commit/f5d33ce1d683c9cce1f4594c35fa45878f98c63b) | Tag / Keyboard初始化性能 | Adopted（adapted，`keyboard.js`根因 + 楼层标签`Set`过滤）/ Omit（其余Tag列表diff） | ST Core `public/scripts/keyboard.js`原生固化选择器索引、`WeakSet`去重、`rAF`按帧合并及子树LCA折叠（删除柏宝库外部`MutationObserver`劫持），并在`applyCharacterTagsToMessageDivs`用`#chat > .mes`单次`Set`过滤替代千层超长选择器拼接（修复`mesIds=0`边界）；其余Tag初始化diff不引入 |
| [0ca7ceac](https://github.com/Shalistera/SillyTavern/commit/0ca7ceacdde9629e588c2ce9e062744c10d6ff60) | Avatar fallback listener | Intentional Omission | 局部DOM优化；不扩展本轮事件范围 |
| [80898271](https://github.com/Shalistera/SillyTavern/commit/80898271ecbd20d1e2e1a2c688933c85009c747f) | Span / Fade性能 | Adopted（adapted，仅单遍`unhashHTMLSpans`）/ Omit（Fade分段与`morphdom`） | 单遍 `¨C(\d+)C` 还原并在同提交内固化下标越界保护；流式淡入常态关闭，不引入 `segmentTemplates` / `morphdom` |
| [882b344f](https://github.com/Shalistera/SillyTavern/commit/882b344f4da67ab5f51b625c4021fa1e02e51d1e) | Streaming panel Markdown复用 | Intentional Omission | 流式代码块美化面板已由柏宝箱 `streamingRegexDefer` + 柏宝库 `regex-bridge` 推迟至终态单次渲染；不叠加第二套前缀 Markdown 缓存 |
| [f9404623](https://github.com/Shalistera/SillyTavern/commit/f940462387b9aafeb95d16ac2f1c3a3751f995de) | Media load listener清理 | Intentional Omission | 未发现当前数据损坏；媒体滚动生命周期优化暂不引入 |
| [93eb4a29](https://github.com/Shalistera/SillyTavern/commit/93eb4a29889bec8bcf6823654bf01833c3ac98b8) | 性能与cache-miss基准 | Intentional Omission | 文档/benchmark，不是Core运行依赖 |
| [bebe62bd](https://github.com/Shalistera/SillyTavern/commit/bebe62bdad8362f4b1c85e7c065ba48b58b3d2cc) | Span indexed语义 | Already Covered（下标边界已内置守卫） | `addShowdownPatch` 直接校验 `nestedIndex >= 0 && nestedIndex < spans.length`，未引入破坏稀疏/越界下标的迭代器实现 |
| [234cb02d](https://github.com/Shalistera/SillyTavern/commit/234cb02d2538728fc96c0d64bbbfed2c50619c64) | WI / Persona search | Adopt | ST；2026-11-13性能阶段采用`Set`查找（4行），与柏宝箱搜索替换独立不冲突 |
| [cfc09c41](https://github.com/Shalistera/SillyTavern/commit/cfc09c41ba55a56e54e0888506313c715b848afc) | Folder索引 | Adopted（adapted，闭合文件夹`Set`预索引） | ST Core `createClosedFolderFilter` 在单次 `filterByTagState` 调用内预建未选中闭合文件夹 `Set` 与空集短路，消除几千张卡 × 闭合文件夹重复扫描 |
| [a659d219](https://github.com/Shalistera/SillyTavern/commit/a659d219d81cc5084aa0d6d8c1e8d37c1b76cb49) | Group引用索引 / stat复用 | Intentional Omission | 列表性能，不引入索引状态 |
| [c8147274](https://github.com/Shalistera/SillyTavern/commit/c8147274b34b281d204fa9887d9048b0431abfa6) | Webpack build cache | Intentional Omission | 构建优化非运行必要依赖 |
| [a3bb450d](https://github.com/Shalistera/SillyTavern/commit/a3bb450d400b20280566de938ba0f451cabb7dc1) | Macro fast path | Adopted（adapted，宏纯文本快路径） | ST Core 在 `evaluateMacros`（前置保留 `chat_id_hash`/`charPrompt`/自定义宏副作用并检查 `<`）与 `MacroEngine.evaluate`（保留前置/后置处理器）跳过无 `{{` 纯文本词法/语法树构建 |
| [46c47c5b](https://github.com/Shalistera/SillyTavern/commit/46c47c5b015bfe90ec582d2a2597b97257ff979b) | Token Count failure | Adopt Now | ST；已有fallback必须结算 |
| [f84b0a1f](https://github.com/Shalistera/SillyTavern/commit/f84b0a1ffbc986b8e04f71d813a6c6fa835a1a0e) | Thumbnail header读取 | Intentional Omission | IO优化，不改图片路径 |
| [b35c996c](https://github.com/Shalistera/SillyTavern/commit/b35c996c81cd878e277944bc10f1c367ee129083) | Hidden preview / 大数组替换 | Adopted（adapted，仅后台流式预览节流）/ Omit（大数组替换） | ST Core 在 `document.hidden` 时将流式中间预览降频至 `>= 250ms`（切回前台立即恢复原 FPS），与柏宝箱负责历史楼层离屏布局跳过的 `content-visibility` 正交互补；6.5 万楼极大数组替换未触及真实场景，不引入 |
| [b0f25818](https://github.com/Shalistera/SillyTavern/commit/b0f25818429becd3518b943fd7d5399d3d452f63) | 并行Template初始化 | Intentional Omission | 启动性能，不改顺序 |
| [fa16e070](https://github.com/Shalistera/SillyTavern/commit/fa16e070a67a57fc4e5be1cc8c5c0f374f3cedfa) | 持久化Chat token cache | Reject | 明确拒绝持久化Chat token缓存；OpenAI兼容批量计数由柏宝箱+柏宝库桥接承担 |
| [b82c3547](https://github.com/Shalistera/SillyTavern/commit/b82c35477a9f2dbf9dcf07e46f88efae4accf045) | Tokenizer init生命周期 | Adopt Now | ST；single-flight、ready发布、失败可重试 |
| [897eb6cb](https://github.com/Shalistera/SillyTavern/commit/897eb6cb4dd985feed8bb1b26534ba4530c9585d) | 浏览器/服务端性能文档 | Intentional Omission | 不引入性能benchmark体系 |
| [63822f73](https://github.com/Shalistera/SillyTavern/commit/63822f73639d2945b0d1720df66effefb25282b0) | Streaming工具/失败/停止 | Adopt Now | 公共生命周期适配；已有Vertex收尾不再建立副本 |
| [f67e0000](https://github.com/Shalistera/SillyTavern/commit/f67e000034a130dc25c7fb7571b5731f4c219f89) | CPU与调度争用测量 | Intentional Omission | benchmark准确性改进，无运行依赖 |

Phase C-D 当时五项可靠性修复与性能优化解耦落地；随后于 2026-11-14 经用户结合真实使用场景（几千张囤卡 + 酒馆助手角色卡管理面板、千层长聊、Vertex 思维链流式、流式淡入常态关闭）明确授权，对上述无跨请求持久缓存、零柏系列重叠的 8 个 Core 热路径子项完成最小侵入二次吸收（见文末专节）。`bebe62bd` 对应的下标越界隐患已在 `addShowdownPatch` 同提交内直接守卫；`b35c996c` 的 6.5 万楼大数组替换仍因未触及真实场景保持不引入。

## Phase C Code Freeze

**当前状态：Phase C Code Freeze，2026-11-09正式登记。** 当前发布入口见[Personal Release Operations](PERSONAL_RELEASE_OPERATIONS.md)，差异结论见[Final Delta Audit](FINAL_DELTA_AUDIT.md)。 根据用户在Phase C-E0任务中确认，Phase C-D已经通过独立审查；本次登记不是Work自审替代独立审查。Candidate阶段曾报告多轮、刷新后继续、Stop、Regenerate等通过。当前正式GHCR镜像已完成NAS切换及基本验收，Image ID、healthy/RestartCount与两插件实际SHA已登记；正式镜像未复验能力按需在对应功能变动时补验（启动日志`listen`/私网过滤告警已于2026-11-13经用户确认仅LAN+Tailscale自用无公网暴露归档结案，Backrest未启用并移出待办）。

| Frozen component | Branch / source | 精确SHA |
| --- | --- | --- |
| Personal ST Runtime | `SurgeXW0508/SillyTavern:release`（冻结Runtime） | `090cbba6d40e5d117ab41a9e6deb20b40e2dc336` |
| Personal ST-BaiBai-Tools | `SurgeXW0508/ST-BaiBai-Tools:personal/stable` | `2f6a9c54d2c906b4a0e44d20c12d0712552e393d` |
| BaiBaoKu原版0.7.3 | `baibai-git/baibaoku` | `b211a4e97fdaec24dc8b90c85ddc198fac9ac200` |

C-E0只登记和交接文档；Stage HEAD可以因此前进。C-E0本地Candidate输入为该冻结Runtime SHA；正式Personal Release使用经CI验证的固定Tag/source commit构建，并检查Runtime相对冻结SHA不变，不能改用浮动分支HEAD。Capability Ownership不变，Save Generate继续不装配，不新增兼容Hook/Adapter。

冻结后仅以下情况允许重新开发：真实验收发现P1、安全问题、数据正确性问题。必须记录复现、Owner、影响面和受影响测试，再提交新的候选。Shalistera性能优化、benchmark更快、顺手重构、UI小优化和Pending Ownership尚未处理均不能解除冻结。

C-E0首次手工Candidate过程保留在[历史交接](PHASE_C_DEPLOYMENT_HANDOFF.md)。此前Final Delta Audit / 发布收口已通过审查和CI，快进合入release并发布v1.19.0-personal.1，Tools AGENTS已切换到release链接。正式镜像与更新/回滚入口见[Personal Release Operations](PERSONAL_RELEASE_OPERATIONS.md)。用户之后已完成正式NAS镜像切换；Work本轮没有SSH或生产操作，也未清理资产。Owner矩阵仍只维护在本文。2026-11-12针对满足上述重开门槛的Vertex凭据边界、P1协议契约及流式/重放正确性问题完成独立开发与审查，阶段性快进合入`release`（Runtime `e49a694083cc46dbf883f13eab664076c139011f`），详见文末2026-11-12记录。

### 2026-11-09 — Phase C-E0 freeze registration

Decision：登记上述已通过独立审查的冻结组合，代码侧停止；部署由用户在ChatGPT指导下手工执行。

Owner Review：本轮只改变维护记录和交接文档，没有能力实现变更。Runtime、两个柏宝仓库、Dockerfile、默认配置、构建流程和依赖不变。旧Vertex/Save Generate外部patch不参与Candidate构建、安装或回滚。

当时的Boundary（历史记录，不代表当前生产状态）：NAS容器、挂载、当时插件版本、Backrest恢复点和旧Image仍待实机证据；构建或启动成功不能替代真实Google与整组合验收。

## Update Preflight（合并/发布前必须完成）

1. 先读Production Baseline和当前Release的Validated Stack，再核验三个项目各自目标版本/commit、工作区、本地修改；未知实机字段不猜测。
2. 即使只更新一个项目，也列出其对另两个项目的接口、Hook、状态、数据与生命周期影响，记录Owner Review结论。
3. 对照上表，检查新能力重叠、Hook顺序、状态与生命周期所有权。
4. 检查官方是否已吸收个人改进；吸收后优先移除对应个人diff。
5. 已有成熟Owner时关闭/删除另一实现，不新增协调两套实现的兼容层。
6. 只有不可替代且无法单Owner的能力才允许明确、有限的跨模块契约，并说明取消/错误/持久化责任。
7. 验证Feature Off无安装/监听/轮询/后台任务、生成只派发一次；更新插件不能悄悄恢复Save Generate。
8. 执行受影响的Core回归、插件策略检查和隔离集成；涉及认证/代理/模型时增加真实环境验收。Mock通过不能替代实机。
9. 更新本Ownership Matrix、Disabled Features、Decision Log、支持矩阵与精确组合记录。
10. 记录验证结果与回滚点后，才可进入另行授权的合并/发布。禁止先升级再故障补丁。

## SillyTavern官方更新流程

1. 查看官方Release与代码差异，记录目标commit；不因新版本出现直接合入。
2. 读取当前生产组合和Owner规则，对比Official、Personal，以及实际相关的Shalistera参考实现；不重新吸收无关优化。
3. 判断能力应由Core还是柏宝持有；官方已有可靠等价能力时优先删个人diff或关闭另一侧重复能力，不建立协调双实现的Adapter。
4. 将已选择官方基线同步到`upstream/release`，在独立`stage/*`适配个人差异；保持正式release和NAS不动。
5. 完成代码审查、CI和受影响的三方组合测试，记录各自精确SHA和回滚组合。
6. 经任务授权合入个人release，使用既有Personal Release Workflow生成Tag/GHCR/Validated Stack；NAS仅拉取验证过的正式Digest，Health/Smoke成功后更新Current/Previous和Production Baseline。

## 柏宝箱安装、更新与上游同步

正式源：`https://github.com/SurgeXW0508/ST-BaiBai-Tools`，Branch/Tag填写`personal/stable`。原生安装后应看到当前分支`personal/stable`、upstream `origin/personal/stable`及上表commit；Update继续跟随该分支，不切回main。

从旧上游安装迁移时，先备份代码目录和账户设置，确认global/local安装范围及实际加载副本。新旧仓库同名目录会使直接安装返回409；切分支也不会更换origin。后续迁移任务应使用原生扩展管理器移除旧代码副本、从Fork按分支安装，保留账户设置，并确认只加载一份；本轮没有操作NAS或替换正式扩展。

上游更新流程：

1. 开始任务先读本文和`personal/stable`的AGENTS.md；不要依赖纯main中存在个人维护文件。
2. 核验上游目标commit、Fork main/stable当前HEAD、当前组合和本地修改。允许固定已验证版本，不追逐无关更新。
3. 将Fork main按fast-forward同步到已选择的上游基线；main不放个人代码或维护策略，不用上游URL无条件更新生产。
4. 列出受影响Capability、阅读Owner矩阵、检查上游是否已有真正Feature Off。若已有且验证可靠，优先删除个人策略，不能保留两套。
5. 从现有stable建立独立候选，将已审查main合入并解决最小个人差异。默认保留公开stable历史，避免重写正在被扩展管理器跟踪的分支。
6. 执行`npm ci --ignore-scripts`、`npm run build`、`npm run test:personal-stable`（含`manifest.json`真实入口`dist/index.js`、`dist/index.css`、17个静态宿主模块白名单、动态宿主导入`/scripts/world-info.js`导出符号及无关检出目录字节一致性门禁）及受影响原有测试；核对源码/dist同步及lockfile差异。
7. 隔离ST验证legacy true/false/缺省设置、禁用UI、重载、无安装/监听/恢复/轮询/Job，以及普通请求次数与相邻Generate Retry。
8. 验证候选是旧stable后代，再fast-forward推进`personal/stable`。不得force-push/rebase已公开的stable历史；rebase仅限尚未发布的候选，最终推广仍须保留旧stable祖先关系。
9. 更新本canonical组合表、Owner/Disabled Features/Decision Log及结果记录；独立审查通过后，才进入另行授权的生产Update和全页重载。

不可删除或改名柏宝箱或柏宝库的`personal/stable`。2026-11-13已收口并合入`personal/stable`扩展管理接管策略：柏宝库默认要求直连或代理等权威线路确认目标SHA（`allowUnverifiedMirrorDecision: false`、云端镜像兜底`cloudMirrorsEnabled: false`），在`system`与`builtin`双适配器中同时完整核验`branch.<name>.remote`与`branch.<name>.merge`（`FX3-2`）——显式跟踪非`origin`远端（如`upstream`）一律报`UNSUPPORTED_UPSTREAM`拦截，单边缺失/格式不合法报`NO_UPSTREAM`拦截，`personal/*`分支必须具备完整的`origin`上游跟踪，仅完全未配置`remote`/`merge`的非`personal/*`分支在权威线路确认远端存在`origin/<同名分支>`时才按同名分支更新并自动补写跟踪配置，游离`HEAD`或远端无同名分支一律报`NO_UPSTREAM`，任何情况下（含`force: true`）严禁自动切向远端默认分支；柏宝箱前端仅在确认后端接管开启时才改写`/api/extensions/*`（非`unsupported`临时读取失败设60s冷却期），且浏览器侧兜底更新检查改为读取个人Fork `SurgeXW0508/ST-BaiBai-Tools`的`personal/stable` manifest，不再读取上游`baibai-git/.../main`。日常个人更新仍以ST扩展管理器的当前分支、commit及远端检查为准。

## 柏宝库 Personal Fork 与固定生产分支策略

个人Fork：`SurgeXW0508/baibaoku`；上游：`baibai-git/baibaoku`。

- `main`：纯上游同步镜像，只接收原作者main，不放个人Runtime策略。
- `personal/stable`：唯一生产分支，NAS只允许跟踪此分支。
- `personal/stable`于2026-11-12从个人Fork的main创建，初始Runtime基线为`b211a4e97fdaec24dc8b90c85ddc198fac9ac200`（0.7.3），与上游等价；初始建分支和新增维护文档不包含Runtime改动。
- 2026-11-12已完成NAS Git跟踪关系整理：`origin`指向`SurgeXW0508/baibaoku`，`upstream`指向`baibai-git/baibaoku`，当前`personal/stable`跟踪`origin/personal/stable`，工作区clean。NAS HEAD为`4814830f`，原Runtime基线`b211a4e9`保留在`backup/pre-personal-stable-20261112`。2026-11-13已将经过审查与三库联跑验证的能力归属收敛与`FX3-2`完整跟踪核验快进合入`origin/personal/stable`（`61aae569` / Runtime `9d9854ca`）；NAS尚未拉取该阶段合入，线上Runtime仍为`b211a4e9`，待全部后续链路完成后统一部署。

### 上游更新流程

1. 将原作者main同步到个人Fork的`main`，不直接更新NAS。
2. 对比新旧上游，检查Server Plugin生命周期、数据库与迁移、依赖、自更新、正则引擎桥接，以及与ST Core和柏宝箱的接口。
3. 完成本文Capability Ownership Review，并运行受影响测试；检查`package.json`与lockfile变化。涉及数据库格式或迁移时，必须独立确认兼容和恢复边界。
4. 审查通过后，以正常PR/快进方式推进个人`personal/stable`。不要force-push、rebase或重写公开stable历史。
5. 只有用户明确授权后才更新NAS。

### NAS更新入口

柏宝库位于独立挂载目录`/vol3/1000/SillyTavern/plugins/baibaoku`（容器内`/home/node/app/plugins/baibaoku`），不在ST镜像内。更新它不需要重新构建Docker镜像，但必须重启SillyTavern Server。

一次性完成NAS remote/branch整理后，日常更新通过飞牛Docker图形界面打开`sillytavern`容器终端，先核验工作区、origin和当前分支，再定向执行：

```bash
git -C /home/node/app/plugins/baibaoku status --short --branch
git -C /home/node/app/plugins/baibaoku remote -v
git -C /home/node/app/plugins/baibaoku branch --show-current
git -C /home/node/app/plugins/baibaoku pull --ff-only origin personal/stable
```

只有工作区干净、当前分支为`personal/stable`、origin指向个人Fork时才允许执行。依赖manifest/lockfile确实变化时，才按仓库安装说明执行生产依赖安装；之后通过飞牛Docker图形界面重启容器，并验证`/api/plugins/baibaoku/v1/status`及本次受影响功能。

**不要用`node /home/node/app/plugins.js update`作为柏宝库单独更新命令**：SillyTavern原生脚本会遍历并更新plugins目录下所有Git Server Plugin，不只更新柏宝库。不要为柏宝库单独更新而开启全局`enableServerPluginsAutoUpdate`；当前生产组合保持`enableServerPluginsAutoUpdate: false`。

完整的一次性NAS分支整理、日常更新、依赖安装、重启、回滚与数据保护步骤见[柏宝库 Personal Maintenance](https://github.com/SurgeXW0508/baibaoku/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)。

## 版本与回滚

`upstream/release`保持纯官方同步基线；`release`从本次正式Closeout起承载已审查Personal稳定代码，个人开发在独立Stage。每个变更记录来源、Owner、受影响能力和测试；上游同步先在隔离分支验证，不将Shalistera整分支合入。

部署时记录ST commit/不可变镜像digest、插件commit/跟踪分支和生产dist哈希、运行时、配置与数据备份位置。保留上一已验证组合及部署描述；回滚整套组合，不能只退ST而留下新的插件Hook。禁止以版本号标签代替运行代码证据。

正式GHCR部署、实际Image ID、容器healthy/RestartCount=0及两插件SHA已由用户提供并登记。Backrest暂未启用且不列入常规Pending；Current/Previous镜像回滚与数据恢复严格分开，完整目录备份和官方过渡回滚镜像继续保留；不读取聊天正文或秘密。

柏宝箱与柏宝库的个人`personal/stable`分支均放置简短AGENTS.md，链接本文及各自部署Runbook，不复制能力矩阵。所有涉及三仓库的任务必须显式要求先阅读本文；具体部署步骤分别见[柏宝箱维护与更新](https://github.com/SurgeXW0508/ST-BaiBai-Tools/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)和[柏宝库维护与更新](https://github.com/SurgeXW0508/baibaoku/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)。

公开stable需要回滚时，优先以新的revert提交恢复已验证代码树，保留正常快进更新链；应急整组合快照恢复后暂停更新，不能通过强推stable倒退来驱动客户端回滚。

## 2026-11-09 — Final Delta Audit / Personal Release

Final Delta Audit未发现需重开Runtime的P1、安全、数据正确性或Owner阻断。16个运行/配置差异均有Core Owner与必要配套；官方release仍为原基线，SH仅参考、不自动同步。发布基础设施独立于Runtime，审查过的personal-release.json进入release后触发版本化GHCR与不可变Validated Stack资产；无latest、无NAS自动构建/部署。

未来优先级：Official security/correctness → Personal Core compatibility → BaiBao compatibility → 用户真实新能力 → UX → performance/optional。升级前先读本文和当前Release的Validated Stack，再做Owner Review、Stage、受影响测试、Release和Deploy。

回滚采用Current + Previous；过渡期旧官方1.19.0保留到下一次Personal Release成功。Runtime回滚与数据恢复分开，插件漂移时不能只退ST。正式GHCR重部署与最终smoke通过只是清理前提，不构成当前清理授权；仍须单独核实备份保障和保留策略。当前正式镜像基本验收已登记，最终文档等待独立审查；其余未验收能力、备份/GUI/安全评估和清理属于明确保留的维护待办。

## v1.19.0-personal.1 — 发布结果

正式source commit为`1af2180585e5bbe49159bc8884d5c890641f13c3`，Runtime仍为`090cbba6d40e5d117ab41a9e6deb20b40e2dc336`；之后的发布结果登记仅是文档。Tag不移动、不重建同版本。

Personal Core CI与Personal Release均成功；amd64/arm64镜像已推送，amd64无凭据隔离启动health smoke通过。实际匿名读取GHCR manifest成功，digest为`sha256:22973f7169fa694a0894b054e2b754ccf0ea881703d32a011e473c79c87ac740`，与Release资产一致。

Release的Validated Stack保留发布时冻结pin和当时验收快照，保持不可变。当前实际NAS元数据及正式镜像基本验收已补入Production Baseline；本轮只在独立文档分支登记，等待独立审查，不重新发布或改制品。Candidate、临时目录、完整备份和旧官方镜像仍保留；飞牛GUI更新方式和Backrest/恢复/安全评估等待办见Operations，不宣称已完成。

## 2026-11-09 — Final Documentation Closeout

Decision：以用户提供的正式NAS输出补齐当前生产组合，区分正式镜像四项基本验收与Candidate历史验证。仓库维护HEAD、Release source、Runtime和NAS实际插件SHA分别记录，不能互相替代。

Scope：只更新维护/操作/验收文档、Production Baseline和根AGENTS；独立文档分支提交待审，不合并、不发布、不操作NAS，也不处理清理、GUI方案、备份恢复或既有安全警告。

## 2026-11-12 — 三仓库 Personal Fork 部署流程收口

Decision：三个仓库统一采用“上游同步镜像 → 独立审查 → 个人生产分支 → 用户授权部署”。上游变化不直接进入NAS；任何组件都不得因为另一个组件更新而被隐式升级。

- SillyTavern：`upstream/release`保持官方同步，`release`承载个人生产代码。NAS使用飞牛OS正式管理的Compose项目`sillytavern`，固定GHCR Digest；更新时通过飞牛Compose GUI修改完整Digest并重新部署，不使用latest。
- 柏宝箱：个人Fork的`main`只同步原作者，`personal/stable`是唯一部署分支。NAS的origin指向个人Fork，酒馆扩展管理器只更新当前分支对应的`origin/<branch>`，因此只有推进个人stable后才会提示生产更新。
- 柏宝库：个人Fork的`main`只同步原作者，`personal/stable`是唯一生产分支。NAS已完成一次性整理，`origin`指向个人Fork、`upstream`指向原作者，当前跟踪`origin/personal/stable`。日常更新使用飞牛Docker容器终端中的定向Git更新，然后通过GUI重启容器；不使用会更新全部Server Plugins的全局脚本。
- 三仓库的详细安装、更新、依赖、重启、回滚步骤分别见[Release Operations](PERSONAL_RELEASE_OPERATIONS.md)、[柏宝箱 Runbook](https://github.com/SurgeXW0508/ST-BaiBai-Tools/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)和[柏宝库 Runbook](https://github.com/SurgeXW0508/baibaoku/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)。

交接规则：仅在**大阶段或完整大功能节点收口**（已具备评估部署价值，或用户主动询问发布/部署）时提供NAS部署交接，说明变更是否影响NAS Runtime、是否已进入生产分支/Release、NAS当前与目标commit或Digest，并询问用户是否现在更新NAS；中间讨论、小功能子步骤、候选修复迭代或用户已明确延后统一发版的阶段内不重复附带NAS更新提示。任何情况下不得自动发布、切换Digest、更新插件、重启容器或修改生产数据；部署必须得到用户明确授权。

Scope（初始文档收口）：只修改文档并在个人Fork创建柏宝库`personal/stable`分支；未修改Runtime源码、未运行构建或发布。\n\nFollow-up（2026-11-12）：用户提供NAS执行结果，确认柏宝库已成功切换到个人Fork的`personal/stable`，并设置`origin`为个人仓库、`upstream`为原作者；工作区clean，保留原始Runtime备份分支。本次Git跟踪整理不改变Runtime，不需要重启。随后将当前NAS分支、备份分支和远端关系同步记录到Production Baseline与柏宝库Runbook。

## 2026-11-12 — Vertex 协议契约对齐、封闭枚举诊断、凭据边界与流式/重放收尾（Merged to release）

Trigger（符合冻结后重开门槛：安全凭据边界 + P1 请求 400 + 流式/历史重放数据正确性缺陷）：

1. 共享凭据入口目标校验缺口（安全边界，Personal 补丁）：上游`src/endpoints/google.js`的`getGoogleApiConfig`（图片描述、原生TTS、Imagen、Veo及`google-vectors.js`共用）直接将`vertexai_region`拼接进域名并附加已保存的Google凭据，可被构造区域诱导至外部域名。现收敛单一Owner `getVertexHost(region)`（`google.js`导出，`vertex-transport.js`的`vertexHost`委托复用），在非反代Vertex模式下于读取/换取凭据前强制校验官方Google域名；若未来上游原生修复该校验，删除本个人补丁。
2. 协议契约缺陷（P1）：`vertex-protocol.js`在默认预设`top_k: 0`时向采样模型发送非法的`generationConfig.topK: 0`；未对`gemini-3.6/3.7/3.8-flash`与`gemini-3.5-flash-lite`剥离采样/惩罚参数；`gemini-3.7/3.8-flash`的`min`及`gemini-3-pro-image`/`gemini-3.1-flash-image`等模型的思考档位映射与Vertex官方契约不一致（保留`gemini-3.1-pro`原生的`LOW/MEDIUM/HIGH`支持，与AI Studio路径解耦）；`gemini-2.5-flash-image`误传`imageConfig.imageSize`导致400；选择器与回退规则缺少`gemini-3.8-flash`。
3. 流式空失败与原生历史重放边界（数据正确性）：`openai.js`在流式`parsed.error`且零可用内容时仍`yield`空的`vertexResponseRecord([], model)`，导致空助手消息落盘且未弹出错误提示；中断/partial/未执行的`functionCall`在下一轮通过普通显示消息被无配对`functionResponse`重放（现由`vertex-state.js`的`reusableVertexDisplayResponse`确立不变式：`functionCall`仅允许经成对`tool_invocations`载体消息重放，显示消息重放一律剥离`functionCall`，对已存盘旧聊天同样生效）；开启“角色名写入正文”（`DEFAULT`/`CONTENT`）时`setOpenAIMessages`传入带前缀的`promptText`导致原生重放吞掉角色名前缀（现改为传入未加前缀的消息原文，保留前缀为独立无签名文本Part）。保持上游`quiet`后台生成的原有错误提示行为不变，同时防止前台生成期间的并发`quiet`调用覆盖`#vertexai_runtime`状态栏。

Capability Ownership Review & Security Boundary：

- Owner：全部能力归属ST Core唯一Owner（`google.js`、`vertex-*.js`、`openai.js`、`vertex-state.js`、`vertex-ui.js`）；`ST-BaiBai-Tools`（`Save Generate`继续不装配、`Generate Retry`保持关闭）与`baibaoku`零改动，柏宝库5个前端Bridge锚点全部通过幂等匹配验证。
- 第三方插件减法：ST Core原生已完整支持`gemini-4-argon`及流式/推理契约，无需保留第三方`Quirlune/Vertex-Custom-Models`扩展（建议在ST扩展管理器卸载以避免DOM选择器争用）；`Shalistera@78a22e87`跨渠道自定义模型继续保持Intentional Omission。
- 防封号与安全边界：维持100%官方Vertex端点与标准头，每次用户操作仅单次上游派发（零自动重试）；聊天与多媒体共用单一官方Vertex域名白名单解析；错误诊断采用16 KiB / 5s双有界读取与封闭枚举白名单（`google.rpc.Code`、`ErrorInfo.reason`、协议层安全阻断枚举及受根约束的camelCase/snake_case Schema路径），绝不读取或回显上游`error.message`、`description`、URL、凭据或Prompt；结合`usageMetadata.thoughtsTokenCount`识别未开启思考展示时思考耗尽`maxOutputTokens`的场景；`#vertexai_runtime`等待秒表仅在等待阶段运行，进入接收或任意终态/异常/取消立即销毁，零残留定时器、零额外网络请求，并在终态展示隐式缓存命中率与Token分项明细。

Scope & Deployment Status：已在`stage/vertex-protocol-and-ux`完成内部diff审查与外部安全/协议复核修复，全部检查通过（`lint`、`test:vertex` 40/40、`test:reliability` 17/17、`test:unit` 412/412、`release.node.mjs` 13/13、Python治理单测 4/4、真实Chromium E2E `VertexNative.e2e.js` + `CoreStreaming.e2e.js` 33/33、柏宝箱`test:personal-stable` 6/6、柏宝库5个Bridge锚点幂等核验 5/5），并基于`fdfad0703ad8bd08ba0d5cc90d0c6f15abecfc5d`快进合入个人`release`分支（阶段Runtime提交链：`fbdcfae4ef39e4bd624d81a01c35421d407e017e` → `206fc2476d76dadc2b24a6214d9dcea607265c8b` → `e49a694083cc46dbf883f13eab664076c139011f`）。按阶段规划，未修改`personal-release.json`（保持在已发布版本`v1.19.0-personal.1` / `090cbba6d40e5d117ab41a9e6deb20b40e2dc336`，避免提前触发`personal-release.yml`自动构建GHCR镜像；在此期间`scripts/personal/release.mjs check`会按设计提示相对`090cbba6`的Runtime差异，直至下一正式版本发版时同步更新`personal-release.json`）；已在`PRODUCTION_BASELINE.json`的`release_branch_milestone`与`repository_heads`登记仓库阶段基线，不改动`current_production`；未构建Docker镜像、未打Tag、未操作NAS生产环境，待后续性能优化与修复阶段完成后统一构建镜像并进行实机Google/NAS验收。

## 2026-11-13 — 用户授权的三仓库性能优化与 Pending Ownership 收敛（Merged to release / personal/stable）

Authorization & Scope：由用户明确授权在Vertex收尾后进入“三仓库性能优化（聚焦世界书`#world_editor_select`切换卡顿）+ Pending Ownership收敛 + 扩展镜像供应链边界加固”阶段。全程严守不触碰Vertex主链路、不恢复Save Generate、不引入新框架/新缓存层/新依赖的边界。

Decision & Ownership Convergence：

1. **世界书切换与搜索（ST Core Owner + Tools UI精简）**：
   - ST Core（`stage/perf-worldinfo`）：消除切换世界书时的重复DOM清理并改为单次Select2销毁后容器级释放（`clearEntryList`）；将每次切换全量`O(K²)`关键词候选重建改为`Map`增量计数与按需懒排序（同时修复切至无关键词世界书时残留旧缓存的问题）；为`originalData.entries`建立基于`WeakMap`的`uid -> 下标`索引（`S1`，命中校验`entries[idx]?.uid === uid`，原地替换中间元素或修改`uid`时自动重建一次，新增/删除/克隆同步维护）；对齐前端`loadWorldInfo`缓存未命中时的深拷贝语义；将后端`/api/worldinfo/get`改为异步文件读取并标注同步/异步读取函数语义同步约束（`S2`）；采用Shalistera `234cb02d`的世界书/人设搜索`Set`查找；在`StreamingProcessor`上暴露`this.previewFailed`供前端流式扩展判断预览失败终态。
   - 柏宝箱（`candidate/perf-worldinfo`）：删除`vueList.js`（历史命名，已无Vue依赖，`T6`）只为附加ST节点而每次create/mount的空Vue根应用，并在节点插入后经`requestAnimationFrame`让出一帧再执行搜索面板/布局收尾刷新，让出前后双重校验`renderToken`与启用开关（`T1`）；世界书下拉分组对同次打开事件去重并在书单未变时复用分组结构；下拉主题同步改为单次`getComputedStyle`读取与批量样式写入，且主题签名覆盖全部29项快照字段（`T3`）；全局世界书选择器对`#world_editor_select`的`change`仅在`requestAnimationFrame`中按帧合并刷新已登记选择器显示标签，不重建下拉或重排选项（`T2`）；`mobileLayout`仅在移动布局安装观察器，`entryVisibility`完成一次卡片高度采样后同时断开`ResizeObserver`与`MutationObserver`。
2. **Tokenizer批量桥与宏求值正确性（Tools + BaiBaoKu 桥接，ST 拥有语义）**：
   - 保留OpenAI兼容渠道所需的Tokenizer批量桥，明确拒绝`fa16e070`持久化Chat token缓存与Markdown缓存。
   - 修复柏宝库`openai-tokenizer-bridge-installer.js`与`world-info-tokenizer-bridge-installer.js`提前调用`substituteParams`导致有状态宏（如`{{roll}}`、`{{random}}`）重复或提前求值的问题，并将注入范围完全收进`start/end`标记块内，支持字节级精确`unpatch`还原；含宏文本（含`{{...}}`及旧式宏`<USER>`/`<BOT>`/`<CHAR>`/`<CHARIFNOTGROUP>`/`<GROUP>`，两侧正则完全统一，`FX2-2`）跳过预热/批量计数并交回ST原生单次求值计数；修复多模态数组/`tool_calls`在批量计数中被误强转为`"[object Object]"`的偏差，严格对齐ST原生tiktoken语义；世界书编辑器Tokenizer预热仅在`main_api === 'openai'`时运行。
3. **扩展管理供应链版本决定权与分支保护（BaiBaoKu 可选接管 + Tools 跟随开关）**：
   - 供应链安全决定（不过度防御）：服务器端会执行的扩展与自更新代码默认必须由**权威线路**（直连GitHub或经用户代理连接GitHub）决定目标提交SHA（`allowUnverifiedMirrorDecision: false`），并在探测阶段保证更快的镜像响应不会提前中止在途的权威代理探测；第三方镜像仍可作为已知权威SHA的下载通道（由git校验对象哈希且克隆后二次核对HEAD SHA）；云端镜像列表兜底默认关闭（`cloudMirrorsEnabled: false`）；完整保留mihomo场景所需的代理探测（环境变量、ST `requestProxy`、git `http.proxy`、本机端口`7890/7897/10809/1080`）。若用户处于纯镜像无代理环境，可通过配置显式开启`allowUnverifiedMirrorDecision: true`。
   - 分支保护、完整跟踪关系核验与同名分支推断（`NO_UPSTREAM` 方案 A，`K2` + `K4` + `FX3-2`）：`system`与`builtin`双Git适配器同时读取并核验`branch.<name>.remote`与`branch.<name>.merge`，由单一`resolveTrackedBranch`统一约束版本检查与实际更新——显式跟踪非`origin`远端（如`upstream/...`或本地非`origin`引用）在所有分支上一律报`UNSUPPORTED_UPSTREAM`拦截，单边缺失/格式不合法/重复配置等残缺状态一律报`NO_UPSTREAM`拦截（绝不落入同名分支推断）；`personal/*`受保护分支必须具备完整的`origin`上游跟踪（`remote=origin` + `refs/heads/<branch>`或`remote=.` + `refs/remotes/origin/<branch>`），游离`HEAD`或`personal/*`缺失upstream时一律报`NO_UPSTREAM` / `BRANCH_PROTECTED`拦截；仅在`remote`与`merge`同时未配置的非`personal/*`合法分支上，当**权威线路**确认远端存在`origin/<同名分支>`时才按同名分支检查或更新，并在更新成功后于双后端自动补写`branch.<name>.remote/merge`与`remote.origin.fetch`；任何情况下（含`force: true`）严禁自动切换到远端默认分支（如`main`）。错误提示统一使用相对扩展路径（`extensions/<folder>`或`public/scripts/extensions/third-party/<folder>`），不暴露服务端绝对路径。
   - 柏宝箱前端`/api/extensions/*`改写前先查询后端接管配置，未开启时直通ST原生路由，非`unsupported`临时查询错误进入60s冷却期并沿用本地缓存值（`T5`）；浏览器兜底更新检查改为读取个人Fork `SurgeXW0508/ST-BaiBai-Tools`的`personal/stable` manifest。
4. **常驻钩子收敛、真实交付入口门禁与跨组件耦合兜底**：
   - 柏宝箱`vite.config.mjs`改为按浏览器运行时固定挂载URL（`/scripts/extensions/third-party/<扩展>/<manifest.js>`）计算`@sillytavern/*`相对导入层级（`../../../../../`），彻底消除对构建机检出路径中`public`目录层级的依赖，并在`test:personal-stable`中新增`manifest.json → dist/index.js`真实入口17个宿主模块路径/导出符号核验与异构路径构建一致性门禁（`FX3-1`）；删除后端已`410 Gone`的Fast Chat渐进加载残留fetch/trigger死代码、无用常量与重复空调用（`T6`）；生成重试导出并复用单一`GENERATION_REQUEST_ID_KEY`常量且Vertex请求一律直通（`T4`）；备份列表fetch拦截按对应开关装配；合并两处重复的`Element.prototype.scrollTop`定义为单一Owner，无`requestAnimationFrame`环境不吞掉写入（`T7`），且对每个已注册拦截器单独捕获隔离异常，防止单一拦截器报错中断后续拦截器与原生滚动写入（`FX2-3`）；`streamingRegexDefer`在`processor.previewFailed === true`时跳过收尾全量重绘。
   - 柏宝库抽取单一`SETTINGS_CACHE_READONLY_PATHS` / `SETTINGS_CACHE_INVALIDATE_PREFIXES`常量并经`JSON.stringify`同步注入`early-bridge`内联脚本（`K3`），修复切换/列出世界书（只读`/api/worldinfo/get`、`/api/worldinfo/list`）误清空前端`settingsGetCache`的缺陷；`hasActiveLazyThemeHydrator`改为进程内读取`getThemeBridgeStatus()`并以扩展目录`mtimeMs`校验配合30s TTL兜底缓存扫描结果、实时解析禁用列表（`K1` + `FX2-1`），增删扩展目录时立即失效重扫，未检测到已启用的柏宝箱或`power-user.js`主题桥时自动回退下发完整主题数据。
   - Character Cache、Chat Search与Early Bridge `MutationObserver`合并层维持`Pending Ownership Review`，本阶段不触碰。

Evidence（隔离Chromium基准`n=5`，CPU 2x节流，预热后`50↔300↔1000`条目4组切换正逆序交替5轮，仅作隔离回归对比，不等同NAS/手机实机验收）：

- 默认`perPage=25`（全部12组场景中位数与p90全面下降）：
  - `st-only`：`switchInteractiveMs`中位数`506–565ms → 449–509ms`（`-5.9% ~ -16.2%`，p90 `522–632ms → 469–538ms`），`longTaskMaxMs`中位数`279–339ms → 218–284ms`（`-13.1% ~ -21.9%`），`longTaskTotalMs`中位数`366–442ms → 315–376ms`。
  - `st+tools`：`dropdownOpenMs`中位数`289–342ms → 276–288ms`，`switchInteractiveMs`中位数`548–595ms → 464–525ms`（`-9.3% ~ -16.5%`，p90 `597–631ms → 512–537ms`），`longTaskTotalMs`中位数`430–451ms → 343–393ms`（`-12.9% ~ -21.9%`，长任务数`3 → 2`）。
  - `st+tools+baibaoku`：`dropdownOpenMs`中位数`314–374ms → 295–304ms`，`switchInteractiveMs`中位数`519–547ms → 480–519ms`（`-2.8% ~ -10.3%`，p90 `552–637ms → 483–536ms`），`longTaskTotalMs`中位数`402–428ms → 312–369ms`（`-13.0% ~ -25.2%`，长任务数`3 → 2`）。
- 大页`perPage=100`：
  - `st-only`：`switchInteractiveMs`中位数`905–1290ms → 701–1222ms`（`-4.2% ~ -22.5%`），`longTaskMaxMs`中位数`591–809ms → 419–757ms`（`-5.6% ~ -29.1%`）。
  - `st+tools`：`switchInteractiveMs`中位数`873–1218ms → 749–1178ms`（`-0.8% ~ -14.2%`），`longTaskTotalMs`中位数`693–924ms → 644–921ms`（`-0.3% ~ -7.1%`，长任务数`3 → 2`，单次`longTaskMaxMs`中位数`419–621ms → 465–753ms`，与`st-only`的`419–757ms`对齐），插入后收尾刷新已按`T1`让出一帧。
  - `st+tools+baibaoku`：`1000→50`与`50→300`的`switchInteractiveMs`中位数分别为`911→756ms`（`-17.0%`）与`999→1007ms`（`+0.8%`）；非默认`perPage=100`切入千条大书（`50→1000`、`300→1000`）相对旧三库组合中位数为`1022→1098ms`（`+7.4%`）与`1023→1188ms`（`+16.1%`），但同场景下仍快于或持平原生ST候选版（`1042ms` / `1222ms`），已降级为低优先级观察项（`P2-3`），按当时边界暂不新增分批机制（`early-bridge`观察器随后已于下方三链路收口中正式迁回ST Core）。

Real-Device Observation Items（实机验收阶段观察项，不阻断合入）：

- `P2-2`（含宏世界书预算预热边界）：正确性优先使预热在首条含宏条目处停止；实机接入OpenAI兼容渠道后，统计单次生成期间`/api/tokenizers/openai/count`的实际调用次数，若有明显耗时再单独经Capability Ownership Review评估由ST Owner侧收敛预算批量计数。
- `P2-3`（非默认`perPage=100`三库切入千条书观察项）：默认`perPage=25`已全面提速且`perPage=100`不慢于原生ST候选版；仅在实机体感明显时录制一次浏览器Performance trace定位根因。

Merged Milestone Status：三仓库代码修复、三轮审查收尾（`S1–S2`、`T1–T7`、`K1–K4`、`FX2-1–FX2-3`、`FX3-1–FX3-2`）、全套单测及隔离Chromium三库真实浏览器联跑验收（含`manifest.json → dist/index.js`及17个宿主模块HTTP 200零报错加载、Save Generate关闭核验、主题懒加载剥离+按需水合与世界书切换）均已完成，并按用户授权快进合入各自稳定分支（`SillyTavern:release`阶段Runtime `e92f8dc4dc2b6bed036567e9df6de3c376ffba6d`，`ST-BaiBai-Tools:personal/stable@3314098e1f009c253ed399b84b05876791472484` / Runtime `61180ebd1e7844b2c9a2e9962520608b3b3bf1b2`，`baibaoku:personal/stable@61aae5691cc3488310c3834c20699d910e5fc639` / Runtime `9d9854ca244d21c50231936ffbab9ab48a6fba2b`）。按阶段规划，未修改`personal-release.json`或`PRODUCTION_BASELINE.json`的`current_production`，未构建Docker镜像、未打Tag、未更新NAS，待全部后续链路收口后统一发版与部署。

## 2026-11-13 ~ 2026-11-14 — 柏宝箱 1.2.0（内置柏宝砚）+ 柏宝库 0.7.4 同步、三轮外审加固、合入前终论审查修复与三项 Pending Ownership 全量收口（Merged to `release` / `personal/stable`）

Scope & Mirror Fast-Forward：

- `SurgeXW0508/ST-BaiBai-Tools:main` 快进同步至 `baibai-git/ST-BaiBai-Tools@d828d6812994414cef24be9e5f995a264e9fe370`（`1.2.0`）；`SurgeXW0508/baibaoku:main` 快进同步至 `baibai-git/baibaoku@d915bc8f0036fb308f02b9a9e52ae880f05d4fe4`（`0.7.4`）。
- 在三库候选分支完成内置柏宝砚三轮外部复核边界修复 + 内部质量自审（`P-1`–`P-6`）+ 合入前终论审查根因闭环（`B1` + `S1`–`S11` + 三轮复核两项落盘正确性闭环及分支/检查点有界等锁收口），从宏观架构层面一次性收口全部三项代码层 `Pending Ownership Review`（运维侧 `Backrest` 演练移出 `pending`、启动日志 `listen` 告警按 LAN + Tailscale 自用归档结案），并按用户授权快进合入稳定主路（`SillyTavern:release` 阶段 Runtime `5c02da4f1bf865dce85558f14bcbd91f949f823a`、`ST-BaiBai-Tools:personal/stable@595854eeaf36fc05ecd380639d3013048693c768` / Runtime `1e8d5a818e19c7deafee42808aa39033c25170a1`、`baibaoku:personal/stable@2ba8864fa6b16cb425c05b6c66b4fefbfb5fd64c` / Runtime `e9d95265c77187446177e839a2b97975ebb2aa0d`），核验 `0 ahead` 后已删除全部已合入临时分支。

Decision & Capability Ownership Review：

1. **内置柏宝砚与原生聊天保存目标绑定（`WP-1`：三轮外部审查边界 + 内部质量自审 `P-1`–`P-6` + 终论审查 `S1`/`S4`/`S5`）**：
   - **主生命周期与装配边界**：Save Generate 继续完全剥离；移除「跟随主 API」（`generateRaw`），AI 标注改写仅走 ST 后端 `chat-completions` 显式副渠道，绝不污染全局 `max_tokens` 单例或将内置破限词发往 Google Vertex 生产账号；手动编辑、查找替换、楼层管理与截图零渠道可用。
   - **副渠道请求、凭据隔离与协议容错（`P-1`）**：采样参数白名单（`EXCLUDABLE_MODEL_PARAMS`）与固定路由/认证信封两阶段构造，配合 `new URL` 纯净 `http(s)://` 地址校验（剥离尾部 `/chat/completions` 或 `/models`，拒绝内嵌凭据/查询参数/片段），阻断串用酒馆主 `CUSTOM`/`OPENAI` Key；识别 ST 非流式 HTTP 200 `{ error }` 错误信封、SSE `TextDecoder` 尾行冲刷与非流式 JSON 回退；共享渠道遵循单调 `revision` 消费者建仓协议（空列表不写占位仓，兼容合并 `baibai_book` 与 `baibai_image`）。
   - **目标会话全链路绑定、`OVERWRITE`/分支保存共用锁、Fail-Closed 落盘核验与删除一致性（`P-2`–`P-4` + 二/三轮外审 + `S1`/`S4`/`S5`）**：ST Core 抽取统一互斥原语 `withChatSaveLock`（`while (isChatSaving)` 串行循环，按剩余预算收敛轮询间隔），`saveChat`/`saveGroupChat`/`saveGroupBookmarkChat`/`saveChatConditional` 返回 `Promise<boolean>` 落盘结果；在首次 `await` 前同步快照绑定目标角色/群组与完整序列化请求体 `initialBody`，使首次 POST 与完整性冲突确认 `OVERWRITE` 后的 `force: true` 重试共用同一已绑定目标与快照而不递归重读全局 `characters[this_chid]`、`selected_group` 或当前 `chat`（三轮外审 P1-1）；原生分支/检查点入口（`bookmarks.js` 的 `createBranch`/`branchChat`/`createNewBookmark`）同步捕获 `originContext` 与消息快照、以 `debounce_timeout.extended`（`5s`）有界超时接入 `withChatSaveLock`（自动保存 `saveChatConditional` 维持默认 `1s`，锁等待耗尽时显式 `toastr.warning` 告警且不破坏在途持锁态），检查点落盘成功且原会话仍活跃后才执行 `saveItemizedPrompts` 与父聊天落盘，并在全部异步恢复点复验 `originContext.isStillActive()` 以抑制中途切卡后对新会话的劫持，`saveGroupBookmarkChat` 仅在 `/api/chats/group/save` 落盘成功后再写入 `group.chats` 与 `editGroup`；`saveChatConditional` 在等待 `!isChatSaving` 锁前后锁定稳定身份（单聊 `targetAvatar + targetChatId`、群聊 `targetGroup`，移除会随角色列表增删重排波动的 `this_chid`），并在保存返回后二次复验目标身份才执行 `saveTokenCache()` / `saveItemizedPrompts()`（`S1`）；柏宝砚经 `fetchPipeline` 动态槽位按需挂载持久化观察器（空闲与 `stopPen()` 立即摘除，支持 `ArrayBuffer`/`Uint8Array`/`Blob`/`Request` 及 Gzip 请求体解压），对 `expectsHttpChatPersistence` 采取显式 fail-closed（`S4`），按完整 `BoundChatTarget` 匹配落盘请求并在全部异步恢复点后复验目标会话，失败原子回滚内存文本/swipe 并完整保留草稿；执行 `/hide`/`/del` 前拦截 `#curEditTextarea` 未保存修改，删除范围自动向前纳入成对 `tool_invocations` 载体系统层、固定传 `/del toolcalls=false <count>`，且在 `runWithObservedChatSave` 闭包内优先识别斜杠命令自身的 `result?.isError`（`S5`），自动丢弃命中已删楼层的后台改写任务。
   - **世界书干跑隔离与零残留/BFCache 安全（`P-5`–`P-6` + 二轮外审 P2-5b）**：前台生成流式期间（`isChatStreaming()`）跳过世界书扫描，干跑前零预修改 `extensionPrompts['2_floating_prompt']`；ST Core `world-info.js` 在 `isDryRun === true` 时抑制 `WORLDINFO_ENTRIES_LOADED`、`WORLDINFO_SCAN_DONE` 事件发射（同步影响 Prompt Manager 干跑预览中的只读监听器）与 `buffer.resetExternalEffects()`（保护并发外部强制激活态），并对未挂载作者注释面板环境守卫 `NOTE_MODULE_NAME?.value ?? ''`，收尾仅在非流式、同目标会话且未被并发外部改写时还原或 `delete` `2_floating_prompt`；启动初始化零写盘，`stopPen()` 引入 `startRunId` 异步竞态门控、卸下观察槽位、解绑设置 `watch`/共享监听/事件与 `#chat` 子节点观察器、重置 UI 状态并移除破坏 BFCache 恢复的 `pagehide` 卸载监听。
2. **三条代码层 Pending Ownership Review 宏观根因收口、三轮外审与合入前终论修复（`WP-2`–`WP-4` + `B1` + `S2`/`S6`–`S10`，现已清零全部 `Pending`）**：
   - **链路一（Character Cache + 二轮外审 P2-4）**：ST Core `src/endpoints/characters.js` 补 1 行 `DiskCache` 命中后回填 `memoryCache`（非 Android）；柏宝库 `/v1/characters/fast-all` 修复 POSIX/Linux 保存聊天仅更新 `chats/<charName>/` 子目录 `mtime` 导致 `chat_size`/`date_last_chat` 永不刷新的根因（逐角色 `stat` 子目录，目录删除自动清零），对存在 V2 `data` 但缺失 `data.name`/`data.tags` 的旧版角色卡沿用根层 `name`/`tags` 回退（严格对齐 ST `readFromV2` + `toShallow` 的 `data_size`、V2 `fav` 布尔优先级与 `date_added`，`FAST_CHARACTER_CACHE_SCHEMA = 3`），仅剔除损坏或真无名卡；柏宝箱物理删除死代码 `src/features/fastBootstrap.js`。
   - **链路二（Chat Search / Chat List + 终论审查 `S8`/`S9`）**：ST Core `src/endpoints/chats.js` 导出 `createChatFragmentMatcher`（`O(M)` 增量 `Set` 匹配，消除 `matchBuffer` 二次重扫）并在文件名已命中全部查询词时跳过逐行 JSON 正文解析；柏宝库 `fast-search`、`fast-recent` 与 `chat-backups/fast-list` 共享统一尾行解析（`FAST_SEARCH_CACHE_SCHEMA = 3`、`CHAT_BACKUP_CACHE_SCHEMA = 3`），对非群聊 `fast-search` 强校验 `avatar_url` 单段文件名与 `chats` 根目录包含边界（拒绝缺失/空串/`.`/`..`/路径逃逸并返回 HTTP 400，群聊 `chatId` 同步做包含校验，`S8`），严格对齐 ST 原生 `getChatInfo` 契约——0 字节或去除 `\r` 后尾部空行视为空聊天（`chat_items: 0, mes: '[The chat is empty]'`，不刷告警），非空截断尾行降级返回 `[The message is empty]` 与**数值** `stats.mtimeMs`，有效尾行原样保留数值/字符串 `send_date`（`S9`），垃圾回收已删群聊文件并删除 `410 Gone` 后的 335 行 `getFastChatGet` 死代码；柏宝箱物理删除 `chatList.js` 旧版 `/api/characters/chats` 二阶段 DOM 手术回退。
   - **链路三（Keyboard Focus Scan & Early Bridge / 闭包绑定 `fetchPipeline`，含二/三轮外审 + 终论审查 `B1`/`S2`/`S6`/`S7`/`S10`）**：将键盘焦点扫描优化原生固化至 ST Core `public/scripts/keyboard.js`（预拼合单次选择器、`WeakSet` 去重 `.scroll-reset-container` 的 `focusout` 监听、后台标签页 512 节点队列上限折叠、先执行 `contains()` 祖先去重再对 `> 40` 独立子树风暴求最近公共祖先 LCA 代替整页 `document.body` 全扫，并通过 `rebuildKeyboardSelectorIndex` + `hasRelevantKeyboardClassChanged` 自动索引全部选择器与祖先组合规则类名 token，覆盖 `.mes_buttons .mes_button`、`.extraMesButtons>div:not(.mes_button)` 及 `registerInteractableType` 动态注册，`S2`），随后从柏宝库彻底删除篡改全局 `window.MutationObserver` 的 `installKeyboardObserverCoalescing` 与客户端 32 位哈希 `settingsSaveCache` 跨次丢写；为柏宝库 `handleFastSettingsSave` 建立同步请求体解码快路径、发包前 FIFO 门控队列 `settingsSaveDispatchQueue`、客户端纪元请求头 `X-Baibaoku-Save-Seq` 与单调递增 `settingsSaveSeq`（重叠的 `CompressionStream('gzip')` 准备阶段严格按发起顺序移交 `rawFetch` 并在发出瞬间释放门控槽位，服务端 `saveSettingsWithCache` 按每用户有界纪元表拒绝乱序到达的旧序号覆盖新设置，解决三轮外审 P1-2「两次保存均 `200 OK` 但异步压缩使旧请求后发后写」竞态；同时对已发出的同体请求禁止跨异体插队合并，`fast-save` 发出后网络中断/超时或 `5xx`/`400` 等不确定状态只清空 `settingsGetCache`、绝不回退 `/api/settings/save`，发包前异常同步清空残留 `settingsSavePending`，`S10`），在 `window.__baibaokuEarlyBridge` 同步暴露 `initialFastConfig` 且在 `closeStEndpointCaches()` 清空进程级 Map；柏宝箱启动时同步水合桥接快照、剥离柏宝库归属键、锁定禁用退役开关 `chatKeyboardScanReductionEnabled`，收敛单一闭包绑定 `src/features/fetchPipeline.js` 调度器统一管理全部 11 处固定功能钩子、动态 `presetSaveToggle:*` 与柏宝砚 `chatSaveObserver`（与未打标第三方 `window.fetch` 外层包装安全共存零递归，`B1` + `S6`），在关闭主题懒加载或设置页加速时卸载 `themeCacheSync` 并清空 `baibaokuThemePageCache`（`S7`），并将 `gzipHook.js` 收紧为仅在压缩前异常或 HTTP `400`/`415` 时未压缩重试。

Verification & Measured Gate Evidence（合入稳定主路基线）：

- 单测、类型、Lint 与构建确定性：
  - `SillyTavern`（`release` 阶段 Runtime `5c02da4f`）：`npm run lint` 零错误/零警告，`npm --prefix tests run lint` 零错误；`test:unit` 21/21 套件（423 项）全部通过（含 `chat-info.test.js`、`pending-ownership-core.test.js` 的原生 `branchChat`/`createBranch`/`createNewBookmark`/`saveChat`/`saveGroupChat`/`saveGroupBookmarkChat` 中途切卡 + `OVERWRITE` 目标与快照绑定、`debounce_timeout.extended` 有界等锁与锁耗尽告警、检查点失败零孤儿 `saveItemizedPrompts`、祖先类名扫描、`#chat` 多子项风暴 LCA 有界扫描、后台 `> 512` 队列上限、`this_chid` 角色重排防误中止、跨角色同名 `main` 锁等待中止、旧 V2 卡根层名称回退与 `world-info` 干跑隔离单测）；`test:vertex` 40/40、`test:reliability` 17/17（Core 测试合计 480 项）、`release.node.mjs` 13/13、Python 治理单测 4/4 通过。
  - `baibaoku`（`personal/stable@2ba8864f` / Runtime `e9d95265`）：全部 5 套测试套件 66/66 通过（`test:perf-ownership` 14/14、`test:extension-manager` 22/22、`test:self-update` 7/7、`test:regex-bridge` 4/4、`test:save-generate` 19/19，含真实 `CompressionStream('gzip')` 下旧请求压缩更慢且两次响应均 `200 OK` 保序回归测试、多连接上传乱序服务端 `X-Baibaoku-Save-Seq` 拦截、`Save A` 写盘后断连不回退覆盖 `Save B`、发包前抛错清理 `settingsSavePending`、`fast-search` `avatar_url` 路径逃逸 HTTP 400 拦截、尾行空行/数值 `mtimeMs`/`SCHEMA = 3` 原生对齐与旧 V2 根层 `name`/`tags` 对齐单测）。
  - `ST-BaiBai-Tools`（`personal/stable@595854ee` / Runtime `1e8d5a81`）：`typecheck:pen` 零错误、`test:pen` 139/139（16 个测试文件，含跨角色同名 `main` 防串认、`expectsHttpChatPersistence` fail-closed、`/del` 命令错误不被锁超时遮蔽、空闲/停用槽位摘除、`storyContext` 流式跳过与并发保护单测）、`test:personal-stable` 17/17（含未打标外层第三方 `window.fetch` 包装下 `1 -> 0 -> 1` 零递归共存、同步异常转 rejected `Promise`、`themeCacheSync` 卸载清缓存、抗压缩混淆字符串字面量死代码剥离校验与异构目录构建一致性）、`test:generate-retry` 162/162、`test:preset-backup-retention` 22/22、`test:preset-search` 15/15；连续两次生产构建产物 SHA256 完全一致（`dist/index.js` = `6baecc06b1e9dbf2dcbb1593e991d684533f6600f4c056f04bda6d55c3aa779d`，`dist/index.css` = `91145ed0b143775ef0e352408afd372370cfa92a388397bb8607dc16a23eeef6`）。
- 三库隔离 Chromium 真实浏览器全链路 E2E（二轮外审 5 项专项复现 + 未打标外层 `window.fetch` 包装共存验证）全部零 `pageerror` 100% 通过：跨角色同名 `main` 锁释放窗口切会话不串认且不误写新角色聊天、`MESSAGE_EDITED` 异步窗口切会话不污染新聊天 DOM、`fast-save` 写盘后连接重置 `0` 次回退 `/api/settings/save` 且最新设置 `Save B` 完整保留、`#chat` 父容器动态获得 `.mes_buttons` 后子 `.mes_button` 按帧补齐 `tabindex="0"`、根层 `name` 旧 V2 角色卡在 `/v1/characters/fast-all` 与原生一致保留、外层未打标 `window.fetch` 包装存在时 `gzipHook` 开关切换与主题保存正常直通零递归、`WORLDINFO_FORCE_ACTIVATE` 在柏宝砚干跑期间完整保留（干跑期间 `WORLDINFO_ENTRIES_LOADED` / `WORLDINFO_SCAN_DONE` 触发数为 0），Save Generate 请求数为 0。
- Merged Milestone Status：三库候选分支均已按用户授权快进合入稳定主路（`SillyTavern:release` 阶段 Runtime `5c02da4f1bf865dce85558f14bcbd91f949f823a`、`ST-BaiBai-Tools:personal/stable@595854eeaf36fc05ecd380639d3013048693c768` / Runtime `1e8d5a818e19c7deafee42808aa39033c25170a1`、`baibaoku:personal/stable@2ba8864fa6b16cb425c05b6c66b4fefbfb5fd64c` / Runtime `e9d95265c77187446177e839a2b97975ebb2aa0d`）并在核验 `0 ahead` 后清理全部已合入临时分支；`personal-release.json`、`PRODUCTION_BASELINE.json` 的 `current_production`、GHCR 镜像与 NAS 保持未动，待用户明确授权后统一发布正式 GHCR 镜像并切换 NAS。

## 2026-11-14 — 用户授权的 Shalistera Core 性能二次吸收（Merged to `release`）

Trigger & User-Confirmed Boundaries：

- 在统一更新正式镜像前，对照 `Shalistera/SillyTavern:release@f67e000034a130dc25c7fb7571b5731f4c219f89`（共同基线 `06bde939`，31 个提交）逐项复盘尚未覆盖的性能点，并结合用户真实常态负载划定边界：
  1. **几千张角色卡囤卡 + 酒馆助手 `角色卡管理（路西法酱改版1002）` 脚本**：核实该脚本通过监听 `APP_READY`/`CHARACTER_EDITED`/`CHARACTER_DELETED`/`CHARACTER_PAGE_LOADED` 读取内存 `SillyTavern.getContext().characters` 与 `tags`/`tag_map`，将自定义管理页挂入独立 Vue + IndexedDB 虚拟分页网格，本身不替原生 `getCharacters()` 加速，但每次启动、导卡、改卡、切卡仍先触发 ST 原生 `getCharacters() -> printCharacters() -> filterByTagState()`（一次 `getCharacters()` 内连跑 20+ 次 `filterByTagState`），故闭合文件夹 `Set` 预索引直接命中几千张卡主路径。
  2. **千层长聊（~1,000 层）+ Vertex 思维链流式**：每个流式预览 tick 同时触发正文与思维链深度计算、Showdown HTML span 占位符还原及 DOM 写入，且每次发送触发世界书扫描与数百段纯文本宏求值、加载/追加消息触发 `applyCharacterTagsToMessageDivs`；用户明确确认**常态未开启流式淡入（`stream_fade_in: false`）**，且几乎不会触及 6.5 万楼极端历史。
  3. **显式排除边界（Non-Goals）**：省略 `stream-fadein.js` 的 `segmentTemplates` / `morphdom` 分段复用（`A4`）；明确拒绝跨请求 `MarkdownRenderCache` 与 `882b344f` 流式面板前缀缓存（代码块面板已由柏宝箱 `streamingRegexDefer` + 柏宝库 `regex-bridge` 推迟至终态单次渲染）；省略 `78a22e87` 跨十余后端自定义模型输入 UI（主用 Vertex + OpenAI 兼容副渠道已有原生自定义输入与柏系列共享渠道）；省略 `b35c996c` 的 `replaceArrayContents` 大数组分块插入及 `a659d219`/`f84b0a1f`/`c8147274`/`b0f25818`/`0ca7ceac`/`f9404623` 等微秒级细碎改动。

Capability Ownership Review & Triad Non-Overlap：

- **单一 Owner 与零跨库改动**：全部 8 个采用子项（`A1`–`A3`、`A5`、`B1`–`B3`、`C1`–`C2`）均属 ST Core 内部算法与局部生命周期优化，不新增任何跨请求持久化缓存、不改动请求协议或存储格式；`ST-BaiBai-Tools`（`personal/stable@595854ee`）与 `baibaoku`（`personal/stable@2ba8864f`）保持 **0 行改动**。
- **三库协同契约核验**：
  - 柏宝库全部 5 个宿主文件补丁锚点（`public/index.html`、`public/scripts/world-info.js`、`public/scripts/openai.js`、`public/scripts/extensions/regex/engine.js`、`public/scripts/power-user.js`）仅 `world-info.js` 涉及局部编辑且避开顶部 `getTokenCountAsync` 锚点，实测 5/5 补丁二次执行幂等、`unpatchWorldInfoJs`/`unpatchOpenAIJs` 还原后字节级 100% 一致。
  - `getMessageDepth(chat, messageId)` 与柏宝砚 `floorShot` 的 `depthZeroProxyId`（从聊天末尾倒找首个 `!is_system` 楼层传入 `messageFormatting`）语义严格等价。
  - `createStreamingContentUpdater` 通过实例闭包保存最近一次渲染状态（`lastElement`、`lastHtml`、`lastFade`），仅在目标节点仍 `isConnected` 且三者一致时跳过重复 DOM 写入，并在真实 DOM 写入（`innerHTML` 或 `applyStreamFadeIn`）成功返回后才更新闭包状态；写入抛错原样上抛、不吞异常、不污染状态，完整保留 `StreamingProcessor.previewFailed` 与柏宝箱 `streamingRegexDefer` 的终态保护边界。
  - `getStreamingRenderInterval` 仅在 `document.hidden === true` 时将中间流式预览 `Stopwatch` 间隔提升至 `max(baseInterval, 250ms)`（切回前台立即按 `baseInterval` 恢复，不节流 `STREAM_TOKEN_RECEIVED` 或错误/终态冲刷），负责「时间维度的当前生成楼层重排节流」，与柏宝箱 `longChatRender` 负责「空间维度的历史楼层 `content-visibility` 离屏跳过」正交互补。

Implementation（原候选分支 `stage/core-perf-intake`，基于 `release@31879033f5fd3afce5157f3e5ae9bae08f9c7880` 快进合入 `release`）：

1. `b1889cd09ea5198e0b7e118d4a588d62367114df` — `perf(streaming): compute message depth from suffix and skip unchanged DOM writes`（`A1 + A2`）：新增无状态后缀扫描 [`public/scripts/util/message-depth.js`](../../public/scripts/util/message-depth.js) 替代 `messageFormatting` 每帧整段 `chat.map().filter().findIndex()`；在 [`public/scripts/util/stream-fadein.js`](../../public/scripts/util/stream-fadein.js) 新增实例闭包保存最近一次渲染状态（`lastElement` / `lastHtml` / `lastFade`）的 `createStreamingContentUpdater()`，接入 `StreamingProcessor` 正文与 `ReasoningHandler` 思维链 DOM 更新（正文流式阶段跳过已挂载且未变思维链的重复 `innerHTML` 重写，`finish()` 以 `force=true` 强制收尾写入）。
2. `48f8337cc597d4d28e13a815245e92c65c6fdaba` — `perf(markdown): restore showdown hashed HTML spans in a single pass`（`A3`）：在 [`public/scripts/util/showdown-patch.js`](../../public/scripts/util/showdown-patch.js) 将 `unhashHTMLSpans` 改为单遍 `/¨C(\d+)C/g` 扫描，嵌套占位符按 `NESTED_SPAN_REPLACE_LIMIT = 10000` 与 `nestedIndex >= 0 && nestedIndex < spans.length` 显式守卫，消除多 HTML 标签流式消息的 $O(S \times L)$ 重复全串扫描并规避 `bebe62bd` 稀疏下标隐患。
3. `76e0358b835151a4a27c124683a78eb5075cd15c` — `perf(streaming): throttle intermediate preview renders while tab is hidden`（`A5`）：新增纯策略模块 [`public/scripts/util/streaming-render-policy.js`](../../public/scripts/util/streaming-render-policy.js)（`HIDDEN_STREAM_RENDER_INTERVAL_MS = 250`）并在 `StreamingProcessor.generate()` 每 tick 更新 `sw.interval`。
4. `dde58b7707deebb14bc28bf258b6c56d987bd6b4` — `perf(worldinfo): reuse per-scan buffer slices and case-folded haystacks`（`B1`）：新增 [`public/scripts/util/bounded-text-cache.js`](../../public/scripts/util/bounded-text-cache.js)（`BoundedTextCache`，基于 `Map` LRU 顺序维护，默认上限 `16` 项及 `2,097,152` 个 UTF-16 单元软预算，超大单条允许在淘空旧项后独占缓存以保证大扫描窗口相邻关键词仍可复用），作为 `WorldInfoBuffer` 实例的两个私有缓存（`#scanCache` 与 `#caseFoldCache`，均采用上述默认预算）：`get` 按 `depth:startDepth:flags:includeRecursion`（覆盖 6 个上下文字段掩码：`personaDescription`、`characterDescription`、`characterPersonality`、`characterDepthPrompt`、`scenario`、`creatorNotes`）复用组装文本，在异步扫描期间任一上下文字段变化或 `addRecurse`/`addInject`/`advanceScan`/`resetExternalEffects` 时统一清空两处缓存，`matchKeys` 复用同一 haystack 的 `toLowerCase()` 结果，随单次 `checkWorldInfo()` 结束自动 GC。
5. `fd77e6e6d28c59fb29d065db7d967fc64d43e76f` — `perf(macros): skip unused macro parsing on plain-text inputs`（`B2 + B3`）：在 [`public/scripts/macros.js`](../../public/scripts/macros.js) 的旧版 `evaluateMacros` 中前置保留 `chat_metadata.chat_id_hash` 初始化、`charPrompt` 读取与 `MacrosParser` 自定义环境函数填充副作用，随后对既不含 `{{` 也不含 `<` 的非空字符串直接返回；在 [`public/scripts/macros/engine/MacroEngine.js`](../../public/scripts/macros/engine/MacroEngine.js) 的新版 `MacroEngine.evaluate` 中于 `#runPreProcessors` 之后检查 `!preProcessed.includes('{{')`，跳过 `MacroParser.parseDocument` 与 `MacroCstWalker.evaluateDocument` 并照常执行 `#runPostProcessors`（完整保留 `\{\{` 转义还原与后置钩子）。
6. `28797486d97375ddefa49f978390c88f1eb083fd` — `perf(tags): pre-index closed folders and filter message divs by Set`（`C1 + C2`）：在 [`public/scripts/filters.js`](../../public/scripts/filters.js) 为 `FilterHelper` 新增只读 `getTagKey(entity)` 访问器；在 [`public/scripts/tags.js`](../../public/scripts/tags.js) 新增 `createClosedFolderFilter(entities, selectedTagIds)` 预建未选中闭合文件夹 `Set` 与空集短路，并将 `applyCharacterTagsToMessageDivs` 改为 `Set<string>` + `$('#chat').children('.mes').filter(...)` 单次子元素过滤（同时修复上游 `mesIds: 0` 被 `!mesIds` 误判全量刷新的边界）。

Verification & Measured Timing Evidence：

- **Lint、单测、三库契约与全量受影响 Playwright E2E**：
  - `SillyTavern`：根目录 `npm run lint` 0 错误 / 0 警告，`tests` `npm run lint` 0 错误；`tests` `npm run test:unit` **24/24 套件（437 项）**全绿（新增 `core-perf-streaming.test.js`、`showdown-patch.test.js`、`bounded-text-cache.test.js`）；`npm run test:vertex` **40/40**、`npm run test:reliability` **17/17**、`release.node.mjs` **13/13**、Python 治理单测 **4/4** 全绿。
  - 受影响 Playwright 浏览器 E2E **19 个套件（577 passed, 13 skipped, 0 failed）**全绿：新增 `CorePerfStreaming.e2e.js`（2/2）、`CorePerfScanMacros.e2e.js`（2/2）、`CorePerfTags.e2e.js`（2/2），以及既有 `CoreStreaming.e2e.js`（12/12）、`MessageFormatter.e2e.js`（15/15）、`MacrosParser.e2e.js`（2/2）、`ReasoningLifecycle.e2e.js`（1/1）、`ReasoningHiddenBlocks.e2e.js`（14/14）、`MacroEnvBuilder.e2e.js`（19/19）、`MacroRegistry.e2e.js`（32/32）、`MacroSlashCommands.e2e.js`（12/12）、`MacroStoryString.e2e.js`（1/1）、`MacroLexer.e2e.js` + `MacroParser.e2e.js`（112 passed, 13 skipped）、`MacroEngine.e2e.js`（328/328）、`WorldInfoEditorSwitch.e2e.js`（1/1）、`WorldInfoRenameChatLore.e2e.js`（1/1）、`WorldInfoRenamePersonaLore.e2e.js`（1/1）、`VertexNative.e2e.js`（21/21）。
  - 伴随仓库回归与三库隔离 Chromium 联跑：`baibaoku` 5 套单测 **66/66** 全绿 + 5/5 宿主桥接幂等与字节级还原通过；`ST-BaiBai-Tools` `typecheck:pen` 0 错误 + 全部 5 套单测 **355/355** 全绿；隔离三库联跑（ST 候选 + 柏宝箱 `personal/stable@595854ee` + 柏宝库 `personal/stable@2ba8864f`）实测 `pageerror = 0`、`http500s = 0`、Save Generate 请求数 `= 0`，柏宝砚 `floorShot` `depthZeroProxyId` 深度 0 渲染对齐、`streamingRegexDefer` 流式跳过 + 正常/错误中断补渲 + `previewFailed=true` 终态保护、Vertex 思维链转正文阶段 `.mes_reasoning` **0 次冗余 DOM 重写**、后台隐藏标签页 `< 250ms` 节流与切回前台立即恢复、Stop 取消终态、千层 `longChatRender`（996 层 `content-visibility` 隔离 + 末尾楼层不隔离）与 `C2` 楼层角色标签写入全部通过。
- **隔离环境修改前后实测耗时对比（预热后 15 轮中位数，仅作同机算法对照证据，不冒充 NAS 实机验收）**：
  - **A1 流式楼层深度计算**（1,000 层聊天 × 400 次流式调用，Node 基准）：`11.624ms → 0.015ms`（**-99.9%**，约 775×）。
  - **A2 流式无变更 DOM 短路**（Vertex 思维链完成后正文流式阶段，Chromium 实测）：`.mes_reasoning` 冗余 DOM 重写次数由每帧重写降至 **`0` 次**。
  - **A3 Showdown HTML Span 还原**（350 个行内 HTML 标签消息 × 20 次流式 `makeHtml` 完整渲染，Node 基准）：`276.703ms → 163.345ms`（**-41.0%**）。
  - **B1 世界书单轮扫描缓冲复用**（50 层历史 + 300 条大小写不敏感条目 × 3 关键词，Node 基准）：`11.785ms → 7.496ms`（**-36.4%**）。
  - **B2 旧版 `evaluateMacros` 纯文本快路径**（300 段纯文本设定/历史块，Chromium 实测）：`6.3ms → 0.1ms`（**-98.4%**，63×）。
  - **B3 新版 `MacroEngine.evaluate` 纯文本快路径**（300 段纯文本设定/历史块，Chromium 实测）：`41.6ms → 0.7ms`（**-98.3%**，59.4×）。
  - **C1 闭合文件夹 `Set` 预索引**（3,000 张角色卡 × 20 个闭合文件夹，Node 基准）：单次 `0.926ms → 0.176ms`（**-81.0%**，5.3×；按单次 `getCharacters()` 触发 ~25 次过滤折算约 `23.2ms → 4.4ms`）。
  - **C2 千层聊天角色标签 DOM 查询**（1,000 层 `#chat > .mes` 目标过滤，Chromium 实测）：`47.7ms → 0.3ms`（**-99.4%**，159×）。
- **Merged Milestone Status**：上述代码与修正后的文档已按用户授权快进合入 `SillyTavern:release`（阶段 Runtime `28797486d97375ddefa49f978390c88f1eb083fd`）并在核验 `0 ahead` 后清理临时分支 `stage/core-perf-intake`；`personal-release.json`、`PRODUCTION_BASELINE.json` 的 `current_production`、GHCR 镜像与 NAS 生产环境均保持未动。

### 2026-11-14 Vertex `gemini-4-carbon` / `gemini-4-hydrogen` 接入与参数忽略策略对齐（候选分支 `stage/vertex-gemini4-models`）

Capability Ownership Review & Boundary Verification：

- **单一 Owner 边界**：Vertex 原生协议、型号能力校验与前端下拉选项归属 ST Core 唯一拥有；柏宝箱（`ST-BaiBai-Tools`）与柏宝库（`baibaoku`）源码对 `model_vertexai_select`、`vertexai_*` 与 Gemini 4 零耦合，维持 **0 改动**；AI Studio（MakerSuite）链路的 `chat-completions.js` / `prompt-converters.js` 上游正则保持不动；前端 `openai.js` 因 `VERTEXAI` 不在 `reasoningEffortSources` 内（原生将 `'max'` 直传后端）维持 **0 改动**，完全避开柏宝库 `openai.js` 补丁区域。
- **架构收敛（冻结型号能力表替代散落 `if (argon)`）**：在 [`src/endpoints/backends/vertex-protocol.js`](../../src/endpoints/backends/vertex-protocol.js) 以单一冻结能力表 `GEMINI4_TEXT_PROFILES` + `gemini4TextProfile(model)` 收口全部 Gemini 4 文本型号规则（排除 `-image` 图像变体；未登记的 `gemini-4-*` 文本型号回退至最保守的 `CONSERVATIVE_GEMINI4_PROFILE`，不放行未知能力）：
  - **家族共性**（`argon` / `carbon` / `hydrogen` 及未知文本变体一致）：接入 `isNoSamplingModel` 与 `rejectsPrefillModel`、仅允许 `global`/`us`/`eu` 区域、默认 `v1beta1` `continuation_token` 自动续传（`autoContinue`）、`min → LOW`、拒绝 `thinkingBudget` 与 `request_images`。
  - **型号差异**（仅在表内声明）：`flex`（`hydrogen: true`，`argon`/`carbon`/保守回退为 `false`）；`v1SegmentCap`（`hydrogen` 流式/非流式均为 `65,536`，其余流式 `65,536` / 非流式 `32,768`）；`maxThinkingLevel`（`hydrogen` 为 `'XHIGH'`，其余为 `'HIGH'`，允许档位由该字段直接推导）。
- **参数忽略 vs 显式报错体验对齐（含 `4A` 有意行为变更）**：
  - 针对前端共享预设每次请求必带的 `frequency_penalty`、`presence_penalty` 以及官方未承诺支持的 `seed >= 0`，将 Gemini 4 文本家族（含既有 `gemini-4-argon`）统一从 `400` 硬报错改为**后端自动剥离并按固定顺序写入 `ignoredParameters`（`temperature, top_p, top_k, frequency_penalty, presence_penalty, seed`）**，在 `#vertexai_runtime` 状态栏显式提示 `模型忽略：…`，消除跨预设切换时无谓打断生成/Swipe/Regenerate 的摩擦。
  - 凡静默处理会改变语义、计费或数据边界的冲突（`n > 1`、`logprobs`/`logit_bias`、非法区域、`4A`/`4C` 选 `Flex`、`v1` 超单段上限、非 `Continue` 助手预填、`request_images`、`thinkingBudget`）继续维持 `VERTEX_CONFIG` `400` 显式报错。
- **面板选项与文案**（[`public/index.html`](../../public/index.html)）：在 `#model_vertexai_select` 的 `Gemini 4` 分组按新型号优先顺序提供 `gemini-4-hydrogen`、`gemini-4-carbon`、`gemini-4-argon`（默认型号不变），并将四处写死 `Argon` 的提示更新为准确的 Gemini 4 家族说明。

Candidate Implementation & Verification（`stage/vertex-gemini4-models`，基于 `release@8781e17923ef399682c5af89a39174417fbf6e4c`）：

- Runtime & 单测提交：`dd3d522b73848dad7cba64625750c68b2ceb17d5` — `feat(vertex): add Gemini 4 Carbon/Hydrogen via per-model capability profiles`。
- 全套验证结果：根目录 `npm run lint` 与 `tests` `npm run lint` 0 错误；`tests` `npm run test:unit` **24/24 套件（437 项）**全绿；`npm run test:vertex` **41/41**（含 `4A`/`4C`/`4H`/未知 `gemini-4-foo` 保守回退/`gemini-4-xxx-image` 排除/DOM 选项顺序表驱动单测）、`npm run test:reliability` **17/17**、`release.node.mjs` **13/13**、`test_stack.py` **4/4** 全绿；Playwright `VertexNative.e2e.js` + `ReasoningLifecycle.e2e.js` **22/22** 全绿；隔离三库 Chromium 联跑实测 `gemini-4-hydrogen`（`Maximum → XHIGH`、`Flex` 放行）与 `gemini-4-carbon`（`Maximum → HIGH`）真实前端发包与状态栏 `模型忽略` 提示符合预期，且 `pageerror = 0`、`http500s = 0`、Save Generate 请求数 `= 0`。
- **Candidate Status**：当前提交位于候选分支 `stage/vertex-gemini4-models`；`release` 分支、`personal-release.json`、`PRODUCTION_BASELINE.json` 的 `current_production`、GHCR 镜像与 NAS 生产环境均保持未动，待用户审阅授权后再快进合入 `release`。
