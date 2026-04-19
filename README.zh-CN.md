[English](./README.md) | 简体中文

# mi-note-export

从小米云服务笔记（i.mi.com）批量导出所有笔记为 Markdown 文件。

## 功能

- 自动拉取全部笔记并转换为 Markdown
- 保留标题、列表、复选框、引用、分割线等格式
- 下载图片、音频、视频等附件
- **基于内容哈希的增量同步**（仅拉取内容有变动的笔记，即使本地文件被移走也不会重复导出）
- 自动清理云端已删除的笔记
- 删除指定云端笔记（移到回收站）
- 按文件夹分目录存放
- Cookie 缓存 + 浏览器身份持久化，减少重复登录

## AI Skill

本项目提供了 AI 编程助手的 Skill 定义文件，可让 AI 助手直接帮你执行笔记导出操作：

```bash
npx skills add ceynri/mi-note-export
```

也可手动将 `skills/mi-note-export/SKILL.md` 复制到你的项目的 Skill 目录中。

## 安装

全局安装：

```bash
npm install -g mi-note-export
```

或安装为项目开发依赖：

```bash
npm install -D mi-note-export
```

> 安装时会自动下载 Playwright Chromium（约 200+ MB）。如果自动安装失败，可手动执行 `npx playwright install chromium`。

## 使用

```bash
mi-note              # 增量同步
mi-note --force      # 全量重新同步
mi-note -o ./notes   # 指定输出目录
```

也可以不安装，通过 `npx` 直接运行：

```bash
npx mi-note-export
```

## 选项

| 选项 | 说明 |
|---|---|
| `-h, --help` | 显示帮助信息 |
| `-f, --force` | 全量重新同步（忽略增量状态） |
| `-o, --output <dir>` | 指定输出目录（默认读取 `.mi-note-export.json`，否则 `output`） |
| `--login` | 强制重新登录（忽略缓存的 Cookie） |
| `--delete-id <id>` | 删除指定 ID 的云端笔记（移到回收站，30 天内可恢复） |
| `--clear-cache` | 清除系统缓存目录（Cookie 和浏览器数据） |
| `-y, --yes` | 跳过确认提示，直接执行 |
| `-v, --version` | 显示版本号 |

## 认证流程

1. **首次运行**：通过 Playwright 打开 Chromium 浏览器 → 用户手动登录小米账号 → 自动提取并缓存 Cookie
2. **后续运行**：读取缓存的 Cookie → 验证有效性 → 有效则直接使用，过期则自动打开浏览器重新登录

浏览器身份数据持久化在系统缓存目录（见下方"数据目录"说明），后续登录时小米会识别为同一设备，通常不再要求手机验证码。

## 输出结构

```
output/
├── assets/              # 附件（图片、音频等）
├── 文件夹名/            # 笔记所属文件夹（如有）
│   └── 笔记标题.md
├── 笔记标题.md          # 有标题的笔记
└── 2025-01-01_12-00-00.md  # 无标题笔记，以创建时间命名
```

## 配置文件

可以在当前工作目录下创建 `.mi-note-export.json` 文件，避免每次都指定 `-o`：

```json
{ "output": "./my-notes" }
```

输出目录优先级：`-o` 命令行参数 > `.mi-note-export.json` > 默认值 `output`。

## 数据目录

### 系统缓存目录

Cookie 和 Playwright 浏览器持久化数据存放在系统缓存目录中：

- **macOS**: `~/Library/Caches/mi-note-export/`
- **Linux**: `$XDG_CACHE_HOME/mi-note-export/` 或 `~/.cache/mi-note-export/`
- **Windows**: `%LOCALAPPDATA%/mi-note-export/cache/`

包含：

- `cookie` — 缓存的登录 Cookie
- `browser-data/` — Playwright 浏览器持久化数据（保留设备身份，减少重复验证）

### 输出目录

增量同步状态文件存放在输出目录内：

- `<output>/.sync-state.json` — 记录已同步笔记、修改时间和内容哈希（用于判断内容是否变动）

## 已知限制

- 不支持私密笔记、待办事项和思维导图
- Cookie 有效期有限（通常数天），过期后需重新登录
- 空笔记（无标题且无内容）会被自动跳过

## 开发

```bash
pnpm install       # 安装依赖
pnpm build         # 编译 TypeScript
pnpm dev           # 监听模式编译
pnpm start         # 运行
```

## 项目结构

```
mi-note-export/
├── src/
│   ├── cli.ts        # CLI 入口
│   ├── auth.ts       # Cookie 获取、缓存、验证
│   ├── api.ts        # 小米云笔记 API 封装
│   ├── converter.ts  # 笔记内容解析与 Markdown 转换
│   ├── sync.ts       # 增量同步逻辑与状态管理
│   ├── types.ts      # 类型定义
│   └── utils.ts      # 通用工具函数
├── .agents/          # AI 编程助手配置（rules/agents）
├── skills/           # AI Skill 发布源（供 npx skills add 安装）
├── dist/             # 编译产物（git ignored）
├── tsconfig.json
└── package.json
```

## License

MIT
