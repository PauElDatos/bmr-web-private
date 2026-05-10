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
  const finite = (values || []).map(Number).filter(Number.isFinite);
  if (!finite.length) return { minY: -1, maxY: 1 };
  let minY = Math.min(...finite);
  let maxY = Math.max(...finite);
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

function buildAxisRange(axisKey, dataRange, view, multiAxis) {
  const minKey = axisKey === 'right' ? 'rightYMin' : 'leftYMin';
  const maxKey = axisKey === 'right' ? 'rightYMax' : 'leftYMax';
  const legacyMin = axisKey === 'left' && !multiAxis ? view?.yMin : undefined;
  const legacyMax = axisKey === 'left' && !multiAxis ? view?.yMax : undefined;
  let minY = Number.isFinite(Number(view?.[minKey])) ? Number(view[minKey]) : Number.isFinite(Number(legacyMin)) ? Number(legacyMin) : dataRange.minY;
  let maxY = Number.isFinite(Number(view?.[maxKey])) ? Number(view[maxKey]) : Number.isFinite(Number(legacyMax)) ? Number(legacyMax) : dataRange.maxY;
  if (minY === maxY) { minY -= 1; maxY += 1; }
  return { ...dataRange, minY, maxY };
}

function setAxisView(view, axisKey, minY, maxY, multiAxis) {
  if (!view) return;
  if (multiAxis) {
    if (axisKey === 'right') {
      view.rightYMin = minY;
      view.rightYMax = maxY;
    } else {
      view.leftYMin = minY;
      view.leftYMax = maxY;
    }
    return;
  }
  view.yMin = minY;
  view.yMax = maxY;
}

function clearAxisView(view, multiAxis) {
  if (!view) return;
  delete view.xMin;
  delete view.xMax;
  delete view.yMin;
  delete view.yMax;
  delete view.leftYMin;
  delete view.leftYMax;
  delete view.rightYMin;
  delete view.rightYMax;
}

