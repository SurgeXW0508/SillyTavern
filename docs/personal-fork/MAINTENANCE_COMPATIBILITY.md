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

固定参考：柏宝箱1.1.2 `d14a2506fb0f8ca7aa3543df040b470a230e172c`；柏宝库0.7.3 `b211a4e97fdaec24dc8b90c85ddc198fac9ac200`。这些是源码验证版本，NAS实际安装版本尚未核实，不能直接覆盖其他版本。

原柏宝箱开关关闭时仍安装Save Generate Fetch wrapper、DOM/ST监听与恢复入口；首次设置迁移还能将false改回true。因此仅关闭复选框不足以建立本组合。本轮独立插件策略修改在装配入口不启动该功能，设置归一为false、移除强制开启迁移、UI固定关闭。没有Vertex Provider特判，也不加入ST Core兼容逻辑。

此前两个Vertex插件适配补丁与其组合Manifest已撤回，不再属于当前交付。柏宝库恢复到原版。柏宝箱仅有独立的功能关闭策略构建，配套源码与dist作为外部审查材料，不进入ST核心仓库。

使用策略构建后必须全页重新加载；不承诺已经运行的旧JS页面热卸载。旧后台任务、数据库记录和聊天数据不被删除或自动恢复；切换前必须在原环境检查并结算/导出需要保留的任务。进程重启/全页重新加载属于后续隔离验收，不在本轮操作正式环境。

重新启用前必须重新进行Owner Review，证明功能不可替代、禁用/销毁闭合、持久化确认和回滚可靠；优先采用能够真正关闭并独立运行的上游实现。不要重新添加Vertex Save Generate Contract来恢复此功能。

独立已知问题：柏宝旧恢复逻辑可能把未确认写入聊天的任务标为已处理，ST公共saveChat会内部处理保存错误。此问题不再是Vertex兼容TODO，不在本轮修改公共保存契约；任何未来重启用Save Generate的任务必须独立验证持久化确认。

## Decision Log

### 2026-11-09 — Vertex / Save Generate

Decision：Vertex生成生命周期由ST Core独立拥有。

Policy：撤回Vertex内部插件契约、能力协商及专用恢复适配；本验证组合关闭整个Save Generate。其他Provider同样回到原生生成路径。

Reason：三项目接管、持久化、恢复链不值得以升级耦合换取后台生成体验。现有开关不能干净退出，使用最小装配层禁用，不继续建立Provider兼容Adapter。

保留协议/认证传输/生成/HTTP模块分离：它们自身有Core生命周期和测试价值，不依赖柏宝内部调用。

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

## 版本与回滚

release保持上游同步基线，个人改动仅在独立开发分支。每个变更记录来源、Owner、受影响能力和测试；上游同步先在隔离分支验证，不将Shalistera整分支合入。

部署时记录ST commit/不可变镜像digest、插件commit和策略构建哈希、运行时、配置与数据备份位置。保留上一已验证组合及部署描述；回滚整套组合，不能只退ST而留下新的插件Hook。禁止以版本号标签代替运行代码证据。

本轮未验证NAS运行版本、镜像、持久化目录、备份覆盖或生产插件。因此尚不宣称具备已验证生产回滚条件。真实环境验收前需确认这些证据及备份恢复能力；不读取聊天正文或秘密。

未来若建立柏宝Fork，只放简短维护入口链接到本仓库本文件。所有涉及柏宝的任务书，在此前也必须显式要求先阅读本文。
