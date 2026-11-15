# Qure-Style-PNG

**Qure 风格 256×256 PNG 图标集**，由上游 SVG 自动转换生成，透明背景，保留 `common/` 与 `flag/` 分类。适用于仅支持 PNG 图标链接的客户端。

- 图标清单：[`Other/Qure-Style-PNG.json`](Other/Qure-Style-PNG.json)
- PNG：[`icon/png/`](icon/png/)
- 原始 SVG、逐项许可与来源记录：[`upstream/`](upstream/)
- 上游同步状态、提交号及每个图标的 SHA-256：[`sync-state.json`](sync-state.json)

## 更新与转换

GitHub Actions 每 24 小时检查一次（每天北京时间 08:17，UTC 00:17；实际触发可能延迟） `aaANDkk/Qure_Style_SVG` 的 `main` 分支，也支持手动运行。SVG 发生变化后，以固定版本的 `resvg` 转成 256×256 PNG，校验 PNG 签名/尺寸/哈希后，仅提交发生变化的内容。新增、修改、删除的图标都会同步。Actions 无须额外 PAT/Secrets。

本项目自身的同步代码、依赖锁文件或状态文件提交会触发一次同步校准；PNG 与上游均无变化时不会产生同步空提交。

### 定时工作流保活

GitHub 对连续 60 天没有仓库活动的公开仓库，会自动禁用定时工作流。为提前产生实际仓库活动，每次定时或手动运行结束后，独立保活任务会重新读取 `main` 的最新提交时间；只有连续 **45 天没有提交**，才更新 `.github/keepalive` 中的 UTC 时间并提交一次。平时跳过，不产生每日空提交，也不修改图标。正常同步或人工提交会自然推迟下次保活。

保活任务即使在图标同步失败后也会尝试运行，仅使用内置 `GITHUB_TOKEN` 的 `contents: write` 权限，无需新增 Secrets。它不依赖未经官方保证可刷新闲置计时的 workflow `enable` API。45 天阈值留有约 15 天余量，但不保证在 GitHub 故障、权限被撤销或定时工作流已被禁用时仍能运行；已停用时仍需在 Actions 页面手动恢复。保活提交本身不会触发新一轮同步。

## 许可与归属

PNG 是上游 SVG 的格式转换副本，转换**不改变也不授予**原有素材的权利或许可。本仓库为便于使用而同步上游所保留的来源说明和许可文本；各图标按各自来源许可使用，不对整个集合施加单一许可。部分素材包含第三方品牌/商标；上游说明部分 Qure 风格参考及重绘内容限学习交流、不用于商业盈利。使用者须自行核对 [`upstream/THIRD_PARTY_NOTICES.md`](upstream/THIRD_PARTY_NOTICES.md) 和 [`upstream/licenses/`](upstream/licenses/)，遵循所有适用的署名、非商业、GPL 等条款与当地法律。

上游：[aaANDkk/Qure_Style_SVG](https://github.com/aaANDkk/Qure_Style_SVG) · 作者：aaANDkk。Qure 风格来源/参考：[Koolson/Qure](https://github.com/Koolson/Qure)。本仓库与上述项目及品牌权利人无关联或背书关系。
