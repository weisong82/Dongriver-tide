// cloudfunctions/getSurgeData/index.js
// 云函数：抓取博罗(二)站水位 + 国家海洋预报台风暴增水
// 并将博罗水位写入云数据库 boluo_history 集合（跨设备共享）
// 部署：在微信开发者工具中右键 cloudfunctions/getSurgeData → 「上传并部署：云端安装依赖」
// 需在云开发控制台创建集合 boluo_history，权限设为「所有用户可读，仅创建者可写」或「仅管理端可读写」
const axios = require('axios');

const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' };

// 博罗(二)站水位 —— shuiwei.cc 为服务端渲染，水位数值在 HTML 文本节点
async function fetchBoluo() {
  const res = await axios.get('https://www.shuiwei.cc/1397.html', { timeout: 9000, headers: UA });
  const html = res.data;
  // 当前水位：<p>当前水位</p><p class="text-3xl ...">1.03 <span>m</span></p>
  const lv = html.match(/当前水位[\s\S]{0,300}?>([0-9]+\.[0-9]{1,2})\s*<span[^>]*>m/);
  const tm = html.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2})/);
  return {
    level: lv ? lv[1] : null,
    unit: 'm',
    time: tm ? tm[1] : '',
    status: lv ? 'live' : 'fail',
    source: '水位大师 shuiwei.cc（云函数抓取）'
  };
}

// 台风与风暴增水 —— 国家海洋环境预报中心风暴潮预报页
async function fetchTyphoon() {
  const res = await axios.get('https://www.nmefc.cn/zhyj/fbcjb/tffbcjb', { timeout: 9000, headers: UA });
  const html = res.data;
  const surgeMatch = html.match(/[广]([东][^。]{0,60}?沿海[^。]{0,30}?[0-9]+\s*[到至]\s*[0-9]+\s*厘米[^。]*?增水)/);
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

// 写入博罗水位历史到云数据库
async function saveBoluoToCloud(boluo) {
  if (boluo.status !== 'live' || !boluo.level || !boluo.time) return;
  const db = cloud.database();
  const dateKey = boluo.time.substring(5, 10); // '08-02'
  // 先删同日旧记录（避免重复）
  try {
    await db.collection('boluo_history').where({ date: dateKey }).remove();
  } catch (e) {}
  // 插入新记录
  await db.collection('boluo_history').add({
    data: {
      date: dateKey,
      level: parseFloat(boluo.level),
      time: boluo.time,
      ts: Date.now()
    }
  });
}

// 读取最近 7 天历史
async function getBoluoHistoryFromCloud() {
  const db = cloud.database();
  const _ = db.command;
  const res = await db.collection('boluo_history')
    .orderBy('time', 'asc')
    .limit(7)
    .get();
  return res.data.map((d) => ({ date: d.date, level: d.level, time: d.time }));
}

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  // 读取历史模式
  if (event && event.action === 'getHistory') {
    try {
      const history = await getBoluoHistoryFromCloud();
      return { action: 'getHistory', history, status: 'live' };
    } catch (e) {
      return { action: 'getHistory', history: [], status: 'fail', error: String(e) };
    }
  }

  // 默认：抓取数据 + 存历史
  const result = { boluo: null, typhoon: null };
  try {
    result.boluo = await fetchBoluo();
    // 抓取成功则写入云数据库
    await saveBoluoToCloud(result.boluo);
  } catch (e) {
    result.boluo = { status: 'fail', level: null, unit: 'm', time: '', source: '水位抓取失败' };
  }
  try { result.typhoon = await fetchTyphoon(); } catch (e) {
    result.typhoon = { status: 'fail', name: '', surge: '', source: '台风抓取失败' };
  }
  return result;
};
