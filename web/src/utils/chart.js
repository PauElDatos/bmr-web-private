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

function normalizePoints(points) {
  return (points || [])
    .map(p => ({ dt: String(p.dt || '').slice(0, 10), x: parseDate(p.dt), y: Number(p.value) }))
    .filter(p => p.dt && Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
}

export function drawLineChart(container, series, options = {}) {
  const { ctx, width, height } = getCanvas(container);
  const pad = options.hideYAxisGutter ? { l: 38, r: 22, t: 24, b: 38 } : { l: 58, r: 22, t: 28, b: 38 };
  ctx.clearRect(0, 0, width, height);

  const normalizedSeries = (series || []).map((s, idx) => ({
    ...s,
    color: s.color || PALETTE[idx % PALETTE.length],
    width: s.width || 2,
    points: normalizePoints(s.points)
  }));
  const all = normalizedSeries.flatMap(s => s.points.map(p => ({ x: p.x, y: p.y })));

  if (!all.length) {
    ctx.fillStyle = '#B0B0B0';
    ctx.font = '14px Arial, system-ui, sans-serif';
    ctx.fillText('Sin datos para mostrar', 24, 40);
    container._chartState = null;
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
    dataMaxY,
    series: normalizedSeries
  };

  ctx.fillStyle = '#252525';
  ctx.fillRect(0, 0, width, height);

  // Optional vertical bands, disabled on macro by passing an empty array.
  for (const band of options.bands || []) {
    const bx0 = xScale(parseDate(band.from));
    const bx1 = xScale(parseDate(band.to));
    const left = Math.max(pad.l, bx0);
    const right = Math.min(width - pad.r, bx1);
    if (right <= pad.l || left >= width - pad.r) continue;
    ctx.fillStyle = band.color || 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(left, pad.t, Math.max(0, right - left), plotH);
  }

  // Grid and axes labels. The left-side label area is not painted separately, avoiding the grey vertical rectangle.
  ctx.strokeStyle = 'rgba(74, 74, 74, 0.72)';
  ctx.lineWidth = 1;
  ctx.font = '11px Arial, system-ui, sans-serif';
  ctx.fillStyle = '#B0B0B0';

  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
    const label = (maxY - (maxY - minY) * i / 4).toLocaleString('es-ES', { maximumFractionDigits: 2 });
    const labelX = Math.max(4, pad.l - ctx.measureText(label).width - 10);
    ctx.fillText(label, labelX, y + 4);
  }

  for (let i = 0; i <= 4; i++) {
    const x = pad.l + (plotW * i / 4);
    const t = minX + (maxX - minX) * i / 4;
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + plotH);
    ctx.stroke();
    const label = new Date(t).getFullYear().toString();
    ctx.fillText(label, x - 14, height - 12);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, plotW, plotH);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, plotW, plotH);
  ctx.clip();

  normalizedSeries.forEach((s) => {
    const visiblePts = s.points.filter(p => p.x >= minX && p.x <= maxX);
    const pts = visiblePts.length ? visiblePts : s.points;
    if (!pts.length) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xScale(p.x), y = yScale(p.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

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
    normalizedSeries.forEach((s, idx) => {
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
  if (!Number.isFinite(range) || range <= 0) return [floor, ceiling];
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

function formatTooltipDate(dt) {
  const d = new Date(dt);
  if (!Number.isFinite(d.getTime())) return String(dt || '');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTooltipValue(value) {
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: 4 });
}

function ensureTooltip(container) {
  let tooltip = container.querySelector('.chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    tooltip.setAttribute('role', 'status');
    container.appendChild(tooltip);
  }
  return tooltip;
}

function findNearestPoint(state, x, y) {
  const { pad, plotW, plotH, minX, maxX, minY, maxY, series } = state;
  const xScale = (px) => pad.l + ((px - minX) / Math.max(1, maxX - minX)) * plotW;
  const yScale = (py) => pad.t + (1 - ((py - minY) / Math.max(1, maxY - minY))) * plotH;
  let best = null;
  for (const s of series || []) {
    for (const p of s.points || []) {
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      const px = xScale(p.x);
      const py = yScale(p.y);
      const dx = Math.abs(px - x);
      const dy = Math.abs(py - y);
      const score = dx * 1.5 + dy * 0.35;
      if (!best || score < best.score) best = { ...p, px, py, name: s.name, score };
    }
  }
  return best;
}

function pointInPlot(state, x, y) {
  return x >= state.pad.l && x <= state.width - state.pad.r && y >= state.pad.t && y <= state.height - state.pad.b;
}

export function attachTradingChartInteractions(container, view, draw) {
  const canvas = container.querySelector('canvas');
  const tooltip = ensureTooltip(container);
  let dragging = false;
  let last = null;

  const updateTooltip = (event) => {
    const state = container._chartState;
    if (!state || !canvas || dragging) {
      tooltip.classList.remove('visible');
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!pointInPlot(state, x, y)) {
      tooltip.classList.remove('visible');
      return;
    }
    const nearest = findNearestPoint(state, x, y);
    if (!nearest) {
      tooltip.classList.remove('visible');
      return;
    }
    tooltip.innerHTML = `<strong>${nearest.name || 'Serie'}</strong><span>${formatTooltipDate(nearest.dt)}</span><em>${formatTooltipValue(nearest.y)}</em>`;
    const tooltipX = Math.min(Math.max(nearest.px + 12, 8), rect.width - 132);
    const tooltipY = Math.min(Math.max(nearest.py - 42, 8), rect.height - 78);
    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${tooltipY}px`;
    tooltip.classList.add('visible');
  };

  const onWheel = (event) => {
    const state = container._chartState;
    if (!state || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { pad, width, height, plotW, plotH } = state;
    const overYAxis = x >= 0 && x <= pad.l + 20 && y >= pad.t && y <= height - pad.b;
    const overXAxis = y >= height - pad.b - 20 && y <= height && x >= pad.l && x <= width - pad.r;
    const overPlot = pointInPlot(state, x, y);
    if (!overYAxis && !overXAxis && !overPlot) return;

    event.preventDefault();
    const factor = event.deltaY > 0 ? 1.16 : 0.86;

    if (overXAxis || overPlot) {
      const center = state.minX + ((Math.min(Math.max(x, pad.l), width - pad.r) - pad.l) / Math.max(1, plotW)) * (state.maxX - state.minX);
      const minRange = 30 * DAY_MS;
      const [xMin, xMax] = zoomAround(state.minX, state.maxX, state.dataMinX, state.dataMaxX, center, factor, minRange);
      view.xMin = xMin;
      view.xMax = xMax;
    }

    if (overYAxis || overPlot || event.shiftKey) {
      const center = state.minY + (1 - ((Math.min(Math.max(y, pad.t), height - pad.b) - pad.t) / Math.max(1, plotH))) * (state.maxY - state.minY);
      const minRange = Math.max((state.dataMaxY - state.dataMinY) * 0.015, 0.000001);
      const [yMin, yMax] = zoomAround(state.minY, state.maxY, state.dataMinY, state.dataMaxY, center, factor, minRange);
      view.yMin = yMin;
      view.yMax = yMax;
    }

    draw();
    updateTooltip(event);
  };

  const onPointerDown = (event) => {
    const state = container._chartState;
    if (!state || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!pointInPlot(state, x, y)) return;
    event.preventDefault();
    dragging = true;
    last = { x, y };
    canvas.setPointerCapture?.(event.pointerId);
    container.classList.add('dragging');
    tooltip.classList.remove('visible');
  };

  const onPointerMove = (event) => {
    const state = container._chartState;
    if (!state || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!dragging || !last) {
      updateTooltip(event);
      return;
    }

    const dx = x - last.x;
    const dy = y - last.y;
    last = { x, y };

    const xSpan = state.maxX - state.minX;
    const ySpan = state.maxY - state.minY;
    const xShift = -dx / Math.max(1, state.plotW) * xSpan;
    const yShift = dy / Math.max(1, state.plotH) * ySpan;
    const [xMin, xMax] = clampRange(state.minX + xShift, state.maxX + xShift, state.dataMinX, state.dataMaxX);
    const [yMin, yMax] = clampRange(state.minY + yShift, state.maxY + yShift, state.dataMinY, state.dataMaxY);

    view.xMin = xMin;
    view.xMax = xMax;
    view.yMin = yMin;
    view.yMax = yMax;
    draw();
  };

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    last = null;
    container.classList.remove('dragging');
    canvas.releasePointerCapture?.(event.pointerId);
  };

  const onDblClick = () => {
    delete view.xMin;
    delete view.xMax;
    delete view.yMin;
    delete view.yMax;
    tooltip.classList.remove('visible');
    draw();
  };

  const onLeave = () => {
    tooltip.classList.remove('visible');
  };

  container.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('mouseleave', onLeave);
  container.addEventListener('dblclick', onDblClick);

  return () => {
    container.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', endDrag);
    canvas.removeEventListener('mouseleave', onLeave);
    container.removeEventListener('dblclick', onDblClick);
    tooltip.remove();
  };
}

export function attachAxisWheelZoom(container, view, draw) {
  return attachTradingChartInteractions(container, view, draw);
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
