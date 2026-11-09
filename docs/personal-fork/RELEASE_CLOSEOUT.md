# Phase C Release Closeout — 2026-11-09

**源码和正式发布侧完成；Phase C生产Closed待用户正式GHCR镜像验收。** 没有新的Runtime开发或生产NAS操作。

| 项目 | 实际结果 |
| --- | --- |
| Final Delta Audit | 通过；无新的P1/security/data correctness/Owner blocker，见[报告](FINAL_DELTA_AUDIT.md) |
| Merge | Stage `1af2180585e5bbe49159bc8884d5c890641f13c3`在behind 0、CI通过后快进合入release；没有squash丢失来源，也未改冻结Runtime |
| Official baseline | 独立`upstream/release@06bde939fb1e9c4c8d8641d810f0a916b5bce127`，官方仍是长期上游 |
| Tag / Release | [v1.19.0-personal.1](https://github.com/SurgeXW0508/SillyTavern/releases/tag/v1.19.0-personal.1)，固定source `1af2180585e5bbe49159bc8884d5c890641f13c3` |
| Frozen Runtime | `090cbba6d40e5d117ab41a9e6deb20b40e2dc336`，运行文件、Dockerfile和依赖未改 |
| Image | `ghcr.io/surgexw0508/sillytavern-personal:1.19.0-personal.1`，amd64/arm64 |
| Digest | `sha256:22973f7169fa694a0894b054e2b754ccf0ea881703d32a011e473c79c87ac740`；实际匿名manifest读取成功，无需为该公开镜像配置PAT |
| Tools | 验证Runtime `2f6a9c54d2c906b4a0e44d20c12d0712552e393d`；stable维护HEAD `ac1279a7535a424c3dc3b2f7a5b2913783fdf7e8`仅AGENTS链接，全部生产源码/dist Git树相同 |
| BaiBaoKu | 原版`b211a4e97fdaec24dc8b90c85ddc198fac9ac200`，0.7.3；未Fork/修改 |
| CI | [Personal Core CI](https://github.com/SurgeXW0508/SillyTavern/actions/runs/42593431772)通过，含Jest 411、Vertex 35、可靠性17、元数据13、核验4、Tools policy 6及lint |
| 发布验证 | [Personal Release](https://github.com/SurgeXW0508/SillyTavern/actions/runs/42593642846)全部job成功；正式镜像隔离启动health smoke通过；Release资产下载及SHA256SUMS逐项校验通过 |

## 唯一正式部署制品

[Validated Stack](https://github.com/SurgeXW0508/SillyTavern/releases/download/v1.19.0-personal.1/validated-stack.json)记录Tag、source SHA、Runtime SHA、digest、build date、上游、插件pin和验收范围。其余同Release资产为stack.env、只读verify-stack.py和SHA256SUMS。不要再以NAS临时clone/build、历史外部patch、浮动latest为长期来源。后续文档登记commit不等于镜像source commit，部署应读取固定Tag的资产。

NAS以后通过原Compose界面选择Release digest、pull/recreate、运行一次只读核验并做短smoke；操作入口与Current+Previous规则见[Operations](PERSONAL_RELEASE_OPERATIONS.md)。不建立新常驻部署服务，不让辅助工具获得插件或生成生命周期Owner。

## 尚需用户完成

- 提供当前Candidate Image ID、healthy/RestartCount、实际插件SHA；尚未提供的Swipe/Continue/工具/非Vertex结果如实标注，不能推定全部通过。
- 用正式GHCR镜像替换临时Candidate，保留原挂载/配置/网络，完成最终health与短smoke。
- 更新[Production Baseline](PRODUCTION_BASELINE.json)中的实际Current/Previous及验收结果，才登记Phase C生产正式Closed。
- 最后确认并清理具体临时clone/build source、中间Image及不再需要的Phase C目录备份；当前/Previous及官方1.19.0过渡rollback不得误删。旧官方镜像保留到下一次Personal Release成功，Backrest正常备份不是临时资产。

本轮没有SSH、没有更换NAS镜像、没有读取Prompt/秘密、没有删除生产数据或回滚资产。网络出口稳定性独立于Vertex Core correctness登记。
