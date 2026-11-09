# Personal Fork 维护与能力归属

Canonical compatibility document。涉及ST、Personal Fork、柏宝箱、柏宝库、Shalistera引入的任务，开始前必须阅读本文件，完成Capability Ownership Review；其他任务书或未来插件Fork只引用本文件，不复制冲突矩阵。

## 稳定维护原则

优先级：稳定性 > 数据正确性 > 核心功能 > 体验增强 > 性能优化。

1. 单能力单Owner；原生实现完整可靠且性能可接受时优先ST。
2. 删除优于兼容。上游吸收个人改动后优先删除个人实现；成熟替代实现出现时重新选择Owner。
3. 性能优化不得改变Prompt、预算、排序或持久化语义。收益不足以抵消Hook、状态复制或升级成本时放弃优化。
4. 不因第三方插件修改ST Core公共契约；不为单一旧插件版本建立通用框架。
5. Feature Off必须退出装配、监听、拦截、轮询和任务创建；仅在回调里判断开关不算退出。
6. 一次请求只有一个生命周期Owner，终态结算一次。派发后不得通过fallback重发模型请求。
7. 保持每用户凭据/OAuth隔离、代理origin允许列表、禁止自动重定向、既有私网过滤和不记录Prompt/秘密的边界。

## 当前能力Owner

| Capability | Owner | 其他实现 | Policy |
| --- | --- | --- | --- |
| Vertex请求协议、认证、传输 | ST | Shalistera仅来源参考 | ST only；不整体合并参考分支 |
| Thinking / Reasoning / Thought Signature | ST | 旧插件适配已撤回 | 按原始Part保存；编辑使对应正文重放失效 |
| Tool Calling原生语义与历史 | ST | 柏宝后台执行不采用 | ST调用工具；保留id/name/参数/顺序/有效调用签名 |
| Generate、Continue、Swipe、Regenerate | ST | Save Generate关闭 | 同一原生请求链 |
| Partial / Failed / Canceled | ST | — | partial保留可用内容和终态；异常终态不自动执行工具或续发 |
| 历史Prompt语义 | ST | — | 当前消息为语义来源，不能因旧response ID恢复已编辑/删除正文 |
| 基础聊天保存 | ST | 柏宝恢复不采用 | 保持上游公共saveChat契约；不得删除已有数据 |
| Save Generate / 后台任务 / 消息恢复 | 柏宝，但本组合不启用 | ST正常生成 | 整个Save Generate关闭；不保留Vertex内部调用契约 |
| 自动重试/黑名单重试 | Pending Ownership Review | 柏宝可选功能 | 本轮验证设置关闭；不得据此报告宣称其可安全接管Vertex |
| 独立体验UI | 柏宝箱 | 未在本轮重新审查 | 不得获得Vertex生成生命周期所有权 |
| 独立数据库/服务 | 柏宝库 | 未在本轮重新审查 | 保持原版；不能凭服务存在推断已启用Save Generate |
| Fast Chat / Character Cache / Early Bridge | Pending Ownership Review | 多方 | R2/R3/R4后置，不提前选Owner |
| Tokenizer、其他渲染/缓存优化 | Pending Ownership Review | 多方 | 不在Phase C扩展范围 |

## Disabled Features

**当前个人验证组合关闭所有Provider的Save Generate。** 这是当前维护策略，不是Vertex API能力限制。用户接受失去关闭页面后继续生成及恢复的体验。

当前维护模型已经由Phase C-B转为正式Fork分支，不再在部署时应用外部patch。

| Component | Source / branch | 精确验证基线 |
| --- | --- | --- |
| Personal ST运行代码 | `SurgeXW0508/SillyTavern:stage/vertex-native-generation-contract` | `24cc9c9559382998afd3b2b2c3e95589df78aa75`；Phase C-B仅更新文档，运行代码不变 |
| 柏宝箱上游同步基线 | `baibai-git/ST-BaiBai-Tools:main` → `SurgeXW0508/ST-BaiBai-Tools:main` | `1e87dfaad87819a90d8032530a62a2ed29f97aea`，实际package/manifest版本1.1.5 |
| 柏宝箱唯一个人部署分支 | `SurgeXW0508/ST-BaiBai-Tools:personal/stable` | `2f6a9c54d2c906b4a0e44d20c12d0712552e393d`，跟踪`origin/personal/stable` |
| 柏宝库 | `baibai-git/baibaoku`原版，无Personal Fork | `b211a4e97fdaec24dc8b90c85ddc198fac9ac200`，0.7.3 |

这些是隔离验证组合，不是NAS安装版本断言。柏宝箱个人差异只有Save Generate生命周期关闭策略、对应构建/测试和简短维护入口；没有Vertex Adapter，也没有其他柏宝优化修改。

当前1.1.5仍无条件装配Save Generate、默认开启并存在false→true旧迁移。Personal Stable在装配入口移除导入/安装及面板通知，设置归一false、移除强制开启迁移、UI固定禁用；不物理删除上游模块，不改Generate Retry实现。生产dist从锁定依赖的源码构建，连续两次构建哈希一致。

Phase C基于1.1.2的外部策略patch，以及更早的两个Vertex兼容patch，只作为历史过程证据。它们不再是正式安装、更新或回滚步骤；不要叠加到personal/stable上。柏宝库源代码保持原版。

安装或更新Personal Stable后必须全页重新加载；不承诺已经运行的旧JS页面热卸载。旧后台任务、数据库记录和聊天数据不被删除或自动恢复；切换前必须在原环境检查并结算/导出需要保留的任务。进程重启/全页重新加载属于后续隔离验收，不在本轮操作正式环境。

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

