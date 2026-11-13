# Personal Fork 维护与能力归属

Canonical compatibility document。当前正式制品为[v1.19.0-personal.1](https://github.com/SurgeXW0508/SillyTavern/releases/tag/v1.19.0-personal.1)；生产事实与待补项见[PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json)。涉及ST、Personal Fork、柏宝箱、柏宝库、Shalistera引入的任务，开始前必须阅读本文件，完成Capability Ownership Review；其他任务书或未来插件Fork只引用本文件，不复制冲突矩阵。

## 接手入口与当前生产状态

先读[Production Baseline](PRODUCTION_BASELINE.json)确认实际部署，再对照本文Owner规则，最后按[Release Operations](PERSONAL_RELEASE_OPERATIONS.md)执行对应更新；正式镜像的实际验收范围见[Release Closeout](RELEASE_CLOSEOUT.md)。无需从历史聊天恢复当前版本。

2026-11-12用户提供的NAS结果：`v1.19.0-personal.1`正式GHCR Digest仍在使用；容器`sillytavern`状态为`running`、RestartCount为0。Compose由飞牛 OS 管理，项目`sillytavern`，工作目录`/vol3/1000/SillyTavern`，配置文件`/vol3/1000/SillyTavern/docker-compose.yml`。NAS Tools仍为`personal/stable@2f6a9c54`、origin为个人Fork、tracking为`origin/personal/stable`、工作区clean。NAS BaiBaoKu 已于2026-11-12完成Git跟踪关系整理：当前分支`personal/stable`，跟踪`origin/personal/stable`，origin为个人Fork，upstream为原作者，工作区clean；NAS当前Git HEAD `4814830f`，Runtime基线仍为`b211a4e9`/0.7.3，另有`backup/pre-personal-stable-20261112`备份分支。后续Runbook文档提交使远端stable继续前进；更新前应fetch并按文档差异判断，不要将文档HEAD误认为Runtime变化。完整SHA、Digest和挂载路径以Production Baseline与Release Operations为准。

正式镜像仅确认启动、Health、Vertex普通RP正文生成、刷新后聊天记录保留。Candidate的多轮、Stop、Regenerate等历史结果单独保留，不自动算作正式镜像已验证。清理、备份恢复、飞牛GUI方案和既有安全警告的后续责任见Operations待办；本轮不处理这些事项。

2026-11-12阶段性仓库状态：Vertex协议契约、封闭枚举诊断、多媒体共享凭据域名守卫与流式/重放收尾已合入个人`release`分支（阶段Runtime基线`e49a694083cc46dbf883f13eab664076c139011f`），暂未修改`personal-release.json`、暂未构建新GHCR镜像或部署NAS；线上生产仍为`v1.19.0-personal.1`（Runtime `090cbba6d40e5d117ab41a9e6deb20b40e2dc336`），待后续性能优化与修复阶段完成后统一发版与实机验证。

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
| Vertex请求协议、认证、传输 | ST | Shalistera仅来源参考 | ST only；不整体合并参考分支；聊天与多媒体共用官方Google域名白名单；封闭枚举RPC诊断与等待/缓存状态栏 |
| Thinking / Reasoning / Thought Signature | ST | 旧插件适配已撤回 | 按原始Part保存；编辑使对应正文重放失效；保留角色名前缀为独立无签名Part |
| Tool Calling原生语义与历史 | ST | 柏宝后台执行不采用 | ST调用工具；保留id/name/参数/顺序/有效调用签名；functionCall仅经成对tool_invocations载体消息重放 |
| Generate、Continue、Swipe、Regenerate | ST | Save Generate关闭 | 同一原生请求链 |
| Partial / Failed / Canceled | ST | — | partial保留可用内容和终态；流式零内容错误抛错不落空消息；异常终态不自动执行工具、不重放未执行functionCall、不续发 |
| 历史Prompt语义 | ST | — | 当前消息为语义来源，不能因旧response ID恢复已编辑/删除正文 |
| 基础聊天保存 | ST | 柏宝恢复不采用 | 保持上游公共saveChat契约；不得删除已有数据 |
| Save Generate / 后台任务 / 消息恢复 | 柏宝，但本组合不启用 | ST正常生成 | 整个Save Generate关闭；不保留Vertex内部调用契约 |
| 世界书编辑器渲染、切换与清理 | ST | 柏宝箱仅保留UI增强 | Core负责单次容器级清理、按需增量关键词缓存、`originalData`按`uid`索引、前端克隆对齐及`/api/worldinfo/get`异步读取；柏宝箱移除空Vue根挂载与逐条强制回流补高循环 |
| 世界书 / 人设搜索 | ST | 柏宝箱搜索替换独立保留 | Core采用Shalistera `234cb02d` `Set`查找；柏宝箱编辑器搜索替换为独立UI能力 |
| 世界书下拉分组/主题与全局选择器显示 | 柏宝箱 | — | 同次打开分组去重并复用未变书单；主题单次读取批量写入；全局选择器监听不响应`#world_editor_select` |
| 自动重试/黑名单重试（Generate Retry） | 柏宝箱（可选，默认关闭） | — | 两个开关默认关闭且关闭时零解析直通；`chat_completion_source === 'vertexai'`一律直通，绝不接管Vertex生成生命周期 |
| Tokenizer批量计数 | 柏宝箱计数 + 柏宝库桥接（ST拥有语义） | 持久化Token缓存不采用 | 面向OpenAI兼容渠道保留；桥接层不提前执行`substituteParams`，含宏条目回退ST原生计数；多模态数组/`tool_calls`对齐ST原生tiktoken语义 |
| 扩展安装/更新线路 | 柏宝库（可选接管） | 关闭接管时走ST原生管理器 | 默认仅直连/代理权威来源可决定目标SHA（`allowUnverifiedMirrorDecision: false`），镜像仅作已知权威SHA下载通道；云端镜像兜底默认关闭（`cloudMirrorsEnabled: false`）；保留mihomo等代理自动探测；严禁自动切离`personal/*`或无上游跟踪分支；柏宝箱前端路由改写跟随后端接管开关 |
| Fast Chat渐进加载 | ST原生 | 柏宝已移除/410 | 柏宝库后端返回`410 Gone`，柏宝箱删除残留前端fetch/trigger死代码与捕获监听 |
| 主题懒加载 | 柏宝库剥离 + 柏宝箱水合 | — | 显式跨组件耦合；柏宝库检测不到已启用的柏宝箱或`power-user.js`主题桥时自动回退下发完整主题 |
| 流式预览失败停止边界（`previewFailed`） | ST导出标志 + 柏宝箱尊重终态 | — | `StreamingProcessor`暴露`this.previewFailed`；柏宝箱`streamingRegexDefer`在`previewFailed`时不覆盖为全量重绘 |
| 独立体验UI / 独立数据库服务 | 柏宝箱 / 柏宝库 | — | 不得获得Vertex生成生命周期所有权；备份列表fetch钩子按开关装配，重复`scrollTop`拦截合并为单一Owner |
| Character Cache / Chat Search / Early Bridge合并层 | Pending Ownership Review | 多方 | 保持Pending另立议题；`fa16e070`持久化Chat token缓存与Markdown缓存明确Reject |
| Token Count失败结算 / Tokenizer资源初始化 | ST | — | Core生命周期single-flight与失败结算由ST独立保证 |
| Reasoning初始化 / 编辑与基础Chat导入 | ST | — | Handler单次装配；导入只创建新文件 |

## Disabled Features

**当前个人稳定组合通过不装配关闭所有Provider的Save Generate。** 这是当前维护策略，不是Vertex API能力限制。用户接受失去关闭页面后继续生成及恢复的体验。

当前维护模型已经由Phase C-B转为正式Fork分支，不再在部署时应用外部patch。

| Component | Source / branch | 精确验证基线 |
| --- | --- | --- |
| Personal ST运行代码 | `SurgeXW0508/SillyTavern:release` | NAS正式生产仍为`090cbba6d40e5d117ab41a9e6deb20b40e2dc336`（`v1.19.0-personal.1`）；仓库`release`已阶段性合入Vertex收尾Runtime `e49a694083cc46dbf883f13eab664076c139011f`（暂未构建新GHCR镜像） |
| 柏宝箱上游同步基线 | `baibai-git/ST-BaiBai-Tools:main` → `SurgeXW0508/ST-BaiBai-Tools:main` | `1e87dfaad87819a90d8032530a62a2ed29f97aea`，实际package/manifest版本1.1.5 |
| 柏宝箱唯一个人部署分支 | `SurgeXW0508/ST-BaiBai-Tools:personal/stable` | `2f6a9c54d2c906b4a0e44d20c12d0712552e393d`为NAS验证Runtime；当前远端维护HEAD `2816699503d8bbab1e601f955ecefe30d8b2e57d`仅文档变更，源码/dist相同；NAS仍跟踪`origin/personal/stable` |
| 柏宝库唯一个人部署分支 | `SurgeXW0508/baibaoku:personal/stable` | NAS Git HEAD `4814830f2d161dfff89e75370effa31d669586d9`；Runtime仍为`b211a4e97fdaec24dc8b90c85ddc198fac9ac200`（0.7.3），本次仅文档变更；跟踪`origin/personal/stable`，原作者为`upstream` |

上述包含冻结验证基线与仓库维护HEAD；当前NAS实际组合已在Production Baseline登记，Tools实际仍为`2f6a9c54`，不能用维护HEAD `ac1279a7`替代。柏宝箱个人差异只有Save Generate生命周期关闭策略、对应构建/测试和简短维护入口；没有Vertex Adapter，也没有其他柏宝优化修改。

此前审查的上游1.1.5仍无条件装配Save Generate、默认开启并存在false→true旧迁移。Personal Stable在装配入口移除导入/安装及面板通知，设置归一false、移除强制开启迁移、UI固定禁用；不物理删除上游模块，也不需要手工删源码或额外Patch。Generate Retry是另一功能，本策略没有修改其实现。生产dist从锁定依赖的源码构建，连续两次构建哈希一致。

Phase C基于1.1.2的外部策略patch，以及更早的两个Vertex兼容patch，只作为历史过程证据。它们不再是正式安装、更新或回滚步骤；不要叠加到personal/stable上。柏宝库个人Fork当前只用于维护分支隔离，Runtime基线仍与上游`b211a4e9`等价，没有额外个人Runtime patch。

安装或更新Personal Stable后必须全页重新加载；不承诺已经运行的旧JS页面热卸载。旧后台任务、数据库记录和聊天数据不被删除或自动恢复；切换前必须在原环境检查并结算/导出需要保留的任务。未来升级后的进程启动/全页重载需要在对应任务中验证；本轮只登记文档，不操作正式环境。

重新启用前必须重新进行Owner Review，证明功能不可替代、禁用/销毁闭合、持久化确认和回滚可靠；优先采用能够真正关闭并独立运行的上游实现。不要重新添加Vertex Save Generate Contract来恢复此功能。

独立已知问题：柏宝旧恢复逻辑可能把未确认写入聊天的任务标为已处理，ST公共saveChat会内部处理保存错误。此问题不再是Vertex兼容TODO，不在本轮修改公共保存契约；任何未来重启用Save Generate的任务必须独立验证持久化确认。

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
| Indexed span semantics | Already Covered | ST | 官方基线仍按下标访问；未采用引入iterator差异的SH span优化 |
| Chat search isolation / chat & character caches / long-chat optimizations | Pending Ownership Review | TBD | 与柏宝搜索/缓存/长聊天有交叉，不能建立双实现 |
| 其他render/cache/scan/UI/build性能、诊断和benchmark | Intentional Omission或下表Pending | — / TBD | 当前不以性能换长期diff，不把合成benchmark当实机收益 |

31提交完整索引（短SHA链接到精确来源）：

| SH commit | 主要范围 | Status | 取舍 / Owner |
| --- | --- | --- | --- |
| [510fbb54](https://github.com/Shalistera/SillyTavern/commit/510fbb545f3c713c869e86fff106b3d1a830ce63) | Vertex与诊断 | Adopted | Vertex由ST适配保留；诊断不引入 |
| [01b87c88](https://github.com/Shalistera/SillyTavern/commit/01b87c88d08206ea056e622e955642c159f72f4c) | 消息/Reasoning深度与fade | Intentional Omission | 性能和渲染diff；不采用 |
| [b34249a6](https://github.com/Shalistera/SillyTavern/commit/b34249a6c81e4cbffbb8cff6f45f32243c2ad2a1) | Markdown / WI / Chat Search | Pending Ownership Review（Chat Search）/ Reject（Markdown缓存） | Chat搜索Owner维持Pending；Markdown缓存明确Reject |
| [b1ae6199](https://github.com/Shalistera/SillyTavern/commit/b1ae6199d44b9c0626552a7e00ac4d99ef618eea) | Chat summaries与Import | Adopt Now | 仅CAI转换和导入防覆盖；缓存/搜索待Owner |
| [6360ee2c](https://github.com/Shalistera/SillyTavern/commit/6360ee2ce883411eb5bbe94a3be3c962ee846329) | stale search / Markdown / template | Pending Ownership Review（Search）/ Reject（Markdown缓存） | Chat搜索维持Pending；Markdown缓存明确Reject |
| [097be538](https://github.com/Shalistera/SillyTavern/commit/097be5384c3a947b0d809b9d06845ff10a88578a) | Reasoning编辑/初始化 | Adopt Now | ST；不增加第二套Reasoning状态 |
| [3ef63e86](https://github.com/Shalistera/SillyTavern/commit/3ef63e86c43a3c2637ec70fb972e09c0d93293c9) | 模型/性能文档与测试 | Intentional Omission | 非运行时依赖；使用个人验证文档 |
| [78a22e87](https://github.com/Shalistera/SillyTavern/commit/78a22e873a0ebc81db9df68c33855e040f1bb559) | 跨API自定义模型ID | Intentional Omission | 可选功能；当前目标ID链路已有 |
| [69c6f626](https://github.com/Shalistera/SillyTavern/commit/69c6f6261b82429411ecfea7550bd5e949f7eb50) | Chat byte scan / Search summaries | Pending Ownership Review | 文件/搜索缓存Owner未定 |
| [195035e5](https://github.com/Shalistera/SillyTavern/commit/195035e5757f9dc7e7309e2739675ed7bd3bb5b4) | 角色元数据缓存 | Pending Ownership Review | R3与柏宝角色缓存后置 |
| [f5d33ce1](https://github.com/Shalistera/SillyTavern/commit/f5d33ce1d683c9cce1f4594c35fa45878f98c63b) | Tag / Keyboard初始化性能 | Intentional Omission | 未确认当前数据正确性阻断 |
| [0ca7ceac](https://github.com/Shalistera/SillyTavern/commit/0ca7ceacdde9629e588c2ce9e062744c10d6ff60) | Avatar fallback listener | Intentional Omission | 局部DOM优化；不扩展本轮事件范围 |
| [80898271](https://github.com/Shalistera/SillyTavern/commit/80898271ecbd20d1e2e1a2c688933c85009c747f) | Span / Fade性能 | Intentional Omission | 不引入渲染实现与其依赖 |
| [882b344f](https://github.com/Shalistera/SillyTavern/commit/882b344f4da67ab5f51b625c4021fa1e02e51d1e) | Streaming panel Markdown复用 | Intentional Omission | 显示缓存收益不抵长期diff |
| [f9404623](https://github.com/Shalistera/SillyTavern/commit/f940462387b9aafeb95d16ac2f1c3a3751f995de) | Media load listener清理 | Intentional Omission | 未发现当前数据损坏；媒体滚动生命周期优化暂不引入 |
| [93eb4a29](https://github.com/Shalistera/SillyTavern/commit/93eb4a29889bec8bcf6823654bf01833c3ac98b8) | 性能与cache-miss基准 | Intentional Omission | 文档/benchmark，不是Core运行依赖 |
| [bebe62bd](https://github.com/Shalistera/SillyTavern/commit/bebe62bdad8362f4b1c85e7c065ba48b58b3d2cc) | Span indexed语义 | Already Covered | 官方下标语义仍在；无需带入优化后修复 |
| [234cb02d](https://github.com/Shalistera/SillyTavern/commit/234cb02d2538728fc96c0d64bbbfed2c50619c64) | WI / Persona search | Adopt | ST；2026-11-13性能阶段采用`Set`查找（4行），与柏宝箱搜索替换独立不冲突 |
| [cfc09c41](https://github.com/Shalistera/SillyTavern/commit/cfc09c41ba55a56e54e0888506313c715b848afc) | Folder索引 | Intentional Omission | 列表性能，无当前必要性 |
| [a659d219](https://github.com/Shalistera/SillyTavern/commit/a659d219d81cc5084aa0d6d8c1e8d37c1b76cb49) | Group引用索引 / stat复用 | Intentional Omission | 列表性能，不引入索引状态 |
| [c8147274](https://github.com/Shalistera/SillyTavern/commit/c8147274b34b281d204fa9887d9048b0431abfa6) | Webpack build cache | Intentional Omission | 构建优化非运行必要依赖 |
| [a3bb450d](https://github.com/Shalistera/SillyTavern/commit/a3bb450d400b20280566de938ba0f451cabb7dc1) | Macro fast path | Intentional Omission | Prompt宏语义保持上游实现 |
| [46c47c5b](https://github.com/Shalistera/SillyTavern/commit/46c47c5b015bfe90ec582d2a2597b97257ff979b) | Token Count failure | Adopt Now | ST；已有fallback必须结算 |
| [f84b0a1f](https://github.com/Shalistera/SillyTavern/commit/f84b0a1ffbc986b8e04f71d813a6c6fa835a1a0e) | Thumbnail header读取 | Intentional Omission | IO优化，不改图片路径 |
| [b35c996c](https://github.com/Shalistera/SillyTavern/commit/b35c996c81cd878e277944bc10f1c367ee129083) | Hidden preview / 大数组替换 | Pending Ownership Review | 长聊天Owner后置；不引入throttle；极大历史参数上限未在当前环境复现/验收 |
| [b0f25818](https://github.com/Shalistera/SillyTavern/commit/b0f25818429becd3518b943fd7d5399d3d452f63) | 并行Template初始化 | Intentional Omission | 启动性能，不改顺序 |
| [fa16e070](https://github.com/Shalistera/SillyTavern/commit/fa16e070a67a57fc4e5be1cc8c5c0f374f3cedfa) | 持久化Chat token cache | Reject | 明确拒绝持久化Chat token缓存；OpenAI兼容批量计数由柏宝箱+柏宝库桥接承担 |
| [b82c3547](https://github.com/Shalistera/SillyTavern/commit/b82c35477a9f2dbf9dcf07e46f88efae4accf045) | Tokenizer init生命周期 | Adopt Now | ST；single-flight、ready发布、失败可重试 |
| [897eb6cb](https://github.com/Shalistera/SillyTavern/commit/897eb6cb4dd985feed8bb1b26534ba4530c9585d) | 浏览器/服务端性能文档 | Intentional Omission | 不引入性能benchmark体系 |
| [63822f73](https://github.com/Shalistera/SillyTavern/commit/63822f73639d2945b0d1720df66effefb25282b0) | Streaming工具/失败/停止 | Adopt Now | 公共生命周期适配；已有Vertex收尾不再建立副本 |
| [f67e0000](https://github.com/Shalistera/SillyTavern/commit/f67e000034a130dc25c7fb7571b5731f4c219f89) | CPU与调度争用测量 | Intentional Omission | benchmark准确性改进，无运行依赖 |

本轮五项修复的实现/测试可以独立于未采用的性能提交存在。`bebe62bd`仅是未采用span优化后的修正，不构成必须追加前序优化的理由。`b35c996c`的大数组替换另有极大历史输入的可用性价值，但本轮未确认当前真实数据触及参数数量上限；不把它与pending-content修复捆绑。出现实机数据正确性问题时按下述重新开发门槛处理。

## Phase C Code Freeze

**当前状态：Phase C Code Freeze，2026-11-09正式登记。** 当前发布入口见[Personal Release Operations](PERSONAL_RELEASE_OPERATIONS.md)，差异结论见[Final Delta Audit](FINAL_DELTA_AUDIT.md)。 根据用户在Phase C-E0任务中确认，Phase C-D已经通过独立审查；本次登记不是Work自审替代独立审查。Candidate阶段曾报告多轮、刷新后继续、Stop、Regenerate等通过。当前正式GHCR镜像已完成NAS切换及基本验收，Image ID、healthy/RestartCount与两插件实际SHA已登记；正式镜像未复验能力、安全警告评估和生产数据恢复演练仍单独保留为待办。

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
6. 执行`npm ci --ignore-scripts`、`npm run build`、`npm run test:personal-stable`及受影响原有测试；核对源码/dist同步及未增加依赖。
7. 隔离ST验证legacy true/false/缺省设置、禁用UI、重载、无安装/监听/恢复/轮询/Job，以及普通请求次数与相邻Generate Retry。
8. 验证候选是旧stable后代，再fast-forward推进`personal/stable`。不得force-push/rebase已公开的stable历史；rebase仅限尚未发布的候选，最终推广仍须保留旧stable祖先关系。
9. 更新本canonical组合表、Owner/Disabled Features/Decision Log及结果记录；独立审查通过后，才进入另行授权的生产Update和全页重载。

不可删除或改名柏宝箱或柏宝库的`personal/stable`。2026-11-13候选分支已收口扩展管理接管策略：柏宝库默认要求直连或代理等权威线路确认目标SHA（`allowUnverifiedMirrorDecision: false`、云端镜像兜底`cloudMirrorsEnabled: false`），并在当前分支为`personal/*`或缺少上游跟踪配置时一律禁止自动切向远端默认分支（含`force: true`）；柏宝箱前端仅在确认后端接管开启时才改写`/api/extensions/*`，且浏览器侧兜底更新检查改为读取个人Fork `SurgeXW0508/ST-BaiBai-Tools`的`personal/stable` manifest，不再读取上游`baibai-git/.../main`。日常个人更新仍以ST扩展管理器的当前分支、commit及远端检查为准。

## 柏宝库 Personal Fork 与固定生产分支策略

个人Fork：`SurgeXW0508/baibaoku`；上游：`baibai-git/baibaoku`。

- `main`：纯上游同步镜像，只接收原作者main，不放个人Runtime策略。
- `personal/stable`：唯一生产分支，NAS只允许跟踪此分支。
- `personal/stable`于2026-11-12从个人Fork的main创建，初始Runtime基线为`b211a4e97fdaec24dc8b90c85ddc198fac9ac200`（0.7.3），与上游等价；本次创建分支和新增维护文档不包含Runtime改动。
- 2026-11-12已完成NAS Git跟踪关系整理：`origin`指向`SurgeXW0508/baibaoku`，`upstream`指向`baibai-git/baibaoku`，当前`personal/stable`跟踪`origin/personal/stable`，工作区clean。NAS HEAD为`4814830f`，原Runtime基线`b211a4e9`保留在`backup/pre-personal-stable-20261112`。截至本次文档核验，GitHub `origin/personal/stable` 为`c56b5533`，比NAS本地HEAD多3个仅修改维护Runbook的文档提交；Runtime未变化。本次只修改Git元数据并切换到文档提交，未更新Runtime或重启容器。

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

正式GHCR部署、实际Image ID、容器healthy/RestartCount=0及两插件SHA已由用户提供并登记。Backrest自动备份/恢复验证、真实生产数据恢复演练尚未完成；因此不宣称完整生产恢复能力已验证。Current/Previous与数据恢复分开，完整目录备份和官方过渡回滚镜像继续保留；不读取聊天正文或秘密。

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

交接规则：凡Runtime修改完成实现、测试和审查后，必须说明变更是否已进入生产分支/Release、NAS当前与目标commit或Digest，并主动询问用户是否现在更新NAS。文档/测试-only变更明确说明无需更新Runtime。不得自动发布、切换Digest、更新插件、重启容器或修改生产数据；部署必须得到用户明确授权。

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

## 2026-11-13 — 用户授权的三仓库性能优化与 Pending Ownership 收敛（Candidate 待审）

Authorization & Scope：由用户明确授权在Vertex收尾后进入“三仓库性能优化（聚焦世界书`#world_editor_select`切换卡顿）+ Pending Ownership收敛 + 扩展镜像供应链边界加固”阶段。全程严守不触碰Vertex主链路、不恢复Save Generate、不引入新框架/新缓存层/新依赖的边界。

Decision & Ownership Convergence：

1. **世界书切换与搜索（ST Core Owner + Tools UI精简）**：
   - ST Core（`stage/perf-worldinfo`）：消除切换世界书时的重复DOM清理并改为容器级释放（`clearEntriesListDom`）；将每次切换全量`O(K²)`关键词候选重建改为按需`Set`构建与增量追加；为`originalData.entries`建立基于`WeakMap`的`uid`索引并在新增/删除/克隆时同步维护；对齐前端`worldInfoCache`未命中时的深拷贝语义；将后端`/api/worldinfo/get`改为异步文件读取；采用Shalistera `234cb02d`的世界书/人设搜索`Set`查找；在`StreamingProcessor`上暴露`this.previewFailed`供前端流式扩展判断预览失败终态。
   - 柏宝箱（`candidate/perf-worldinfo`）：删除`worldInfoListOptimizer`只为附加ST节点而每次create/mount的空Vue根应用，移除逐条同步读取`offsetHeight`的强制回流补高循环；世界书下拉分组对同次打开事件去重并在书单未变时复用分组结构；下拉主题同步改为单次`getComputedStyle`读取与批量`cssText`写入；全局世界书选择器捕获监听排除`#world_editor_select`；`mobileLayout`仅在移动布局安装观察器，`entryVisibility`全部测量完成后立即断开`IntersectionObserver`。
2. **Tokenizer批量桥与宏求值正确性（Tools + BaiBaoKu 桥接，ST 拥有语义）**：
   - 保留OpenAI兼容渠道所需的Tokenizer批量桥，明确拒绝`fa16e070`持久化Chat token缓存与Markdown缓存。
   - 修复柏宝库`openai-tokenizer-bridge-installer.js`与`world-info-tokenizer-bridge-installer.js`提前调用`substituteParams`导致有状态宏（如`{{roll}}`、`{{random}}`）重复或提前求值的问题，并将注入范围完全收进`start/end`标记块内，支持字节级精确`unpatch`还原；含宏文本跳过预热/批量计数并交回ST原生单次求值计数；修复多模态数组/`tool_calls`在批量计数中被误强转为`"[object Object]"`的偏差，严格对齐ST原生tiktoken语义；世界书编辑器Tokenizer预热仅在`main_api === 'openai'`时运行。
3. **扩展管理供应链版本决定权与分支保护（BaiBaoKu 可选接管 + Tools 跟随开关）**：
   - 供应链安全决定（不过度防御）：服务器端会执行的扩展与自更新代码默认必须由**权威线路**（直连GitHub或经用户代理连接GitHub）决定目标提交SHA（`allowUnverifiedMirrorDecision: false`），并在探测阶段保证更快的镜像响应不会提前中止在途的权威代理探测；第三方镜像仍可作为已知权威SHA的下载通道（由git校验对象哈希且克隆后二次核对HEAD SHA）；云端镜像列表兜底默认关闭（`cloudMirrorsEnabled: false`）；完整保留mihomo场景所需的代理探测（环境变量、ST `requestProxy`、git `http.proxy`、本机端口`7890/7897/10809/1080`）。若用户处于纯镜像无代理环境，可通过配置显式开启`allowUnverifiedMirrorDecision: true`。
   - 分支保护：本地位于`personal/*`受保护分支或缺少上游跟踪配置（`!trackedBranch`）时，即使传入`force: true`也严禁自动切换到远端默认分支（如`main`），防止误拉取带Save Generate的上游主线。
   - 柏宝箱前端`/api/extensions/*`改写前先查询后端接管配置，未开启时直通ST原生路由；浏览器兜底更新检查改为读取个人Fork `SurgeXW0508/ST-BaiBai-Tools`的`personal/stable` manifest。
4. **常驻钩子收敛与跨组件耦合兜底**：
   - 柏宝箱删除后端已`410 Gone`的Fast Chat渐进加载残留fetch/trigger死代码与捕获监听；备份列表fetch拦截按对应开关装配；合并两处重复的`Element.prototype.scrollTop`定义为单一Owner；`streamingRegexDefer`在`processor.previewFailed === true`时跳过收尾全量重绘。
   - 柏宝库修复切换/列出世界书（只读`/api/worldinfo/get`、`/api/worldinfo/list`）误清空前端`settingsGetCache`的缺陷；新增`hasActiveLazyThemeHydrator`守卫，在未检测到已启用的柏宝箱或`power-user.js`主题桥时自动回退下发完整主题数据。
   - Character Cache、Chat Search与Early Bridge `MutationObserver`合并层维持`Pending Ownership Review`，本阶段不触碰。

Candidate Status：三仓库改动均提交在各自本地候选分支（ST `stage/perf-worldinfo`、Tools `candidate/perf-worldinfo`已同步构建`dist/index.js`、BaiBaoKu `candidate/perf-worldinfo`），尚未合入`release`或`personal/stable`，未修改`personal-release.json`或`PRODUCTION_BASELINE.json`的`current_production`，未推送、未构建Docker镜像、未操作NAS，待用户审查diff并明确授权后按发布节奏推进。

