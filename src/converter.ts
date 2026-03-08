import { join } from "node:path";
import { formatDateTime, sanitizeFileName } from "./utils.js";
import type {
  RawNoteEntry,
  ParsedNote,
  NoteFile,
  NoteFolder,
} from "./types.js";

interface ParsedLine {
  type: string;
  text: string;
}

/** MIME 类型分类映射 */
const MIME_CATEGORY_MAP: Record<string, { type: string; defaultSuffix: string }> = {
  image: { type: "img", defaultSuffix: "jpg" },
  audio: { type: "audio", defaultSuffix: "mp3" },
  video: { type: "video", defaultSuffix: "mp4" },
};

/** 媒体标签到 Markdown 格式的映射 */
const MEDIA_TAG_FORMATS: { tag: string; format: (name: string, path: string) => string }[] = [
  { tag: "img", format: (name, path) => `![${name}](${path})` },
  { tag: "sound", format: (name, path) => `[🔊 ${name}](${path})` },
  { tag: "video", format: (name, path) => `[🎬 ${name}](${path})` },
];

/** 标题标签到 Markdown 标记的映射（含预编译正则） */
const HEADING_TAGS: {
  tag: string;
  prefix: string;
  matchRegex: RegExp;
  inlineRegex: RegExp;
}[] = [
  { tag: "size", prefix: "#" },
  { tag: "mid-size", prefix: "##" },
  { tag: "h3-size", prefix: "###" },
].map(({ tag, prefix }) => ({
  tag,
  prefix,
  matchRegex: new RegExp(`^<${tag}>([\\s\\S]*?)</${tag}>$`),
  inlineRegex: new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"),
}));

const LIST_TYPES = ["checkbox", "bullet", "order"];

/**
 * 解析笔记原始数据，规范化字段
 */
export function parseNoteEntry(note: RawNoteEntry): ParsedNote {
  const id = String(note.id);
  const folderId = String(note.folderId || "");

  const extraInfo = parseExtraInfo(note.extraInfo);

  let content = note.content || note.snippet || "";
  if (extraInfo.mind_content) {
    content = extraInfo.mind_content as string;
  }

  let subject = (extraInfo.title as string) || note.subject || "";
  if (!subject) {
    subject = formatDateTime(note.createDate || Date.now());
  }
  subject = sanitizeFileName(subject);

  const files = parseNoteFiles(note);

  return {
    id,
    folderId,
    subject,
    content,
    files,
    createDate: note.createDate,
    modifyDate: note.modifyDate,
    contentType: (extraInfo.contentType as string) || "note",
  };
}

/**
 * 解析 extraInfo 字段（可能是 JSON 字符串或对象）
 */
