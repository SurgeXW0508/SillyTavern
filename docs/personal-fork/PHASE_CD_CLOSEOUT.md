# Phase C-D — Core Reliability Closeout

2026-11-09。开发收口候选，等待独立审查。本文与本轮运行修复在同一Git提交；最终精确SHA由提交本身及交付记录标识。本轮不合并release、不打Tag/Release、不部署NAS、不修改柏宝箱/柏宝库。

## 结论与实际基线

只采用五类Core可靠性修复，没有整体合并Shalistera，没有吸收其缓存/渲染/扫描性能框架，也没有新增第三方兼容契约或运行依赖。公共生成拥有正文、Reasoning、停止、工具和失败收尾；Vertex保留其原生Parts、Signature及终态责任。Save Generate继续不装配。

| 项目 | 本轮开始时实际读取的精确基线 |
| --- | --- |
| Personal ST stage | `6f3479d3e33dbfc890e7aef4ce4e9b90c0ae65c2`，工作区干净；Ahead 3 / Behind 0 |
| Personal ST release | `06bde939fb1e9c4c8d8641d810f0a916b5bce127`，本轮不移动 |
| 1.19.0 tag | `7e8663cd9c184a550b37238218bdd32c6efc68e9`；release仅额外包含npm发布workflow修复 |
| Shalistera release | `f67e000034a130dc25c7fb7571b5731f4c219f89`；相对共同release基线31提交 |
| Personal Tools stable | `2f6a9c54d2c906b4a0e44d20c12d0712552e393d`，`personal/stable`，保持不变 |
| BaiBaoKu原版 | `b211a4e97fdaec24dc8b90c85ddc198fac9ac200`，沿用C-B固定组合，不代表NAS已安装证据 |

所有开发和测试在独立Core副本、临时目录及新建dataRoot中进行，未读取生产聊天/凭据。本轮一个提交后stage相对release为Ahead 4 / Behind 0；交付时以远端compare复核。

## Capability Ownership Review

| 本轮能力 | Owner | Core独立存在的原因 | 与柏宝边界 |
| --- | --- | --- | --- |
| Token Count失败结算 | ST | 原生ajax失败会使异步计数永久pending | 不接管批量Bridge，不改变Tokenizer选择 |
| Tokenizer资源初始化 | ST | 原生SentencePiece可返回未ready实例，失败污染驻留对象；WebTokenizer重复加载 | 仅有限模型实例的资源生命周期；缓存性能Owner仍Pending |
| Reasoning初始化/编辑 | ST | 重复装配Handler可在textarea已移除后再次写入`undefined` | 原生消息与签名由ST保存；插件不参与 |
| 公共Streaming生命周期 | ST | 未刷新到DOM的末段正文/Reasoning在异常时会丢失；Stop不能继续工具 | Vertex仅附加元数据，不恢复内部插件生成Contract |
| Chat Import创建语义 | ST | 多历史或同毫秒导入会覆盖已有文件，CAI转换另有TDZ错误 | 不包含柏宝列表、搜索、数据库或缓存 |

