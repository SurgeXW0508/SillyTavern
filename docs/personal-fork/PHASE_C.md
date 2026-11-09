# Phase C — Vertex Native 架构简化与维护收口

日期：2026-11-09（北京时间）。状态：独立开发分支交付，等待独立审查与真实Google/隔离NAS验收。未合并release、未Tag/Release、未部署。

本报告替代第一轮三方兼容交付的设计结论；历史提交及独立审查报告仍作为过程证据，不作为当前安装方案。

## 最终架构与Owner

**Vertex生成生命周期由ST Core独立拥有。** 不再通过柏宝箱接管、柏宝库后台任务及柏宝箱恢复来完成Vertex生成。

最终链路：ST Generate → ST Chat Completion HTTP入口 → Vertex协议/认证传输/生成 → SSE或JSON → ST消息收尾 → 原有聊天保存。

长期Owner矩阵、Disabled Features、Decision Log、Update Preflight及回滚规则统一位于 [MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)。根目录AGENTS.md要求后续修改/升级先读该文档并执行Capability Ownership Review。

| 保留边界 | 责任 |
| --- | --- |
| `vertex-protocol.js` | 请求转换、参数约束、SSE、函数参数增量；不接管聊天保存 |
| `vertex-transport.js` | 用户凭据、OAuth、地址、代理和连接安全 |
| `vertex-native.js`生成/HTTP适配 | 上游流、取消/deadline、CONTINUATION、唯一终态；浏览器连接、保活、背压、资源释放 |
| `vertex-state.js`及ST原生消息/工具路径 | 原始Parts、签名、当前历史语义、工具执行及普通聊天保存 |
| 柏宝箱 | 独立体验功能；本组合不装配Save Generate |
| 柏宝库 | 保持原版，独立服务/数据库；不参与Vertex生成调用 |

生成/HTTP拆分仍有Core自身的生命周期和测试价值，因此保留；没有将所有Provider改造为新的框架。协议/传输/生成内部测试工厂不属于第三方支持契约。

## 本轮删除与关闭

1. 删除 `VERTEX_GENERATION_CONTRACT`、供插件调用的默认 `runVertexGeneration` 导出、HTTP中的插件专用409分支和契约版本头；删除响应中的contract版本标记。Core SSE/JSON终态字段仍保留，属于前后端原生业务数据。
2. 撤回此前柏宝库四个文件的Vertex适配，隔离副本恢复原版；撤回此前柏宝箱的Vertex能力协商、接管、专用消息恢复和partial插件适配。旧两个补丁与其活动Manifest不属于当前交付。
3. 从核心测试脚本移除三方HTTP/SQLite及插件恢复测试。保留其中有独立价值的HTTP/取消/原供应商回归，改为无插件依赖的Core测试。
4. **本个人验证组合关闭所有Provider的Save Generate。** 不采用额外的Vertex Provider特判。关闭页面后后台继续生成/自动恢复能力明确放弃；关闭本身不删除历史聊天或旧任务数据。

### 为什么不能只关闭原有复选框

参考柏宝箱1.1.2在`src/index.js`无条件安装`installSaveGenerateFetchHook()`；安装函数无论开关都建立Fetch wrapper、意图/停止/输入恢复/窗口恢复/删除监听。wrapper甚至先尝试处理保存请求再检查开关。`initializeSettings()`的旧迁移还能将false改为true。

因此提供**一个独立的功能关闭策略patch**：

- 从装配入口移除Save Generate导入和安装。
- 移除柏宝库状态面板对该模块的导入/通知，使生产构建不包含其安装与恢复实现。
- 默认设置为false，初始化时归一旧true/缺省值，撤掉强制开启迁移。
- 复选框固定关闭，说明本组合使用原生生成与保存。
- 不改柏宝Save Generate模块自身，不加入Vertex代码、Provider判断或新的生命周期Adapter。

策略patch只针对柏宝箱 `d14a2506fb0f8ca7aa3543df040b470a230e172c`（1.1.2），包括源码和生产dist；是外部审查材料，没有纳入ST源码或推送插件上游。柏宝库 `b211a4e97fdaec24dc8b90c85ddc198fac9ac200`（0.7.3）无本地修改。NAS实际版本仍未知，对其他版本必须重新比较。

必须全页重载后使用新构建；本轮不承诺热卸载已运行的旧代码。其他柏宝功能仍可能有自己的Hook，本轮证明的是Save Generate自身不装配、不监听、不轮询、不恢复、不创建新任务，不宣称整个柏宝箱没有Hook。

