// components/tide-chart/tide-chart.js
// 潮汐曲线图组件 —— canvas 2d 绘制
const tide = require('../../utils/tide.js');

Component({
  properties: {
    stationKey: { type: String, value: 'huizhou' },
    // 当日预测数据 predictDay 的结果
    day: { type: Object, value: null, observer() { this.draw(); } },
    // 是否绘制"当前时刻"标记线
    showNow: { type: Boolean, value: true }
  },

  data: {
    cssW: 0,
    cssH: 0
  },

  lifetimes: {
    attached() {
      this.ctx = null;
      this.canvas = null;
      this.cssW = 0;
      this.cssH = 0;
      this.canvasReady = false;
    },
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
        // 用实例变量而非 setData，避免异步延迟导致 draw 读到旧值
        this.cssW = w;
        this.cssH = h;
        this.canvasReady = true;
        this.draw();
      });
    },

    draw() {
      // Canvas 未就绪或数据未到，都不画；两边就绪后由 observer/init 回调触发
      if (!this.canvasReady || !this.ctx || !this.data.day) return;
      const ctx = this.ctx;
      const w = this.cssW;
      const h = this.cssH;
      const day = this.data.day;
      if (!w || !h) return;

      ctx.clearRect(0, 0, w, h);

      // 绘图区边距
      const padL = 50, padR = 16, padT = 20, padB = 30;
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

      // === Y 轴：横向网格 + 刻度 + 数值标签（潮高，每 50cm） ===
      const step = 50;
      const gridStart = Math.ceil(hMin / step) * step;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = gridStart; v <= hMax; v += step) {
        const y = yOf(v);
        // 网格线
        ctx.strokeStyle = 'rgba(31, 74, 110, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.stroke();
        // 刻度短线（向轴左伸出）
        ctx.strokeStyle = 'rgba(143, 176, 208, 0.7)';
        ctx.beginPath();
        ctx.moveTo(padL - 4, y);
        ctx.lineTo(padL, y);
        ctx.stroke();
        // 数值标签
        ctx.fillStyle = '#9fc4e0';
        ctx.fillText(String(Math.round(v)), padL - 7, y);
      }

      // === X 轴：竖向网格 + 刻度 + 小时标签（每 3 小时） ===
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xHours = [0, 3, 6, 9, 12, 15, 18, 21, 24];
      xHours.forEach((hr) => {
        const m = hr * 60;
        const x = xOf(m);
        // 网格线（每 6 小时加深，每 3 小时浅）
        ctx.strokeStyle = (hr % 6 === 0) ? 'rgba(31, 74, 110, 0.55)' : 'rgba(31, 74, 110, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        // 刻度短线（向下伸出）
        ctx.strokeStyle = 'rgba(143, 176, 208, 0.7)';
        ctx.beginPath();
        ctx.moveTo(x, padT + plotH);
        ctx.lineTo(x, padT + plotH + 4);
        ctx.stroke();
        // 小时标签
        ctx.fillStyle = (hr % 6 === 0) ? '#b9d4ec' : '#6f93b3';
        ctx.fillText(String(hr).padStart(2, '0'), x, padT + plotH + 7);
      });

      // === 坐标轴线（左轴 + 底轴，加粗） ===
      ctx.strokeStyle = 'rgba(143, 176, 208, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      // === 轴标题 ===
      ctx.fillStyle = '#6f93b3';
      ctx.font = '9px sans-serif';
      // Y 轴标题（顶部）
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('潮高(cm)', padL, padT - 4);
      // X 轴标题（右下）
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('时', padL + plotW, padT + plotH + 16);

      // === 潮位曲线 + 填充 ===
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

      // === 高潮点 ===
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
      // === 低潮点 ===
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

      // === 当前时刻竖线 ===
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
