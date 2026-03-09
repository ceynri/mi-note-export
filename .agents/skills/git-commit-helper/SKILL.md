---
name: git-commit-helper
description: 根据 git diff 内容自动生成规范的 commit message。当用户请求生成 commit 信息、提交代码、或需要帮助编写 commit message 时，应使用此 skill。
---

# Git Commit Helper

此 skill 用于分析 git 工作区的修改内容，自动生成符合规范的 commit message，并在用户确认后执行 git commit。

## Workflow

### 1. 获取修改信息

```bash
# 查看已暂存和未暂存的文件变更
git status

# 查看具体的代码差异（未暂存）
git diff

# 查看已暂存的代码差异
git diff --cached
```

### 2. 分析修改内容

根据 diff 内容分析：
- 修改涉及的模块/功能
- 修改的类型（新增功能、修复 bug、重构、样式调整等）
- 修改的具体内容和影响范围

### 3. 生成 Commit Message

遵循以下格式：

```
<type>(<scope>): <subject>

<body>
```

#### Type 类型

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响代码运行） |
| `refactor` | 重构（非新功能、非 bug 修复） |
| `perf` | 性能优化 |
| `test` | 增加测试 |
| `chore` | 构建过程或辅助工具变动 |
| `revert` | 回滚 |

#### Scope

修改涉及的模块名称，如 `invoice`、`funds`、`components`、`utils`

#### Subject

- 使用中文描述
- 简明扼要，不超过 50 个字符
- 以动词开头，如"新增"、"修复"、"优化"、"调整"

#### Body（可选）

- 详细描述修改内容
- 说明修改原因
- 列出主要变更点

### 4. 展示并确认

```
📝 建议的 commit message：

---
<生成的 commit message>
---

请确认是否使用此 commit message 进行提交？
- 输入 "ok" 或 "确认" 执行提交
- 输入修改建议，我会重新生成
- 输入 "取消" 放弃提交
```

### 5. 执行提交

用户确认后：

```bash
# 暂存所有修改（如有未暂存的）
git add -A

# 执行提交
git commit -m "<commit message>"
```

## 输出示例

**场景**：用户修改了发票相关的常量和组件文件

```
📝 建议的 commit message：

---
feat(invoice): 新增发票详情退票信息展示

- 在发票详情弹窗中新增退票原因和退票说明字段
- 新增退票原因类型映射常量 RefundReasonTypeMap
- 优化发票状态相关的常量定义
---

请确认是否使用此 commit message 进行提交？
```

## Notes

- 分析 diff 时关注实际的业务逻辑变更，忽略格式化、空行等无关紧要的变化
- commit message 应能让其他开发者快速理解本次修改的目的和内容

### 分批提交

当工作区的修改涉及多个不相关的功能或主题时，应主动将它们拆分为多个独立的 commit，而非合并为一个大提交。

操作方式：

1. 分析所有变更，按逻辑主题分组（如：重构、文档更新、新增功能各一组）
2. 每组通过 `git add <files>` 精确暂存对应文件，然后单独 commit
3. 全部提交完成后统一推送

分组原则：

- 同一功能/目的的文件变更归为一组
- 重构、文档、配置、新功能等不同类型的变更应分开
- 如果用户明确要求分批提交，必须按此方式执行