## 两项ST Core正确性收口

### 非流式partial

服务JSON响应保留 `vertexMeta.state=partial`、受控错误、正文/Reasoning、原始Parts、签名。前端将“明确partial且含可用文本/思考/图片”视为需要进入消息收尾的结果，错误通知仍明确说明未完整完成。

Generate不再在错误或JSON schema快捷返回入口丢弃这类结果；正常/Swipe/Continue仍通过原生saveReply保存元数据。没有可用内容的failed仍拒绝，不伪装成成功。

异常终态不自动执行工具，也不通过自动Swipe或自动Continue隐式派发另一请求。流式MAX_TOKENS同样保留partial且禁止这些自动后续动作。显式的服务端CONTINUATION仍只在API明确返回有效token时受限接续，不等于网络重试。

控制后的错误类别随`vertex_generation`保存；没有把上游原始错误正文写进记录。响应元数据、当前Swipe元数据与消息事件保持一致。

新增浏览器验证使用实际Core服务产生“第一段有内容，续传503”和MAX_TOKENS结果，经实际sendOpenAIRequest → Generate → saveReply → 原有saveChat → 真实隔离HTTP保存/读取，确认聊天JSONL持久化正文、思考、签名、Parts和partial。failed无正文也经过同一入口验证，没有消息完成事件、工具动作或聊天保存。

### 工具回合历史编辑

去重改为一个完整回合的Prompt投影：只有显示消息仍绑定同一模型、同一原生Parts且内容未改变，才由工具载体代表该回合并隐藏重复显示正文。

若中间正文被用户编辑、被正则改写、删除或存在歧义，不再隐藏当前消息或重放载体中的旧正文/思考。工具载体只保留未改变的Function Call Parts及其原始签名；工具id/name/参数/结果和顺序保持不变。当前显示正文按普通未签名文本进入历史。不会把旧正文签名附到新文本上。

这是构建Prompt时的投影，不修改已保存聊天记录或删除原始元数据；恢复为完全相同的原文后可以重新验证。正常未编辑回合仍重放完整原始Parts。组成员/模型不匹配时不复用另一来源的记录。

完整Generate浏览器用例实际执行工具各一次，编辑中间说明后发起下一轮，确认新正文只出现一次、旧正文消失、调用与结果顺序/签名保留、工具不重复执行。服务端协议测试核对这些Parts到Google请求的转换。

## 能力矩阵（当前只有Core路径）

| 能力 | 当前状态 | 证据/限制 |
| --- | --- | --- |
| 普通文本、SSE/JSON、多轮 | 已实现，隔离通过 | 原生HTTP和浏览器；真实Google待验 |
| Thinking/Reasoning/原始Parts/Signature | 已实现，隔离通过 | partial、停止、Swipe及持久化；真实模型待验 |
| Continue / Swipe / Regenerate | 原生能力保留 | 浏览器、协议；不通过柏宝恢复 |
| partial/failed/canceled | 原生终态 | 保留可用部分，空失败拒绝，取消释放资源 |
| 普通工具、多工具、多轮工具 | 已实现，隔离通过 | 实际工具动作及完整循环；编辑回合需真实模型复核签名接受情况 |
| JSON/schema | 转换已测 | 不完整JSON不冒充完整结构化结果；partial进入普通消息收尾，quiet调用仍不创建聊天消息 |
| 图片输入/支持模型图片输出 | 第一轮实现保留 | 协议/浏览器帧；真实图片与多轮编辑待验；无新增媒体能力 |
| 音视频输入 | 继承原转换 | 未做真实媒体验收；无新音视频输出 |
| Google Search/URL Context/代码执行等原生工具 | 原参数支持保留 | 非通用新UI；真实产物/展示仍待专门验收 |
| Argon明确CONTINUATION | 原有受限续接保留 | 合成续接/失败/循环保护已测；真实长输出/usage计费待验 |
| 特殊actual_content | 保留显式单一工具展开 | 与普通工具协议区分，原始envelope留存，不挪用函数签名 |
| 后台生成、关闭页面后恢复 | **关闭** | 不再作为Vertex兼容TODO |
| 上游网络/HTTP自动重试 | 不提供 | 避免重复请求；用户显式重试为新调用 |

未新增模型能力。Argon区域、API版本、采样忽略提示、Flex等参数边界保持第一轮已实现范围；上游模型能力变化需先Preflight。

## 安全与公共契约

