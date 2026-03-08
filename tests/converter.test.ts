import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { noteToMarkdown, parseNoteEntry } from "../src/converter.js";
import type { RawNoteEntry, ParsedNote } from "../src/types.js";

function makeParsedNote(content: string): ParsedNote {
  return {
    id: "1",
    folderId: "",
    subject: "test",
    content,
    files: [],
    createDate: 1700000000000,
    modifyDate: 1700000000000,
    contentType: "note",
  };
}

describe("noteToMarkdown - heading", () => {
  it("should convert size tag to h1", () => {
    const note = makeParsedNote("<text><size>标题</size></text>");
    assert.equal(noteToMarkdown(note), "# 标题");
  });

  it("should convert mid-size tag to h2", () => {
    const note = makeParsedNote("<text><mid-size>二级标题</mid-size></text>");
    assert.equal(noteToMarkdown(note), "## 二级标题");
  });

  it("should convert h3-size tag to h3", () => {
    const note = makeParsedNote("<text><h3-size>三级标题</h3-size></text>");
    assert.equal(noteToMarkdown(note), "### 三级标题");
  });
});

describe("noteToMarkdown - list items", () => {
  it("should convert bullet list", () => {
    const note = makeParsedNote("<bullet>项目一</bullet>\n<bullet>项目二</bullet>");
    assert.equal(noteToMarkdown(note), "- 项目一\n- 项目二");
  });

  it("should convert ordered list", () => {
    const note = makeParsedNote("<order>第一</order>\n<order>第二</order>");
    assert.equal(noteToMarkdown(note), "1. 第一\n1. 第二");
  });

  it("should convert indented bullet list", () => {
    const note = makeParsedNote('<bullet indent="1">一级</bullet>\n<bullet indent="2">二级</bullet>');
    assert.equal(noteToMarkdown(note), "- 一级\n  - 二级");
  });

  it("should convert checkbox unchecked", () => {
    const note = makeParsedNote('<input type="checkbox" checked="false" />待办');
    assert.equal(noteToMarkdown(note), "- [ ] 待办");
  });

  it("should convert checkbox checked", () => {
    const note = makeParsedNote('<input type="checkbox" checked="true" />已完成');
    assert.equal(noteToMarkdown(note), "- [x] 已完成");
  });

  it("should convert indented checkbox", () => {
    const note = makeParsedNote(
      '<input type="checkbox" checked="false" />父任务\n<input indent="2" type="checkbox" checked="false" />子任务',
    );
    assert.equal(noteToMarkdown(note), "- [ ] 父任务\n  - [ ] 子任务");
  });
});

describe("noteToMarkdown - block elements", () => {
  it("should convert hr", () => {
    const note = makeParsedNote("<hr />");
    assert.equal(noteToMarkdown(note), "---");
  });

  it("should convert quote", () => {
    const note = makeParsedNote("<quote>引用文本</quote>");
    assert.equal(noteToMarkdown(note), "> 引用文本");
  });

  it("should convert plain text", () => {
    const note = makeParsedNote("<text>普通文本</text>");
    assert.equal(noteToMarkdown(note), "普通文本");
  });

  it("should skip empty text tags", () => {
    const note = makeParsedNote("<text>  </text>");
    assert.equal(noteToMarkdown(note), "");
  });

  it("should convert align tag", () => {
    const note = makeParsedNote('<align align="center">居中文本</align>');
    assert.equal(noteToMarkdown(note), '<div align="center">居中文本</div>');
  });
});

