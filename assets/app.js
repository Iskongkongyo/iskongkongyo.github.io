const REPO = "Iskongkongyo/FireflyVPN";
const fallbackReleaseUrl = `https://github.com/${REPO}/releases`;
const api = `https://api.github.com/repos/${REPO}/releases/latest`;
const CACHE_KEY = "ff_release_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHref(id, href) {
  const el = document.getElementById(id);
  if (el) el.href = href;
}

async function loadLatestRelease() {
  // 默认回退
  setHref("apkBtn", fallbackReleaseUrl);
  setText("latestVersion", "Releases");
  setText("latestVersion2", "Releases");

  try {
    // 尝试从缓存读取
    const cached = sessionStorage.getItem(CACHE_KEY);
    let data;

    if (cached) {
      const { ts, payload } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) {
        data = payload;
      }
    }

    // 缓存未命中或过期，请求 API
    if (!data) {
      const resp = await fetch(api, {
        headers: { "Accept": "application/vnd.github+json" }
      });

      if (!resp.ok) throw new Error("GitHub API error: " + resp.status);
      data = await resp.json();

      // 写入缓存
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload: data }));
      } catch (_) { /* sessionStorage 不可用时忽略 */ }
    }

    const tag = data.tag_name || "Latest";
    setText("latestVersion", tag);
    setText("latestVersion2", tag);

    // 优先找 .apk 资产
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const apk = assets.find(a => (a.name || "").toLowerCase().endsWith(".apk"));

    if (apk && apk.browser_download_url) {
      setHref("apkBtn", apk.browser_download_url);
      setText("apkBtn", `下载 APK（${tag}）`);
    } else {
      // 没有 apk 资产就指向 release 页面
      setHref("apkBtn", data.html_url || fallbackReleaseUrl);
      setText("apkBtn", `前往 Releases（${tag}）`);
    }
  } catch (e) {
    // API 受限/网络异常：保持回退链接即可
    console.warn(e);
  }
}

function initTheme() {
  const key = "ff_theme";
  const saved = localStorage.getItem(key);

  if (saved === "light" || saved === "dark") {
    document.documentElement.dataset.theme = saved;
  } else {
    // 首次访问：检测系统偏好
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
  }

  const btn = document.getElementById("themeBtn");
  btn?.addEventListener("click", () => {
    const now = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = now;
    localStorage.setItem(key, now);
  });
}

function initMobileMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const nav = document.getElementById("mainNav");

  if (!menuBtn || !nav) return;

  menuBtn.addEventListener("click", () => {
    nav.classList.toggle("open");
  });

  // 点击导航链接后自动收起
  nav.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      nav.classList.remove("open");
    });
  });
}

initTheme();
initMobileMenu();
loadLatestRelease();
