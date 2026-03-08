import { writeFile } from "node:fs/promises";
import { buildHeaders } from "./auth.js";
import { fileExists, ensureFileDir, delay, randomDelay } from "./utils.js";
import type { RawNoteEntry, NoteFolder, NoteListData } from "./types.js";

const API_BASE = "https://i.mi.com";

interface FetchPageOptions {
  limit?: number;
  syncTag?: string;
}

/**
 * 获取笔记列表（单页）
 */
async function fetchNotePage(
  cookie: string,
  { limit = 200, syncTag = "" }: FetchPageOptions = {},
): Promise<NoteListData> {
  const params = new URLSearchParams({
    ts: String(Date.now()),
    limit: String(limit),
  });
  if (syncTag) params.set("syncTag", syncTag);

  const url = `${API_BASE}/note/full/page/?${params}`;
  const resp = await fetchWithRetry(url, cookie);

  if (!resp) {
    throw new Error(
      "获取笔记列表失败。请检查 Cookie 是否有效（运行 --login 重新登录）",
    );
  }

  const json = (await resp.json()) as { result: string; data?: NoteListData };

  if (json.result !== "ok" || !json.data) {
    throw new Error(`API 返回异常: ${JSON.stringify(json)}`);
  }

  return json.data;
}

/**
 * 获取所有笔记列表（自动分页）
 */
export async function getAllNotes(
  cookie: string,
  limit = 200,
): Promise<{ entries: RawNoteEntry[]; folders: Record<string, NoteFolder> }> {
  let syncTag = "";
  const allEntries: RawNoteEntry[] = [];
  const allFolders: Record<string, NoteFolder> = {};

  while (true) {
    const data = await fetchNotePage(cookie, { limit, syncTag });

    const entries = data.entries ?? [];
    const folders = data.folders ?? [];

    allEntries.push(...entries);

    for (const folder of folders) {
      allFolders[String(folder.id)] = folder;
    }

    process.stdout.write(`\r📋 已获取 ${allEntries.length} 条笔记...`);

    if (data.lastPage) break;

    syncTag = data.syncTag ?? "";
    if (!syncTag) break;

    await randomDelay(300);
  }

  console.log(`\r📋 共获取 ${allEntries.length} 条笔记`);

  return { entries: allEntries, folders: allFolders };
}

/**
 * 获取笔记详情
 */
export async function getNoteDetail(
  cookie: string,
  noteId: number | string,
): Promise<RawNoteEntry> {
  const url = `${API_BASE}/note/note/${noteId}/?ts=${Date.now()}`;
  const resp = await fetchWithRetry(url, cookie);

  if (!resp) {
    throw new Error(`获取笔记详情失败: ${noteId}`);
  }

  const json = (await resp.json()) as {
    result: string;
    data?: { entry: RawNoteEntry };
  };

  if (json.result !== "ok" || !json.data?.entry) {
    throw new Error(`获取笔记详情异常: ${noteId}`);
  }

  return json.data.entry;
}

/**
 * 下载附件文件
 */
export async function downloadFile(
  cookie: string,
  fileId: string,
  savePath: string,
): Promise<void> {
  if (await fileExists(savePath)) return;

  const params = new URLSearchParams({
    type: "note_img",
    fileid: fileId,
    ts: String(Date.now()),
  });

  const url = `${API_BASE}/file/full?${params}`;

  try {
    const resp = await fetch(url, {
      headers: buildHeaders(cookie),
      redirect: "follow",
    });

    if (!resp.ok) {
      console.warn(`\n⚠️ 下载附件失败 (${resp.status}): ${fileId}`);
      return;
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    await ensureFileDir(savePath);
    await writeFile(savePath, buffer);
  } catch (err) {
    console.warn(
      `\n⚠️ 下载附件异常: ${fileId} - ${(err as Error).message}`,
    );
  }
}

/**
 * 带重试的 fetch 请求
 */
async function fetchWithRetry(
  url: string,
  cookie: string,
  retries = 1,
): Promise<Response | null> {
  try {
    const resp = await fetch(url, {
      headers: buildHeaders(cookie),
    });

    if (resp.status === 401 && retries > 0) {
      await delay(500);
      return fetchWithRetry(url, cookie, retries - 1);
    }

    if (!resp.ok) return null;
    return resp;
  } catch (err) {
    if (retries > 0) {
      await delay(500);
      return fetchWithRetry(url, cookie, retries - 1);
    }
    console.error(`\n❌ 网络请求失败: ${(err as Error).message}`);
    return null;
  }
}

/**
 * 从 cookie 字符串中提取 serviceToken
 */
function extractServiceToken(cookie: string): string {
  const match = cookie.match(/serviceToken=([^;]+)/);
  if (!match) {
    throw new Error("Cookie 中未找到 serviceToken，请重新登录（--login）");
  }
  return match[1];
}

/**
 * 删除云端笔记（移到回收站）
 */
export async function deleteNote(
  cookie: string,
  noteId: string,
): Promise<void> {
  const serviceToken = extractServiceToken(cookie);

  const url = `${API_BASE}/note/full/${noteId}/delete`;
  const body = new URLSearchParams({
    tag: noteId,
    purge: "false",
    serviceToken,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      ...buildHeaders(cookie),
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    throw new Error(`删除笔记请求失败 (HTTP ${resp.status})`);
  }

  const json = (await resp.json()) as {
    result: string;
    code: number;
    description: string;
  };

  if (json.result !== "ok") {
    throw new Error(`删除笔记失败: ${json.description ?? JSON.stringify(json)}`);
  }
}
