#!/usr/bin/env node

/**
 * 一键发布脚本：检查工作区 → 测试 → 编译 → 版本升级 → 发布 npm → 推送 git tag
 *
 * 用法：
 *   pnpm release              正式版 patch（0.1.8 → 0.1.9）
 *   pnpm release minor        正式版 minor（0.1.8 → 0.2.0）
 *   pnpm release major        正式版 major（0.1.8 → 1.0.0）
 *   pnpm release beta         发布 beta 版（自动判断首次/递增）
 *   pnpm release beta:minor   beta minor（0.1.8 → 0.2.0-beta.0）
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const pkgPath = resolve(root, "package.json");

const arg = process.argv[2] || "patch";

// 解析参数：支持 "beta" 或 "beta:minor" 格式
let BUMP, IS_BETA, BETA_BASE;
if (arg === "beta") {
  BUMP = "prepatch";
  IS_BETA = true;
  BETA_BASE = "patch";
} else if (arg.startsWith("beta:")) {
  BETA_BASE = arg.split(":")[1]; // minor / major
  if (!["patch", "minor", "major"].includes(BETA_BASE)) {
    console.error(`❌ 无效的 beta 版本类型: ${arg}，请使用 beta / beta:minor / beta:major`);
    process.exit(1);
  }
  BUMP = `pre${BETA_BASE}`;
  IS_BETA = true;
} else if (["patch", "minor", "major"].includes(arg)) {
  BUMP = arg;
  IS_BETA = false;
} else {
  console.error(`❌ 无效的版本类型: ${arg}，请使用 patch / minor / major / beta / beta:minor / beta:major`);
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log(`\n🔧 ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", ...opts });
}

function getVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

function setUpstream() {
  // 检查是否已有 upstream，没有则自动设置
  try {
    execSync("git remote get-url origin", { cwd: root, stdio: "pipe" });
  } catch {
    console.error("❌ 未配置 git remote origin，请先设置后再发布");
    process.exit(1);
  }

  // 当前分支
  const branch = execSync("git branch --show-current", {
    cwd: root,
    encoding: "utf-8",
  }).trim();

  // 检查 upstream 是否已设置
  try {
    execSync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, {
      cwd: root,
      stdio: "pipe",
    });
  } catch {
    console.log(`\n🔗 设置 ${branch} 的 upstream 为 origin/${branch}...`);
    run(`git push --set-upstream origin ${branch}`);
  }
}

// ─── 开始发布流程 ───────────────────────────────────────────────
console.log(`🚀 开始发布 (bump: ${BUMP})\n`);

// 1. 检查工作区是否干净
console.log("📋 检查工作区状态...");
const status = execSync("git status --porcelain", {
  cwd: root,
  encoding: "utf-8",
});
if (status.trim()) {
  console.error("❌ 工作区有未提交的变更，请先提交或暂存：\n");
  console.error(status);
  process.exit(1);
}
console.log("✅ 工作区干净\n");

// 2. 确保 upstream 已配置
setUpstream();

// 3. 拉取最新代码
console.log("📥 拉取远程更新...");
run("git pull --rebase");
console.log("");

// 4. 运行测试
console.log("🧪 运行测试...");
run("pnpm test");
console.log("✅ 测试通过\n");

// 5. 编译
console.log("🔨 编译 TypeScript...");
run("pnpm build");
console.log("✅ 编译完成\n");

// 6. 版本升级（会自动创建 git tag 和 commit）
console.log(`📦 升级版本 (${BUMP})...`);
if (IS_BETA) {
  // beta 版：检查当前是否已是 beta 版，决定用 prerelease 还是 pre{patch,minor,major}
  const current = getVersion();
  const isAlreadyBeta = /-beta\.\d+$/.test(current);
  if (isAlreadyBeta) {
    // 已有 beta 版，直接递增 prerelease：0.1.9-beta.0 → 0.1.9-beta.1
    run(`npm version prerelease --preid beta -m "chore: release v%s"`);
  } else {
    // 首次发 beta，使用 pre{patch,minor,major}
    run(`npm version ${BUMP} --preid beta -m "chore: release v%s"`);
  }
} else {
  run(`npm version ${BUMP} -m "chore: release v%s"`);
}
const newVersion = getVersion();
console.log(`✅ 版本升级至 ${newVersion}\n`);

// 7. 发布到 npm（beta 版打 tag beta，正式版打 tag latest）
console.log("📤 发布到 npm...");
const npmTag = IS_BETA ? "beta" : "latest";
run(`npm publish --tag ${npmTag}`);
console.log(`✅ v${newVersion} 已发布到 npm（tag: ${npmTag}）\n`);

// 8. 推送代码和 tag 到远程
console.log("📤 推送代码和 tag 到远程...");
run("git push --follow-tags");
console.log("✅ 推送完成\n");

console.log(`\n🎉 发布完成！v${newVersion}\n`);