保持每用户secret选择、OAuth缓存用户/秘密指纹隔离、固定Google端点、反向代理origin允许列表、模型/OAuth禁止自动重定向及既有Private Request Filter。没有新增外部地址或认证架构。

使用ST出站代理时，远端DNS/路由仍由代理负责，必须实机验证。错误仅公开受控类别/状态，不记录Prompt、凭据、上游错误正文或续传token。

`saveChat()`和`saveChatConditional()`函数体保持第一轮/上游公共语义，没有为旧柏宝恢复修改保存成功确认。旧Save Generate的恢复确认问题作为其独立维护事项记录于canonical文档；因为该功能退出Vertex，不再是本轮Core阻断。

## 验证

| 检查 | 本轮结果 |
| --- | --- |
| Core Node专项 | 35通过，0跳过：27协议/服务/传输/历史/HTTP适配 + 8真实HTTP路由 |
| Chromium Core专项 | 16通过，含完整工具编辑下一轮及真实临时聊天保存/读取 |
| 真实柏宝箱策略构建Feature Off | 1通过；旧enabled=true归一false；无Save Generate全局状态/样式/后台请求；Vertex和custom的SSE/JSON各一次原生请求 |
| ST既有Jest | 19 suites / 411通过，包括Prompt converter、Chat integrity |
| ST ESLint / 浏览器专项ESLint | 通过 |
| 柏宝箱修改文件ESLint / 生产构建 | 通过；既有单包体积提示保留 |
| 核心/插件diff检查、策略patch应用与哈希 | 通过 |

环境Linux、Node24.22.1、Chromium153.0.8010.0、Playwright1.65.0。只用合成数据、受控供应商、临时用户目录。没有真实Google凭据、模型账单调用或NAS操作。未创建PR，不声称GitHub CI已经运行。

Core复跑：

```bash
npm run lint
npm run test:vertex
npm run test:unit --prefix tests -- --runInBand
# 只指向独立配置/独立数据的ST实例
cd tests
ST_BASE_URL=http://127.0.0.1:8000 npx playwright test frontend/VertexNative.e2e.js
```

Core测试不需要柏宝或SQLite驱动，不再因缺少配套插件而跳过。Feature Off测试及策略patch在外部审查包；该测试加载实际生产dist，其他可选优化/自动重试功能关闭，只证明本轮目标能力。未把它表述为全部柏宝功能的正式UI/生命周期验收。

## 自审与剩余限制

自审沿生成所有权、取消/终态、非流式部分结果、编辑后的工具回合、关闭态和公共保存边界完成；已测范围没有发现新的P1阻断。新增Core没有导入柏宝模块；柏宝库副本干净；没有新增运行依赖、兼容能力协商或第三方专用响应分支。

仍需验证：

1. 真实Google认证/区域/模型、长输出及分段usage、真实工具签名和编辑后回合、图片、限流/超时、实际代理缓冲与DNS边界。
2. NAS实际运行代码、插件版本、Node/SQLite驱动、持久化/备份/整组合回滚点。其他柏宝Bridge与优化仍按后续Owner Review处理，本轮不修R2/R3/R4。
3. 浏览器关闭或非流式请求已经取消后不再提供后台结果恢复，这是关闭后台生成的明确能力边界。关闭本功能不会迁移、删除或自动结算旧任务。
4. 插件更新可能替换个人策略构建，必须先检查禁止安装Save Generate的装配边界；不能仅保留一个关闭复选框。NAS当前版本未核实，不能直接套用1.1.2策略patch。
5. ST上游公共saveChat会自行显示并处理保存错误，本轮保持该契约；实际服务器拒绝写入时仍应遵循原生错误提示和恢复流程，不承诺新的保存确认API。

下一步：独立审查本次diff、canonical规则和单个策略patch；通过后开展真实Google与隔离NAS验收。验收覆盖原生SSE/JSON、Thinking、普通/编辑工具回合、partial、停止、连接切换、Continue/Swipe/Regenerate、图片及OpenAI/AI Studio对照，核对请求次数、终态、签名和聊天持久化。通过后再另行决定合并/发布/部署。

## 来源

基线：个人/官方release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`；第一轮Phase C `ca1a7bff7e5be41c1f9afb1fdb5a16e0712734ff`。选择性改编来源仍为Shalistera `510fbb545f3c713c869e86fff106b3d1a830ce63`，没有新增引入其其他优化。

独立审查指出的两个Core问题本轮收口；柏宝恢复确认问题通过退出该功能解除三方依赖，没有转化成新的Core保存契约。
