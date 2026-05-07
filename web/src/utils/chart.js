function getCanvas(container) {
  const canvas = container.querySelector('canvas');
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * ratio));
  canvas.height = Math.max(220, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { canvas, ctx, width: rect.width, height: rect.height };
}

const PALETTE = ['#FEF702', '#36C3FF', '#FF6A00', '#B0B0B0', '#9467bd', '#17becf', '#8c564b'];
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(d) { return new Date(d).getTime(); }

function paddedYRange(values) {
  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const yPad = (maxY - minY) * 0.08;
  return { minY: minY - yPad, maxY: maxY + yPad };
}

export function drawLineChart(container, series, options = {}) {
  const { ctx, width, height } = getCanvas(container);
  const pad = options.hideYAxisGutter ? { l: 34, r: 22, t: 28, b: 38 } : { l: 58, r: 22, t: 28, b: 38 };
  ctx.clearRect(0, 0, width, height);

  const all = [];
  for (const s of series || []) {
    for (const p of s.points || []) {
      const x = parseDate(p.dt);
      const y = Number(p.value);
      if (Number.isFinite(x) && Number.isFinite(y)) all.push({ x, y });
    }
  }

  if (!all.length) {
    ctx.fillStyle = '#B0B0B0';
    ctx.font = '14px Arial, system-ui, sans-serif';
    ctx.fillText('Sin datos para mostrar', 24, 40);
    return;
  }

  const dataMinX = Math.min(...all.map(p => p.x));
  const dataMaxX = Math.max(...all.map(p => p.x));
  const yRange = paddedYRange(all.map(p => p.y));
  const dataMinY = yRange.minY;
  const dataMaxY = yRange.maxY;

  let minX = Number.isFinite(Number(options.view?.xMin)) ? Number(options.view.xMin) : dataMinX;
  let maxX = Number.isFinite(Number(options.view?.xMax)) ? Number(options.view.xMax) : dataMaxX;
  let minY = Number.isFinite(Number(options.view?.yMin)) ? Number(options.view.yMin) : dataMinY;
  let maxY = Number.isFinite(Number(options.view?.yMax)) ? Number(options.view.yMax) : dataMaxY;

  if (minX === maxX) { minX -= DAY_MS; maxX += DAY_MS; }
  if (minY === maxY) { minY -= 1; maxY += 1; }

  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = Math.max(1, height - pad.t - pad.b);
  const xScale = (x) => pad.l + ((x - minX) / Math.max(1, maxX - minX)) * plotW;
  const yScale = (y) => pad.t + (1 - ((y - minY) / Math.max(1, maxY - minY))) * plotH;

  container._chartState = {
    pad,
    width,
    height,
    plotW,
    plotH,
    minX,
    maxX,
    minY,
    maxY,
    dataMinX,
    dataMaxX,
    dataMinY,
    dataMaxY
  };

  ctx.fillStyle = '#252525';
  ctx.fillRect(0, 0, width, height);

  // recession or regime bands
  for (const band of options.bands || []) {
    const bx0 = xScale(parseDate(band.from));
    const bx1 = xScale(parseDate(band.to));
    const left = Math.max(pad.l, bx0);
    const right = Math.min(width - pad.r, bx1);
    if (right <= pad.l || left >= width - pad.r) continue;
    ctx.fillStyle = band.color || 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(left, pad.t, Math.max(0, right - left), plotH);
  }

  // grid
  ctx.strokeStyle = 'rgba(74, 74, 74, 0.72)';
  ctx.lineWidth = 1;
  ctx.font = '11px Arial, system-ui, sans-serif';
  ctx.fillStyle = '#B0B0B0';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i / 4);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    const label = (maxY - (maxY - minY) * i / 4).toLocaleString('es-ES', { maximumFractionDigits: 2 });
    ctx.fillText(label, options.hideYAxisGutter ? pad.l + 6 : 8, y + 4);
  }
  for (let i = 0; i <= 4; i++) {
    const x = pad.l + (plotW * i / 4);
    const t = minX + (maxX - minX) * i / 4;
    const label = new Date(t).getFullYear().toString();
    ctx.fillText(label, x - 14, height - 12);
  }

  // border without forcing a heavy left gutter on compact charts
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(width - pad.r, pad.t);
  ctx.lineTo(width - pad.r, pad.t + plotH);
  ctx.lineTo(pad.l, pad.t + plotH);
  if (!options.hideYAxisGutter) ctx.lineTo(pad.l, pad.t);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, plotW, plotH);
  ctx.clip();

  (series || []).forEach((s, idx) => {
    const pts = (s.points || [])
      .filter(p => Number.isFinite(Number(p.value)) && Number.isFinite(parseDate(p.dt)))
      .map(p => ({ x: parseDate(p.dt), y: Number(p.value) }));
    if (!pts.length) return;
    ctx.strokeStyle = s.color || PALETTE[idx % PALETTE.length];
    ctx.lineWidth = s.width || 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xScale(p.x), y = yScale(p.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // event markers
  for (const marker of options.markers || []) {
    if (!marker.dt) continue;
    const mx = xScale(parseDate(marker.dt));
    if (!Number.isFinite(mx) || mx < pad.l || mx > width - pad.r) continue;
    ctx.strokeStyle = marker.color || 'rgba(254, 247, 2, .42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, pad.t);
    ctx.lineTo(mx, pad.t + plotH);
    ctx.stroke();
  }

  ctx.restore();

  if (!options.hideLegend) {
    let lx = pad.l;
    let ly = 16;
    ctx.font = '12px Arial, system-ui, sans-serif';
    (series || []).forEach((s, idx) => {
      const c = s.color || PALETTE[idx % PALETTE.length];
      ctx.fillStyle = c;
      ctx.fillRect(lx, ly - 9, 14, 3);
      ctx.fillStyle = '#B0B0B0';
      ctx.fillText(s.name || `Serie ${idx + 1}`, lx + 20, ly - 5);
      lx += (s.name || '').length * 7 + 64;
    });
  }
}

function clampRange(min, max, floor, ceiling) {
  const full = ceiling - floor;
  let range = max - min;
  if (range >= full) return [floor, ceiling];
  if (min < floor) { max += floor - min; min = floor; }
  if (max > ceiling) { min -= max - ceiling; max = ceiling; }
  return [Math.max(floor, min), Math.min(ceiling, max)];
}

function zoomAround(min, max, floor, ceiling, center, factor, minRange) {
  const currentRange = Math.max(minRange, max - min);
  const nextRange = Math.max(minRange, currentRange * factor);
  const ratio = currentRange ? (center - min) / currentRange : 0.5;
  let nextMin = center - nextRange * ratio;
  let nextMax = nextMin + nextRange;
  return clampRange(nextMin, nextMax, floor, ceiling);
}

export function attachAxisWheelZoom(container, view, draw) {
  const onWheel = (event) => {
    const state = container._chartState;
    const canvas = container.querySelector('canvas');
    if (!state || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { pad, width, height, plotW, plotH } = state;
    const overYAxis = x >= 0 && x <= pad.l + 18 && y >= pad.t && y <= height - pad.b;
    const overXAxis = y >= height - pad.b - 18 && y <= height && x >= pad.l && x <= width - pad.r;
    if (!overYAxis && !overXAxis) return;

    event.preventDefault();
    const factor = event.deltaY > 0 ? 1.16 : 0.86;

    if (overXAxis) {
      const center = state.minX + ((x - pad.l) / Math.max(1, plotW)) * (state.maxX - state.minX);
      const minRange = 30 * DAY_MS;
      const [xMin, xMax] = zoomAround(state.minX, state.maxX, state.dataMinX, state.dataMaxX, center, factor, minRange);
      view.xMin = xMin;
      view.xMax = xMax;
    }

    if (overYAxis) {
      const center = state.minY + (1 - ((y - pad.t) / Math.max(1, plotH))) * (state.maxY - state.minY);
      const minRange = Math.max((state.dataMaxY - state.dataMinY) * 0.015, 0.000001);
      const [yMin, yMax] = zoomAround(state.minY, state.maxY, state.dataMinY, state.dataMaxY, center, factor, minRange);
      view.yMin = yMin;
      view.yMax = yMax;
    }

    draw();
  };

  const onDblClick = () => {
    delete view.xMin;
    delete view.xMax;
    delete view.yMin;
    delete view.yMax;
    draw();
  };

  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('dblclick', onDblClick);
  return () => {
    container.removeEventListener('wheel', onWheel);
    container.removeEventListener('dblclick', onDblClick);
  };
}

export function attachResize(container, draw) {
  let raf = null;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}
