// pages/surge/index.js
const surge = require('../../utils/surge-data.js');

Page({
  data: {
    boluo: null,
    typhoon: null,
    loading: true
  },

  onLoad() {
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
  }
});