function parseExtraInfo(
  raw: string | Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 解析笔记附件文件列表
 */
function parseNoteFiles(note: RawNoteEntry): NoteFile[] {
  const rawFiles = note.setting?.data || note.files || [];
  if (!Array.isArray(rawFiles)) return [];

  return rawFiles.map((file) => {
    const rawId = file.rawId || file.fileId || file.digest || "";
    const mimeType = file.mimeType || "";
    // rawId 格式如 "59943385.9SALxthhIbQQm5IyAhhK_g"，取 . 后的部分作为 ID
    const dotIndex = rawId.indexOf(".");
    const id = dotIndex >= 0 ? rawId.slice(dotIndex + 1) : rawId;

    const { type, suffix } = inferFileType(mimeType);
    const dateStr = formatDateTime(note.createDate || Date.now());
    const name = `${type}_${dateStr}_${id.slice(-8)}.${suffix}`;

    return { rawId, name, id, type, suffix, fileId: rawId };
  });
}

/**
 * 从 MIME 类型推断文件分类和后缀
 */
function inferFileType(mimeType: string): { type: string; suffix: string } {
  const [category, subtype] = mimeType.split("/");
  const mapping = MIME_CATEGORY_MAP[category];
  if (!mapping) return { type: "file", suffix: "bin" };

  let suffix = subtype || mapping.defaultSuffix;
  if (suffix === "jpeg") suffix = "jpg";
  return { type: mapping.type, suffix };
}

/**
 * 将笔记内容转换为 Markdown（逐行解析）
 */
export function noteToMarkdown(note: ParsedNote): string {
  let content = note.content || "";
  const files = note.files || [];

  // 预处理：替换附件标记
  content = replaceAttachments(content, files);

  // 移除格式标记
  content = content.replace(/<new-format\s*\/>/g, "");

  // 逐行解析
  const lines = content.split("\n");
  const mdLines: string[] = [];
  let prevLineType = ""; // 追踪上一行类型，用于空行控制

  for (const line of lines) {
    const parsed = parseLine(line.trim());
    if (parsed === null) continue; // 跳过空的 <text> 行

    // 在段落文本和非段落元素之间插入空行
    if (mdLines.length > 0 && needsBlankLine(prevLineType, parsed.type)) {
      mdLines.push("");
    }

    mdLines.push(parsed.text);
    prevLineType = parsed.type;
  }

  // 后处理：合并连续空行
  let result = mdLines.join("\n");
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * 判断两行之间是否需要插入空行
 */
function needsBlankLine(prevType: string, currType: string): boolean {
  if (!prevType) return false;

  // 同类列表项之间不加空行
  if (prevType === currType && LIST_TYPES.includes(currType)) return false;

  // 段落与段落之间加空行
  if (prevType === "text" && currType === "text") return true;

  // 标题、分割线、引用块前后加空行
  const blockTypes = ["heading", "hr", "quote"];
  if (blockTypes.includes(currType) || blockTypes.includes(prevType)) return true;

  // 列表与非列表之间加空行
  if (LIST_TYPES.includes(prevType) !== LIST_TYPES.includes(currType)) return true;

  return false;
}

/**
 * 解析单行内容，返回 { type, text } 或 null（跳过该行）
 */
function parseLine(line: string): ParsedLine | null {
  if (!line) return { type: "blank", text: "" };

  // 分割线
  if (/^<hr\s*\/>$/.test(line)) {
    return { type: "hr", text: "---" };
  }

  // 复选框：<input type="checkbox" ...属性... />文本
  const checkboxMatch = line.match(
    /^<input\s+([^>]*?)type="checkbox"([^>]*?)\s*\/>(.*)$/,
  );
  if (checkboxMatch) {
    const attrs = checkboxMatch[1] + checkboxMatch[2];
    const indentMatch = attrs.match(/indent="(\d+)"/);
    const checkedMatch = attrs.match(/checked="(true|false)"/);
    const indent = getIndentLevel(indentMatch?.[1]);
    const checked = checkedMatch?.[1] === "true";
    const text = convertInlineStyles(checkboxMatch[3].trim());
    const spaces = "  ".repeat(indent);
    return {
      type: "checkbox",
      text: `${spaces}- [${checked ? "x" : " "}] ${text}`,
    };
  }

  // 有序列表：<order indent="N">文本</order>
  const orderMatch = line.match(
    /^<order(?:\s+indent="(\d+)")?\s*>([\s\S]*?)<\/order>$/,
  );
  if (orderMatch) {
    return formatListItem("order", "1.", orderMatch[1], orderMatch[2]);
  }

  // 无序列表：<bullet indent="N">文本</bullet>
  const bulletMatch = line.match(
    /^<bullet(?:\s+indent="(\d+)")?\s*>([\s\S]*?)<\/bullet>$/,
  );
  if (bulletMatch) {
    return formatListItem("bullet", "-", bulletMatch[1], bulletMatch[2]);
  }

  // 引用块：<quote>文本</quote>
  const quoteMatch = line.match(/^<quote>([\s\S]*?)<\/quote>$/);
  if (quoteMatch) {
    const text = convertInlineStyles(quoteMatch[1].trim());
    return { type: "quote", text: `> ${text}` };
  }

  // 文本行：<text indent="N">内容</text>
  const textMatch = line.match(
    /^<text(?:\s+indent="(\d+)")?\s*>([\s\S]*?)<\/text>$/,
  );
  if (textMatch) {
    const innerContent = textMatch[2];

    // 空的 <text> 行 → 空行
    if (!innerContent.trim()) {
      return { type: "blank", text: "" };
    }

    // 检查内部是否包含标题标签
    const headingResult = tryParseHeading(innerContent);
    if (headingResult) return headingResult;

    // 普通文本行
    return { type: "text", text: convertInlineStyles(innerContent.trim()) };
  }

  // 对齐：<align align="center">文本</align>
  const alignMatch = line.match(
    /^<align\s+align="(center|left|right)">([\s\S]*?)<\/align>$/,
  );
  if (alignMatch) {
    const text = convertInlineStyles(alignMatch[2].trim());
    return {
      type: "text",
      text: `<div align="${alignMatch[1]}">${text}</div>`,
    };
  }

  // 旧式附件标记残留（☺ 后跟 fileId）
  if (/^☺\s/.test(line)) {
    return null; // 已在预处理中替换，残留的直接跳过
  }

  // 无法识别的行，保留原样但去掉未知标签
  const cleaned = convertInlineStyles(line).replace(/<[^>]+>/g, "").trim();
  return cleaned ? { type: "text", text: cleaned } : null;
}

/**
 * 格式化列表项
 */
function formatListItem(
  type: string,
  marker: string,
  indentStr: string | undefined,
  content: string,
): ParsedLine {
  const indent = getIndentLevel(indentStr);
  const text = convertInlineStyles(content.trim());
  const spaces = "  ".repeat(indent);
  return { type, text: `${spaces}${marker} ${text}` };
}

/**
 * 尝试从内容中解析标题标签
 */
function tryParseHeading(content: string): ParsedLine | null {
  const trimmed = content.trim();

  for (const { prefix, matchRegex } of HEADING_TAGS) {
    const match = trimmed.match(matchRegex);
    if (match) {
      return {
        type: "heading",
        text: `${prefix} ${convertInlineStyles(match[1].trim())}`,
      };
    }
  }

  return null;
}

/**
 * 转换行内样式标签为 Markdown
 */
function convertInlineStyles(text: string): string {
  if (!text) return "";

  // 粗体
  text = text.replace(/<b>([\s\S]*?)<\/b>/g, "**$1**");
  // 斜体
  text = text.replace(/<i>([\s\S]*?)<\/i>/g, "*$1*");
  // 删除线
  text = text.replace(/<delete>([\s\S]*?)<\/delete>/g, "~~$1~~");
  // 下划线（Markdown 不原生支持，保留 HTML）
  text = text.replace(/<u>([\s\S]*?)<\/u>/g, "<u>$1</u>");
  // 背景色
  text = text.replace(
    /<background\s+color="([^"]+)">([\s\S]*?)<\/background>/g,
    (_: string, color: string, inner: string) => {
      const rgb = bgrToRgb(color);
      return `<mark style="background:${rgb}">${inner}</mark>`;
    },
  );
  // 行内标题标签（非独占一行时，当作粗体处理）
  for (const { inlineRegex } of HEADING_TAGS) {
    text = text.replace(inlineRegex, "**$1**");
  }

  return text;
}