describe("noteToMarkdown - inline styles", () => {
  it("should convert bold", () => {
    const note = makeParsedNote("<text><b>粗体</b></text>");
    assert.equal(noteToMarkdown(note), "**粗体**");
  });

  it("should convert italic", () => {
    const note = makeParsedNote("<text><i>斜体</i></text>");
    assert.equal(noteToMarkdown(note), "*斜体*");
  });

  it("should convert strikethrough", () => {
    const note = makeParsedNote("<text><delete>删除</delete></text>");
    assert.equal(noteToMarkdown(note), "~~删除~~");
  });

  it("should convert underline", () => {
    const note = makeParsedNote("<text><u>下划线</u></text>");
    assert.equal(noteToMarkdown(note), "<u>下划线</u>");
  });

  it("should convert inline heading tag to bold", () => {
    const note = makeParsedNote("<text>前文<size>标题</size>后文</text>");
    assert.equal(noteToMarkdown(note), "前文**标题**后文");
  });
});

describe("noteToMarkdown - blank line control", () => {
  it("should add blank line between paragraphs", () => {
    const note = makeParsedNote("<text>段落一</text>\n<text>段落二</text>");
    assert.equal(noteToMarkdown(note), "段落一\n\n段落二");
  });

  it("should not add blank line between same-type list items", () => {
    const note = makeParsedNote("<bullet>a</bullet>\n<bullet>b</bullet>");
    assert.equal(noteToMarkdown(note), "- a\n- b");
  });

  it("should add blank line between text and heading", () => {
    const note = makeParsedNote("<text>正文</text>\n<text><size>标题</size></text>");
    assert.equal(noteToMarkdown(note), "正文\n\n# 标题");
  });

  it("should add blank line between list and non-list", () => {
    const note = makeParsedNote("<bullet>列表</bullet>\n<text>正文</text>");
    assert.equal(noteToMarkdown(note), "- 列表\n\n正文");
  });
});

describe("noteToMarkdown - attachments", () => {
  it("should replace img tag with markdown image", () => {
    const note: ParsedNote = {
      ...makeParsedNote('<img id="abc123" />'),
      files: [{ rawId: "abc123", name: "img_test_abc12345.jpg", id: "abc123", type: "img", suffix: "jpg", fileId: "abc123" }],
    };
    assert.equal(noteToMarkdown(note), "![img_test_abc12345.jpg](assets/img_test_abc12345.jpg)");
  });

  it("should replace sound tag with markdown link", () => {
    const note: ParsedNote = {
      ...makeParsedNote('<sound id="def456" />'),
      files: [{ rawId: "def456", name: "audio_test_def45678.mp3", id: "def456", type: "audio", suffix: "mp3", fileId: "def456" }],
    };
    assert.equal(noteToMarkdown(note), "[🔊 audio_test_def45678.mp3](assets/audio_test_def45678.mp3)");
  });

  it("should replace video tag with markdown link", () => {
    const note: ParsedNote = {
      ...makeParsedNote('<video id="ghi789" />'),
      files: [{ rawId: "ghi789", name: "video_test_ghi78901.mp4", id: "ghi789", type: "video", suffix: "mp4", fileId: "ghi789" }],
    };
    assert.equal(noteToMarkdown(note), "[🎬 video_test_ghi78901.mp4](assets/video_test_ghi78901.mp4)");
  });
});

describe("parseNoteEntry", () => {
  it("should parse basic note entry", () => {
    const raw: RawNoteEntry = {
      id: 123,
      subject: "测试笔记",
      content: "<text>内容</text>",
      createDate: 1700000000000,
      modifyDate: 1700000000000,
    };
    const parsed = parseNoteEntry(raw);
    assert.equal(parsed.id, "123");
    assert.equal(parsed.subject, "测试笔记");
    assert.equal(parsed.contentType, "note");
  });

  it("should use createDate as subject when no subject", () => {
    const raw: RawNoteEntry = {
      id: 456,
      content: "<text>无标题</text>",
      createDate: 1700000000000,
    };
    const parsed = parseNoteEntry(raw);
    assert.ok(parsed.subject.includes("2023"));
  });

  it("should parse extraInfo title", () => {
    const raw: RawNoteEntry = {
      id: 789,
      extraInfo: JSON.stringify({ title: "来自extraInfo的标题" }),
      content: "",
    };
    const parsed = parseNoteEntry(raw);
    assert.equal(parsed.subject, "来自extraInfo的标题");
  });
});
