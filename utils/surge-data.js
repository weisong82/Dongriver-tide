// utils/surge-data.js
// 气象增减水数据获取层 —— 通过云函数 getSurgeData 抓取
// 云函数未部署/调用失败时降级为最近一次真实抓取示例（UI 标注"示例"）。
// 云函数实现见 cloudfunctions/getSurgeData/index.js

// 降级示例数据（2026-07-25 调研真实抓取所得）
const SAMPLE_BOLUO = {
  level: '1.03',
  unit: 'm',
  time: '2026-07-23 08:00',
  warn: '—（未设置）',
  status: 'sample',
  source: '水位大师 shuiwei.cc（最近一次抓取示例）'
};

const SAMPLE_TYPHOON = {
  name: '红霞',
  number: '202612',
  level: '台风级',
  surge: '受台风“红霞”影响，广东揭阳到惠州沿海将出现 80 到 160 厘米的风暴增水，深圳沿海 30 到 80 厘米。',
  status: 'sample',
  source: '国家海洋环境预报中心 2026-07-25'
};

function normalizeBoluo(b) {
  if (!b || b.status !== 'live' || !b.level) {
    return Object.assign({}, SAMPLE_BOLUO, { status: 'sample' });
  }
  return Object.assign({}, SAMPLE_BOLUO, b, { status: 'live' });
}

function normalizeTyphoon(t) {
  if (t && t.status === 'live') {
    return Object.assign({}, t, { status: 'live' });
  }
  // 获取不到实时台风数据时，返回台风实时路径链接（不再用示例数据）
  return {
    status: 'fail',
    link: 'https://tf.tianqi.com/',
    source: '实时数据获取失败，可查看台风实时路径'
  };
}

function fetchSurgeData() {
  return new Promise((resolve) => {
    if (!wx.cloud || !wx.cloud.callFunction) {
      resolve({ boluo: normalizeBoluo(null), typhoon: normalizeTyphoon(null) });
      return;
    }
    wx.cloud.callFunction({
      name: 'getSurgeData',
      success(res) {
        const r = (res && res.result) || {};
        resolve({ boluo: normalizeBoluo(r.boluo), typhoon: normalizeTyphoon(r.typhoon) });
      },
      fail() {
        resolve({ boluo: normalizeBoluo(null), typhoon: normalizeTyphoon(null) });
      }
    });
  });
}

// 博罗水位：每次打开实时请求云函数，结果存页面内存，关闭小程序自然清除
function fetchBoluo() {
  return new Promise((resolve) => {
    if (!wx.cloud || !wx.cloud.callFunction) {
      resolve(normalizeBoluo(null));
      return;
    }
    wx.cloud.callFunction({
      name: 'getSurgeData',
      success(res) {
        const r = (res && res.result) || {};
        const boluo = normalizeBoluo(r.boluo);
        // live 数据存入历史记录
        if (boluo.status === 'live' && boluo.level && boluo.time) {
          saveBoluoHistory(boluo);
        }
        resolve(boluo);
      },
      fail() {
        resolve(normalizeBoluo(null));
      }
    });
  });
}

// === 博罗水位历史记录（localStorage 持久化，最近 7 天） ===
const BOLUO_HISTORY_KEY = 'boluo_history';

// 存一条记录：{ date: '08-02', level: 1.03, time: '2026-08-02 08:00' }
function saveBoluoHistory(boluo) {
  try {
    const list = wx.getStorageSync(BOLUO_HISTORY_KEY) || [];
    // 从 time 提取日期键，如 '2026-08-02 08:00' → '08-02'
    const dateKey = boluo.time.substring(5, 10);
    // 去重：同一天覆盖旧记录
    const filtered = list.filter((item) => item.date !== dateKey);
    filtered.push({ date: dateKey, level: parseFloat(boluo.level), time: boluo.time });
    // 按日期排序，保留最近 7 天
    filtered.sort((a, b) => a.time.localeCompare(b.time));
    const recent = filtered.slice(-7);
    wx.setStorageSync(BOLUO_HISTORY_KEY, recent);
  } catch (e) {}
}

// 读取历史记录：优先云端，降级本地
function getBoluoHistory() {
  return new Promise((resolve) => {
    // 本地缓存（秒出，作为降级/离线兜底）
    let localHistory = [];
    try { localHistory = wx.getStorageSync(BOLUO_HISTORY_KEY) || []; } catch (e) {}
    if (!wx.cloud || !wx.cloud.callFunction) {
      resolve(localHistory);
      return;
    }
    wx.cloud.callFunction({
      name: 'getSurgeData',
      data: { action: 'getHistory' },
      success(res) {
        const r = (res && res.result) || {};
        if (r.status === 'live' && Array.isArray(r.history) && r.history.length) {
          resolve(r.history);
        } else {
          resolve(localHistory);
        }
      },
      fail() {
        resolve(localHistory);
      }
    });
  });
}

module.exports = { fetchSurgeData, fetchBoluo, getBoluoHistory, saveBoluoHistory, SAMPLE_BOLUO, SAMPLE_TYPHOON };
