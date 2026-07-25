// utils/tide.js
// 东江潮汐预测 —— 基于天文潮汐调和常数模型
//
// 数据性质说明：
// 本模型采用珠江口不规则半日潮型的主要分潮（M2/S2/K1/O1 等）调和常数，
// 在本地计算任意日期的潮位曲线，可覆盖过去与未来任意天数。
// 属于天文潮汐预测，未计入气象增减水与上游径流影响，结果仅供参考，
// 实际潮位以水文/海洋部门发布的数据为准。
//
// 若需接入真实实时数据（如和风天气潮汐 API），可在 predictDay 中替换数据源。

// 纪元：2026-01-01 00:00 (UTC+8)，时间变量 t 为自纪元起的小时数（本地）
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0) - 8 * 3600 * 1000;

// 主要分潮角速度（度/小时）
const CONSTITUENTS = {
  M2:  { speed: 28.9841042 },
  S2:  { speed: 30.0 },
  N2:  { speed: 28.4397295 },
  K2:  { speed: 30.0821373 },
  K1:  { speed: 15.0410686 },
  O1:  { speed: 13.9430356 },
  P1:  { speed: 14.9589314 },
  Q1:  { speed: 13.3986609 },
  M4:  { speed: 57.9682104 },
  MS4: { speed: 58.9841042 }
};

// 站点配置
// m2HighAnchor: 该站 M2 分潮出现高潮的参考本地时刻（锚定潮时）
// deltas: 各分潮相位相对 M2 的差值（度），反映珠江口特征
// amps: 各分潮振幅（cm）
// datum: 平均海平面基准偏移（cm），使潮位为正
const STATIONS = {
  huizhou: {
    key: 'huizhou',
    name: '惠州',
    desc: '惠州·东江感潮段',
    // 锚定到惠州港真实高潮时刻（来源：国家海洋信息中心，经潮汐表网站）
    m2HighAnchor: new Date('2026-07-25T03:49:00+08:00'),
    datum: 120, // 平均海面，使高潮≈180、低潮≈60
    amps: {
      M2: 40, S2: 17, N2: 8, K2: 5,
      K1: 22, O1: 19, P1: 7, Q1: 4,
      M4: 4, MS4: 3
    },
    deltas: {
      M2: 0, S2: 60, N2: -18, K2: 72,
      K1: 40, O1: 60, P1: 92, Q1: 52,
      M4: -150, MS4: -128
    }
  },
  dongguan: {
    key: 'dongguan',
    name: '东莞',
    desc: '东莞·东江感潮段',
    // 更靠海，潮差略大、潮时略提前
    m2HighAnchor: new Date('2026-07-25T03:20:00+08:00'),
    datum: 130,
    amps: {
      M2: 52, S2: 22, N2: 10, K2: 6,
      K1: 26, O1: 22, P1: 9, Q1: 5,
      M4: 5, MS4: 4
    },
    deltas: {
      M2: 0, S2: 58, N2: -20, K2: 70,
      K1: 42, O1: 58, P1: 90, Q1: 50,
      M4: -140, MS4: -118
    }
  }
};

function hourSinceEpoch(date) {
  return (date.getTime() - EPOCH_MS) / 3600000; // 毫秒差转小时
}

// 预计算各分潮的迟角 g（度），由锚定时刻反推
function buildPhases(station) {
  const tAnchor = hourSinceEpoch(station.m2HighAnchor);
  const gM2 = (CONSTITUENTS.M2.speed * tAnchor) % 360;
  const phases = {};
  Object.keys(CONSTITUENTS).forEach((key) => {
    const d = station.deltas[key] || 0;
    phases[key] = (gM2 + d) % 360;
  });
  return phases;
}

// 计算指定时刻的潮位（cm）
function predictHeightAt(station, date) {
  const t = hourSinceEpoch(date);
  const phases = buildPhases(station);
  let h = station.datum;
  Object.keys(CONSTITUENTS).forEach((key) => {
    const c = CONSTITUENTS[key];
    const amp = station.amps[key] || 0;
    const g = phases[key];
    const arg = ((c.speed * t - g) * Math.PI) / 180;
    h += amp * Math.cos(arg);
  });
  return Math.round(h * 10) / 10;
}