## Update Preflight（合并/发布前必须完成）

1. 核验三个项目各自目标版本/commit、工作区、本地修改与当前验证组合；未核实NAS版本就标为未知。
2. 列出变更涉及的Capability，记录Owner Review结论。
3. 对照上表，检查新能力重叠、Hook顺序、状态与生命周期所有权。
4. 检查官方是否已吸收个人改进；吸收后优先移除对应个人diff。
5. 已有成熟Owner时关闭/删除另一实现，不新增协调两套实现的兼容层。
6. 只有不可替代且无法单Owner的能力才允许明确、有限的跨模块契约，并说明取消/错误/持久化责任。
7. 验证Feature Off无安装/监听/轮询/后台任务、生成只派发一次；更新插件不能悄悄恢复Save Generate。
8. 执行受影响的Core回归、插件策略检查和隔离集成；涉及认证/代理/模型时增加真实环境验收。Mock通过不能替代实机。
9. 更新本Ownership Matrix、Disabled Features、Decision Log、支持矩阵与精确组合记录。
10. 记录验证结果与回滚点后，才可进入另行授权的合并/发布。禁止先升级再故障补丁。

## 柏宝箱安装、更新与上游同步

正式源：`https://github.com/SurgeXW0508/ST-BaiBai-Tools`，Branch/Tag填写`personal/stable`。原生安装后应看到当前分支`personal/stable`、upstream `origin/personal/stable`及上表commit；Update继续跟随该分支，不切回main。

从旧上游安装迁移时，先备份代码目录和账户设置，确认global/local安装范围及实际加载副本。新旧仓库同名目录会使直接安装返回409；切分支也不会更换origin。后续迁移任务应使用原生扩展管理器移除旧代码副本、从Fork按分支安装，保留账户设置，并确认只加载一份；本轮没有操作NAS或替换正式扩展。

上游更新流程：

1. 开始任务先读本文和`personal/stable`的AGENTS.md；不要依赖纯main中存在个人维护文件。
2. 核验上游目标commit、Fork main/stable当前HEAD、当前组合和本地修改。允许固定已验证版本，不追逐无关更新。
3. 将Fork main按fast-forward同步到已选择的上游基线；main不放个人代码或维护策略。
4. 列出受影响Capability、阅读Owner矩阵、检查上游是否已有真正Feature Off。若已有且验证可靠，优先删除个人策略，不能保留两套。
5. 从现有stable建立独立候选，将已审查main合入并解决最小个人差异。默认保留公开stable历史，避免重写正在被扩展管理器跟踪的分支。
6. 执行`npm ci --ignore-scripts`、`npm run build`、`npm run test:personal-stable`及受影响原有测试；核对源码/dist同步及未增加依赖。
7. 隔离ST验证legacy true/false/缺省设置、禁用UI、重载、无安装/监听/恢复/轮询/Job，以及普通请求次数与相邻Generate Retry。
8. 验证候选是旧stable后代，再fast-forward推进`personal/stable`。不得force-push/rebase已公开的stable历史；rebase仅限尚未发布的候选，最终推广仍须保留旧stable祖先关系。
9. 更新本canonical组合表、Owner/Disabled Features/Decision Log及结果记录；独立审查通过后，才进入另行授权的生产Update和全页重载。

不可删除或改名`personal/stable`。原版柏宝库可选扩展管理接管在跟踪分支消失或游离HEAD时可能选默认分支；维护任务必须核验origin、当前分支和跟踪关系。柏宝扩展管理接管仍为Pending Ownership Review，本轮没有修改开关；原生路由测试不等于已验证NAS的全部接管配置。

柏宝箱自身版本提示有上游manifest兜底；提示不代表personal/stable已经有新提交。个人更新以ST扩展管理器的当前分支、commit及远端检查为准；本轮不改提示或更新实现。

## 柏宝库固定版本策略

不建立无代码差异的Personal Fork。固定原版精确commit，避免生产静默升级。隔离组合已用ST配置`enableServerPluginsAutoUpdate: false`，同时阻止ST启动更新器和柏宝库读取该配置的自更新入口；没有修改正式配置，也没有把仓库默认值改掉。

生产升级前先确认目标commit，做Capability Ownership Review，检查其是否触及ST或柏宝箱Owner，再隔离验证、记录整组合和回滚点后升级。单独设置柏宝库的git自更新开关不能替代核验ST自己的启动自动更新设置。

## 版本与回滚

release保持上游同步基线，个人改动仅在独立开发分支。每个变更记录来源、Owner、受影响能力和测试；上游同步先在隔离分支验证，不将Shalistera整分支合入。

部署时记录ST commit/不可变镜像digest、插件commit/跟踪分支和生产dist哈希、运行时、配置与数据备份位置。保留上一已验证组合及部署描述；回滚整套组合，不能只退ST而留下新的插件Hook。禁止以版本号标签代替运行代码证据。

本轮未验证NAS运行版本、镜像、持久化目录、备份覆盖或生产插件。因此尚不宣称具备已验证生产回滚条件。真实环境验收前需确认这些证据及备份恢复能力；不读取聊天正文或秘密。

柏宝箱Fork已在personal/stable放置简短AGENTS.md，链接本文，不复制矩阵。所有涉及柏宝的任务书必须显式要求先阅读本文；柏宝库仍保持上游原版。

公开stable需要回滚时，优先以新的revert提交恢复已验证代码树，保留正常快进更新链；应急整组合快照恢复后暂停更新，不能通过强推stable倒退来驱动客户端回滚。