export function drawLineChart(container, series, options = {}) {
  const { ctx, width, height } = getCanvas(container);
  ctx.clearRect(0, 0, width, height);

  const normalizedSeries = (series || []).map((s, idx) => ({
    ...s,
    axis: s.axis === 'right' ? 'right' : 'left',
    color: s.color || PALETTE[idx % PALETTE.length],
    width: s.width || 2,
    points: normalizePoints(s.points)
  }));
  const all = normalizedSeries.flatMap(s => s.points.map(p => ({ x: p.x, y: p.y, axis: s.axis })));

  if (!all.length) {
    ctx.fillStyle = '#B0B0B0';
    ctx.font = '16px Arial, system-ui, sans-serif';
    ctx.fillText('Sin datos para mostrar', 24, 40);
    container._chartState = null;
    return;
  }

  const hasRightAxis = normalizedSeries.some(s => s.axis === 'right' && s.points.length);
  const multiAxis = Boolean(options.dualAxis || hasRightAxis);
  const pad = multiAxis
    ? { l: 66, r: 72, t: 30, b: 40 }
    : (options.hideYAxisGutter ? { l: 58, r: 22, t: 24, b: 38 } : { l: 58, r: 22, t: 28, b: 38 });

  const dataMinX = Math.min(...all.map(p => p.x));
  const dataMaxX = Math.max(...all.map(p => p.x));
  const leftRange = paddedYRange(all.filter(p => p.axis !== 'right').map(p => p.y));
  const rightRange = paddedYRange(all.filter(p => p.axis === 'right').map(p => p.y));
  const leftAxis = buildAxisRange('left', leftRange, options.view, multiAxis);
  const rightAxis = buildAxisRange('right', hasRightAxis ? rightRange : leftRange, options.view, multiAxis);

  let minX = Number.isFinite(Number(options.view?.xMin)) ? Number(options.view.xMin) : dataMinX;
  let maxX = Number.isFinite(Number(options.view?.xMax)) ? Number(options.view.xMax) : dataMaxX;
  if (minX === maxX) { minX -= DAY_MS; maxX += DAY_MS; }
  if (leftAxis.minY === leftAxis.maxY) { leftAxis.minY -= 1; leftAxis.maxY += 1; }
  if (rightAxis.minY === rightAxis.maxY) { rightAxis.minY -= 1; rightAxis.maxY += 1; }

  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = Math.max(1, height - pad.t - pad.b);
  const xScale = (x) => pad.l + ((x - minX) / Math.max(1, maxX - minX)) * plotW;
  const yScaleForAxis = (axisKey) => {
    const a = axisKey === 'right' ? rightAxis : leftAxis;
    return (y) => pad.t + (1 - ((y - a.minY) / Math.max(1e-12, a.maxY - a.minY))) * plotH;
  };
  const yScaleLeft = yScaleForAxis('left');
  const yScaleRight = yScaleForAxis('right');

  container._chartState = {
    pad,
    width,
    height,
    plotW,
    plotH,
    minX,
    maxX,
    minY: leftAxis.minY,
    maxY: leftAxis.maxY,
    dataMinX,
    dataMaxX,
    dataMinY: leftAxis.minY,
    dataMaxY: leftAxis.maxY,
    multiAxis,
    axes: {
      left: { ...leftAxis, dataMinY: leftRange.minY, dataMaxY: leftRange.maxY },
      right: { ...rightAxis, dataMinY: (hasRightAxis ? rightRange : leftRange).minY, dataMaxY: (hasRightAxis ? rightRange : leftRange).maxY }
    },
    series: normalizedSeries
  };

  ctx.fillStyle = '#252525';
  ctx.fillRect(0, 0, width, height);

  for (const band of options.bands || []) {
    const bx0 = xScale(parseDate(band.from));
    const bx1 = xScale(parseDate(band.to));
    const left = Math.max(pad.l, bx0);
    const right = Math.min(width - pad.r, bx1);
    if (right <= pad.l || left >= width - pad.r) continue;
    ctx.fillStyle = band.color || 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(left, pad.t, Math.max(0, right - left), plotH);
  }

  ctx.strokeStyle = 'rgba(74, 74, 74, 0.72)';
  ctx.lineWidth = 1;
  ctx.font = '13px Arial, system-ui, sans-serif';
  ctx.fillStyle = '#B0B0B0';

  const drawYTicks = (ticks, scale, side = 'left', drawGrid = false) => {
    ctx.textAlign = side === 'right' ? 'left' : 'right';
    for (const tick of ticks) {
      const y = scale(tick.value);
      if (y < pad.t - 0.5 || y > pad.t + plotH + 0.5) continue;
      if (drawGrid) {
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
      }
      ctx.fillText(tick.label, side === 'right' ? width - pad.r + 8 : pad.l - 8, y + 4);
    }
  };

  if (options.anchoredGrid) {
    drawYTicks(generateAnchoredYTicks(leftAxis.minY, leftAxis.maxY, plotH), yScaleLeft, 'left', true);
    if (multiAxis && hasRightAxis) drawYTicks(generateAnchoredYTicks(rightAxis.minY, rightAxis.maxY, plotH), yScaleRight, 'right', false);

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
      const label = (leftAxis.maxY - (leftAxis.maxY - leftAxis.minY) * i / 4).toLocaleString('es-ES', { maximumFractionDigits: 2 });
      ctx.fillText(label, pad.l - 8, y + 4);
    }
    if (multiAxis && hasRightAxis) {
      ctx.textAlign = 'left';
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (plotH * i / 4);
        const label = (rightAxis.maxY - (rightAxis.maxY - rightAxis.minY) * i / 4).toLocaleString('es-ES', { maximumFractionDigits: 2 });
        ctx.fillText(label, width - pad.r + 8, y + 4);
      }
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

  if (multiAxis && options.axisLabels) {
    ctx.font = '12px Arial, system-ui, sans-serif';
    ctx.fillStyle = '#B0B0B0';
    ctx.textAlign = 'left';
    if (options.axisLabels.left) ctx.fillText(options.axisLabels.left, pad.l, 18);
    ctx.textAlign = 'right';
    if (options.axisLabels.right) ctx.fillText(options.axisLabels.right, width - pad.r, 18);
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
    const scaleY = s.axis === 'right' ? yScaleRight : yScaleLeft;
    const visiblePts = s.points.filter(p => p.x >= minX && p.x <= maxX);
    const pts = visiblePts.length ? visiblePts : s.points;
    if (!pts.length) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xScale(p.x), y = scaleY(p.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  for (const marker of options.markers || []) {
    if (!marker.dt) continue;
    const mx = xScale(parseDate(marker.dt));
    if (!Number.isFinite(mx) || mx < pad.l || mx > width - pad.r) continue;
    ctx.strokeStyle = marker.color || 'rgba(254, 247, 2, .42)';
    ctx.lineWidth = marker.width || 1;
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

function axisYScale(state, axisKey) {
  const axis = axisKey === 'right' ? state.axes?.right : state.axes?.left;
  const minY = axis?.minY ?? state.minY;
  const maxY = axis?.maxY ?? state.maxY;
  return (py) => state.pad.t + (1 - ((py - minY) / Math.max(1e-12, maxY - minY))) * state.plotH;
}

function findNearestPoint(state, x, y) {
  const { pad, plotW, minX, maxX, series } = state;
  const xScale = (px) => pad.l + ((px - minX) / Math.max(1, maxX - minX)) * plotW;
  let best = null;
  for (const s of series || []) {
    const axis = s.axis === 'right' ? 'right' : 'left';
    const a = state.axes?.[axis] || state.axes?.left || { minY: state.minY, maxY: state.maxY };
    const yScale = axisYScale(state, axis);
    for (const p of s.points || []) {
      if (p.x < minX || p.x > maxX || p.y < a.minY || p.y > a.maxY) continue;
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

function yAxisFromPointer(state, x) {
  if (state.multiAxis && x >= state.width - state.pad.r - 22) return 'right';
  return 'left';
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
    const overLeftYAxis = x >= 0 && x <= pad.l + 20 && y >= pad.t && y <= height - pad.b;
    const overRightYAxis = state.multiAxis && x >= width - pad.r - 20 && x <= width && y >= pad.t && y <= height - pad.b;
    const overXAxis = y >= height - pad.b - 20 && y <= height && x >= pad.l && x <= width - pad.r;
    const overPlot = pointInPlot(state, x, y);
    if (!overLeftYAxis && !overRightYAxis && !overXAxis && !overPlot) return;

    event.preventDefault();

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

    if (event.shiftKey || overLeftYAxis || overRightYAxis) {
      const axisKey = overRightYAxis ? 'right' : yAxisFromPointer(state, x);
      const axis = state.axes?.[axisKey] || state.axes?.left || { minY: state.minY, maxY: state.maxY, dataMinY: state.dataMinY, dataMaxY: state.dataMaxY };
      const center = axis.minY + (1 - ((Math.min(Math.max(y, pad.t), height - pad.b) - pad.t) / Math.max(1, plotH))) * (axis.maxY - axis.minY);
      const minRange = Math.max((axis.dataMaxY - axis.dataMinY) * 0.015, 0.000001);
      const [yMin, yMax] = zoomAround(axis.minY, axis.maxY, axis.dataMinY, axis.dataMaxY, center, factor, minRange);
      setAxisView(view, axisKey, yMin, yMax, state.multiAxis);
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
    const xShift = -dx / Math.max(1, state.plotW) * xSpan;
    const [xMin, xMax] = clampRange(state.minX + xShift, state.maxX + xShift, state.dataMinX, state.dataMaxX);
    view.xMin = xMin;
    view.xMax = xMax;

    for (const axisKey of state.multiAxis ? ['left', 'right'] : ['left']) {
      const axis = state.axes?.[axisKey] || state.axes?.left || { minY: state.minY, maxY: state.maxY, dataMinY: state.dataMinY, dataMaxY: state.dataMaxY };
      const ySpan = axis.maxY - axis.minY;
      const yShift = dy / Math.max(1, state.plotH) * ySpan;
      const [yMin, yMax] = clampRange(axis.minY + yShift, axis.maxY + yShift, axis.dataMinY, axis.dataMaxY);
      setAxisView(view, axisKey, yMin, yMax, state.multiAxis);
    }

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
    const state = container._chartState;
    clearAxisView(view, state?.multiAxis);
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
