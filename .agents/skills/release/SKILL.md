---
name: release
description: 发布 NPM 包。当用户说"发布"、"发版"、"release"、"发 beta"时触发此 skill。
---

# Release

此 skill 用于发布 NPM 包，支持正式版和 beta 版。

## Workflow

### 1. 确认发布类型

读取 `package.json` 当前版本号，结合工作区变更判断推荐类型，向用户确认：

| 类型 | 说明 | 示例 |
|---|---|---|
| `patch` | 正式版补丁 | 0.1.9 → 0.1.10 |
| `minor` | 正式版次版本 | 0.1.9 → 0.2.0 |
| `major` | 正式版主版本 | 0.1.9 → 1.0.0 |
| `beta` | beta 版（自动判断首次/递增） | 0.1.9 → 0.1.10-beta.0，再次 → 0.1.10-beta.1 |

### 2. 执行发布

用户确认后，直接运行：

```bash
pnpm release <type>
```

脚本会自动完成：工作区检查 → 测试 → 编译 → 版本升级（含 git commit + tag）→ npm 发布 → 推送代码和 tag。

无需逐步确认，脚本内部已包含所有检查和错误处理。

## 注意事项

- `beta` 版发布到 npm 的 `beta` tag，不影响 `latest`
- 用户安装 beta 版需显式指定：`npm install <pkg>@beta`
- 脚本会在工作区有未提交变更时自动中止
