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


function niceNumber(value, round = true) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  const niceFraction = round
    ? (fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 4 ? 2.5 : fraction < 7 ? 5 : 10)
    : (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10);
  return niceFraction * Math.pow(10, exponent);
}

function pickStep(targetValue, allowedSteps) {
  for (const step of allowedSteps) {
    if (targetValue <= step) return step;
  }
  return allowedSteps[allowedSteps.length - 1];
}

function formatAxisNumber(value, step) {
  const normalized = Math.abs(value) < Math.abs(step) * 1e-8 ? 0 : value;
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(Math.abs(step || 1))) + 1));
  return normalized.toLocaleString('es-ES', { maximumFractionDigits: decimals });
}

function generateAnchoredYTicks(minY, maxY, plotH) {
  const span = maxY - minY;
  if (!Number.isFinite(span) || span <= 0) return [];
  const targetTicks = Math.max(3, Math.min(8, Math.round(plotH / 72)));
  const step = niceNumber(span / targetTicks, true);
  const first = Math.floor(minY / step) * step;
  const ticks = [];
  const maxTicks = 40;
  for (let value = first, i = 0; value <= maxY + step * 0.5 && i < maxTicks; value += step, i++) {
    if (value >= minY - step * 0.5) ticks.push({ value, label: formatAxisNumber(value, step) });
  }
  return ticks;
}

function chooseYearInterval(yearSpan, targetTicks) {
  const raw = Math.max(1, yearSpan / Math.max(1, targetTicks));
  const exponent = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exponent);
  const fraction = raw / base;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return Math.max(1, niceFraction * base);
}

function generateAnchoredTimeTicks(minX, maxX, plotW) {
  const span = maxX - minX;
  if (!Number.isFinite(span) || span <= 0) return [];
  const spanDays = span / DAY_MS;
  const targetTicks = Math.max(3, Math.min(9, Math.round(plotW / 130)));
  const ticks = [];
  const maxTicks = 80;

  if (spanDays > 365 * 1.35) {
    const minDate = new Date(minX);
    const maxDate = new Date(maxX);
    const minYear = minDate.getUTCFullYear();
    const maxYear = maxDate.getUTCFullYear();
    const interval = chooseYearInterval(Math.max(1, maxYear - minYear + 1), targetTicks);
    const startYear = Math.floor(minYear / interval) * interval;
    for (let year = startYear, i = 0; year <= maxYear + interval && i < maxTicks; year += interval, i++) {
      const value = Date.UTC(year, 0, 1);
      if (value >= minX - span * 0.03 && value <= maxX + span * 0.03) ticks.push({ value, label: String(year) });
    }
    return ticks;
  }

  if (spanDays > 45) {
    const minDate = new Date(minX);
    const maxDate = new Date(maxX);
    const totalMonths = (maxDate.getUTCFullYear() - minDate.getUTCFullYear()) * 12 + (maxDate.getUTCMonth() - minDate.getUTCMonth()) + 1;
    const interval = pickStep(Math.max(1, totalMonths / targetTicks), [1, 2, 3, 6, 12]);
    const startMonthIndex = Math.floor(((minDate.getUTCFullYear() * 12) + minDate.getUTCMonth()) / interval) * interval;
    for (let monthIndex = startMonthIndex, i = 0; monthIndex <= (maxDate.getUTCFullYear() * 12 + maxDate.getUTCMonth()) + interval && i < maxTicks; monthIndex += interval, i++) {
      const year = Math.floor(monthIndex / 12);
      const month = monthIndex % 12;
      const value = Date.UTC(year, month, 1);
      if (value < minX - span * 0.03 || value > maxX + span * 0.03) continue;
      const date = new Date(value);
      const monthLabel = date.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).replace('.', '');
      ticks.push({ value, label: month === 0 || interval >= 12 ? `${monthLabel} ${year}` : monthLabel });
    }
    return ticks;
  }

  const intervalDays = pickStep(Math.max(1, spanDays / targetTicks), [1, 2, 7, 14, 30]);
  const firstDay = Math.floor(minX / DAY_MS / intervalDays) * intervalDays;
  for (let day = firstDay, i = 0; day * DAY_MS <= maxX + span * 0.03 && i < maxTicks; day += intervalDays, i++) {
    const value = day * DAY_MS;
    if (value < minX - span * 0.03) continue;
    const date = new Date(value);
    ticks.push({ value, label: date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) });
  }
  return ticks;
}

