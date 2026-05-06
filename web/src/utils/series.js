export function byDateMap(points) {
  const m = new Map();
  for (const p of points || []) m.set(String(p.dt).slice(0, 10), Number(p.value));
  return m;
}

function cleanPoints(points) {
  return (points || [])
    .map(p => ({ dt: String(p.dt).slice(0, 10), value: Number(p.value) }))
    .filter(p => p.dt && Number.isFinite(p.value))
    .sort((a, b) => a.dt.localeCompare(b.dt));
}

export function transformSeries(points, options = {}) {
  const invert = Boolean(options.invert);
  const transform = options.transform || options.scale || 'NORMAL';
  const lagMonths = Number(options.lagMonths || 0);
  const base = cleanPoints(points).map((p) => {
    const d = new Date(p.dt);
    if (lagMonths) d.setMonth(d.getMonth() + lagMonths);
    let value = Number(p.value);
    if (invert && value !== 0) value = 1 / value;
    return { dt: d.toISOString().slice(0, 10), value };
  }).filter(p => Number.isFinite(p.value));

  if (transform === 'LOG') {
    return base.map(p => ({ ...p, value: p.value > 0 ? Math.log(p.value) : null })).filter(p => Number.isFinite(p.value));
  }
  if (transform === 'EXP') {
    return base.map(p => ({ ...p, value: Math.exp(p.value / 100) })).filter(p => Number.isFinite(p.value));
  }
  if (transform === 'DIFF_1') return diffN(base, 1, false);
  if (transform === 'DIFF_12') return diffN(base, 12, false);
  if (transform === 'PCT_1') return diffN(base, 1, true);
  if (transform === 'PCT_12') return diffN(base, 12, true);
  if (transform === 'ZSCORE') return zscore(base);
  return base;
}

function diffN(points, n, pct) {
  const out = [];
  for (let i = n; i < points.length; i++) {
    const cur = Number(points[i].value);
    const prev = Number(points[i - n].value);
    let value = pct ? (prev !== 0 ? ((cur / prev) - 1) * 100 : null) : cur - prev;
    if (Number.isFinite(value)) out.push({ dt: points[i].dt, value });
  }
  return out;
}

function zscore(points) {
  const vals = points.map(p => Number(p.value)).filter(Number.isFinite);
  if (!vals.length) return points;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
  const sd = Math.sqrt(variance) || 1;
  return points.map(p => ({ dt: p.dt, value: (Number(p.value) - mean) / sd })).filter(p => Number.isFinite(p.value));
}

export function filterByYears(points, startYear, endYear) {
  const s = Number(startYear || 0);
  const e = Number(endYear || 9999);
  return (points || []).filter((p) => {
    const y = Number(String(p.dt).slice(0, 4));
    return y >= s && y <= e;
  });
}

export function calculateSeries(a, b, op = 'sum') {
  const mb = byDateMap(b);
  const out = [];
  for (const pa of a || []) {
    const av = Number(pa.value);
    const bv = mb.get(String(pa.dt).slice(0, 10));
    const value = applyOp(av, bv, op);
    if (Number.isFinite(value)) out.push({ dt: pa.dt, value });
  }
  return op === 'spread_z' ? zscore(out) : op === 'correlation_rolling' ? rollingCorrelationExact(a, b, 24) : out;
}

export function calculateSeriesAligned(a, b, op = 'sum') {
  if (op === 'correlation_rolling') return rollingCorrelationAligned(a, b, 24);
  const aa = cleanPoints(a);
  const bb = cleanPoints(b);
  const dates = [...new Set([...aa.map(p => p.dt), ...bb.map(p => p.dt)])].sort();
  const out = [];
  let ia = 0, ib = 0, lastA = null, lastB = null;
  for (const d of dates) {
    while (ia < aa.length && aa[ia].dt <= d) lastA = aa[ia++].value;
    while (ib < bb.length && bb[ib].dt <= d) lastB = bb[ib++].value;
    const value = applyOp(lastA, lastB, op);
    if (Number.isFinite(value)) out.push({ dt: d, value });
  }
  return op === 'spread_z' ? zscore(out) : out;
}

