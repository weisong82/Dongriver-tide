// app.js
App({
  onLaunch() {
    // 初始化云开发（用于「气象增减水」Tab 的云函数抓取）
    // 替换 'dongriver-tide' 为你的云环境 ID：
    // 微信开发者工具 → 云开发 → 创建/选择环境 → 复制环境 ID
    if (wx.cloud) {
      try {
        wx.cloud.init({ env: 'cloud1-d3gjs0x5cfdb9b846', traceUser: true });
      } catch (e) {
        console.warn('云开发初始化失败，气象增减水将降级为示例数据', e);
      }
    }
  },
  globalData: {
    stationKey: 'huizhou'
  }
})