长期Owner矩阵及完整31提交分类只维护在[canonical maintenance document](MAINTENANCE_COMPATIBILITY.md#shalistera-adoption-matrix)。本报告提供本轮实现与验证证据，不建立另一套跨仓库策略。

## 实现与来源

| 来源 / 采用方式 | 当前代码位置 | 实际行为 |
| --- | --- | --- |
| `46c47c5b`，复用必要修复 | `public/scripts/tokenizers.js`：countTokensFromServer / countTokensFromKoboldAPI / countTokensFromTextgenAPI | HTTP/网络错误进入原有apiFailureTokenCount并结算Promise；null响应也走原fallback。成功计数含0、padding、同步调用、BEST_MATCH原有fallback选择不变 |
| `b82c3547`，复用资源修复 | `src/endpoints/tokenizers.js`：SentencePieceTokenizer / WebTokenizer / createSentencepieceEncodingHandler | 同模型调用共享pending；加载完成才发布instance；失败清理pending、后续请求重试；一次encode失败不会在同请求中再次初始化。不同模型独立，仍是原来有限的模型映射 |
| `097be538`，复用幂等修复 | `public/scripts/reasoning.js`：initReasoning / loadReasoningSettings / setReasoningSettingsHandlers / 编辑Done、Cancel | 设置刷新每次执行；文档、设置、应用事件、宏、命令只装配一次；textarea已不存在时Done/Cancel直接结束 |
| `63822f73`，按Phase C适配 | `public/script.js`：StreamingProcessor.generate / finalizeIntermediaryMessage / Generate工具和终态分支 | 缓存未刷新的末段内容，异常时只flush一次；已有收尾负责Reasoning、swipe、附件、消息事件和保存；渲染异常不重试renderer；Stop后不执行工具/auto-continue；reasoning-only工具前置消息不误删；失败路径释放终态processor引用 |
| `b1ae6199`，仅导入部分，增加排他创建 | `src/endpoints/chats.js`：importCAIChat / POST /import / POST /group/import | CAI每段历史分别转换；角色/群聊选择未使用名称；新文本用`wx`，复制用`COPYFILE_EXCL`；选名后遇并发占用明确失败。正常聊天保存契约不变 |

公共Streaming现在将有内容的正常、Continue、Swipe异常消息通过同一个收尾发送一次MESSAGE_RECEIVED和CHARACTER_MESSAGE_RENDERED并保存，供订阅者读取保留下来的消息。这些事件表示消息到达/渲染，并不把异常当成模型completed；Vertex仍持有partial/canceled终态。此处将原先只对Vertex执行的收尾推广到公共Core，未保留双路径。

Impersonate异常只保留输入框中已收到的草稿，不写入Assistant聊天，也不发送完成消息事件。无任何正文/Reasoning/图片的失败继续按原错误路径处理，不因本轮改动新增占位消息保存。渲染器自身抛错时不再次渲染，保留其已经更新的消息状态；不承诺挽救未写入状态前就被扩展渲染器抛弃的数据。

## 已有覆盖与明确省略

- Phase C已覆盖Vertex JSON partial进入saveReply、原生流式partial/signature、工具文本收尾、编辑工具中间消息后的Prompt语义。本轮不重写这些路径，用现有专项回归验证。
- 当前Core的`public/scripts/util/showdown-patch.js`仍使用下标访问；`bebe62bd`修的是未采用的SH优化分支，因此记Already Covered，不倒推引入span优化。
- 当前Vertex选择器包含`gemini-4-argon`，getChatCompletionModel直接读取vertexai_model；现有测试覆盖其流式、JSON、工具和再生。未引入`78a22e87`跨Chat/Text/Preset/Connection/Slash的自定义ID功能。真实账户可用模型/区域仍需实机核实。
- Chat Search stale response、Chat/Character/Token缓存、WI/Persona搜索和长聊天相关变更留待Owner Review。本轮没有处理R2/R3/R4。
- 隐藏页throttle、Markdown/Streaming cache、byte scan、索引、模板并行、Webpack cache、图片header、宏fast path、头像/媒体listener优化以及诊断/benchmark均未采用；完整混合提交取舍见canonical索引。未因测试需要带入这些依赖。

## 测试与证据

| 检查 | 结果 | 覆盖 / 证据 |
| --- | --- | --- |
| `npm run test:reliability` | 17/17通过 | 10项Tokenizer加载/实际HTTP + 7项真实文件导入/并发竞争 |
| `npm run test:vertex` | 35/35通过 | 协议/SSE/签名/工具/取消/错误/HTTP生命周期/历史Prompt |
| ST Jest | 19 suites，411/411通过 | Prompt converter、Chat integrity、Tool Calling、OpenAI/AI Studio等既有回归 |
| Chromium隔离浏览器 | 46/46通过 | 12项公共Streaming + 14项既有Reasoning UI + 1项编辑保存重载 + 3项Tokenizer fallback + 16项既有Vertex |
| Core ESLint | 通过，0错误/0警告 | 原有`npm run lint`范围 |
| 新增测试ESLint | 通过，0错误/0警告 | 6个新增测试/fixture文件 |
| `git diff --check` | 通过 | 无空白错误 |

环境：Node 24.22.1；根依赖复用缓存，已安装包逐项核对未发现与未修改package-lock的版本差异；测试依赖在新的隔离目录使用未修改的tests/package-lock执行npm ci，Playwright 1.56.1、Jest 29.7.0；Chromium 153.0.8010.0。没有变更任何依赖锁文件。此前兼容运行时Playwright 1.65.0同样46项通过，正式报告以锁定1.56.1的最终复跑为准。

新增Node测试使用实际Express导入/Tokenizer路由和真实临时文件；模型加载以可控延迟/失败替代，检查共享和重试的次数与实际HTTP返回结构。竞争测试在选名与写入之间放入另一个写入者的文件，确认明确报错且对方文件字节未变；日志中的EEXIST为预期故障注入。

浏览器运行真实ST前端和临时ST后端。Provider响应以合成SSE/JSON替代；Reasoning编辑以及公共Streaming失败使用真实`/api/chats/save`、`/api/chats/get`读回，再次渲染/比较。Vertex现有JSON partial测试同样经过实际Core service→HTTP payload→Generate→真实保存读回。其他用例仅对不相关的设置保存、计数或聊天保存做隔离，不宣称全部46项都是后端端到端测试。

本轮未修改两个柏宝仓库，浏览器相关用例筛出第三方扩展以验证Core Owner；没有重做C-B全部插件组合实验。C-B已验证Feature Off，今次没有增加拦截/监听/Job；完整实际插件设置及Generate Retry关闭状态仍须在最终Candidate验收确认。

可复现命令（独立副本；不要指向生产dataRoot）：

```bash
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix tests
npm run test:reliability
npm run test:vertex
npm run test:unit --prefix tests -- --runInBand
npm run lint
```

用独立配置、空白dataRoot启动该提交的ST并等待可访问；再运行：

```bash
cd tests
ST_BASE_URL=http://127.0.0.1:18363 npx playwright test frontend/CoreStreaming.e2e.js frontend/ReasoningLifecycle.e2e.js frontend/TokenizerFailure.e2e.js frontend/ReasoningHiddenBlocks.e2e.js frontend/VertexNative.e2e.js --workers=1
```

测试fixture通过浏览器route额外导出私有StreamingProcessor以测试真实实现；未给生产Core新增测试导出。实际使用的隔离启动/浏览器配置、日志、输入refs及SHA清单随证据包交付。PR检查追加`test:reliability`；本轮没有创建PR，因此不能把本地结果写成GitHub CI已通过。

## 自审、限制与独立审查焦点

1. Runtime只改五个既有源码文件；无新运行依赖、持久化cache、全局Hook、Provider Adapter、安全路径变更。Reasoning只保留一份Handler；Tokenizer pending每次结束清除；公共Streaming不重发模型请求。
2. 导入是新文件排他创建，不是多历史事务。若批量中间磁盘失败，之前成功的新文件可能保留，接口返回失败；不会自动回滚或覆盖旧聊天。磁盘满/断电下新文件原子完整性、备份恢复不在本轮验证范围，不能将“防覆盖”表述为事务性导入。
3. 真实Google认证、区域/模型权限、代理链、长输出/断线、图片与多轮工具实际体验，以及完整NAS插件组合未在本轮验证。没有付费模型请求和生产数据操作。
4. 公开saveChat契约仍是原实现；本轮成功读回证明的是正常持久化路径，不是磁盘故障能返回可靠确认的新契约。Save Generate旧恢复问题保持关闭，不再列为Vertex兼容TODO。
5. 极大历史的展开参数数量上限属于`b35c996c`剩余范围，未在当前真实数据上确认；当前不吸收其整套长聊天实现。最终验收如出现Core数据正确性阻断，按冻结例外再开独立修复。
6. 独立审查优先检查公共错误收尾的事件/保存顺序、Stop与工具边界、Token fallback不递归、Tokenizer失败释放、Reasoning签名完整性以及排他导入的失败行为；不以增补性能优化作为通过条件。

当前测试与自审范围内未发现未解决的P1阻断。建议独立审查通过后正式登记Phase C Code Freeze。现在仅锁定独立审查候选，不自行宣布独立审查通过。

## 下一步最小实机验收

固定本轮ST提交 + Tools `personal/stable@2f6a9c54` + 原版BaiBaoKu `b211a4e9`，先核实真实代码/镜像和备份恢复点。重载到新代码，不沿用旧页面。

- 设置中确认Save Generate固定关闭、Generate Retry等未审查接管保持关闭；普通请求观察只派发一次，无Job/恢复请求。
- 真实Vertex流式与JSON各一次普通多轮、Thinking、一次Stop保留正文，再生成/Swipe/Continue检查历史与签名。
- 实际工具回合及编辑中间解释后的下一轮；断线/认证失败不执行未完成工具、不重复请求；只使用单独的验收聊天。
- Reasoning编辑一次→保存→重载；现有目标预设和连接切换不因计数失败挂起。
- 在独立测试角色/群聊导入两段历史并连续重导，确认生成不同文件且旧文件不变；不覆盖真实聊天。

验收后不再追逐SH优化。只有验收P1、安全或数据正确性问题触发新的开发候选；合并、发布、镜像及正式NAS部署均需下一阶段独立授权。
