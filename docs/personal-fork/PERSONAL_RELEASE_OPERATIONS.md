# Personal Release / NAS Operations

本文件定义发布和人工部署入口；Owner唯一来源仍为[canonical maintenance](MAINTENANCE_COMPATIBILITY.md)。最终差异结论见[Final Delta Audit](FINAL_DELTA_AUDIT.md)。

## 发布源与分支

- `upstream/release`：纯官方release同步基线，当前`06bde939fb1e9c4c8d8641d810f0a916b5bce127`。不放个人策略。
- `stage/...`：独立审查/测试候选。`release`：Personal正式稳定代码；不再把它当未修改官方镜像。
- `personal-release.json`：审查过的版本、上游基线、Runtime SHA、插件pin和已知验收范围。只有明确修改此发布清单并合入release才触发正式发布。
- 不同步SH分支；不得因参考Fork新增优化而改当前Freeze。

发布流程：Review → Stage → Personal Core CI通过/behind 0 → 合入release → Personal Release Actions → Git Tag + GHCR版本镜像 + Release资产 → 用户NAS部署。初次采用已验证Stage的fast-forward合入，保留原提交来源。官方机器人及npm发布workflow在Fork中不运行，不要求用户复制官方Bot Secret或配置npm凭据。

Personal Release在一个流水线中创建固定Tag、构建同一commit、推送GHCR、跑无凭据/无生产数据的镜像启动health smoke、生成资产并发布draft Release。GITHUB_TOKEN生成的Tag不会可靠触发第二条workflow，所以不依赖级联事件。只发布明确版本，不创建个人latest/浮动release镜像别名。已存在镜像版本拒绝覆盖；失败仅重跑失败job，成功的build不重建。已公开Release不覆盖其资产；需要变更重新出版本。

镜像支持linux/amd64与linux/arm64构建；本流水线启动smoke仅在原生amd64执行，不把arm64构建成功当成NAS实机验收。Dockerfile及Runtime未改；base仍为浮动`node:lts-alpine3.23`，因此运行部署固定本次实际digest，不能把同源码未来重建当字节相同镜像。

## Validated Stack唯一发行记录

每个GitHub Personal Release附带：

- `validated-stack.json`：Tag/source commit、冻结Runtime、官方baseline、版本镜像/digest/build date/Actions URL、Tools branch/pin/runtime tree指纹、原版BaiBaoKu pin、真实验收范围及缺失项。
- `stack.env`：唯一非秘密的`ST_IMAGE=ghcr.io/...@sha256:...`，供现有Compose使用。
- `verify-stack.py`：只读检查，不pull、不checkout、不重启、不修改数据。
- `SHA256SUMS`：上述文件的传输完整性校验；不是额外签名体系。

GitHub Release资产是该版本具体source SHA/digest的权威记录。仓库清单是构建输入，不在Git提交里伪造尚未产出的digest，也不在发布后为了填digest改同一个Tag。当前配置如有null，只说明证据未提供，不代表通过。正式Production Baseline需在用户GHCR镜像验收后登记其实际Image ID、容器状态与组件SHA；不能把Candidate报告冒充正式镜像验收。

Tools部署pin仍是已验证`2f6a9c54`；Closeout只把AGENTS canonical link改为release时，Personal stable HEAD会产生文档后继。核验器比较全部Git树（仅排除AGENTS.md），只有生产源码和dist完全相同时才接受该维护提交，并分别输出实际SHA和验证SHA。不得把其他source/config/build改动按“文档提交”豁免。

## NAS一次配置，以后用版本制品更新

无需在NAS clone ST或build。首次在已确认的原compose/stack中，将现有ST服务的image改为`${ST_IMAGE:?Select a validated Personal Release}`；保留既有挂载、端口、网络、proxy、user、重启/停止参数和healthcheck，移除该服务的自动build来源。将所选Release的stack.env作为该stack实际使用的环境文件，或在NAS界面image字段直接填写同一digest。不要把`.env`误当容器env_file；ST_IMAGE必须参与Compose变量替换。具体配置位置先根据实际NAS入口确认，不猜路径/服务名，不覆盖现有秘密环境文件。

以后每次：

1. 阅读目标Release及Validated Stack，对照当前/Previous和实际插件状态，确认受影响Owner与验收范围。
2. 下载固定Tag的资产并核验SHA256SUMS。下载路径由用户选择；不执行远端`curl | sh`。
3. 用NAS现有Compose界面替换版本/digest，执行pull与recreate；不要勾选源码build、全扩展更新、数据卷删除或latest跟踪。
4. 等待healthy，用核验入口核对digest/source/plugin SHA，然后做短smoke。成功后记录新Current和旧Previous。

可选的一次只读命令（主机已有Python3和Docker即可，无新常驻服务；否则用NAS界面/同样的Docker元数据人工核对）：

```bash
python3 verify-stack.py --stack validated-stack.json --config nas-paths.json
```

`nas-paths.json`仅保存首次确认的container、tools_directory、baibaoku_directory（容器内路径），不包含凭据。Candidate阶段可加`--phase candidate`，这只检查Runtime label，不宣称该镜像匹配正式digest。默认release模式同时要求镜像digest与release commit label匹配；不配置Docker HEALTHCHECK时额外执行镜像自带只读health probe。不要用标签/版本号替代digest和代码证据。

核验器还拒绝Core被bind mount遮盖、Tools错误origin/branch/tracking、dirty源码及BaiBaoKu SHA漂移。它不查询Prompt/秘密，不自动修复Git，不更改插件设置，也不能证明没有第二份插件安装；Save Generate off、Generate Retry off、版本自更新关闭、只有一份Tools仍需按UI确认。Extension Manager未使用则不必开启；如使用也不能在冻结验收中拉未来提交。

若GHCR包首次发布默认私有，需一次性将该Personal镜像包设为Public，或由用户在NAS安全配置read:packages认证；不把PAT写进Compose/聊天/命令参数。包的访问状态以实际匿名pull检查为准，不能因GitHub repo公开就宣称镜像可匿名拉取。

## Current + Previous回滚与清理

每次成功部署后只维护Current和上一个已验证Previous正式镜像（含其digest/Validated Stack及插件状态）。过渡期额外保留旧官方1.19.0 rollback image，直到下一次Personal Release成功后再按规则轮换。本轮没有删除镜像或NAS目录。

Runtime故障优先换回Previous镜像；前提是Tools/BaiBaoKu仍与Previous兼容且未漂移，必要时同时恢复旧插件代码/配置。不要因一次Core故障自动恢复旧聊天数据。数据正确性问题先停止写入、保存现场，核对影响后才使用数据备份；不盲目覆盖备份点后新增聊天。

只有Final Audit、Merge、Release、正式GHCR重部署及最终health/smoke都通过后，才清理：临时clone/build source、Candidate本地中间镜像、已不再需要的Phase C完整目录临时备份。先列出具体路径/Image ID并确认它们不属于Current/Previous/官方过渡rollback，不执行全局image prune，不用危险通配符删正式目录。Backrest正常备份不属于这些临时清理对象。

## 当前Closeout状态

代码与发布体系完成不等于整个Phase C生产Closed。合入、Tag/Release、GHCR与最终NAS验收分别登记：源码和产物结果由GitHub记录；真实NAS由用户提供Image ID、healthy/RestartCount、实际组件SHA、最终smoke后才能更新Production Baseline、允许清理并登记Phase C正式Closed。
