#!/usr/bin/env node

import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { parseArgs, printHelp, getCacheDir, fileExists, loadConfigFile } from "./utils.js";
import { ensureCookie } from "./auth.js";
import { syncNotes, removeNoteFromState } from "./sync.js";
import { getNoteDetail, deleteNote } from "./api.js";
import { parseNoteEntry } from "./converter.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log(version);
    process.exit(0);
  }

  if (args.clearCache) {
    await handleClearCache(args.yes);
    process.exit(0);
  }

  console.log("🚀 小米云笔记导出工具\n");

  try {
    const cookie = await ensureCookie(args.login);
    const config = await loadConfigFile();
    const outputDir = args.output || config.output || "output";

    if (args.deleteId) {
      await handleDelete(cookie, args.deleteId, outputDir, args.yes);
    } else {
      await syncNotes(cookie, outputDir, args.force);
    }
  } catch (err) {
    const error = err as Error;
    console.error(`\n❌ 出错了: ${error.message}`);
    if (error.stack) {
      console.error(`\n${error.stack}`);
    }
    process.exit(1);
  }
}

async function handleDelete(
  cookie: string,
  noteId: string,
  outputDir: string,
  skipConfirm = false,
): Promise<void> {
  console.log(`🔍 正在获取笔记信息 (ID: ${noteId})...`);

  const raw = await getNoteDetail(cookie, noteId);
  const note = parseNoteEntry(raw);

  const modifyTime = note.modifyDate
    ? new Date(note.modifyDate).toLocaleString("zh-CN")
    : "未知";

  console.log(`
📝 笔记信息:
  标题:     ${note.subject || "(无标题)"}
  ID:       ${note.id}
  修改时间: ${modifyTime}
  附件数:   ${note.files.length}
`);

  if (!skipConfirm) {
    const confirmed = await confirm("确认要将该笔记移到回收站吗？(y/N) ");
    if (!confirmed) {
      console.log("已取消");
      return;
    }
  }

  console.log("🗑️  正在删除...");
  await deleteNote(cookie, noteId);
  await removeNoteFromState(noteId, outputDir);

  console.log("✅ 笔记已移到回收站（30 天内可在小米云服务中恢复）");
}

async function handleClearCache(skipConfirm = false): Promise<void> {
  const cacheDir = getCacheDir();

  if (!(await fileExists(cacheDir))) {
    console.log("ℹ️  缓存目录不存在，无需清理");
    return;
  }

  console.log(`📁 缓存目录: ${cacheDir}`);

  if (!skipConfirm) {
    const confirmed = await confirm("确认要清除所有缓存数据吗？(y/N) ");
    if (!confirmed) {
      console.log("已取消");
      return;
    }
  }

  await rm(cacheDir, { recursive: true, force: true });
  console.log("✅ 缓存已清除（下次运行需要重新登录）");
}

function confirm(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

main();
