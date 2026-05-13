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
const LEFT_AXIS_COLUMN_WIDTH = 46;

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

function paddedLogYRange(values) {
  const finite = (values || []).map(Number).filter(v => Number.isFinite(v) && v > 0);
  if (!finite.length) return { minY: 1, maxY: 10 };
  let minY = Math.min(...finite);
  let maxY = Math.max(...finite);
  if (minY === maxY) {
    minY = minY / 1.5;
    maxY = maxY * 1.5;
  }
  const minLog = Math.log10(minY);
  const maxLog = Math.log10(maxY);
  const pad = Math.max((maxLog - minLog) * 0.08, 0.08);
  return { minY: Math.pow(10, minLog - pad), maxY: Math.pow(10, maxLog + pad) };
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

function generateLogYTicks(minY, maxY, plotH) {
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || minY <= 0 || maxY <= minY) return [];
  const minExp = Math.floor(Math.log10(minY));
  const maxExp = Math.ceil(Math.log10(maxY));
  const ticks = [];
  for (let exp = minExp; exp <= maxExp; exp++) {
    for (const mult of [1, 2, 5]) {
      const value = mult * Math.pow(10, exp);
      if (value >= minY && value <= maxY) {
        ticks.push({ value, label: formatAxisNumber(value, value >= 100 ? 1 : 0.1) });
      }
    }
  }
  const targetTicks = Math.max(4, Math.min(9, Math.round(plotH / 64)));
  if (ticks.length <= targetTicks) return ticks;
  const step = Math.ceil(ticks.length / targetTicks);
  return ticks.filter((_, idx) => idx % step === 0 || idx === ticks.length - 1);
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

function normalizeAxisKey(axis) {
  if (axis === 'right') return 'right';
  if (typeof axis === 'string' && axis.startsWith('left:')) return axis;
  return 'left';
}

function getAxisViewRange(view, axisKey, multiAxis) {
  if (!view) return {};
  if (axisKey === 'right') return { minY: view.rightYMin, maxY: view.rightYMax };
  if (axisKey === 'left') {
    return {
      minY: multiAxis ? view.leftYMin : (Number.isFinite(Number(view.yMin)) ? view.yMin : view.leftYMin),
      maxY: multiAxis ? view.leftYMax : (Number.isFinite(Number(view.yMax)) ? view.yMax : view.leftYMax)
    };
  }
  return view.axisRanges?.[axisKey] || {};
}

function buildAxisRange(axisKey, dataRange, view, multiAxis) {
  const viewRange = getAxisViewRange(view, axisKey, multiAxis);
  let minY = Number.isFinite(Number(viewRange.minY)) ? Number(viewRange.minY) : dataRange.minY;
  let maxY = Number.isFinite(Number(viewRange.maxY)) ? Number(viewRange.maxY) : dataRange.maxY;
  if (minY === maxY) { minY -= 1; maxY += 1; }
  return { ...dataRange, minY, maxY };
}

function axisScaleKind(options, axisKey) {
  if (options.axisScales?.[axisKey] === 'log') return 'log';
  if (axisKey !== 'right' && options.axisScales?.left === 'log') return 'log';
  if (axisKey === 'right' && (options.axisScales?.right === 'log' || options.logRightAxis)) return 'log';
  return 'linear';
}

function yToCanvas(axis, pad, plotH, value) {
  if (axis.scale === 'log' && axis.minY > 0 && axis.maxY > axis.minY && value > 0) {
    const minLog = Math.log10(axis.minY);
    const maxLog = Math.log10(axis.maxY);
    return pad.t + (1 - ((Math.log10(value) - minLog) / Math.max(1e-12, maxLog - minLog))) * plotH;
  }
  return pad.t + (1 - ((value - axis.minY) / Math.max(1e-12, axis.maxY - axis.minY))) * plotH;
}

function canvasToY(axis, pad, plotH, y) {
  const ratio = 1 - ((Math.min(Math.max(y, pad.t), pad.t + plotH) - pad.t) / Math.max(1, plotH));
  if (axis.scale === 'log' && axis.minY > 0 && axis.maxY > axis.minY) {
    const minLog = Math.log10(axis.minY);
    const maxLog = Math.log10(axis.maxY);
    return Math.pow(10, minLog + ratio * (maxLog - minLog));
  }
  return axis.minY + ratio * (axis.maxY - axis.minY);
}

function zoomAxis(axis, center, factor) {
  if (axis.scale === 'log' && axis.dataMinY > 0 && axis.dataMaxY > axis.dataMinY && center > 0) {
    const minLog = Math.log10(axis.minY);
    const maxLog = Math.log10(axis.maxY);
    const floor = Math.log10(axis.dataMinY);
    const ceiling = Math.log10(axis.dataMaxY);
    const centerLog = Math.log10(center);
    const minRange = Math.max((ceiling - floor) * 0.015, 0.001);
    const [nextMin, nextMax] = zoomAround(minLog, maxLog, floor, ceiling, centerLog, factor, minRange);
    return [Math.pow(10, nextMin), Math.pow(10, nextMax)];
  }
  const minRange = Math.max((axis.dataMaxY - axis.dataMinY) * 0.015, 0.000001);
  return zoomAround(axis.minY, axis.maxY, axis.dataMinY, axis.dataMaxY, center, factor, minRange);
}

function panAxis(axis, dy, plotH) {
  if (axis.scale === 'log' && axis.dataMinY > 0 && axis.dataMaxY > axis.dataMinY) {
    const minLog = Math.log10(axis.minY);
    const maxLog = Math.log10(axis.maxY);
    const floor = Math.log10(axis.dataMinY);
    const ceiling = Math.log10(axis.dataMaxY);
    const shift = dy / Math.max(1, plotH) * (maxLog - minLog);
    const [nextMin, nextMax] = clampRange(minLog + shift, maxLog + shift, floor, ceiling);
    return [Math.pow(10, nextMin), Math.pow(10, nextMax)];
  }
  const ySpan = axis.maxY - axis.minY;
  const yShift = dy / Math.max(1, plotH) * ySpan;
  return clampRange(axis.minY + yShift, axis.maxY + yShift, axis.dataMinY, axis.dataMaxY);
}

function setAxisView(view, axisKey, minY, maxY, multiAxis) {
  if (!view) return;
  if (axisKey === 'right') {
    view.rightYMin = minY;
    view.rightYMax = maxY;
    return;
  }
  if (axisKey === 'left') {
    if (multiAxis) {
      view.leftYMin = minY;
      view.leftYMax = maxY;
    } else {
      view.yMin = minY;
      view.yMax = maxY;
    }
    return;
  }
  if (!view.axisRanges) view.axisRanges = {};
  view.axisRanges[axisKey] = { minY, maxY };
}

function clearAxisView(view) {
  if (!view) return;
  delete view.xMin;
  delete view.xMax;
  delete view.yMin;
  delete view.yMax;
  delete view.leftYMin;
  delete view.leftYMax;
  delete view.rightYMin;
  delete view.rightYMax;
  delete view.axisRanges;
}

function axisLabelFromKey(axisKey, seriesForAxis, fallback = '') {
  const explicit = seriesForAxis.find(s => s.axisLabel)?.axisLabel;
  if (explicit) return explicit;
  if (seriesForAxis.length === 1) return seriesForAxis[0].shortName || seriesForAxis[0].name || fallback;
  return fallback;
}

function seriesIdentity(s) {
  return s.id || s.name || '';
}

export function drawLineChart(container, series, options = {}) {
  const { ctx, width, height } = getCanvas(container);
  ctx.clearRect(0, 0, width, height);

  const normalizedSeries = (series || []).map((s, idx) => ({
    ...s,
    id: s.id || s.name || `series-${idx}`,
    axis: normalizeAxisKey(s.axis),
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

  const axisKeys = [...new Set(normalizedSeries.filter(s => s.points.length).map(s => s.axis))];
  const leftAxisKeys = axisKeys.filter(key => key !== 'right');
  const hasRightAxis = axisKeys.includes('right');
  const multiAxis = Boolean(options.dualAxis || hasRightAxis || leftAxisKeys.length > 1);
  const leftColumns = Math.max(1, leftAxisKeys.length || 1);
  const baseLeftPad = multiAxis ? 66 : 58;
  const maxLeftPad = Math.min(Math.max(58, width * 0.28), 260);
  const leftPad = options.independentLeftAxes
    ? Math.min(maxLeftPad, baseLeftPad + Math.max(0, leftColumns - 1) * LEFT_AXIS_COLUMN_WIDTH)
    : baseLeftPad;
  const pad = multiAxis
    ? { l: leftPad, r: hasRightAxis ? 72 : 24, t: 30, b: options.bottomLegendSpace || 40 }
    : (options.hideYAxisGutter ? { l: 58, r: 22, t: 24, b: options.bottomLegendSpace || 38 } : { l: 58, r: 22, t: 28, b: options.bottomLegendSpace || 38 });

  const dataMinX = Math.min(...all.map(p => p.x));
  const dataMaxX = Math.max(...all.map(p => p.x));
  const axes = {};
  for (const axisKey of axisKeys) {
    const scale = axisScaleKind(options, axisKey);
    const values = all.filter(p => p.axis === axisKey).map(p => p.y);
    const range = scale === 'log' ? paddedLogYRange(values) : paddedYRange(values);
    const axisSeries = normalizedSeries.filter(s => s.axis === axisKey);
    axes[axisKey] = {
      ...buildAxisRange(axisKey, range, options.view, multiAxis),
      dataMinY: range.minY,
      dataMaxY: range.maxY,
      scale,
      color: axisSeries[0]?.color || '#B0B0B0',
      label: axisLabelFromKey(axisKey, axisSeries, axisKey === 'right' ? 'SP500' : '')
    };
  }

  if (!axes.left && leftAxisKeys.length) axes.left = axes[leftAxisKeys[0]];
  const primaryLeftKey = leftAxisKeys[0] || 'left';
  const leftAxis = axes[primaryLeftKey] || paddedYRange([]);
  const rightAxis = axes.right || leftAxis;

  let minX = Number.isFinite(Number(options.view?.xMin)) ? Number(options.view.xMin) : dataMinX;
  let maxX = Number.isFinite(Number(options.view?.xMax)) ? Number(options.view.xMax) : dataMaxX;
  if (minX === maxX) { minX -= DAY_MS; maxX += DAY_MS; }
  for (const axis of Object.values(axes)) {
    if (axis.minY === axis.maxY) { axis.minY -= 1; axis.maxY += 1; }
  }

  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = Math.max(1, height - pad.t - pad.b);
  const xScale = (x) => pad.l + ((x - minX) / Math.max(1, maxX - minX)) * plotW;
  const yScaleForAxis = (axisKey) => {
    const a = axes[axisKey] || axes.left || leftAxis;
    return (y) => yToCanvas(a, pad, plotH, y);
  };

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
    dataMinY: leftAxis.dataMinY || leftAxis.minY,
    dataMaxY: leftAxis.dataMaxY || leftAxis.maxY,
    multiAxis,
    leftAxisKeys,
    axisColumnWidth: LEFT_AXIS_COLUMN_WIDTH,
    axes,
    series: normalizedSeries
  };

  ctx.fillStyle = '#252525';
  ctx.fillRect(0, 0, width, height);

  for (const band of options.yBands || []) {
    const axisKey = normalizeAxisKey(band.axis || primaryLeftKey);
    const axis = axes[axisKey] || leftAxis;
    const scaleY = yScaleForAxis(axisKey);
    const from = Number.isFinite(Number(band.from)) ? Number(band.from) : axis.minY;
    const to = Number.isFinite(Number(band.to)) ? Number(band.to) : axis.maxY;
    const y0 = scaleY(from);
    const y1 = scaleY(to);
    const top = Math.max(pad.t, Math.min(y0, y1));
    const bottom = Math.min(pad.t + plotH, Math.max(y0, y1));
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) continue;
    ctx.fillStyle = band.color || 'rgba(148, 163, 184, 0.10)';
    ctx.fillRect(pad.l, top, plotW, bottom - top);
  }

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

  const drawYTicks = (axis, scale, side = 'left', drawGrid = false, labelX = null, color = '#B0B0B0') => {
    const ticks = axis.scale === 'log' ? generateLogYTicks(axis.minY, axis.maxY, plotH) : generateAnchoredYTicks(axis.minY, axis.maxY, plotH);
    ctx.textAlign = side === 'right' ? 'left' : 'right';
    ctx.fillStyle = color;
    for (const tick of ticks) {
      const y = scale(tick.value);
      if (y < pad.t - 0.5 || y > pad.t + plotH + 0.5) continue;
      if (drawGrid) {
        ctx.strokeStyle = 'rgba(74, 74, 74, 0.72)';
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
      }
      ctx.fillText(tick.label, side === 'right' ? width - pad.r + 8 : (labelX ?? pad.l - 8), y + 4);
    }
  };

  if (options.anchoredGrid) {
    leftAxisKeys.forEach((axisKey, idx) => {
      const axis = axes[axisKey];
      if (!axis) return;
      const xLabel = pad.l - 8 - idx * LEFT_AXIS_COLUMN_WIDTH;
      drawYTicks(axis, yScaleForAxis(axisKey), 'left', idx === 0, xLabel, axis.color || '#B0B0B0');
      if (options.independentLeftAxes && idx > 0) {
        ctx.strokeStyle = axis.color || 'rgba(255,255,255,.18)';
        ctx.globalAlpha = 0.42;
        const xAxis = Math.max(6, pad.l - 2 - idx * LEFT_AXIS_COLUMN_WIDTH);
        ctx.beginPath(); ctx.moveTo(xAxis, pad.t); ctx.lineTo(xAxis, pad.t + plotH); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
    if (!leftAxisKeys.length) drawYTicks(leftAxis, yScaleForAxis('left'), 'left', true);
    if (hasRightAxis) drawYTicks(rightAxis, yScaleForAxis('right'), 'right', false, null, rightAxis.color || '#B0B0B0');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#B0B0B0';
    ctx.strokeStyle = 'rgba(74, 74, 74, 0.72)';
    for (const tick of generateAnchoredTimeTicks(minX, maxX, plotW)) {
      const x = xScale(tick.value);
      if (x < pad.l - 0.5 || x > width - pad.r + 0.5) continue;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.fillText(tick.label, x, height - pad.b + 22);
    }
  } else {
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (plotH * i / 4);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
      const label = (leftAxis.maxY - (leftAxis.maxY - leftAxis.minY) * i / 4).toLocaleString('es-ES', { maximumFractionDigits: 2 });
      ctx.fillText(label, pad.l - 8, y + 4);
    }
    if (hasRightAxis) {
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
      ctx.fillText(label, x, height - pad.b + 22);
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

  if (options.independentLeftAxes && leftAxisKeys.length > 1) {
    ctx.font = '11px Arial, system-ui, sans-serif';
    leftAxisKeys.forEach((axisKey, idx) => {
      const axis = axes[axisKey];
      if (!axis?.label) return;
      const x = Math.max(10, pad.l - 40 - idx * LEFT_AXIS_COLUMN_WIDTH);
      ctx.fillStyle = axis.color || '#B0B0B0';
      ctx.textAlign = 'center';
      ctx.fillText(String(axis.label).slice(0, 8), x, 18);
    });
  }

  for (const line of options.yLines || []) {
    const axisKey = normalizeAxisKey(line.axis || primaryLeftKey);
    const y = yScaleForAxis(axisKey)(Number(line.value));
    if (!Number.isFinite(y) || y < pad.t || y > pad.t + plotH) continue;
    ctx.save();
    ctx.strokeStyle = line.color || 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = line.width || 1;
    ctx.setLineDash(line.dash || [6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
    if (line.label) {
      ctx.setLineDash([]);
      ctx.font = '11px Arial, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = line.color || '#B0B0B0';
      ctx.fillText(String(line.label), width - pad.r - 8, Math.max(pad.t + 12, y - 6));
    }
    ctx.restore();
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
    const scaleY = yScaleForAxis(s.axis);
    const visiblePts = s.points.filter(p => p.x >= minX && p.x <= maxX);
    const pts = visiblePts.length ? visiblePts : s.points;
    if (!pts.length) return;
    const focusedId = options.focusedSeriesId || options.focusedSeriesName || '';
    const dimmed = focusedId && focusedId !== seriesIdentity(s);
    ctx.globalAlpha = dimmed ? 0.18 : 1;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = dimmed ? Math.max(1, s.width * 0.72) : s.width;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xScale(p.x), y = scaleY(p.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
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
  const axis = state.axes?.[axisKey] || state.axes?.left || { minY: state.minY, maxY: state.maxY, scale: 'linear' };
  return (py) => yToCanvas(axis, state.pad, state.plotH, py);
}

function findNearestPoint(state, x, y) {
  const { pad, plotW, minX, maxX, series } = state;
  const xScale = (px) => pad.l + ((px - minX) / Math.max(1, maxX - minX)) * plotW;
  let best = null;
  for (const s of series || []) {
    const axis = s.axis || 'left';
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
  if (state.multiAxis && state.axes?.right && x >= state.width - state.pad.r - 22) return 'right';
  const leftKeys = state.leftAxisKeys?.length ? state.leftAxisKeys : ['left'];
  if (state.multiAxis && x <= state.pad.l) {
    const idx = Math.min(leftKeys.length - 1, Math.max(0, Math.floor((state.pad.l - x) / Math.max(1, state.axisColumnWidth || LEFT_AXIS_COLUMN_WIDTH))));
    return leftKeys[idx] || 'left';
  }
  return leftKeys[0] || 'left';
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
    const overRightYAxis = state.multiAxis && state.axes?.right && x >= width - pad.r - 20 && x <= width && y >= pad.t && y <= height - pad.b;
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
      const center = canvasToY(axis, pad, plotH, y);
      const [yMin, yMax] = zoomAxis(axis, center, factor);
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

    for (const axisKey of Object.keys(state.axes || { left: true })) {
      const axis = state.axes?.[axisKey] || state.axes?.left || { minY: state.minY, maxY: state.maxY, dataMinY: state.dataMinY, dataMaxY: state.dataMaxY };
      const [yMin, yMax] = panAxis(axis, dy, state.plotH);
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
    clearAxisView(view);
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
