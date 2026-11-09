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
| Token Count失败结算 / Tokenizer资源初始化 | ST | 柏宝性能Bridge另行审查 | 本轮仅修Core生命周期；不引入缓存或批量Bridge |
| Reasoning初始化 / 编辑与基础Chat导入 | ST | — | Handler单次装配；导入只创建新文件 |
| Tokenizer性能、其他渲染/缓存优化 | Pending Ownership Review | 多方 | 不扩大Phase C；资源初始化正确性不等于性能能力归属 |

## Disabled Features

**当前个人验证组合关闭所有Provider的Save Generate。** 这是当前维护策略，不是Vertex API能力限制。用户接受失去关闭页面后继续生成及恢复的体验。

当前维护模型已经由Phase C-B转为正式Fork分支，不再在部署时应用外部patch。

| Component | Source / branch | 精确验证基线 |
| --- | --- | --- |
| Personal ST运行代码 | `SurgeXW0508/SillyTavern:stage/vertex-native-generation-contract` | `090cbba6d40e5d117ab41a9e6deb20b40e2dc336`；Phase C冻结运行基线；之后的C-E0提交仅修改文档 |
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

### 2026-11-09 — Phase C-D Core reliability closeout

Decision：只吸收Token Count失败结算、Tokenizer初始化、Reasoning幂等编辑、公共Streaming边界和Chat Import防覆盖。五类能力均由ST Core拥有，脱离柏宝仍成立；不改变性能优化的Pending Owner。

Policy：公共StreamingProcessor结算已收到的正文/Reasoning及消息收尾，Vertex只附加原生Parts/Signature/终态。停止后不调用工具或自动续发；失败不重新派发模型请求，不保留已终结的processor引用。Save Generate继续不装配，两个柏宝仓库和安全/认证/代理实现不变。

Evidence：详见[Phase C-D closeout](PHASE_CD_CLOSEOUT.md)中的命令、边界和验收清单。未进行真实Google或NAS验收，不能把隔离测试当成生产验收。

## Shalistera Adoption Matrix

参考固定到`Shalistera/SillyTavern:release@f67e000034a130dc25c7fb7571b5731f4c219f89`。共同基线为`06bde939fb1e9c4c8d8641d810f0a916b5bce127`，相差31提交。它比1.19.0 tag `7e8663cd9c184a550b37238218bdd32c6efc68e9`多一项npm发布workflow修复，因此最初按tag统计的32提交不是遗漏。

