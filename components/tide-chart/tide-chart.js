// components/tide-chart/tide-chart.js
// 潮汐曲线图组件 —— canvas 2d 绘制
const tide = require('../../utils/tide.js');

Component({
  properties: {
    stationKey: { type: String, value: 'huizhou' },
    // 当日预测数据 predictDay 的结果
    day: { type: Object, value: null, observer() { this.draw(); } },
    // 是否绘制“当前时刻”标记线
    showNow: { type: Boolean, value: true }
  },

  data: {
    cssW: 0,
    cssH: 0
  },

  lifetimes: {
    ready() {
      this.initCanvas();
    }
  },

  methods: {
    initCanvas() {
      const q = wx.createSelectorQuery().in(this);
      q.select('#tideCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 2;
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this.canvas = canvas;
        this.ctx = ctx;
        this.setData({ cssW: w, cssH: h });
        this.draw();
      });
    },

    draw() {
      if (!this.ctx || !this.data.day) return;
      const ctx = this.ctx;
      const w = this.data.cssW;
      const h = this.data.cssH;
      const day = this.data.day;
      if (!w || !h) return;

      ctx.clearRect(0, 0, w, h);

      // 绘图区边距
      const padL = 46, padR = 14, padT = 20, padB = 26;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      // 数据范围（cm），留出余量
      const lo = day.min.height;
      const hi = day.max.height;
      const span = hi - lo || 50;
      const hMin = lo - span * 0.12;
      const hMax = hi + span * 0.12;

      const xOf = (m) => padL + (m / 1440) * plotW;
      const yOf = (val) => padT + (1 - (val - hMin) / (hMax - hMin)) * plotH;

      // 背景渐变
      const bg = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      bg.addColorStop(0, 'rgba(33, 88, 130, 0.35)');
      bg.addColorStop(1, 'rgba(13, 43, 77, 0.10)');
      ctx.fillStyle = bg;
      ctx.fillRect(padL, padT, plotW, plotH);

      // 横向网格 + y 轴标签（潮高，每 50cm）
      const step = 50;
      const gridStart = Math.ceil(hMin / step) * step;
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#8fb0d0';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = gridStart; v <= hMax; v += step) {
        const y = yOf(v);
        ctx.strokeStyle = 'rgba(31, 74, 110, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.stroke();
        ctx.fillText(String(Math.round(v)), padL - 6, y);
      }

      // 竖向网格 + x 轴标签（0/6/12/18/24 时）
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      [0, 6, 12, 18, 24].forEach((hr) => {
        const m = hr * 60;
        const x = xOf(m);
        ctx.strokeStyle = 'rgba(31, 74, 110, 0.45)';
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.fillText(String(hr).padStart(2, '0'), x, padT + plotH + 6);
      });

      // 潮位曲线 + 填充
      const series = day.series || [];
      if (series.length > 1) {
        const baseline = padT + plotH;
        // 填充
        ctx.beginPath();
        ctx.moveTo(xOf(series[0].minutes), baseline);
        series.forEach((p) => ctx.lineTo(xOf(p.minutes), yOf(p.height)));
        ctx.lineTo(xOf(series[series.length - 1].minutes), baseline);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, padT, 0, baseline);
        fill.addColorStop(0, 'rgba(79, 195, 247, 0.32)');
        fill.addColorStop(1, 'rgba(79, 195, 247, 0.04)');
        ctx.fillStyle = fill;
        ctx.fill();
        // 描边
        ctx.beginPath();
        series.forEach((p, i) => {
          const x = xOf(p.minutes), y = yOf(p.height);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // 高潮点
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      (day.highs || []).forEach((p) => {
        const x = xOf(p.minutes), y = yOf(p.height);
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd9d9';
        ctx.fillText(Math.round(p.height) + '', x, y - 4);
      });
      // 低潮点
      ctx.textBaseline = 'top';
      (day.lows || []).forEach((p) => {
        const x = xOf(p.minutes), y = yOf(p.height);
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cfeefd';
        ctx.fillText(Math.round(p.height) + '', x, y + 4);
      });

      // 当前时刻竖线
      if (this.data.showNow && this.data.stationKey) {
        const station = tide.STATIONS[this.data.stationKey];
        if (station) {
          const now = new Date();
          const dayStart = tide.startOfDay(now).getTime();
          if (now.getTime() >= dayStart && now.getTime() < dayStart + 86400000) {
            const minutes = (now - dayStart) / 60000;
            const x = xOf(minutes);
            ctx.strokeStyle = 'rgba(255, 214, 10, 0.85)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, padT + plotH);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffd60a';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('现在', x + 3, padT + 2);
          }
        }
      }
    }
  }
});
