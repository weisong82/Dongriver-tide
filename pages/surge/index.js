// pages/surge/index.js
const surge = require('../../utils/surge-data.js');

Page({
  data: {
    boluo: null,
    typhoon: null,
    history: [],
    loading: true
  },

  onLoad() {
    // 先读历史记录（本地秒出），再请求实时数据
    this.setData({ history: surge.getBoluoHistory() });
    this.load();
  },

  onShow() {
    // 首页 fetchBoluo 可能已存新记录，切回本页时刷新历史
    this.setData({ history: surge.getBoluoHistory() });
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
