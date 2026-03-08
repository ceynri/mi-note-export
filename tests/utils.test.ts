import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFileName, formatDateTime, parseArgs, loadConfigFile } from "../src/utils.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("sanitizeFileName", () => {
  it("should replace illegal characters", () => {
    assert.equal(sanitizeFileName('file<>:"/\\|?*name'), "file_________name");
  });

  it("should collapse multiple spaces", () => {
    assert.equal(sanitizeFileName("hello   world"), "hello world");
  });

  it("should truncate to 200 chars", () => {
    const long = "a".repeat(300);
    assert.equal(sanitizeFileName(long).length, 200);
  });

  it("should remove leading dots", () => {
    assert.equal(sanitizeFileName("...hidden"), "hidden");
  });

  it("should remove trailing dots", () => {
    assert.equal(sanitizeFileName("file..."), "file");
  });

  it("should remove trailing spaces", () => {
    assert.equal(sanitizeFileName("file   "), "file");
  });

  it("should handle mixed edge cases", () => {
    assert.equal(sanitizeFileName("..file name.."), "file name");
  });
});

describe("formatDateTime", () => {
  it("should format timestamp correctly", () => {
    const ts = new Date(2025, 0, 15, 8, 30, 45).getTime();
    assert.equal(formatDateTime(ts), "2025-01-15_08-30-45");
  });

  it("should pad single digit values", () => {
    const ts = new Date(2025, 0, 1, 1, 2, 3).getTime();
    assert.equal(formatDateTime(ts), "2025-01-01_01-02-03");
  });
});

describe("parseArgs", () => {
  it("should parse --help", () => {
    const args = parseArgs(["node", "cli", "--help"]);
    assert.equal(args.help, true);
  });

  it("should parse -h", () => {
    const args = parseArgs(["node", "cli", "-h"]);
    assert.equal(args.help, true);
  });

  it("should parse --version", () => {
    const args = parseArgs(["node", "cli", "--version"]);
    assert.equal(args.version, true);
  });

  it("should parse -v", () => {
    const args = parseArgs(["node", "cli", "-v"]);
    assert.equal(args.version, true);
  });

  it("should parse --force", () => {
    const args = parseArgs(["node", "cli", "--force"]);
    assert.equal(args.force, true);
  });

  it("should parse --output with value", () => {
    const args = parseArgs(["node", "cli", "--output", "./notes"]);
    assert.equal(args.output, "./notes");
  });

  it("should parse -o with value", () => {
    const args = parseArgs(["node", "cli", "-o", "./notes"]);
    assert.equal(args.output, "./notes");
  });

  it("should parse --login", () => {
    const args = parseArgs(["node", "cli", "--login"]);
    assert.equal(args.login, true);
  });

  it("should parse --delete-id with value", () => {
    const args = parseArgs(["node", "cli", "--delete-id", "123"]);
    assert.equal(args.deleteId, "123");
  });

  it("should parse --yes", () => {
    const args = parseArgs(["node", "cli", "--yes"]);
    assert.equal(args.yes, true);
  });

  it("should parse -y", () => {
    const args = parseArgs(["node", "cli", "-y"]);
    assert.equal(args.yes, true);
  });

  it("should parse multiple flags", () => {
    const args = parseArgs(["node", "cli", "--force", "--login", "-o", "./out"]);
    assert.equal(args.force, true);
    assert.equal(args.login, true);
    assert.equal(args.output, "./out");
  });

  it("should parse --clear-cache", () => {
    const args = parseArgs(["node", "cli", "--clear-cache"]);
    assert.equal(args.clearCache, true);
  });

  it("should have correct defaults", () => {
    const args = parseArgs(["node", "cli"]);
    assert.equal(args.help, false);
    assert.equal(args.version, false);
    assert.equal(args.force, false);
    assert.equal(args.output, null);
    assert.equal(args.login, false);
    assert.equal(args.deleteId, null);
    assert.equal(args.yes, false);
    assert.equal(args.clearCache, false);
  });
});

describe("loadConfigFile", () => {
  const testDir = join(tmpdir(), `mi-note-export-test-${Date.now()}`);

  it("should return empty object when config file does not exist", async () => {
    const config = await loadConfigFile(testDir);
    assert.deepEqual(config, {});
  });

  it("should read output from config file", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, ".mi-note-export.json"), JSON.stringify({ output: "./my-notes" }));
    const config = await loadConfigFile(testDir);
    assert.equal(config.output, "./my-notes");
    await rm(testDir, { recursive: true, force: true });
  });

  it("should return empty object for invalid JSON", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, ".mi-note-export.json"), "not json");
    const config = await loadConfigFile(testDir);
    assert.deepEqual(config, {});
    await rm(testDir, { recursive: true, force: true });
  });
});