`Adopt Now`表示本轮已实现，不是待办；混合提交只采用Reason栏明确限定的部分。没有整体merge/cherry-pick。宏观分类按实际diff的功能范围完成，不宣称对未采用模块逐行审计。

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
| [b34249a6](https://github.com/Shalistera/SillyTavern/commit/b34249a6c81e4cbffbb8cff6f45f32243c2ad2a1) | Markdown / WI / Chat Search | Pending Ownership Review | 搜索Owner未定；Markdown缓存不采用 |
| [b1ae6199](https://github.com/Shalistera/SillyTavern/commit/b1ae6199d44b9c0626552a7e00ac4d99ef618eea) | Chat summaries与Import | Adopt Now | 仅CAI转换和导入防覆盖；缓存/搜索待Owner |
| [6360ee2c](https://github.com/Shalistera/SillyTavern/commit/6360ee2ce883411eb5bbe94a3be3c962ee846329) | stale search / Markdown / template | Pending Ownership Review | 不碰R2/搜索；其他缓存与去重优化不采用 |
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
| [234cb02d](https://github.com/Shalistera/SillyTavern/commit/234cb02d2538728fc96c0d64bbbfed2c50619c64) | WI / Persona search | Pending Ownership Review | 搜索优化与柏宝交叉，未选Owner |
| [cfc09c41](https://github.com/Shalistera/SillyTavern/commit/cfc09c41ba55a56e54e0888506313c715b848afc) | Folder索引 | Intentional Omission | 列表性能，无当前必要性 |
| [a659d219](https://github.com/Shalistera/SillyTavern/commit/a659d219d81cc5084aa0d6d8c1e8d37c1b76cb49) | Group引用索引 / stat复用 | Intentional Omission | 列表性能，不引入索引状态 |
| [c8147274](https://github.com/Shalistera/SillyTavern/commit/c8147274b34b281d204fa9887d9048b0431abfa6) | Webpack build cache | Intentional Omission | 构建优化非运行必要依赖 |
| [a3bb450d](https://github.com/Shalistera/SillyTavern/commit/a3bb450d400b20280566de938ba0f451cabb7dc1) | Macro fast path | Intentional Omission | Prompt宏语义保持上游实现 |
| [46c47c5b](https://github.com/Shalistera/SillyTavern/commit/46c47c5b015bfe90ec582d2a2597b97257ff979b) | Token Count failure | Adopt Now | ST；已有fallback必须结算 |
| [f84b0a1f](https://github.com/Shalistera/SillyTavern/commit/f84b0a1ffbc986b8e04f71d813a6c6fa835a1a0e) | Thumbnail header读取 | Intentional Omission | IO优化，不改图片路径 |
| [b35c996c](https://github.com/Shalistera/SillyTavern/commit/b35c996c81cd878e277944bc10f1c367ee129083) | Hidden preview / 大数组替换 | Pending Ownership Review | 长聊天Owner后置；不引入throttle；极大历史参数上限未在当前环境复现/验收 |
| [b0f25818](https://github.com/Shalistera/SillyTavern/commit/b0f25818429becd3518b943fd7d5399d3d452f63) | 并行Template初始化 | Intentional Omission | 启动性能，不改顺序 |
| [fa16e070](https://github.com/Shalistera/SillyTavern/commit/fa16e070a67a57fc4e5be1cc8c5c0f374f3cedfa) | 持久化Chat token cache | Pending Ownership Review | Tokenizer性能Owner未定；本轮仅资源初始化 |
| [b82c3547](https://github.com/Shalistera/SillyTavern/commit/b82c35477a9f2dbf9dcf07e46f88efae4accf045) | Tokenizer init生命周期 | Adopt Now | ST；single-flight、ready发布、失败可重试 |
| [897eb6cb](https://github.com/Shalistera/SillyTavern/commit/897eb6cb4dd985feed8bb1b26534ba4530c9585d) | 浏览器/服务端性能文档 | Intentional Omission | 不引入性能benchmark体系 |
| [63822f73](https://github.com/Shalistera/SillyTavern/commit/63822f73639d2945b0d1720df66effefb25282b0) | Streaming工具/失败/停止 | Adopt Now | 公共生命周期适配；已有Vertex收尾不再建立副本 |
| [f67e0000](https://github.com/Shalistera/SillyTavern/commit/f67e000034a130dc25c7fb7571b5731f4c219f89) | CPU与调度争用测量 | Intentional Omission | benchmark准确性改进，无运行依赖 |

本轮五项修复的实现/测试可以独立于未采用的性能提交存在。`bebe62bd`仅是未采用span优化后的修正，不构成必须追加前序优化的理由。`b35c996c`的大数组替换另有极大历史输入的可用性价值，但本轮未确认当前真实数据触及参数数量上限；不把它与pending-content修复捆绑。出现实机数据正确性问题时按下述重新开发门槛处理。

## Phase C Code Freeze

**当前状态：Phase C Code Freeze，2026-11-09正式登记。** 根据用户在Phase C-E0任务中确认，Phase C-D已经通过独立审查；本次登记不是Work自审替代独立审查。真实Google、真实NAS、生产回滚仍待用户手工验收，不因冻结登记而视为通过。

| Frozen component | Branch / source | 精确SHA |
| --- | --- | --- |
| Personal ST Runtime | `SurgeXW0508/SillyTavern:stage/vertex-native-generation-contract` | `090cbba6d40e5d117ab41a9e6deb20b40e2dc336` |
| Personal ST-BaiBai-Tools | `SurgeXW0508/ST-BaiBai-Tools:personal/stable` | `2f6a9c54d2c906b4a0e44d20c12d0712552e393d` |
| BaiBaoKu原版0.7.3 | `baibai-git/baibaoku` | `b211a4e97fdaec24dc8b90c85ddc198fac9ac200` |

C-E0只登记和交接文档；Stage HEAD可以因此前进，但Candidate Image输入必须仍为冻结Runtime SHA，不能改用浮动分支HEAD。Capability Ownership不变，Save Generate继续不装配，不新增兼容Hook/Adapter。

冻结后仅以下情况允许重新开发：真实验收发现P1、安全问题、数据正确性问题。必须记录复现、Owner、影响面和受影响测试，再提交新的候选。Shalistera性能优化、benchmark更快、顺手重构、UI小优化和Pending Ownership尚未处理均不能解除冻结。

真实NAS首次检查、构建、迁移、回滚和验收见[Phase C Deployment Handoff](PHASE_C_DEPLOYMENT_HANDOFF.md)。本轮不SSH、不构建/切换正式NAS、不合并release、不Tag/Release。柏宝箱AGENTS暂保留当前Stage canonical链接；最终Closeout合入release并确认文档存在后必须切换到release，不提前建立第二份矩阵。

### 2026-11-09 — Phase C-E0 freeze registration

Decision：登记上述已通过独立审查的冻结组合，代码侧停止；部署由用户在ChatGPT指导下手工执行。

Owner Review：本轮只改变维护记录和交接文档，没有能力实现变更。Runtime、两个柏宝仓库、Dockerfile、默认配置、构建流程和依赖不变。旧Vertex/Save Generate外部patch不参与Candidate构建、安装或回滚。

Boundary：NAS容器、挂载、当前插件版本、Backrest恢复点和旧Image仍待实机证据；构建或启动成功不能替代真实Google与整组合验收。

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