function applyOp(av, bv, op) {
  av = Number(av); bv = Number(bv);
  if (!Number.isFinite(av) || !Number.isFinite(bv)) return null;
  if (op === 'subtract' || op === 'spread_z') return av - bv;
  if (op === 'divide') return bv !== 0 ? av / bv : null;
  if (op === 'multiply') return av * bv;
  return av + bv;
}

function rollingCorrelationExact(a, b, n = 24) {
  const mb = byDateMap(b);
  const pairs = [];
  for (const pa of a || []) {
    const bv = mb.get(String(pa.dt).slice(0, 10));
    if (Number.isFinite(Number(pa.value)) && Number.isFinite(bv)) pairs.push({ dt: pa.dt, a: Number(pa.value), b: Number(bv) });
  }
  return rollingCorrPairs(pairs, n);
}

function rollingCorrelationAligned(a, b, n = 24) {
  const aa = cleanPoints(a), bb = cleanPoints(b);
  const dates = [...new Set([...aa.map(p => p.dt), ...bb.map(p => p.dt)])].sort();
  const pairs = [];
  let ia = 0, ib = 0, lastA = null, lastB = null;
  for (const d of dates) {
    while (ia < aa.length && aa[ia].dt <= d) lastA = aa[ia++].value;
    while (ib < bb.length && bb[ib].dt <= d) lastB = bb[ib++].value;
    if (Number.isFinite(lastA) && Number.isFinite(lastB)) pairs.push({ dt: d, a: lastA, b: lastB });
  }
  return rollingCorrPairs(pairs, n);
}

function rollingCorrPairs(pairs, n) {
  const out = [];
  for (let i = n - 1; i < pairs.length; i++) {
    const w = pairs.slice(i - n + 1, i + 1);
    const xs = w.map(x => x.a), ys = w.map(x => x.b);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const cov = xs.reduce((acc, x, j) => acc + (x - mx) * (ys[j] - my), 0);
    const vx = xs.reduce((acc, x) => acc + Math.pow(x - mx, 2), 0);
    const vy = ys.reduce((acc, y) => acc + Math.pow(y - my, 2), 0);
    const value = vx && vy ? cov / Math.sqrt(vx * vy) : null;
    if (Number.isFinite(value)) out.push({ dt: pairs[i].dt, value });
  }
  return out;
}

export function normalizeTo100(points) {
  const first = (points || []).find(p => Number.isFinite(Number(p.value)) && Number(p.value) !== 0);
  if (!first) return points || [];
  const base = Number(first.value);
  return points.map(p => ({ dt: p.dt, value: Number(p.value) / base * 100 })).filter(p => Number.isFinite(p.value));
}

export function makeRecessionBands(points, options = {}) {
  const bands = [];
  let start = null;
  let prev = null;
  for (const p of cleanPoints(points)) {
    const active = Number(p.value) >= 0.5;
    if (active && start === null) start = p.dt;
    if (!active && start !== null) {
      bands.push({ from: start, to: prev || p.dt, color: options.color || 'rgba(148, 163, 184, .16)' });
      start = null;
    }
    prev = p.dt;
  }
  if (start !== null && prev) bands.push({ from: start, to: prev, color: options.color || 'rgba(148, 163, 184, .16)' });
  return bands;
}

export function describePoints(points) {
  const clean = cleanPoints(points);
  const last = clean[clean.length - 1] || null;
  return {
    count: clean.length,
    firstDt: clean[0]?.dt || null,
    lastDt: last?.dt || null,
    firstValue: clean[0]?.value ?? null,
    lastValue: last?.value ?? null,
    min: clean.length ? Math.min(...clean.map(p => p.value)) : null,
    max: clean.length ? Math.max(...clean.map(p => p.value)) : null
  };
}

export function toCsvRows(series) {
  const names = (series || []).map(s => s.name || 'Serie');
  const maps = (series || []).map(s => byDateMap(s.points || []));
  const dates = [...new Set((series || []).flatMap(s => (s.points || []).map(p => String(p.dt).slice(0, 10))))].sort();
  if (!dates.length) return [];
  const rows = [['dt', ...names]];
  for (const d of dates) rows.push([d, ...maps.map(m => m.has(d) ? m.get(d) : '')]);
  return rows;
}
