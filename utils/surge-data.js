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
        resolve(normalizeBoluo(r.boluo));
      },
      fail() {
        resolve(normalizeBoluo(null));
      }
    });
  });
}

module.exports = { fetchSurgeData, fetchBoluo, SAMPLE_BOLUO, SAMPLE_TYPHOON };