function normalizePoints(points) {
  return (points || [])
    .map(p => ({ dt: String(p.dt || '').slice(0, 10), x: parseDate(p.dt), y: Number(p.value) }))
    .filter(p => p.dt && Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
}

export function drawLineChart(container, series, options = {}) {
  const { ctx, width, height } = getCanvas(container);
  const pad = options.hideYAxisGutter ? { l: 58, r: 22, t: 24, b: 38 } : { l: 58, r: 22, t: 28, b: 38 };
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
    ctx.font = '16px Arial, system-ui, sans-serif';
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

  // Grid and axes labels. With anchoredGrid enabled, ticks are calculated in data coordinates
  // instead of fixed screen percentages. That makes the grid and axis numbers move with the
  // data while panning, rather than staying pinned to static canvas positions.
  ctx.strokeStyle = 'rgba(74, 74, 74, 0.72)';
  ctx.lineWidth = 1;
  ctx.font = '13px Arial, system-ui, sans-serif';
  ctx.fillStyle = '#B0B0B0';

  if (options.anchoredGrid) {
    ctx.textAlign = 'right';
    for (const tick of generateAnchoredYTicks(minY, maxY, plotH)) {
      const y = yScale(tick.value);
      if (y < pad.t - 0.5 || y > pad.t + plotH + 0.5) continue;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
      ctx.fillText(tick.label, pad.l - 8, y + 4);
    }

    ctx.textAlign = 'center';
    for (const tick of generateAnchoredTimeTicks(minX, maxX, plotW)) {
      const x = xScale(tick.value);
      if (x < pad.l - 0.5 || x > width - pad.r + 0.5) continue;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.fillText(tick.label, x, height - 12);
    }
  } else {
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (plotH * i / 4);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
      const label = (maxY - (maxY - minY) * i / 4).toLocaleString('es-ES', { maximumFractionDigits: 2 });
      ctx.fillText(label, pad.l - 8, y + 4);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const x = pad.l + (plotW * i / 4);
      const t = minX + (maxX - minX) * i / 4;
      const label = new Date(t).getFullYear().toString();
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.fillText(label, x, height - 12);
    }
  }
  ctx.textAlign = 'left';

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
    ctx.font = '14px Arial, system-ui, sans-serif';
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

    // Trackpads emit horizontal wheel deltas when the user slides two fingers left/right.
    // In that case the chart should pan on X, not zoom.
    const horizontalDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaX * 16 : event.deltaX;
    const verticalDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
    const isHorizontalPan = Math.abs(horizontalDelta) > Math.abs(verticalDelta) && Math.abs(horizontalDelta) > 0;

    if (isHorizontalPan) {
      const xSpan = state.maxX - state.minX;
      const xShift = horizontalDelta / Math.max(1, plotW) * xSpan;
      const [xMin, xMax] = clampRange(state.minX + xShift, state.maxX + xShift, state.dataMinX, state.dataMaxX);
      view.xMin = xMin;
      view.xMax = xMax;
      draw();
      updateTooltip(event);
      return;
    }

    const factor = verticalDelta > 0 ? 1.16 : 0.86;

    if (event.shiftKey) {
      const center = state.minY + (1 - ((Math.min(Math.max(y, pad.t), height - pad.b) - pad.t) / Math.max(1, plotH))) * (state.maxY - state.minY);
      const minRange = Math.max((state.dataMaxY - state.dataMinY) * 0.015, 0.000001);
      const [yMin, yMax] = zoomAround(state.minY, state.maxY, state.dataMinY, state.dataMaxY, center, factor, minRange);
      view.yMin = yMin;
      view.yMax = yMax;
    } else {
      const center = state.minX + ((Math.min(Math.max(x, pad.l), width - pad.r) - pad.l) / Math.max(1, plotW)) * (state.maxX - state.minX);
      const minRange = 30 * DAY_MS;
      const [xMin, xMax] = zoomAround(state.minX, state.maxX, state.dataMinX, state.dataMaxX, center, factor, minRange);
      view.xMin = xMin;
      view.xMax = xMax;
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
