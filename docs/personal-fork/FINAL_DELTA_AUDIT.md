# Phase C Final Delta Audit

> [!NOTE]
> 本文为 2026-11-09 Phase C（`v1.19.0-personal.1` / Runtime `090cbba6`）冻结差异归档记录。2026-11-12 起经授权合入或候选验证的后续变更（含 Vertex 收尾、世界书性能优化、三项 Pending Ownership 收口及 `saveChat`/`saveGroupChat`/`saveChatConditional` 返回 `Promise<boolean>` 契约）以 [MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md) 与 [PRODUCTION_BASELINE.json](PRODUCTION_BASELINE.json) 为唯一现行依据。

2026-11-09。本轮是冻结差异与发布边界核查，不再逐行审计、不增加Vertex能力。Runtime保持`090cbba6d40e5d117ab41a9e6deb20b40e2dc336`；输入Stage为`8f8c5fb02fe56ec186c3719fc9a7e3ce359a98a6`；两者差异仅两份文档。官方release和原个人release均为`06bde939fb1e9c4c8d8641d810f0a916b5bce127`；Shalistera当前仍为`f67e000034a130dc25c7fb7571b5731f4c219f89`。

## 结论

**Final Delta Audit通过，未发现新的P1、安全、数据正确性或能力Owner阻断；不重开Runtime。** 以共同官方基线比较，冻结Runtime变更32文件，其中16个运行/配置文件；其余为测试、维护文档、AGENTS、CI及package.json中的测试命令，没有新增运行依赖或锁文件变化。Runtime相对官方是有明确边界的Personal Core能力，不是部署时拼装外部patch。

