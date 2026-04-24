/**
 * Egern 桌面小组件: 网络诊断雷达 Lite / 可配置版
 *
 * 默认移除高耗时检测项: Netflix、Disney+、TikTok、ChatGPT、Claude、Gemini。
 * 如需恢复某一项，把 CHECKS 里对应开关改成 true 即可。
 *
 * 兼容性修复:
 * - 使用 Egern 官方 redirect: 'manual'，替代原脚本中的 followRedirect: false。
 * - 优先使用 ctx.device 读取网络信息；$network / ctx.network 仅作为旧环境兜底。
 * - 统一封装 http/text/json/header，某个接口失败不会导致整个小组件空白。
 */
export default async function(ctx) {
  const CHECKS = {
    purity: true,
    localDelay: true,
    proxyDelay: true,

    // 高耗时/易触发风控的检测项，默认关闭。
    netflix: false,
    disney: false,
    tiktok: false,
    chatgpt: false,
    claude: false,
    gemini: false,
  };

  const C = {
    bg: { light: '#FFFFFF', dark: '#121212' },
    barBg: { light: '#0000001A', dark: '#FFFFFF22' },
    text: { light: '#1C1C1E', dark: '#FFFFFF' },
    dim: { light: '#8E8E93', dark: '#8E8E93' },
    cpu: { light: '#007AFF', dark: '#0A84FF' },
    mem: { light: '#AF52DE', dark: '#BF5AF2' },
    disk: { light: '#FF9500', dark: '#FF9F0A' },
    netRx: { light: '#34C759', dark: '#30D158' },
    netTx: { light: '#5856D6', dark: '#5E5CE6' },
    yellow: { light: '#FFCC00', dark: '#FFD60A' },
    red: { light: '#FF3B30', dark: '#FF453A' },
  };

  const BASE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
  const commonHeaders = {
    'User-Agent': BASE_UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  };

  function clip(value, max) {
    const s = value == null ? '' : String(value);
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function fmtProxyISP(isp) {
    if (!isp) return '未知';
    const s = String(isp);
    if (/it7/i.test(s)) return 'IT7 Network';
    if (/dmit/i.test(s)) return 'DMIT Network';
    if (/cloudflare/i.test(s)) return 'Cloudflare';
    if (/akamai/i.test(s)) return 'Akamai';
    if (/amazon|aws/i.test(s)) return 'AWS';
    if (/google/i.test(s)) return 'Google Cloud';
    if (/microsoft|azure/i.test(s)) return 'Azure';
    if (/alibaba|aliyun/i.test(s)) return '阿里云';
    if (/tencent/i.test(s)) return '腾讯云';
    if (/oracle/i.test(s)) return 'Oracle Cloud';
    return clip(s, 11);
  }

  function getFlag(code) {
    const cc = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return '';
    return String.fromCodePoint(cc.charCodeAt(0) + 127397, cc.charCodeAt(1) + 127397);
  }

  function header(res, name) {
    if (!res || !res.headers) return '';
    try {
      if (typeof res.headers.get === 'function') return res.headers.get(name) || '';
    } catch (_) {}
    return res.headers[name] || res.headers[name.toLowerCase()] || res.headers[name.toUpperCase()] || '';
  }

  async function httpGet(url, options) {
    try {
      return await ctx.http.get(url, options || {});
    } catch (_) {
      return null;
    }
  }

  async function safeText(res) {
    if (!res) return '';
    try {
      if (typeof res.text === 'function') return await res.text();
      if (typeof res.body === 'string') return res.body;
    } catch (_) {}
    return '';
  }

  async function safeJson(res) {
    if (!res) return null;
    try {
      if (typeof res.json === 'function') return await res.json();
    } catch (_) {}
    try {
      const t = await safeText(res);
      return t ? JSON.parse(t) : null;
    } catch (_) {
      return null;
    }
  }

  function fmtUnlock(name, res, cc) {
    if (!res) return `${name} -`;
    if (res === '❌') return `${name} ❌`;
    if (res === 'APP') return `${name} APP`;
    const target = res === 'OK' || res === 'XX' ? cc : res;
    return `${name} ${getFlag(target) || res}`;
  }

  const d = ctx.device || {};
  const wifi = d.wifi || {};
  const cellular = d.cellular || {};
  const ipv4 = d.ipv4 || {};
  const legacyNet = (typeof $network !== 'undefined' && $network) ? $network : (ctx.network || {});
  const legacyV4 = legacyNet.v4 || {};

  const isWifi = !!wifi.ssid;
  let netName = '未连接';
  let netIcon = 'antenna.radiowaves.left.and.right';
  let localIp = ipv4.address || legacyV4.primaryAddress || '获取失败';
  let gateway = ipv4.gateway || legacyV4.primaryRouter || '无网关';

  if (isWifi) {
    netName = wifi.ssid;
    netIcon = 'wifi';
  } else if (cellular.radio) {
    const radioKey = String(cellular.radio).toUpperCase().replace(/\s+/g, '');
    const radioMap = { GPRS: '2.5G', EDGE: '2.75G', WCDMA: '3G', LTE: '4G', NR: '5G', NRNSA: '5G' };
    netName = radioMap[radioKey] || String(cellular.radio);
    gateway = '蜂窝内网';
  }

  async function fetchLocal() {
    const res = await httpGet('https://myip.ipip.net/json', {
      headers: commonHeaders,
      timeout: 4000,
      credentials: 'omit',
    });
    const body = await safeJson(res);
    const data = body && body.data ? body.data : {};
    const loc = Array.isArray(data.location) ? [data.location[1], data.location[2]].filter(Boolean).join(' ') : '';
    return { ip: data.ip || '获取失败', loc: loc || '未知' };
  }

  async function fetchProxy() {
    const res = await httpGet('http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,query,isp,org&lang=zh-CN', {
      timeout: 4000,
      credentials: 'omit',
    });
    const data = (await safeJson(res)) || {};
    const cc = data.countryCode || 'XX';
    const locName = data.city || data.regionName || data.country || '';
    return {
      ip: data.query || '获取失败',
      loc: [getFlag(cc), locName].filter(Boolean).join(' ') || '未知',
      isp: fmtProxyISP(data.isp || data.org),
      cc,
    };
  }

  async function fetchPurity() {
    if (!CHECKS.purity) return {};
    const res = await httpGet('https://my.ippure.com/v1/info', {
      timeout: 4000,
      credentials: 'omit',
    });
    return (await safeJson(res)) || {};
  }

  async function measure(url) {
    const start = Date.now();
    const res = await httpGet(url, { timeout: 2500, credentials: 'omit' });
    if (!res) return '超时';
    return `${Date.now() - start} ms`;
  }

  async function checkNetflix() {
    async function getStatus(id) {
      const r = await httpGet(`https://www.netflix.com/title/${id}`, {
        timeout: 4000,
        headers: commonHeaders,
        redirect: 'manual',
        credentials: 'omit',
      });
      return r ? r.status : 0;
    }
    const sFull = await getStatus(70143836);
    const sOrig = await getStatus(81280792);
    if (sFull === 200) return 'OK';
    if (sOrig === 200) return 'APP';
    return '❌';
  }

  async function checkDisney() {
    const res = await httpGet('https://www.disneyplus.com', {
      timeout: 4000,
      headers: commonHeaders,
      redirect: 'manual',
      credentials: 'omit',
    });
    if (!res || res.status === 403) return '❌';
    const loc = header(res, 'location');
    if (loc.indexOf('unavailable') >= 0) return '❌';
    return 'OK';
  }

  async function checkTikTok() {
    const res = await httpGet('https://www.tiktok.com/explore', {
      timeout: 4000,
      headers: commonHeaders,
      redirect: 'manual',
      credentials: 'omit',
    });
    if (!res || res.status === 403 || res.status === 401) return '❌';
    const body = await safeText(res);
    if (body.indexOf('Access Denied') >= 0 || body.indexOf('Please wait...') >= 0) return '❌';
    const m = body.match(/"region":"([A-Z]{2})"/i);
    return m && m[1] ? m[1].toUpperCase() : 'OK';
  }

  async function checkChatGPT() {
    const res = await httpGet('https://chatgpt.com/cdn-cgi/trace', {
      timeout: 3500,
      credentials: 'omit',
    });
    const body = await safeText(res);
    const m = body.match(/loc=([A-Z]{2})/);
    return m && m[1] ? m[1].toUpperCase() : 'OK';
  }

  async function checkClaude() {
    const res = await httpGet('https://claude.ai/login', {
      timeout: 5000,
      headers: commonHeaders,
      credentials: 'omit',
    });
    if (!res) return '❌';
    const body = await safeText(res);
    if (body.indexOf('App unavailable') >= 0 || body.indexOf('certain regions') >= 0) return '❌';
    if (res.status === 403 && body.indexOf('1020') >= 0) return '❌';
    if (res.status === 403 && (body.indexOf('cf-turnstile') >= 0 || body.indexOf('Just a moment') >= 0 || body.indexOf('Challenge') >= 0)) return 'OK';
    if (res.status === 200 || res.status === 301 || res.status === 302) return 'OK';
    return '❌';
  }

  async function checkGemini() {
    const res = await httpGet('https://gemini.google.com/app', {
      timeout: 4000,
      headers: commonHeaders,
      redirect: 'manual',
      credentials: 'omit',
    });
    if (!res) return '❌';
    const loc = header(res, 'location');
    if (loc.indexOf('faq') >= 0) return '❌';
    return 'OK';
  }

  async function maybeRun(enabled, fn) {
    return enabled ? await fn() : '';
  }

  const baseResult = await Promise.all([
    fetchLocal(),
    fetchProxy(),
    fetchPurity(),
    CHECKS.localDelay ? measure('https://www.baidu.com') : Promise.resolve('关闭'),
    CHECKS.proxyDelay ? measure('http://cp.cloudflare.com/generate_204') : Promise.resolve('关闭'),
  ]);

  const localData = baseResult[0];
  const proxyData = baseResult[1];
  const purityData = baseResult[2];
  const localDelay = baseResult[3];
  const proxyDelay = baseResult[4];

  const unlockResult = await Promise.all([
    maybeRun(CHECKS.netflix, checkNetflix),
    maybeRun(CHECKS.disney, checkDisney),
    maybeRun(CHECKS.tiktok, checkTikTok),
    maybeRun(CHECKS.chatgpt, checkChatGPT),
    maybeRun(CHECKS.claude, checkClaude),
    maybeRun(CHECKS.gemini, checkGemini),
  ]);

  const rNF = unlockResult[0];
  const rDP = unlockResult[1];
  const rTK = unlockResult[2];
  const rGPT = unlockResult[3];
  const rCL = unlockResult[4];
  const rGM = unlockResult[5];

  const videoText = [
    CHECKS.netflix ? fmtUnlock('NF', rNF, proxyData.cc) : '',
    CHECKS.disney ? fmtUnlock('DP', rDP, proxyData.cc) : '',
    CHECKS.tiktok ? fmtUnlock('TK', rTK, proxyData.cc) : '',
  ].filter(Boolean).join(' ');

  const aiText = [
    CHECKS.chatgpt ? fmtUnlock('GPT', rGPT, proxyData.cc) : '',
    CHECKS.claude ? fmtUnlock('CL', rCL, proxyData.cc) : '',
    CHECKS.gemini ? fmtUnlock('GM', rGM, proxyData.cc) : '',
  ].filter(Boolean).join(' ');

  const isRes = purityData.isResidential;
  let nativeText = CHECKS.purity ? '无数据' : '已关闭';
  let nativeIc = 'questionmark.building.fill';
  let nativeCol = C.dim;
  if (isRes === true) {
    nativeText = '原生住宅';
    nativeIc = 'house.fill';
    nativeCol = C.netRx;
  } else if (isRes === false) {
    nativeText = '商业机房';
    nativeIc = 'building.2.fill';
    nativeCol = C.disk;
  }

  const risk = purityData.fraudScore;
  let riskTxt = CHECKS.purity ? '无数据' : '已关闭';
  let riskCol = C.dim;
  let riskIc = 'questionmark.circle.fill';
  if (typeof risk === 'number') {
    if (risk >= 70) {
      riskTxt = `高危 (${risk})`;
      riskCol = C.red;
      riskIc = 'xmark.shield.fill';
    } else if (risk >= 30) {
      riskTxt = `中危 (${risk})`;
      riskCol = C.disk;
      riskIc = 'exclamationmark.triangle.fill';
    } else {
      riskTxt = `纯净 (${risk})`;
      riskCol = C.netRx;
      riskIc = 'checkmark.shield.fill';
    }
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const timeCol = { light: '#00000055', dark: '#FFFFFF55' };

  function Row(ic, icCol, label, val, valCol) {
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 5,
      children: [
        { type: 'image', src: `sf-symbol:${ic}`, color: icCol, width: 11, height: 11 },
        { type: 'text', text: label, font: { size: 10, weight: 'regular' }, textColor: C.dim, maxLines: 1 },
        { type: 'spacer' },
        { type: 'text', text: String(val || '未知'), font: { size: 10, weight: 'medium' }, textColor: valCol || C.text, maxLines: 1, minScale: 0.45 },
      ],
    };
  }

  const leftRows = [
    Row(netIcon, C.cpu, '环境', netName, C.text),
    Row('wifi.router.fill', C.cpu, '网关', gateway, C.text),
    Row('iphone', C.cpu, '内网', localIp, C.text),
    Row('globe.asia.australia.fill', C.cpu, '公网', localData.ip, C.text),
    Row('map.fill', C.cpu, '位置', localData.loc, C.text),
    Row('timer', C.cpu, '延迟', localDelay, C.text),
  ];
  if (videoText) leftRows.push(Row('play.tv.fill', C.cpu, '影视', videoText, C.text));

  const rightRows = [
    Row('paperplane.fill', C.mem, '出口', proxyData.ip, C.text),
    Row('mappin.and.ellipse', C.mem, '落地', proxyData.loc, C.text),
    Row('server.rack', C.mem, '厂商', proxyData.isp, C.text),
    Row(nativeIc, nativeCol, '属性', nativeText, C.text),
    Row(riskIc, riskCol, '纯净', riskTxt, riskCol),
    Row('timer', C.mem, '延迟', proxyDelay, C.text),
  ];
  if (aiText) rightRows.push(Row('cpu', C.mem, 'AI', aiText, C.text));

  return {
    type: 'widget',
    padding: 14,
    backgroundColor: C.bg,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          { type: 'image', src: 'sf-symbol:waveform.path.ecg', color: C.text, width: 16, height: 16 },
          { type: 'text', text: '网络诊断雷达 Lite', font: { size: 14, weight: 'bold' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: timeStr, font: { size: 10, weight: 'medium' }, textColor: timeCol },
        ],
      },
      { type: 'spacer', length: 12 },
      {
        type: 'stack',
        direction: 'row',
        gap: 10,
        children: [
          { type: 'stack', direction: 'column', gap: 4.5, flex: 1, children: leftRows },
          { type: 'stack', width: 0.5, backgroundColor: C.barBg },
          { type: 'stack', direction: 'column', gap: 4.5, flex: 1, children: rightRows },
        ],
      },
      { type: 'spacer' },
    ],
  };
}
