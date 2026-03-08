import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir, fileExists, ensureDir } from "./utils.js";

const COOKIE_FILE = join(getDataDir(), ".cookie");
const BROWSER_DATA_DIR = join(getDataDir(), ".browser-data");
const NOTE_URL = "https://i.mi.com/note/h5#/";
const NOTE_API_BASE = "https://i.mi.com/note/full/page/";
const LOGIN_TIMEOUT = 300_000;
const POLL_INTERVAL = 2_000;

/**
 * 确保有有效的 Cookie
 * - 如果有缓存且有效，直接返回
 * - 否则启动浏览器让用户登录
 */
export async function ensureCookie(forceLogin = false): Promise<string> {
  if (!forceLogin) {
    const cached = await loadCachedCookie();
    if (cached) {
      console.log("🔑 检测到缓存的 Cookie，正在验证有效性...");
      const valid = await validateCookie(cached);
      if (valid) {
        console.log("✅ Cookie 有效");
        return cached;
      }
      console.log("⚠️ Cookie 已过期，需要重新登录");
    }
  }

  const cookie = await loginAndGetCookie();
  await saveCookie(cookie);
  return cookie;
}

/**
 * 通过 Playwright 打开浏览器让用户登录，获取 Cookie
 */
async function loginAndGetCookie(): Promise<string> {
  console.log("🌐 正在打开浏览器，请在浏览器中登录小米账号...");

  const { chromium } = await import("playwright");

  // 使用持久化上下文：复用浏览器身份，避免每次都是新设备触发风控
  const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    channel: "chromium",
  });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(NOTE_URL);

  console.log("⏳ 等待登录完成...(登录成功后会自动检测)");

  // 轮询检测登录状态，避免 waitForFunction 在页面导航时因 context 销毁而报错
  const startTime = Date.now();

  while (Date.now() - startTime < LOGIN_TIMEOUT) {
    // 检测方式 1：页面 URL 和 DOM
    try {
      const loggedIn = await page.evaluate(() => {
        const isNotePage = location.href.includes("i.mi.com/note");
        const hasContent =
          document.querySelector(".note-list") ||
          document.querySelector('[class*="note"]') ||
          document.querySelector('[class*="list"]');
        return isNotePage && !!hasContent;
      });
      if (loggedIn) break;
    } catch {
      // 页面正在导航（如跳转到登录页），evaluate 会失败，忽略即可
    }

    // 检测方式 2：尝试用当前 Cookie 调 API
    try {
      const cookieStr = await extractCookies(context);
      if (cookieStr && (await validateCookie(cookieStr))) break;
    } catch {
      // ignore
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  if (Date.now() - startTime >= LOGIN_TIMEOUT) {
    await context.close();
    throw new Error("登录超时（5 分钟），请重试");
  }

  console.log("✅ 登录成功，正在提取 Cookie...");

  const cookieStr = await extractCookies(context);
  await context.close();

  if (!cookieStr) {
    throw new Error("未能获取到 Cookie，请重试");
  }

  return cookieStr;
}

/**
 * 从浏览器上下文中提取 Cookie 字符串
 */
async function extractCookies(
  context: { cookies: (url: string) => Promise<{ name: string; value: string }[]> },
): Promise<string> {
  const cookies = await context.cookies("https://i.mi.com");
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * 验证 Cookie 是否有效
 */
async function validateCookie(cookie: string): Promise<boolean> {
  try {
    const url = `${NOTE_API_BASE}?ts=${Date.now()}&limit=1`;
    const resp = await fetch(url, {
      headers: buildHeaders(cookie),
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { result: string };
    return data.result === "ok";
  } catch {
    return false;
  }
}

/**
 * 构建请求头
 */
export function buildHeaders(cookie: string): Record<string, string> {
  return {
    Cookie: cookie,
    Referer: "https://i.mi.com/note/h5",
    Origin: "https://i.mi.com",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-ch-ua":
      '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

/**
 * 加载缓存的 Cookie
 */
async function loadCachedCookie(): Promise<string | null> {
  if (!(await fileExists(COOKIE_FILE))) return null;
  try {
    const content = await readFile(COOKIE_FILE, "utf-8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

/**
 * 保存 Cookie 到文件
 */
async function saveCookie(cookie: string): Promise<void> {
  await ensureDir(getDataDir());
  await writeFile(COOKIE_FILE, cookie, "utf-8");
  console.log("💾 Cookie 已缓存到本地");
}
