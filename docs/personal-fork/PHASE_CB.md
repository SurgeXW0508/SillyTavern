# Phase C-B — Personal Tools Stable 与维护基线

日期：2026-11-09（北京时间）。完成代码与隔离验证，等待独立审查；未部署NAS，没有真实Google付费调用。

## 结果与精确组合

| 组件 | 本轮精确基线/结果 |
| --- | --- |
| Personal ST运行代码 | `24cc9c9559382998afd3b2b2c3e95589df78aa75`，本轮只更新维护文档，运行代码不变 |
| 柏宝箱上游及个人main | `1e87dfaad87819a90d8032530a62a2ed29f97aea`，main完全同步且未放个人修改 |
| 柏宝箱Personal Stable | `2f6a9c54d2c906b4a0e44d20c12d0712552e393d`，`SurgeXW0508/ST-BaiBai-Tools:personal/stable` |
| 柏宝库原版 | `b211a4e97fdaec24dc8b90c85ddc198fac9ac200`，0.7.3，无Personal Fork或源码修改 |

任务书所称当前1.1.3与实际源码元数据不一致：`1e87dfa`的package.json和manifest.json均为**1.1.5**。本轮基于该实际提交实现，没有把1.1.2外部patch机械应用到新版。

隔离工作区重新获取远端24cc9c95；没有覆盖旧缓存工作区中的代码或既有插件修改。NAS当前代码、插件版本及备份状态仍未取证，不能将本表写成现网清单。

## 分支与安装方式

- 上游：`baibai-git/ST-BaiBai-Tools:main`。
- 个人Fork `main`：纯上游同步基线。
- 唯一个人部署分支：`personal/stable`。
- 安装URL：`https://github.com/SurgeXW0508/ST-BaiBai-Tools`。
- ST原生Branch/Tag字段：`personal/stable`。
- 安装后的当前分支：`personal/stable`；跟踪：`origin/personal/stable`。

日常Update沿当前分支更新，不需要反复切分支或重新安装。首次分支列表会对浅克隆取完整历史/远端分支，属于现有ST行为，本轮未修改。旧上游安装与Fork同名，后续正式迁移需要核对global/local范围、备份账户设置、替换旧代码目录并确认仅一份生效；本轮没有执行迁移。

不再把外部.patch作为正式部署、升级或主要维护方法。历史补丁仅保留过程证据，不能叠加到Personal Stable。

## Personal Policy与相对上游差异

唯一运行策略：**Save Generate不装配，适用于所有Provider。**

本轮相对上游main共10个文件：5个源码/UI文件、1个生产dist、package中的测试命令、1个新增策略测试、原测试中2个有意解除面板耦合的预期、1个简短AGENTS.md。总体499行增加/662行删除；dist包含压缩重命名产生的较大文本差异，不代表扩大业务范围。

| 修改 | 目的 |
| --- | --- |
| src/index.js | 移除Save Generate导入和无条件安装，保持其他装配顺序 |
| src/features/state.js | 默认false，既有true/缺省值归一false，撤销false→true迁移 |
| src/features/settingsPanel.js / baibaokuPanel.js / settings.html | 固定禁用并说明Personal Stable；面板不再导入/通知Save Generate |
| dist/index.js | 用当前锁定依赖和源码生成；没有手改 |
| scripts/test-personal-stable.mjs / package.json | 验证真实设置模块的旧值、迁移标记及重复初始化，保留无关设置 |
| scripts/test-generate-blacklist-retry.mjs | 2个面板通知用例改为验证不填充Save Generate状态、显式模块调用自行探测；未跳过用例 |
| AGENTS.md | 说明main/stable边界，链接唯一canonical规则，不复制能力矩阵 |

`saveGenerate.js`、`generateRetry.js`及其他功能实现保持上游原样，没有新依赖、Vertex分支判断或运行时Adapter。Save Generate安装/恢复函数未进入生产bundle，不能通过旧设置或UI误开启。原模块保留便于未来删除个人差异。

当前dist SHA-256：`40468da5a9d66ba3f18703a2e2e8ab7d9768d54769c9bc8c27567e0e3bebfbf9`。

## 本轮验证

| 验证 | 结果与边界 |
| --- | --- |
| npm ci --ignore-scripts / npm run build | 通过；连续两次生产构建dist哈希一致 |
| npm run test:personal-stable | 6通过；true/false/缺省值、迁移标记两态、再次初始化均关闭，并保持Generate Retry设置 |
| npm run test:generate-retry | 162通过，0跳过；原上游相邻模块测试，含Save Generate模块的隔离可调用性、重试/生命周期等 |
| 修改文件ESLint、git diff --check | 通过 |
| 真实生产bundle+完整ST+原版柏宝库 | 4项Chromium通过：旧设置归一与页面重载、Vertex SSE、Vertex JSON、custom受控单次重试 |
| 原生ST Extension Manager | 3项真实HTTP/Git通过，见下节 |

