---
name: mi-note-export
description: 从小米云服务笔记批量导出 Markdown 文件，支持删除云端笔记。当用户提到"导出小米笔记"、"同步小米云笔记"、"备份小米笔记"、"删除小米笔记"、"mi-note-export"时触发此 skill。
---

# mi-note-export

从小米云服务（i.mi.com）批量导出笔记为 Markdown，支持增量同步和删除云端笔记。

## 使用

通过 `npx` 直接执行，无需提前安装：

```bash
npx mi-note-export                 # 增量同步
npx mi-note-export --force         # 全量重新同步
npx mi-note-export --login         # 强制重新登录
npx mi-note-export -o ./mi-notes   # 指定输出目录
npx mi-note-export --delete-id <noteId>        # 删除指定云端笔记（交互确认）
npx mi-note-export --delete-id <noteId> --yes  # 删除指定云端笔记（跳过确认）
```

> ⚠️ 首次执行时会自动下载工具及其依赖 Playwright Chromium（约 200+ MB），需提醒用户确认。

首次运行会自动打开 Chromium 浏览器，用户需手动登录小米账号，登录成功后自动提取 Cookie 并缓存。

## 删除笔记流程

删除操作会将笔记移到小米云服务的回收站（30 天内可恢复），**不是永久删除**。

### Agent 执行删除的约束

执行 `--delete-id` 前，**必须**向用户展示待删除笔记的标题、修改时间等详情，并获得用户明确确认后才可执行。笔记详情可从本地同步状态（`.mi-note-export/.sync-state.json`）、已导出的文件、或上下文中获取。

## 运行时数据

工具会在当前工作目录下创建 `.mi-note-export/` 目录，存放 Cookie 缓存、浏览器身份数据和同步状态。建议将该目录加入 `.gitignore`。

## 常见问题

| 问题 | 操作 |
|---|---|
| Cookie 过期 | 加 `--login` 重新登录 |
| Playwright 未安装 | `npx playwright install chromium` |
| 笔记内容不完整 | 加 `--force` 全量重新同步 |

## 限制

- 不支持私密笔记、待办事项和思维导图
- Cookie 有效期有限（通常数天），过期后需手动重新登录
- 空笔记（无标题且无内容）会被跳过
