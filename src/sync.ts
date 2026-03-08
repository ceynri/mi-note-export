import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getAllNotes, getNoteDetail, downloadFile } from "./api.js";
import { parseNoteEntry, noteToMarkdown, getNoteFilePath } from "./converter.js";
import {
  randomDelay,
  ensureFileDir,
  fileExists,
  getSyncStateFile,
  ensureDir,
} from "./utils.js";
import type { RawNoteEntry, NoteFolder, SyncState } from "./types.js";

const SAVE_INTERVAL = 10;

/**
 * 执行笔记同步
 */
export async function syncNotes(
  cookie: string,
  outputDir: string,
  force = false,
): Promise<void> {
  // 加载同步状态
  const state = force ? createEmptyState() : await loadState(outputDir);

  if (state.lastSync && !force) {
    const noteCount = Object.keys(state.notes).length;
    console.log(
      `📂 检测到之前的同步记录 (${noteCount} 条笔记)，将进行增量更新`,
    );
  } else {
    console.log("📂 开始全量同步笔记...");
  }

  // 拉取笔记列表
  const { entries, folders } = await getAllNotes(cookie);

  // 确保输出目录存在
  await ensureDir(outputDir);
  await ensureDir(join(outputDir, "assets"));

  // 清理已删除的笔记
  const deletedCount = await cleanDeletedNotes(state, entries);
  if (deletedCount > 0) {
    console.log(`🗑️  清理了 ${deletedCount} 条已删除的笔记`);
  }

  // 筛选需要同步的笔记
  const toSync: RawNoteEntry[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const existing = state.notes[String(entry.id)];
    const isUpToDate =
      !force &&
      existing &&
      !existing.empty &&
      existing.modifyDate !== undefined &&
      entry.modifyDate !== undefined &&
      existing.modifyDate >= entry.modifyDate;

    if (isUpToDate) {
      skipped++;
    } else {
      toSync.push(entry);
    }
  }

  console.log(
    `📊 共 ${entries.length} 条笔记，待同步 ${toSync.length} 条，跳过 ${skipped} 条`,
  );

  if (toSync.length === 0) {
    console.log("✅ 所有笔记已是最新状态");
    return;
  }

  // 逐条同步
  let synced = 0;
  let failed = 0;
  let emptyCount = 0;

  for (let i = 0; i < toSync.length; i++) {
    const entry = toSync[i];
    const progress = (((i + 1) / toSync.length) * 100).toFixed(1);
    process.stdout.write(
      `\r⏳ 同步中... ${i + 1}/${toSync.length} (${progress}%)`,
    );

    try {
      // 获取笔记详情并转换为 Markdown
      const detail = await getNoteDetail(cookie, entry.id);
      const note = parseNoteEntry(detail);
      const markdown = noteToMarkdown(note);

      // 跳过空笔记
      if (!markdown.trim()) {
        emptyCount++;
        state.notes[note.id] = {
          id: note.id,
          subject: note.subject,
          modifyDate: note.modifyDate,
          filePath: null,
          empty: true,
        };
        continue;
      }

      // 计算保存路径
      const filePath = getNoteFilePath(note, folders, outputDir);

      // 删除旧文件（如果路径变了）
      const oldPath = state.notes[note.id]?.filePath;
      if (oldPath && oldPath !== filePath && (await fileExists(oldPath))) {
        await rm(oldPath, { force: true });
      }

      // 写入文件
      await ensureFileDir(filePath);
      await writeFile(filePath, markdown, "utf-8");

      // 下载附件
      for (const file of note.files) {
        const assetPath = join(outputDir, "assets", file.name);
        await downloadFile(cookie, file.fileId, assetPath);
      }

      // 更新状态
      state.notes[note.id] = {
        id: note.id,
        subject: note.subject,
        modifyDate: note.modifyDate,
        filePath,
      };

      synced++;

      // 定期保存状态
      if (synced % SAVE_INTERVAL === 0) {
        await saveState(state, outputDir);
      }

      // 请求间延时
      await randomDelay(400);
    } catch (err) {
      failed++;
      console.error(`\n❌ 同步失败 [${entry.id}]: ${(err as Error).message}`);
    }
  }

  // 保存最终状态
  state.lastSync = Date.now();
  state.folders = folders;
  await saveState(state, outputDir);

  console.log(`\n
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 同步完成报告
  总笔记数: ${entries.length}
  本次同步: ${synced}
  未修改:   ${skipped}
  空笔记:   ${emptyCount}
  失败:     ${failed}
  输出目录: ${outputDir}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

/**
 * 清理云端已删除的笔记
 */
async function cleanDeletedNotes(
  state: SyncState,
  entries: RawNoteEntry[],
): Promise<number> {
  const cloudIds = new Set(entries.map((e) => String(e.id)));
  let count = 0;

  for (const [id, noteState] of Object.entries(state.notes)) {
    if (!cloudIds.has(id)) {
      // 删除本地文件
      if (noteState.filePath && (await fileExists(noteState.filePath))) {
        await rm(noteState.filePath, { force: true });
      }
      delete state.notes[id];
      count++;
    }
  }

  return count;
}

/**
 * 加载同步状态
 */
export async function loadState(outputDir: string): Promise<SyncState> {
  const stateFile = getSyncStateFile(outputDir);
  if (!(await fileExists(stateFile))) {
    return createEmptyState();
  }
  try {
    const content = await readFile(stateFile, "utf-8");
    return JSON.parse(content) as SyncState;
  } catch {
    return createEmptyState();
  }
}

/**
 * 保存同步状态
 */
export async function saveState(state: SyncState, outputDir: string): Promise<void> {
  await ensureDir(outputDir);
  await writeFile(getSyncStateFile(outputDir), JSON.stringify(state, null, 2), "utf-8");
}

/**
 * 创建空状态
 */
function createEmptyState(): SyncState {
  return {
    notes: {},
    folders: {},
    lastSync: null,
  };
}

/**
 * 从同步状态中移除指定笔记，并删除对应的本地文件
 */
export async function removeNoteFromState(noteId: string, outputDir: string): Promise<void> {
  const state = await loadState(outputDir);
  const noteState = state.notes[noteId];

  if (noteState?.filePath && (await fileExists(noteState.filePath))) {
    await rm(noteState.filePath, { force: true });
  }

  delete state.notes[noteId];
  await saveState(state, outputDir);
}
