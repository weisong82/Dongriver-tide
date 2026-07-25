// cloudfunctions/getSurgeData/index.js
// 云函数：抓取博罗(二)站水位 + 国家海洋预报台风暴增水
// 部署：在微信开发者工具中右键 cloudfunctions/getSurgeData → 「上传并部署：云端安装依赖」
const axios = require('axios');

const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' };

// 博罗(二)站水位 —— shuiwei.cc 为服务端渲染，水位数值在 HTML 文本节点
async function fetchBoluo() {
  const res = await axios.get('https://www.shuiwei.cc/1397.html', { timeout: 9000, headers: UA });
  const html = res.data;
  // 当前水位：<p>当前水位</p><p class="text-3xl ...">1.03 <span>m</span></p>
  const lv = html.match(/当前水位[\s\S]{0,300}?>([0-9]+\.[0-9]{1,2})\s*<span[^>]*>m/);
  const tm = html.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2})/);
  const warn = html.match(/警戒水位[\s\S]{0,80}?>([^<]*?)<\/div>/);
  return {
    level: lv ? lv[1] : null,
    unit: 'm',
    time: tm ? tm[1] : '',
    warn: warn ? warn[1].trim() : '—',
    status: lv ? 'live' : 'fail',
    source: '水位大师 shuiwei.cc（云函数抓取）'
  };
}

// 台风与风暴增水 —— 国家海洋环境预报中心风暴潮预报页
async function fetchTyphoon() {
  const res = await axios.get('https://www.nmefc.cn/zhyj/fbcjb/tffbcjb', { timeout: 9000, headers: UA });
  const html = res.data;
  // 提取增水文本，如「广东揭阳到惠州沿海将出现80到160厘米的风暴增水」
  const surgeMatch = html.match(/[广]([东][^。]{0,60}?沿海[^。]{0,30}?[0-9]+\s*[到至]\s*[0-9]+\s*厘米[^。]*?增水)/);
  // 台风名
  const tyMatch = html.match(/第([0-9]+)号台风[“"]([^”"]{1,8})[”"]/) || html.match(/台风[“"]([^”"]{1,8})[”"]/);
  const surgeText = surgeMatch ? surgeMatch[1].replace(/\s+/g, '') : '';
  const name = tyMatch ? (tyMatch[2] || tyMatch[1]) : '';
  const ok = !!(surgeText || name);
  return {
    name: name,
    surge: surgeText,
    status: ok ? 'live' : 'fail',
    source: '国家海洋环境预报中心（云函数抓取）'
  };
}

exports.main = async (event, context) => {
  const result = { boluo: null, typhoon: null };
  try { result.boluo = await fetchBoluo(); } catch (e) {
    result.boluo = { status: 'fail', level: null, unit: 'm', time: '', warn: '—', source: '水位抓取失败' };
  }
  try { result.typhoon = await fetchTyphoon(); } catch (e) {
    result.typhoon = { status: 'fail', name: '', surge: '', source: '台风抓取失败' };
  }
  return result;
};
