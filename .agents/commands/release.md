---
description: 提交代码、发布 NPM 包并推送到远端
---

按以下步骤执行完整发布流程，每步失败时立即停止并告知我。

1. **提交代码**：使用 `git-commit-helper` skill 完成代码提交，commit message 无需确认直接提交。如果工作区无变更则跳过此步。

2. **Bump 版本 → 构建 → 提交 tag**：读取 `package.json` 当前版本号，根据变更类型推荐 patch/minor/major 并向我确认。确认后依次执行以下操作，中间无需再次确认：
   - `npm version <type> --no-git-tag-version`
   - `pnpm build`（失败则终止）
   - `git add -A && git commit -m "chore: bump version to <version>" && git tag v<version>`

3. **发布并推送**：运行 `npm publish`，成功后自动执行 `git push && git push --tags`。
