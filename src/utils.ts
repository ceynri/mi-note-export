import { mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir, platform } from "node:os";

const APP_NAME = "mi-note-export";

/**
 * 清理文件名中的非法字符
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/[.\s]+$/, "")
    .trim()
    .slice(0, 200);
}

/**
 * 延时函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带随机抖动的延时（模拟人类操作节奏）
 * @param baseMs 基准延时
 * @param jitterRatio 抖动比例（0~1），默认 0.5 即 ±50%
 */
export function randomDelay(baseMs: number, jitterRatio = 0.5): Promise<void> {
  const jitter = baseMs * jitterRatio * (2 * Math.random() - 1);
  return delay(Math.max(50, Math.round(baseMs + jitter)));
}

/**
 * 格式化日期为 YYYY-MM-DD_HH-mm-ss
 */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `${date}_${time}`;
}

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保文件所在目录存在
 */
export async function ensureFileDir(filePath: string): Promise<void> {
  await ensureDir(dirname(filePath));
}

/**
 * 获取全局缓存目录（跨平台）
 *
 * - macOS:   ~/Library/Caches/mi-note-export/
 * - Linux:   $XDG_CACHE_HOME/mi-note-export/ 或 ~/.cache/mi-note-export/
 * - Windows: %LOCALAPPDATA%/mi-note-export/cache/
 */
export function getCacheDir(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Caches", APP_NAME);
    case "win32":
      return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), APP_NAME, "cache");
    default:
      return join(process.env.XDG_CACHE_HOME || join(home, ".cache"), APP_NAME);
  }
}

/**
 * 获取同步状态文件路径（位于输出目录内）
 */
export function getSyncStateFile(outputDir: string): string {
  return join(outputDir, ".sync-state.json");
}

export interface CliArgs {
  help: boolean;
  version: boolean;
  force: boolean;
  output: string | null;
  login: boolean;
  deleteId: string | null;
  yes: boolean;
}

/**
 * 解析命令行参数
 */
export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = {
    help: false,
    version: false,
    force: false,
    output: null,
    login: false,
    deleteId: null,
    yes: false,
  };

  const knownFlags = new Set([
    "--help", "-h",
    "--version", "-v",
    "--force", "-f",
    "--output", "-o",
    "--login",
    "--delete-id",
    "--yes", "-y",
  ]);

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--version":
      case "-v":
        result.version = true;
        break;
      case "--force":
      case "-f":
        result.force = true;
        break;
      case "--output":
      case "-o":
        result.output = args[++i];
        break;
      case "--login":
        result.login = true;
        break;
      case "--delete-id":
        result.deleteId = args[++i];
        break;
      case "--yes":
      case "-y":
        result.yes = true;
        break;
      default:
        if (args[i].startsWith("-") && !knownFlags.has(args[i])) {
          console.warn(`⚠️ 未知参数: ${args[i]}`);
        }
        break;
    }
  }

  return result;
}

/**
 * 打印帮助信息
 */
export function printHelp(): void {
  console.log(`
小米云笔记导出工具

用法: mi-note [选项]

选项:
  -h, --help         显示帮助信息
  -v, --version      显示版本号
  -f, --force        强制重新同步所有笔记（忽略增量状态）
  -o, --output       指定输出目录（默认: ./output）
  --login            强制重新登录（忽略缓存的 Cookie）
  --delete-id <id>   删除指定 ID 的云端笔记（移到回收站）
  -y, --yes          跳过确认提示，直接执行
`);
}
