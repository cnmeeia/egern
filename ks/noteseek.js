// NodeSeek 自动签到优化版

let cfg = {
  cookie: "",
  tgToken: "",
  tgUserId: "",
  notifyOnlyFail: false,
  enableCapture: true,
  randomReward: false,
};

const STORE = {
  cookie: "NS_COOKIE",
  expiry: "NS_COOKIE_EXPIRY",
  warnDate: "NS_COOKIE_EXPIRY_WARN_DATE",
};

parseArgument();

const isCapture = typeof $request !== "undefined";

(async () => {
  if (isCapture) captureCookie();
  else await checkin();
})()
  .catch(e => {
    const err = getErr(e);
    console.log(`[NS签到] 脚本异常: ${err}`);
    $notification.post("NS签到异常", "", err);
  })
  .finally(() => $done({}));

function parseArgument() {
  if (typeof $argument === "undefined" || !$argument) return;

  try {
    const arg = typeof $argument === "string" ? JSON.parse($argument) : $argument;
    const valid = v => {
      if (v === undefined || v === null) return false;
      const s = String(v).trim();
      return s && !["xxx", "无", "none", "null"].includes(s.toLowerCase());
    };
    const bool = v => v === true || v === "true" || v === "1" || v === 1;

    cfg.cookie = valid(arg.NS_COOKIE) ? String(arg.NS_COOKIE) : "";
    cfg.tgToken = valid(arg.TG_BOT_TOKEN) ? String(arg.TG_BOT_TOKEN) : "";
    cfg.tgUserId = valid(arg.TG_USER_ID) ? String(arg.TG_USER_ID) : "";
    cfg.notifyOnlyFail = bool(arg.TG_NOTIFY_ONLY_FAIL);

    if (arg.ENABLE_CAPTURE !== undefined) cfg.enableCapture = bool(arg.ENABLE_CAPTURE);
    if (arg.RANDOM_REWARD !== undefined) cfg.randomReward = bool(arg.RANDOM_REWARD);
  } catch (e) {
    console.log(`[NS签到] 参数解析失败: ${getErr(e)}`);
  }
}

function captureCookie() {
  if (!cfg.enableCapture) {
    console.log("[NS签到] 抓取开关关闭，跳过。");
    return;
  }

  const headers = $request.headers || {};
  const getHeader = name =>
    headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];

  const cookie = getHeader("Cookie");
  if (!cookie) {
    $notification.post("NS Cookie 获取失败", "", "未从请求中找到 Cookie，请重新访问 NodeSeek。");
    return;
  }

  const ok = $persistentStore.write(cookie, STORE.cookie);
  const expiry = getCookieExpiry(cookie);

  if (expiry) {
    $persistentStore.write(String(expiry), STORE.expiry);
  }

  if (ok) {
    const expiryText = expiry ? formatDate(new Date(expiry)) : "未知";
    console.log(`[NS签到] Cookie 已保存，过期时间: ${expiryText}`);
    $notification.post(
      "NS Cookie 获取成功",
      "",
      `Cookie 已保存。\nSession 预计过期时间：${expiryText}\n建议关闭抓取开关。`
    );
  } else {
    $notification.post("NS Cookie 保存失败", "", "写入本地存储失败。");
  }
}

async function checkin() {
  await checkCookieExpiry();

  const cookie = cfg.cookie || $persistentStore.read(STORE.cookie);
  if (!cookie) {
    await notify({
      title: "NS签到结果",
      subtitle: "❌ 无法签到",
      body: "未检测到 Cookie，请打开抓取开关并登录 NodeSeek 获取 Cookie。",
      tg: "❌ <b>NodeSeek 签到失败</b>\n\n原因：未检测到 Cookie。",
      fail: true,
    });
    return;
  }

  const url = `https://www.nodeseek.com/api/attendance?random=${cfg.randomReward ? "true" : "false"}`;

  try {
    const resp = await request({
      method: "POST",
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36",
        "Origin": "https://www.nodeseek.com",
        "Referer": "https://www.nodeseek.com/board",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Cookie": cookie,
      },
      body: "",
    });

    await handleResponse(resp);
  } catch (e) {
    const err = getErr(e);
    await notify({
      title: "NS签到结果",
      subtitle: "⚠️ 网络异常",
      body: err,
      tg: `⚠️ <b>NodeSeek 签到网络异常</b>\n\n<code>${escapeHtml(err)}</code>`,
      fail: true,
    });
  }
}

