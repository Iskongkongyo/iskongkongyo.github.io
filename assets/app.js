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

/**
 * Lightweight markdown -> HTML converter
 * Supports: headings, bold, italic, inline code, links, lists, paragraphs
 */
function markdownToHtml(md) {
  if (!md) return '<p class="muted">暂无更新说明。</p>';

  const lines = md.split("\n");
  let html = "";
  let inList = false;
  let listType = "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (inList) { html += `</${listType}>`; inList = false; }
      const level = headingMatch[1].length;
      html += `<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`;
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        if (inList) html += `</${listType}>`;
        html += "<ul>";
        inList = true;
        listType = "ul";
      }
      html += `<li>${inlineFormat(ulMatch[1])}</li>`;
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^\s*\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        if (inList) html += `</${listType}>`;
        html += "<ol>";
        inList = true;
        listType = "ol";
      }
      html += `<li>${inlineFormat(olMatch[1])}</li>`;
      continue;
    }

    // Close list if we hit a non-list line
    if (inList) { html += `</${listType}>`; inList = false; }

    // Empty line
    if (line.trim() === "") continue;

    // Paragraph
    html += `<p>${inlineFormat(line)}</p>`;
  }

  if (inList) html += `</${listType}>`;
  return html;
}

/** Format inline markdown: bold, italic, code, links */
function inlineFormat(text) {
  return text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Inline code: `code`
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Format ISO date to readable string */
function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

async function loadLatestRelease() {
  // 默认回退
  setHref("apkBtn", fallbackReleaseUrl);
  setText("latestVersion", "请求失败");
  setText("latestVersion2", "请求失败");

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
      } catch (_) { /* ignore */ }
    }

    const tag = data.tag_name || "Latest";
    setText("latestVersion", tag);
    setText("latestVersion2", tag);

    // 优先找 .apk 资产
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const apk = assets.find(a => (a.name || "").toLowerCase().endsWith(".apk"));

    if (apk && apk.browser_download_url) {
      setHref("apkBtn", apk.browser_download_url);
      setText("apkBtn", `GitHub 下载（${tag}）`);
    } else {
      // 没有 apk 资产就指向 release 页面
      setHref("apkBtn", data.html_url || fallbackReleaseUrl);
      setText("apkBtn", `前往 Releases（${tag}）`);
    }

    // R2 高速下载也显示版本号
    setText("apkBtnR2", `⚡ 高速下载（${tag}）`);

    // Changelog
    renderChangelog(data);

  } catch (e) {
    // API 受限/网络异常：保持回退链接即可
    console.warn(e);
    const body = document.getElementById("changelogBody");
    if (body) body.innerHTML = '<p class="muted">无法加载更新日志，请访问 <a href="' + fallbackReleaseUrl + '" target="_blank">GitHub Releases</a> 查看。</p>';
    setText("changelogTag", "—");
  }
}

function renderChangelog(data) {
  const tagEl = document.getElementById("changelogTag");
  const dateEl = document.getElementById("changelogDate");
  const bodyEl = document.getElementById("changelogBody");

  if (tagEl) tagEl.textContent = data.tag_name || "Latest";
  if (dateEl) dateEl.textContent = formatDate(data.published_at);
  if (bodyEl) bodyEl.innerHTML = markdownToHtml(data.body);
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

function initBackToTop() {
  const btn = document.getElementById("backToTop");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      btn.classList.add("show");
    } else {
      btn.classList.remove("show");
    }
  });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

initTheme();
initMobileMenu();
initBackToTop();
loadLatestRelease();