/**
 * 获取缩进层级（indent="1" 是默认级别，不额外缩进）
 */
function getIndentLevel(indentStr: string | undefined): number {
  const n = Number(indentStr || 0);
  return Math.max(0, n - 1); // indent="1" → 0 级缩进，indent="2" → 1 级
}

/**
 * 预处理：替换附件标记为 Markdown 格式
 */
function replaceAttachments(content: string, files: NoteFile[]): string {
  for (const file of files) {
    const assetPath = `assets/${file.name}`;
    const escapedId = escapeRegex(file.rawId);
    const imgMd = `![${file.name}](${assetPath})`;

    // 替换 <img>/<sound>/<video> 标签
    for (const { tag, format } of MEDIA_TAG_FORMATS) {
      const regex = new RegExp(
        `<${tag}\\s+[^>]*(?:id|data)="[^"]*${escapedId}[^"]*"[^>]*/>`,
        "g",
      );
      content = content.replace(regex, format(file.name, assetPath));
    }

    // 旧式标记 ☺ fileID<数字/></>
    content = content.replace(
      new RegExp(`☺\\s*${escapedId}<[^>]*></>`, "g"),
      imgMd,
    );
    // 旧式标记（无尾部标签）
    content = content.replace(
      new RegExp(`☺\\s*${escapedId}(?!<)`, "g"),
      imgMd,
    );
  }

  return content;
}

/**
 * 获取笔记的文件保存路径
 */
export function getNoteFilePath(
  note: ParsedNote,
  folders: Record<string, NoteFolder>,
  outputDir: string,
): string {
  const folder = note.folderId ? folders[note.folderId] : undefined;
  const folderName = folder ? sanitizeFileName(folder.subject || "") : "";
  const fileName = `${note.subject}.md`;

  if (folderName) {
    return join(outputDir, folderName, fileName);
  }
  return join(outputDir, fileName);
}

/**
 * BGR 颜色转 RGB
 */
function bgrToRgb(bgrColor: string): string {
  if (!bgrColor || bgrColor.length < 6) return bgrColor;
  const hex = bgrColor.replace("#", "");
  const b = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const r = hex.slice(4, 6);
  return `#${r}${g}${b}`;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