async function handleResponse(resp) {
  const status = Number(resp.status || 0);
  const raw = resp.body || "";
  const msg = parseMessage(raw);
  const content = msg || raw.slice(0, 200) || "服务端未返回有效内容";

  if (status >= 200 && status < 300) {
    await notify({
      title: "NS活动签到",
      subtitle: "✅ 签到成功",
      body: content,
      tg: `✅ <b>NodeSeek 自动签到成功</b>\n\n状态码：${status}\n返回信息：\n<code>${escapeHtml(content)}</code>`,
      fail: false,
    });
    return;
  }

  const map = {
    403: ["⚠️ 403 风控拦截", "遭受 Cloudflare 或系统风控，请稍后重试。"],
    500: ["❌ 服务器错误", "NodeSeek 服务器内部错误。"],
  };

  const [subtitle, reason] = map[status] || [`❓ 异常状态 ${status}`, "请求返回异常状态码。"];

  await notify({
    title: "NS活动签到",
    subtitle,
    body: `${reason}\n${content}`,
    tg: `❌ <b>NodeSeek 签到失败</b>\n\n状态码：${status}\n原因：${escapeHtml(reason)}\n详情：\n<code>${escapeHtml(content)}</code>`,
    fail: true,
  });
}

async function checkCookieExpiry() {
  const expiry = Number($persistentStore.read(STORE.expiry));
  if (!expiry || Number.isNaN(expiry)) return;

  const now = Date.now();
  const remainMs = expiry - now;
  const remainHours = Math.floor(remainMs / 36e5);
  const expiryText = formatDate(new Date(expiry));

  if (remainMs > 48 * 36e5) {
    console.log(`[NS签到] Cookie 正常，约 ${Math.floor(remainHours / 24)} 天后过期。`);
    return;
  }

  const today = formatDate(new Date()).slice(0, 10);
  const lastWarnDate = $persistentStore.read(STORE.warnDate);
  if (lastWarnDate === today) return;

  $persistentStore.write(today, STORE.warnDate);

  const expired = remainMs <= 0;
  const body = expired
    ? `Session Cookie 已于 ${expiryText} 过期，请重新登录 NodeSeek 并抓取 Cookie。`
    : `Session Cookie 将在约 ${remainHours} 小时后过期（${expiryText}），建议重新登录刷新 Cookie。`;

  await notify({
    title: "NS签到警告",
    subtitle: expired ? "❌ Cookie 已过期" : "⚠️ Cookie 即将过期",
    body,
    tg: `${expired ? "❌" : "⚠️"} <b>NodeSeek Cookie ${expired ? "已过期" : "即将过期"}</b>\n\n<code>${escapeHtml(body)}</code>`,
    fail: true,
  });
}

async function notify({ title, subtitle, body, tg, fail }) {
  console.log(`[${title}] ${subtitle} ${body}`);
  $notification.post(title, subtitle, body);

  if (!fail && cfg.notifyOnlyFail) return;
  if (tg) await sendTg(tg);
}

async function sendTg(text) {
  if (!cfg.tgToken || !cfg.tgUserId) return;

  try {
    const resp = await request({
      method: "POST",
      url: `https://api.telegram.org/bot${cfg.tgToken}/sendMessage`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.tgUserId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (Number(resp.status) !== 200) {
      console.log(`[TG] 推送失败: ${resp.status} ${resp.body}`);
    }
  } catch (e) {
    console.log(`[TG] 推送异常: ${getErr(e)}`);
  }
}

function request(opts) {
  return new Promise((resolve, reject) => {
    const method = String(opts.method || "GET").toUpperCase();
    const req = {
      url: opts.url,
      headers: opts.headers || {},
    };

    if (opts.body !== undefined) req.body = opts.body;

    const cb = (err, resp, data) => {
      if (err) reject(err);
      else resolve({
        status: resp.status || resp.statusCode,
        headers: resp.headers || {},
        body: data || "",
      });
    };

    method === "POST" ? $httpClient.post(req, cb) : $httpClient.get(req, cb);
  });
}

function parseMessage(body) {
  try {
    const obj = JSON.parse(body);
    return obj && obj.message ? String(obj.message) : "";
  } catch {
    return "";
  }
}

function getCookieExpiry(cookie) {
  const match = String(cookie).match(/smac\s*=\s*(\d+)-/);
  if (!match) return null;

  // smac 时间戳 + 30 天
  return Number(match[1]) * 1000 + 30 * 24 * 60 * 60 * 1000;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getErr(e) {
  return e && (e.error || e.message) ? String(e.error || e.message) : String(e);
}