组合测试启动完整ST隔离实例，加载原版柏宝库（Bridge正常安装在独立host副本），其源码未修改；`enableServerPluginsAutoUpdate:false`防止测试时变化。Tools通过真实扩展发现与生产入口加载。其他可选优化关闭，以隔离本轮能力。

Vertex两种模式使用本机受控供应商和原生后端协议/网络路径，不只是在浏览器返回一个Mock响应。每次前端POST=1、上游模型请求=1，Save Generate请求=0；终态completed。代理URL由测试实际确认ST提示框，沿用原有origin允许列表与私网白名单，没有绕过或修改安全校验。

重试用例通过实际UI启用原有Generate Retry，仅对custom供应商验证一次503后成功：前端/上游恰好各2次请求，后台请求0。它证明相邻实现没有因删除Save Generate wrapper而失效，不决定Generate Retry的Vertex所有权，后者仍Pending Ownership Review。

旧enabled=true被归一false；保存合成账户设置并重载后仍false，复选框关闭且disabled。没有Save Generate全局状态、显示资源或后台请求。静态构建检查确认安装/恢复实现不在bundle中，因此并非安装后再检查开关。

环境Linux、Node24.22.1、Chromium153.0.8010.0、Playwright1.65.0、系统Git。测试仅使用合成临时数据、真实本地HTTP/Git和受控供应商，无Google凭据、真实Prompt、现网账户或NAS操作。

## 原生扩展安装与更新证据

测试使用未修改的`src/endpoints/extensions.js`实际路由、真实Express、Git克隆/分支/拉取：

1. 从真实GitHub Fork URL指定personal/stable安装，返回1.1.5；核对HEAD=2f6a9c54、当前分支personal/stable、upstream origin/personal/stable及origin URL。
2. Branches含origin/main和origin/personal/stable；使用原生Switch切main再切回stable；原生Update及Version后HEAD仍为个人提交、跟踪关系未变。
3. 在独立本地裸仓库和Git HTTP服务中同时推进main与stable，实际Update只取stable新commit、保持stable分支；再次Update不产生额外提交。测试提交从未推到GitHub。

这证明原生分支安装/更新能力；没有修改ST扩展安装逻辑。原版柏宝库可选扩展管理会接管部分原生路由，实际NAS若开启该功能需核对执行路径。本轮未调整它的配置或实现；单独的原生路由测试不等于所有柏宝接管路径已验收。

## 维护与后续升级

完整Owner Matrix、Disabled Features、Decision Log、安装迁移、上游同步、公开分支历史和回滚策略只维护在 [MAINTENANCE_COMPATIBILITY.md](MAINTENANCE_COMPATIBILITY.md)。Tools AGENTS.md仅链接该文档。

基本流程：先读canonical并核验版本 → 同步Fork main → 审查改变的Capability → 检查上游真Feature Off是否已成熟 → 删除或保留最小个人差异 → 在独立候选合入main → 构建与定向测试 → 隔离ST → 更新组合记录 → 经审查后快进personal/stable → 另行安排生产Update。

公开personal/stable不强推/改名/删除，确保现有安装可以快进。优先保留已验证版本，不因上游有新提交就更新。上游已经解决Feature Off后，优先删除本个人策略。

柏宝库继续固定原版commit，不为对称建立Fork。生产需防止ST和插件的静默自更新；目标commit/Owner Review/隔离验证完成后才升级。

## 自审与剩余限制

- Personal main与上游一致；个人策略只在stable，未额外改变其他功能或插件版本号。
- Core本轮仅文档变化，扩展安装逻辑和Vertex运行代码不变；柏宝库源代码不变。
- 原始模块保留、入口与状态通知解除，设置/UI表达一致；源码与dist一致；升级后需全页重载，不承诺旧页面热卸载。
- 真实Google、实际NAS版本/代理/运行时、生产安装范围与柏宝库扩展管理接管配置仍需验收。其他柏宝优化未重新评审。
- 同为1.1.5不能辨认个人构建；实际branch/commit和dist哈希才是版本证据。

本轮没有已知阻断当前已测组合的P1。停止开发，等待独立审查；随后再进入真实Google与隔离NAS阶段，不自行发布或部署。
