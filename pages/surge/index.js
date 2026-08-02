// pages/surge/index.js
const surge = require('../../utils/surge-data.js');
const tide = require('../../utils/tide.js');

// 生成博罗站 24 小时水位趋势（基于潮汐模型，作参考）
function buildBoluoTrend() {
  const station = tide.STATIONS.huizhou; // 博罗靠近惠州，用惠州站潮汐模型作趋势参考
  const now = new Date();
  const start = new Date(now.getTime() - 12 * 3600 * 1000); // 前12小时
  const points = [];
  let minH = Infinity, maxH = -Infinity;
  for (let i = 0; i <= 48; i++) { // 每30分钟一个点，共24小时
    const d = new Date(start.getTime() + i * 30 * 60 * 1000);
    const h = tide.predictHeightAt(station, d);
    points.push({ minutes: i * 30, height: Math.round(h * 10) / 10, label: d });
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  // 当前时刻索引（now 在 start 后约 12h = 第24个点附近）
  const nowIdx = Math.round((now - start) / (30 * 60 * 1000));
  return { points, minH: Math.round(minH), maxH: Math.round(maxH), nowIdx };
}

Page({
  data: {
    boluo: null,
    typhoon: null,
    trend: null,
    loading: true
  },

  onLoad() {
    this.setData({ trend: buildBoluoTrend() });
    this.load();
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  load(cb) {
    this.setData({ loading: true });
    surge.fetchSurgeData().then(({ boluo, typhoon }) => {
      this.setData({ boluo, typhoon, loading: false });
      cb && cb();
    });
  },

  refresh() {
    this.load();
  },

  openTyphoonLink() {
    wx.setClipboardData({
      data: 'https://tf.tianqi.com/',
      success: () => {
        wx.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '东江气象增减水 · 博罗水位与台风增水',
      path: '/pages/surge/index',
      imageUrl: '/assets/icon.png'
    };
  },

  onShareTimeline() {
    return {
      title: '东江气象增减水',
      imageUrl: '/assets/icon.png'
    };
  }
});
