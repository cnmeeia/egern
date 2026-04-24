/* Net Speed Panel - optimized */

const $ = new Env('network-speed')

$.isPanel = () =>
  $.isSurge() && typeof $input !== 'undefined' && $.lodash_get($input, 'purpose') === 'panel'

$.isTile = () =>
  $.isStash() && typeof $script !== 'undefined' && $.lodash_get($script, 'type') === 'tile'

const arg = parseArgument()

let title = arg.title || 'NetSpeed'
let content = ''
let icon = arg.icon || ''
let color = arg['icon-color'] || ''

!(async () => {
  if ($.isTile()) await notify('网络速率', '面板', '开始查询')

  const mb = clampNumber(arg.mb, 3, 1, 4)
  const bytes = mb * 1024 * 1024

  const start = Date.now()
  await $.http.get({
    url: `https://speed.cloudflare.com/__down?bytes=${bytes}&r=${Date.now()}`
  })
  const duration = Math.max((Date.now() - start) / 1000, 0.001)

  const mbps = round((mb / duration) * 8, 0)
  const mbpsPerSecond = round(mb / duration, 1)

  const pingStart = Date.now()
  await $.http.get({
    url: `https://cp.cloudflare.com/generate_204?r=${Date.now()}`
  })
  const ping = Date.now() - pingStart

  icon = getIcon(mbps)
  color = getColor(ping)

  content =
    `下行速率: ${mbps} Mbps [${mbpsPerSecond} MB/s]\n` +
    `测试耗时: ${round(duration, 2)}s\n` +
    `网络延迟: ${ping} ms\n` +
    `执行时间: ${new Date().toTimeString().split(' ')[0]}`

  if ($.isTile()) {
    await notify('网络速率', '面板', '查询完成')
  } else if (!$.isPanel()) {
    await notify('网络速率', title, content)
  }
})()
  .catch(async e => {
    $.logErr(e)
    title = '❌'
    content = `${$.lodash_get(e, 'message') || $.lodash_get(e, 'error') || e}`
    await notify('网络速率', title, content)
  })
  .finally(() => {
    const result = {
      title,
      content,
      icon,
      'icon-color': color
    }

    $.log($.toStr(result))
    $.done(result)
  })

function parseArgument() {
  if (typeof $argument === 'undefined' || !$argument) return {}

  return Object.fromEntries(
    $argument.split('&').map(item => {
      const [key, ...rest] = item.split('=')
      return [
        decodeURIComponent(key || ''),
        decodeURIComponent(rest.join('=') || '')
      ]
    })
  )
}

function clampNumber(value, defaultValue, min, max) {
  const num = Number(value)
  if (!Number.isFinite(num)) return defaultValue
  return Math.min(Math.max(num, min), max)
}

function getIcon(mbps) {
  if (arg.icon) return arg.icon

  if (mbps < 80) return arg.iconslow || 'tortoise'
  if (mbps < 120) return arg.iconmid || 'hare'

  return arg.iconfast || 'bird'
}

function getColor(ping) {
  if (arg['icon-color']) return arg['icon-color']

  if (ping < 150) return arg.colorlow || '#06D6A0'
  if (ping < 300) return arg.colormid || '#FFD166'

  return arg.colorhigh || '#EF476F'
}

async function notify(title, subt, desc, opts) {
  if ($.lodash_get(arg, 'notify')) {
    $.msg(title, subt, desc, opts)
  }
}

function createRound(methodName) {
  const func = Math[methodName]

  return (number, precision) => {
    precision =
      precision == null
        ? 0
        : precision >= 0
          ? Math.min(precision, 292)
          : Math.max(precision, -292)

    if (precision) {
      let pair = `${number}e`.split('e')
      const value = func(`${pair[0]}e${+pair[1] + precision}`)
      pair = `${value}e`.split('e')
      return +`${pair[0]}e${+pair[1] - precision}`
    }

    return func(number)
  }
}

function round(...args) {
  return createRound('round')(...args)
}

// prettier-ignore
function Env(t,s){class e{constructor(t){this.env=t}send(t,s="GET"){t="string"==typeof t?{url:t}:t;let e=this.get;return"POST"===s&&(e=this.post),new Promise((s,i)=>{e.call(this,t,(t,e,r)=>{t?i(t):s(e)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,s){this.name=t,this.http=new e(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,s)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $environment&&$environment["surge-version"]}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,s=null){try{return JSON.parse(t)}catch{return s}}toStr(t,s=null){try{return JSON.stringify(t)}catch{return s}}lodash_get(t,s,e){if(!t||!s)return e;const i=s.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return e;return r}get(t,s=()=>{}){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash())$httpClient.get(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status?e.status:e.statusCode,e.status=e.statusCode),s(t,e,i)});else if(this.isQuanX())$task.fetch(t).then(t=>{const{statusCode:e,headers:i,body:r}=t;s(null,{status:e,statusCode:e,headers:i,body:r},r)},t=>s(t&&t.error||"UndefinedError"));else if(this.isNode()){this.got=this.got||require("got");this.got(t).then(t=>{const{statusCode:e,headers:i,body:r}=t;s(null,{status:e,statusCode:e,headers:i,body:r},r)},t=>{const{message:e,response:i}=t;s(e,i,i&&i.body)})}}post(t,s=()=>{}){const e=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash())$httpClient[e](t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status?e.status:e.statusCode,e.status=e.statusCode),s(t,e,i)});else if(this.isQuanX())t.method=e,$task.fetch(t).then(t=>{const{statusCode:e,headers:i,body:r}=t;s(null,{status:e,statusCode:e,headers:i,body:r},r)},t=>s(t&&t.error||"UndefinedError"))}msg(s=t,e="",i="",r){if(this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash())$notification.post(s,e,i,r);else this.isQuanX()&&$notify(s,e,i,r)}log(...t){console.log(t.join("\n"))}logErr(t){console.log(`❗️${this.name}, 错误!`,t)}done(t={}){this.isSurge()||this.isShadowrocket()||this.isQuanX()||this.isLoon()||this.isStash()?$done(t):this.isNode()&&process.exit(0)}}(t,s)}