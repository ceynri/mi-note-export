---
description: 提交代码、发布 NPM 包并推送到远端
---

按以下步骤执行完整发布流程：

1. **提交代码**：运行 `git status` 和 `git diff` 分析变更，生成规范的 commit message（遵循 Conventional Commits），向我确认后提交。如果变更涉及多个不相关主题，拆分为多个 commit。如果工作区无变更则跳过此步。

2. **Bump 版本**：读取 `package.json` 当前版本号，根据变更类型推荐 patch/minor/major，向我确认后执行 `npm version <type> --no-git-tag-version`。

3. **构建**：运行 `pnpm build`，失败则终止。

4. **提交版本号变更并打 tag**：`git add -A && git commit -m "chore: bump version to <version>" && git tag v<version>`。

5. **发布 NPM**：运行 `npm publish`（需要我确认）。

6. **推送远端**：运行 `git push && git push --tags`（需要我确认）。

每步失败时立即停止并告知我。
