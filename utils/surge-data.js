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

// 博罗水位缓存：数据源每日 08:00 更新一次，按"数据日期"判断缓存新鲜度
// 缓存有效 = 缓存数据的更新时间 >= 最近一次数据更新时刻（今天8点，或当前未到8点则昨天8点）
const BOLUO_CACHE_KEY = 'boluo_cache';

function isBoluoCacheFresh(cache) {
  if (!cache || !cache.boluo || !cache.boluo.time) return false;
  // 兼容 iOS 解析 "2026-07-31 08:00"
  const t = new Date(String(cache.boluo.time).replace(/-/g, '/'));
  if (isNaN(t.getTime())) return false;
  const now = new Date();
  const today8 = new Date(now);
  today8.setHours(8, 0, 0, 0);
  const lastUpdate = now.getTime() >= today8.getTime() ? today8 : new Date(today8.getTime() - 86400000);
  return t.getTime() >= lastUpdate.getTime();
}

function fetchBoluoCached() {
  return new Promise((resolve) => {
    // 命中新鲜缓存则直接返回（跨日 08:00 后自动失效，触发重新请求）
    try {
      const cache = wx.getStorageSync(BOLUO_CACHE_KEY);
      if (isBoluoCacheFresh(cache)) {
        resolve(cache.boluo);
        return;
      }
    } catch (e) {}
    // 缓存失效，请求云函数
    if (!wx.cloud || !wx.cloud.callFunction) {
      resolve(normalizeBoluo(null));
      return;
    }
    wx.cloud.callFunction({
      name: 'getSurgeData',
      success(res) {
        const r = (res && res.result) || {};
        const boluo = normalizeBoluo(r.boluo);
        try { wx.setStorageSync(BOLUO_CACHE_KEY, { boluo, ts: Date.now() }); } catch (e) {}
        resolve(boluo);
      },
      fail() {
        resolve(normalizeBoluo(null));
      }
    });
  });
}

module.exports = { fetchSurgeData, fetchBoluoCached, SAMPLE_BOLUO, SAMPLE_TYPHOON };