// 采样一天（含前后1h余量），返回 {minutes, height} 序列
// minutes 为相对当日 00:00 的分钟数，可为负或大于 1440
function sampleDay(station, date) {
  const start = startOfDay(date);
  const step = 10; // 分钟
  const margin = 60; // 前后各1h余量以捕获边界极值
  const points = [];
  for (let m = -margin; m <= 1440 + margin; m += step) {
    const d = new Date(start.getTime() + m * 60 * 1000);
    points.push({ minutes: m, height: predictHeightAt(station, d) });
  }
  return points;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 抛物线插值细化极值点
function refinePeak(prev, cur, next) {
  const y0 = prev.height, y1 = cur.height, y2 = next.height;
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return { minutes: cur.minutes, height: cur.height };
  const delta = (0.5 * (y0 - y2)) / denom; // 步长倍数
  const m = cur.minutes + delta * (cur.minutes - prev.minutes);
  const h = y1 - 0.25 * (y0 - y2) * delta;
  return { minutes: m, height: Math.round(h * 10) / 10 };
}

// 找极值：type 'high' 局部极大，'low' 局部极小，限定在当日 [0,1440)
function findExtrema(points, type) {
  const result = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], cur = points[i], next = points[i + 1];
    let isPeak = false;
    if (type === 'high') isPeak = cur.height >= prev.height && cur.height > next.height;
    else isPeak = cur.height <= prev.height && cur.height < next.height;
    if (isPeak && cur.minutes >= 0 && cur.minutes < 1440) {
      const r = refinePeak(prev, cur, next);
      if (r.minutes >= 0 && r.minutes < 1440) result.push(r);
    }
  }
  return result;
}

function minutesToHHMM(min) {
  const total = Math.round(min);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return [String(hh).padStart(2, '0'), String(mm).padStart(2, '0')].join(':');
}

// 预测某日：返回 { date, highs, lows, hourly, max, min }
function predictDay(station, date) {
  const points = sampleDay(station, date);
  const highs = findExtrema(points, 'high');
  const lows = findExtrema(points, 'low');

  // 逐小时序列（0..23），用于绘图
  const dayStart = startOfDay(date);
  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const d = new Date(dayStart.getTime() + h * 3600 * 1000);
    hourly.push({ hour: h, height: predictHeightAt(station, d) });
  }

  const all = points.filter((p) => p.minutes >= 0 && p.minutes < 1440);
  const max = all.reduce((a, b) => (b.height > a.height ? b : a), all[0]);
  const min = all.reduce((a, b) => (b.height < a.height ? b : a), all[0]);
  const series = all.map((p) => ({ minutes: p.minutes, height: p.height }));

  return {
    date: startOfDay(date).getTime(),
    highs: highs.map((p) => ({ time: minutesToHHMM(p.minutes), height: p.height, minutes: p.minutes })).sort((a, b) => a.minutes - b.minutes),
    lows: lows.map((p) => ({ time: minutesToHHMM(p.minutes), height: p.height, minutes: p.minutes })).sort((a, b) => a.minutes - b.minutes),
    hourly,
    series,
    max: { time: minutesToHHMM(max.minutes), height: max.height },
    min: { time: minutesToHHMM(min.minutes), height: min.height }
  };
}

// 预测一个日期区间 [start, start+days)
function predictRange(station, startDate, days) {
  const list = [];
  const start = startOfDay(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    list.push(predictDay(station, d));
  }
  return list;
}

// 当前潮位
function predictNow(station) {
  return predictHeightAt(station, new Date());
}

// 潮汐状态：涨/落
function tideState(station, date) {
  const now = date || new Date();
  const before = predictHeightAt(station, new Date(now.getTime() - 30 * 60 * 1000));
  const after = predictHeightAt(station, new Date(now.getTime() + 30 * 60 * 1000));
  return after > before ? 'rising' : 'falling';
}

module.exports = {
  CONSTITUENTS,
  STATIONS,
  predictHeightAt,
  predictDay,
  predictRange,
  predictNow,
  tideState,
  startOfDay
};
