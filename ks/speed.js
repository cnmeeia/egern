/* Net Speed - Egern Stable + iOS Style */

const arg = parseArgument()

let title = arg.title || 'Network'
let content = ''
let icon = ''
let color = ''

;(async () => {
  const mb = clampNumber(arg.mb, 1, 1, 3)
  const bytes = mb * 1024 * 1024

  // ----------- HTTP 兼容封装（关键修复）-----------
  function httpGet(url) {
    return new Promise((resolve, reject) => {
      $httpClient.get(url, (err, resp, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  // ----------- 下载测速 -----------
  const start = Date.now()
  await httpGet(`https://speed.cloudflare.com/__down?bytes=${bytes}&r=${Date.now()}`)
  const duration = Math.max((Date.now() - start) / 1000, 0.001)

  const mbps = Math.round((mb / duration) * 8)

  // ----------- 延迟 -----------
  const pingStart = Date.now()
  await httpGet(`https://cp.cloudflare.com/generate_204?r=${Date.now()}`)
  const ping = Date.now() - pingStart

  // ----------- 状态（控制中心风格）-----------
  const status =
    mbps >= 120 && ping < 120 ? 'Excellent' :
    mbps >= 80 && ping < 200 ? 'Good' :
    mbps >= 40 ? 'Normal' :
    'Slow'

  // ----------- 内容（极简单行）-----------
  content = `↓ ${mbps}M   ${ping}ms · ${status}`

  // ----------- 图标 -----------
  icon = getIcon(mbps)
  color = getColor(ping)

})()
.catch(e => {
  title = 'Error'
  content = e?.message || JSON.stringify(e)
})
.finally(() => {
  $done({
    title,
    content,
    icon,
    'icon-color': color
  })
})

/* ------------------ 工具函数 ------------------ */

function parseArgument() {
  if (typeof $argument === 'undefined') return {}

  return Object.fromEntries(
    $argument.split('&').map(i => {
      const [k, ...v] = i.split('=')
      return [decodeURIComponent(k), decodeURIComponent(v.join('='))]
    })
  )
}

function clampNumber(value, def, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return def
  return Math.min(Math.max(n, min), max)
}

function getIcon(mbps) {
  if (arg.icon) return arg.icon

  if (mbps < 40) return arg.iconslow || 'wifi.slash'
  if (mbps < 100) return arg.iconmid || 'wifi'
  return arg.iconfast || 'bolt.horizontal.fill'
}

function getColor(ping) {
  if (arg['icon-color']) return arg['icon-color']

  if (ping < 120) return arg.colorlow || '#32D74B'
  if (ping < 250) return arg.colormid || '#FFD60A'
  return arg.colorhigh || '#FF453A'
}