官方release没有新增等价实现需要本轮移除。官方staging和实验分支不作为此次上游同步范围，不因存在新分支扩大冻结范围。31个SH提交的逐项取舍仍在[canonical matrix](MAINTENANCE_COMPATIBILITY.md#shalistera-adoption-matrix)。

## Official / Personal运行差异分类

| 类别 | 文件/边界 | Owner与必要性 |
| --- | --- | --- |
| A 保留 | `vertex-protocol.js`、`vertex-transport.js`、`vertex-native.js` | ST；协议转换、认证/HTTP分离、原生Parts、工具参数增量、官方continuation、一次终态、取消与资源释放 |
| A 保留 | `chat-completions.js`路由入口 | ST；仅Vertex走Native；OpenAI、AI Studio等仍走原路由 |
| A 保留 | `openai.js`、`vertex-state.js`、`prompt-converters.js` | ST；选中Provider/Model快照、Parts/Signature保存、工具历史与编辑后失效、Continue独立续写语义 |
| A 保留 | `tool-calling.js` | ST；保留Provider Tool ID/调用签名，将Native response附加到有效调用；避免Vertex工具参数/结果日志 |
| A 保留 | `public/script.js` | ST；JSON partial进入保存；公共Streaming保留pending正文/Reasoning、停止不继续工具/自动续发、失败释放processor |
| A 保留 | `reasoning.js`、前后端`tokenizers.js` | ST；重复初始化/编辑保护；错误Promise结算；共享pending初始化、失败清理/后续重试，不引入性能cache |
| A 保留 | `chats.js`导入部分 | ST；多历史正确转换、唯一名和排他创建；不改变公共saveChat契约、不引入扫描/搜索缓存 |
| A 保留 | `public/index.html`、`vertex-ui.js`、`default/config.yaml` | ST；显式原生设置/状态/错误，管理员proxy origin allowlist；不把凭据或Prompt写日志 |
| 必要配套 | tests、CI、维护文档、测试scripts | 验证上述边界；不是额外运行能力；无BaiBao源码被合入Core |
| B 未来可删 | 原Google通用转换/旧Vertex分支代码、官方已有的基本UI/认证辅助 | 新Native入口在旧dispatch前隔离。旧原生代码的不可达Vertex分支不是第二次请求；为低diff不在本轮重构。官方未来吸收等价Native与可靠性修复后，按Owner Review删除个人实现 |
| C 运行差异 | 未发现 | 没有误带SH cache/render/scan/diagnostics；没有旧Save Generate Contract或插件恢复Adapter |
| C 发布配置 | 继承的官方workflow依赖ST Bot App Secret；Docker job仅允许官方仓库 | 属于Fork发布基础设施缺口。仅增加Personal CI/Release，并将官方机器人/npm任务限制为官方仓库；不触碰Runtime |

## Reference配套完整性

| 能力 | Personal闭合链与与SH的关系 |
| --- | --- |
| Native Parts / Thought Signature | 原生Parts保留边界与各Part签名 → 前端response record → Chat/swipe extra → 下一轮原生重放；编辑/模型变化会使旧正文重放失效。无需SH渲染cache |
| Tool Calls | 增量参数处理、原ID/签名、顺序化结果、完整回合重放及中间文本编辑均有Core路径；异常/取消终态不执行未完成工具 |
| Continuation | 仅按Google明确continuation token续接，限制段数/重复token/请求总时限；不是网络失败重试，也不依赖柏宝后台任务 |
| Streaming terminal | 生成服务/HTTP adapter分别拥有上游与下游；公共Streaming负责消息收尾，Vertex提供partial/failed/canceled及Parts元数据；不存在第二条恢复请求 |
| Authentication / transport | 每用户凭据/OAuth cache隔离、origin allowlist、既有private filter、禁止自动redirect、资源上限与脱敏错误；保持原出口代理的DNS策略边界 |
| usage / diagnostics | usage按segment汇总，HTTP响应携带原生元数据；独立诊断页面/采集器明确不采用，没有保留对SH diagnostics模块的import或运行依赖 |
| frontend history restore | ST自身Chat持久化和Parts绑定负责刷新后的历史；不依赖柏宝消息恢复。用户已报告刷新后继续RP通过 |

SH `510fbb54`提供功能来源；Personal拆分协议/传输/生成/HTTP并补充安全与历史语义，不要求保持其内部实现。C-D选择的五项可靠性修复可脱离未采用优化独立存在。没有只搬调用端而遗漏必要状态机的证据。

## BaiBao Owner最终核查

Tools按冻结`2f6a9c54`实际代码确认：`src/index.js`无Save Generate导入/装配，设置归一false，旧false→true迁移移除、UI固定禁用，生产dist随该策略构建。上游saveGenerate模块物理保留但不进入运行生命周期。6项Personal policy测试本轮再次通过。

Generate Retry仍有独立wrapper，因此验证组合要求该设置关闭；不能把“Save Generate不装配”说成“柏宝完全无fetch wrapper”。Tokenizer/Regex/Theme和其他优化仍按既有Pending Owner边界，不重新审查或协调双实现。

BaiBaoKu原版`b211a4e9`的Extension Manager：有效`origin/personal/stable`且远端分支存在时沿该分支更新；缺失tracking、游离HEAD或远端分支消失时仍有默认分支回退。此条件风险不能写成“绝不回main”。策略是保持分支存在、禁止验收期间自动更新、核验origin/branch/tracking，缺失时停止更新；只读核验器拒绝这种状态。没有为此修改插件或ST扩展管理。

## 验证与实机记录

本轮本地复跑：Vertex 35/35、Core reliability 17/17、ST Jest 19 suites/411项、Tools policy 6/6、ESLint通过；发布元数据13项、只读核验4项通过。Runtime未改，沿用C-D已通过的46项前端隔离证据，不为性能重新跑SH benchmark。最终以本轮Stage的Personal Core CI实际结果为合入门槛，不将历史官方机器人失败视为测试通过。

用户本轮确认的真实NAS/Vertex：正常RP、连续多轮、刷新后继续、Stop、Regenerate通过；出口节点稳定性属运行环境，不等于Core correctness缺陷。Candidate Image ID、healthy/RestartCount、NAS两插件SHA、Swipe/Continue、真实工具及非Vertex smoke未提供，正式记录为null/not_reported；不能从用户“可正常回复”推导全部验收通过。

**正式GHCR制品重新部署、最终smoke、Production Baseline与临时资产清理仍需用户实机完成。** 源码审查通过允许Merge/Release，不等于NAS部署闭环已完成。所有发布/产物结果以Git Tag、Actions和Release资产实际记录为准。
