// components/water-chart/water-chart.js
// 水位趋势图组件 —— canvas 2d 绘制 24h 水位序列
Component({
  properties: {
    trend: { type: Object, value: null, observer() { this.draw(); } }
  },

  lifetimes: {
    attached() {
      this.ctx = null;
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
      q.select('#waterCanvas').fields({ node: true, size: true }).exec((res) => {
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
        this.cssW = w;
        this.cssH = h;
        this.canvasReady = true;
        this.draw();
      });
    },

    draw() {
      if (!this.canvasReady || !this.ctx || !this.data.trend) return;
      const ctx = this.ctx;
      const w = this.cssW;
      const h = this.cssH;
      const trend = this.data.trend;
      const points = trend.points || [];
      if (!w || !h || points.length < 2) return;

      ctx.clearRect(0, 0, w, h);

      const padL = 44, padR = 14, padT = 16, padB = 28;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const lo = trend.minH;
      const hi = trend.maxH;
      const span = hi - lo || 10;
      const hMin = lo - span * 0.15;
      const hMax = hi + span * 0.15;
      const totalMin = (points.length - 1) * 30; // 总分钟数

      const xOf = (m) => padL + (m / totalMin) * plotW;
      const yOf = (val) => padT + (1 - (val - hMin) / (hMax - hMin)) * plotH;

      // 背景
      const bg = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      bg.addColorStop(0, 'rgba(33, 88, 130, 0.3)');
      bg.addColorStop(1, 'rgba(13, 43, 77, 0.08)');
      ctx.fillStyle = bg;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Y 轴网格 + 刻度
      const step = Math.ceil(span / 3 / 10) * 10 || 10;
      const gridStart = Math.ceil(hMin / step) * step;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = gridStart; v <= hMax; v += step) {
        const y = yOf(v);
        ctx.strokeStyle = 'rgba(31, 74, 110, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(143, 176, 208, 0.6)';
        ctx.beginPath();
        ctx.moveTo(padL - 4, y);
        ctx.lineTo(padL, y);
        ctx.stroke();
        ctx.fillStyle = '#9fc4e0';
        ctx.fillText(String(Math.round(v)), padL - 7, y);
      }

      // X 轴刻度（-12h / -6h / 现在 / +6h / +12h）
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xLabels = [
        { idx: 0, text: '-12h' },
        { idx: 12, text: '-6h' },
        { idx: 24, text: '现在' },
        { idx: 36, text: '+6h' },
        { idx: 48, text: '+12h' }
      ];
      xLabels.forEach((xl) => {
        if (xl.idx > points.length - 1) return;
        const x = xOf(xl.idx * 30);
        ctx.strokeStyle = xl.text === '现在' ? 'rgba(255, 214, 10, 0.3)' : 'rgba(31, 74, 110, 0.4)';
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(143, 176, 208, 0.6)';
        ctx.beginPath();
        ctx.moveTo(x, padT + plotH);
        ctx.lineTo(x, padT + plotH + 4);
        ctx.stroke();
        ctx.fillStyle = xl.text === '现在' ? '#ffd60a' : '#6f93b3';
        ctx.fillText(xl.text, x, padT + plotH + 7);
      });

      // 轴线
      ctx.strokeStyle = 'rgba(143, 176, 208, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      // 轴标题
      ctx.fillStyle = '#6f93b3';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('水位(cm)', padL, padT - 3);

      // 曲线 + 填充
      const baseline = padT + plotH;
      ctx.beginPath();
      ctx.moveTo(xOf(points[0].minutes), baseline);
      points.forEach((p) => ctx.lineTo(xOf(p.minutes), yOf(p.height)));
      ctx.lineTo(xOf(points[points.length - 1].minutes), baseline);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, padT, 0, baseline);
      fill.addColorStop(0, 'rgba(79, 195, 247, 0.3)');
      fill.addColorStop(1, 'rgba(79, 195, 247, 0.03)');
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = xOf(p.minutes), y = yOf(p.height);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 当前时刻竖线
      const nowIdx = trend.nowIdx || 24;
      if (nowIdx >= 0 && nowIdx <= points.length - 1) {
        const x = xOf(nowIdx * 30);
        ctx.strokeStyle = 'rgba(255, 214, 10, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        // 当前点
        const y = yOf(points[nowIdx].height);
        ctx.fillStyle = '#ffd60a';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff8d6';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(points[nowIdx].height + '', x, y - 6);
      }
    }
  }
});
