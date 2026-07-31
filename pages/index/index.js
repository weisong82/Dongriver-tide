// pages/index/index.js
const tide = require('../../utils/tide.js');
const surge = require('../../utils/surge-data.js');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function fmtDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildDays(stationKey) {
  const station = tide.STATIONS[stationKey];
  const today = tide.startOfDay(new Date());
  // 以前后 15 天（约一个朔望月）的潮差最大/最小值作为分档基准
  let maxRange = 0, minRange = Infinity;
  for (let i = -15; i <= 15; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const pd = tide.predictDay(station, d);
    const r = pd.max.height - pd.min.height;
    if (r > maxRange) maxRange = r;
    if (r < minRange) minRange = r;
  }
  const span = maxRange - minRange;
  const days = [];
  for (let i = -3; i <= 7; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const pd = tide.predictDay(station, d);
    const isToday = i === 0;
    const range = pd.max.height - pd.min.height;
    const ratio = span > 0 ? (range - minRange) / span : 0.5;
    const tideType = ratio >= 0.66 ? 'big' : ratio >= 0.33 ? 'mid' : 'small';
    const tideTypeText = tideType === 'big' ? '大潮' : tideType === 'mid' ? '中潮' : '小潮';
    const timeline = []
      .concat(pd.highs.map((h) => ({ type: 'high', typeText: '高潮', time: h.time, height: Math.round(h.height), minutes: h.minutes })))
      .concat(pd.lows.map((l) => ({ type: 'low', typeText: '低潮', time: l.time, height: Math.round(l.height), minutes: l.minutes })))
      .sort((a, b) => a.minutes - b.minutes)
      .map((it, idx) => Object.assign(it, { key: idx }));
    days.push({
      date: pd.date,
      weekday: isToday ? '今天' : '周' + WEEKDAYS[d.getDay()],
      dateLabel: fmtDate(d),
      dateCN: `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`,
      isToday,
      highs: pd.highs,
      lows: pd.lows,
      hourly: pd.hourly,
      series: pd.series,
      max: pd.max,
      min: pd.min,
      range: Math.round(range),
      tideType,
      tideTypeText,
      timeline
    });
  }
  return days;
}

Page({
  data: {
    stationKey: 'huizhou',
    stationDesc: '',
    days: [],
    activeIndex: 3, // 今天位于第 4 个
    activeDay: null,
    currentHeight: 0,
    stateText: '',
    stateClass: '',
    boluo: { level: '--', unit: 'm', time: '', warn: '', status: 'loading', source: '' }
  },

  onLoad() {
    this.refreshAll();
  },

  onShow() {
    this.refreshNow();
    this.loadBoluo();
    // 每分钟刷新一次“当前潮位”
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.refreshNow(), 60000);
  },

  onHide() {
    if (this._timer) clearInterval(this._timer);
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  // 博罗(二)站水位（带 6 小时缓存，数据源每日更新一次）
  loadBoluo() {
    surge.fetchBoluoCached().then((boluo) => {
      this.setData({ boluo });
    });
  },

  refreshAll() {
    const stationKey = this.data.stationKey;
    const station = tide.STATIONS[stationKey];
    const days = buildDays(stationKey);
    const activeIndex = this.data.activeIndex || 3;
    this.setData({
      stationDesc: station.desc,
      days,
      activeIndex,
      activeDay: days[activeIndex]
    });
    this.refreshNow();
  },

  refreshNow() {
    const station = tide.STATIONS[this.data.stationKey];
    if (!station) return;
    const h = tide.predictNow(station);
    const state = tide.tideState(station);
    this.setData({
      currentHeight: Math.round(h),
      stateText: state === 'rising' ? '涨潮中' : '退潮中',
      stateClass: state === 'rising' ? 'rising' : 'falling'
    });
  },

  switchStation(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.stationKey) return;
    this.setData({ stationKey: key });
    this.refreshAll();
  },

  selectDay(e) {
    const index = Number(e.currentTarget.dataset.index);
    const days = this.data.days;
    this.setData({ activeIndex: index, activeDay: days[index] });
    this.refreshNow();
  },

  // 复制备案号，引导用户到工信部备案查询页校验
  copyICP() {
    wx.setClipboardData({
      data: '粤ICP备2026106696号',
      success: () => {
        wx.showToast({ title: '备案号已复制，可于 beian.miit.gov.cn 查询', icon: 'none', duration: 2500 });
      }
    });
  }
});
