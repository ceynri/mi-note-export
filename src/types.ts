/** 笔记 API 返回的原始条目 */
export interface RawNoteEntry {
  id: number | string;
  folderId?: number | string;
  subject?: string;
  content?: string;
  snippet?: string;
  createDate?: number;
  modifyDate?: number;
  tag?: string;
  extraInfo?: string | Record<string, unknown>;
  setting?: { data?: RawNoteFile[] };
  files?: RawNoteFile[];
}

/** 笔记附件原始数据 */
export interface RawNoteFile {
  rawId?: string;
  fileId?: string;
  digest?: string;
  mimeType?: string;
}

/** 解析后的笔记 */
export interface ParsedNote {
  id: string;
  folderId: string;
  subject: string;
  content: string;
  files: NoteFile[];
  createDate?: number;
  modifyDate?: number;
  contentType: string;
}

/** 解析后的附件信息 */
export interface NoteFile {
  rawId: string;
  name: string;
  id: string;
  type: string;
  suffix: string;
  fileId: string;
}

/** 文件夹信息 */
export interface NoteFolder {
  id: number | string;
  subject?: string;
}

/** 笔记列表 API 响应数据 */
export interface NoteListData {
  entries?: RawNoteEntry[];
  folders?: NoteFolder[];
  lastPage?: boolean;
  syncTag?: string;
}

/** 同步状态中的单条笔记记录 */
export interface SyncNoteState {
  id: string;
  subject: string;
  modifyDate?: number;
  filePath: string | null;
  empty?: boolean;
  contentHash?: string;
}

/** 同步状态 */
export interface SyncState {
  notes: Record<string, SyncNoteState>;
  folders: Record<string, NoteFolder>;
  lastSync: number | null;
  syncTag?: string;
}
