// components/boluo-trend/boluo-trend.js
// 博罗水位 7 天趋势图 —— canvas 2d 绘制历史记录
Component({
  properties: {
    history: { type: Array, value: [], observer() { this.draw(); } }
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
      q.select('#boluoTrendCanvas').fields({ node: true, size: true }).exec((res) => {
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
      if (!this.canvasReady || !this.ctx) return;
      const ctx = this.ctx;
      const w = this.cssW;
      const h = this.cssH;
      const history = this.data.history || [];
      if (!w || !h || history.length < 1) {
        // 无数据时画提示
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#6f93b3';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('暂无历史数据，使用几天后可见趋势', w / 2, h / 2);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const padL = 40, padR = 14, padT = 18, padB = 28;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const levels = history.map((d) => d.level);
      const lo = Math.min.apply(null, levels);
      const hi = Math.max.apply(null, levels);
      const span = hi - lo || 0.5;
      const hMin = lo - span * 0.2;
      const hMax = hi + span * 0.2;

      const n = history.length;
      const xOf = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const yOf = (val) => padT + (1 - (val - hMin) / (hMax - hMin)) * plotH;

      // 背景
      const bg = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      bg.addColorStop(0, 'rgba(33, 88, 130, 0.3)');
      bg.addColorStop(1, 'rgba(13, 43, 77, 0.08)');
      ctx.fillStyle = bg;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Y 轴网格 + 刻度
      const step = span < 1 ? 0.2 : span < 2 ? 0.5 : 1;
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
        ctx.fillText(v.toFixed(1), padL - 7, y);
      }

      // X 轴日期标签
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      history.forEach((d, i) => {
        const x = xOf(i);
        ctx.strokeStyle = 'rgba(31, 74, 110, 0.3)';
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(143, 176, 208, 0.6)';
        ctx.beginPath();
        ctx.moveTo(x, padT + plotH);
        ctx.lineTo(x, padT + plotH + 4);
        ctx.stroke();
        ctx.fillStyle = '#6f93b3';
        ctx.fillText(d.date, x, padT + plotH + 7);
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
      ctx.fillText('水位(m)', padL, padT - 3);

      // 折线 + 填充
      if (n >= 2) {
        const baseline = padT + plotH;
        ctx.beginPath();
        ctx.moveTo(xOf(0), baseline);
        history.forEach((d, i) => ctx.lineTo(xOf(i), yOf(d.level)));
        ctx.lineTo(xOf(n - 1), baseline);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, padT, 0, baseline);
        fill.addColorStop(0, 'rgba(76, 175, 80, 0.3)');
        fill.addColorStop(1, 'rgba(76, 175, 80, 0.03)');
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.beginPath();
        history.forEach((d, i) => {
          const x = xOf(i), y = yOf(d.level);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#66bb6a';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // 数据点 + 数值标签
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      history.forEach((d, i) => {
        const x = xOf(i), y = yOf(d.level);
        ctx.fillStyle = '#66bb6a';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c8f0c8';
        ctx.textBaseline = 'bottom';
        ctx.fillText(d.level.toFixed(2), x, y - 5);
      });
    }
  }
});
