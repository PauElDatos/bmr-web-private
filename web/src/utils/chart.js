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

function formatDateEs(timestamp) {
  const d = new Date(timestamp);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatChartNumber(value) {
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: 4 });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function textBox(ctx, lines, x, y, options = {}) {
  const pad = 8;
  ctx.save();
  ctx.font = options.font || '12px Arial, system-ui, sans-serif';
  const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + pad * 2;
  const lineH = 16;
  const height = lines.length * lineH + pad * 2 - 3;
  const bx = clamp(x, 8, Math.max(8, options.maxW - width - 8));
  const by = clamp(y, 8, Math.max(8, options.maxH - height - 8));
  const radius = 8;
  ctx.fillStyle = 'rgba(15, 15, 15, 0.92)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + radius, by);
  ctx.lineTo(bx + width - radius, by);
  ctx.quadraticCurveTo(bx + width, by, bx + width, by + radius);
  ctx.lineTo(bx + width, by + height - radius);
  ctx.quadraticCurveTo(bx + width, by + height, bx + width - radius, by + height);
  ctx.lineTo(bx + radius, by + height);
  ctx.quadraticCurveTo(bx, by + height, bx, by + height - radius);
  ctx.lineTo(bx, by + radius);
  ctx.quadraticCurveTo(bx, by, bx + radius, by);
  ctx.fill();
  ctx.stroke();
  lines.forEach((line, idx) => {
    ctx.fillStyle = idx === 0 ? '#FEF702' : '#FFFFFF';
    ctx.fillText(line, bx + pad, by + pad + 11 + idx * lineH);
  });
  ctx.restore();
}

function findNearestPoint(seriesPoints, hoverX, minX, maxX) {
  let nearest = null;
  for (const s of seriesPoints || []) {
    const visible = s.points.filter(p => p.x >= minX && p.x <= maxX);
    const candidates = visible.length ? visible : s.points;
    for (const p of candidates) {
      const dist = Math.abs(p.x - hoverX);
      if (!nearest || dist < nearest.dist) nearest = { ...p, name: s.name, color: s.color, dist };
    }
  }
  return nearest;
}

export function drawLineChart(container, series, options = {}) {
  const { ctx, width, height } = getCanvas(container);
  const pad = options.hideYAxisGutter ? { l: 38, r: 24, t: 26, b: 38 } : { l: 58, r: 22, t: 28, b: 38 };
  ctx.clearRect(0, 0, width, height);

  const seriesPoints = (series || []).map((s, idx) => ({
    name: s.name || `Serie ${idx + 1}`,
    color: s.color || PALETTE[idx % PALETTE.length],
    width: s.width || 2,
    points: (s.points || [])
      .filter(p => Number.isFinite(Number(p.value)) && Number.isFinite(parseDate(p.dt)))
      .map(p => ({ x: parseDate(p.dt), y: Number(p.value), dt: String(p.dt).slice(0, 10), raw: p }))
      .sort((a, b) => a.x - b.x)
  }));

  const all = seriesPoints.flatMap(s => s.points.map(p => ({ x: p.x, y: p.y })));

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
  const xFromPx = (x) => minX + ((x - pad.l) / Math.max(1, plotW)) * (maxX - minX);
  const yFromPx = (y) => minY + (1 - ((y - pad.t) / Math.max(1, plotH))) * (maxY - minY);

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
    seriesPoints,
    xScale,
    yScale,
    xFromPx,
    yFromPx
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

  // grid and axes
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

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.strokeRect(pad.l, pad.t, plotW, plotH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, plotW, plotH);
  ctx.clip();

  seriesPoints.forEach((s) => {
    if (!s.points.length) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    s.points.forEach((p, i) => {
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

  const hover = options.view?.hover;
  if (hover && hover.active) {
    const hoverXValue = xFromPx(hover.x);
    const nearest = findNearestPoint(seriesPoints, hoverXValue, minX, maxX);
    if (nearest) {
      const hx = xScale(nearest.x);
      const hy = yScale(nearest.y);
      if (hx >= pad.l && hx <= width - pad.r && hy >= pad.t && hy <= pad.t + plotH) {
        ctx.strokeStyle = 'rgba(254, 247, 2, 0.46)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, pad.t);
        ctx.lineTo(hx, pad.t + plotH);
        ctx.moveTo(pad.l, hy);
        ctx.lineTo(width - pad.r, hy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = nearest.color || '#FEF702';
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();

        const lines = [formatDateEs(nearest.x), `${nearest.name}: ${formatChartNumber(nearest.y)}`];
        textBox(ctx, lines, hx + 12, hy - 38, { maxW: width, maxH: height });
      }
    }
  }

  ctx.restore();

  if (!options.hideLegend) {
    let lx = pad.l;
    let ly = 16;
    ctx.font = '12px Arial, system-ui, sans-serif';
    seriesPoints.forEach((s) => {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, ly - 9, 14, 3);
      ctx.fillStyle = '#B0B0B0';
      ctx.fillText(s.name, lx + 20, ly - 5);
      lx += s.name.length * 7 + 64;
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

function isInsidePlot(state, x, y) {
  return x >= state.pad.l && x <= state.width - state.pad.r && y >= state.pad.t && y <= state.height - state.pad.b;
}

export function attachTradingViewInteractions(container, view, draw) {
  let dragging = false;
  let dragStart = null;

  const canvas = () => container.querySelector('canvas');

  const setCursor = (cursor) => {
    const c = canvas();
    if (c) c.style.cursor = cursor;
  };

  const resetView = () => {
    delete view.xMin;
    delete view.xMax;
    delete view.yMin;
    delete view.yMax;
    draw();
  };

  const onWheel = (event) => {
    const state = container._chartState;
    const c = canvas();
    if (!state || !c) return;

    const rect = c.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { pad, width, height, plotW, plotH } = state;

    const overYAxis = x >= 0 && x <= pad.l + 28 && y >= pad.t && y <= height - pad.b;
    const overXAxis = y >= height - pad.b - 24 && y <= height && x >= pad.l && x <= width - pad.r;
    const overPlot = isInsidePlot(state, x, y);
    if (!overYAxis && !overXAxis && !overPlot) return;

    event.preventDefault();
    const factor = event.deltaY > 0 ? 1.16 : 0.86;

    const shouldZoomY = overYAxis || (overPlot && event.shiftKey);
    const shouldZoomX = overXAxis || overPlot || !shouldZoomY;

    if (shouldZoomX && !overYAxis) {
      const center = state.minX + ((x - pad.l) / Math.max(1, plotW)) * (state.maxX - state.minX);
      const minRange = 7 * DAY_MS;
      const [xMin, xMax] = zoomAround(state.minX, state.maxX, state.dataMinX, state.dataMaxX, center, factor, minRange);
      view.xMin = xMin;
      view.xMax = xMax;
    }

    if (shouldZoomY) {
      const center = state.minY + (1 - ((y - pad.t) / Math.max(1, plotH))) * (state.maxY - state.minY);
      const minRange = Math.max((state.dataMaxY - state.dataMinY) * 0.01, 0.000001);
      const [yMin, yMax] = zoomAround(state.minY, state.maxY, state.dataMinY, state.dataMaxY, center, factor, minRange);
      view.yMin = yMin;
      view.yMax = yMax;
    }

    draw();
  };

  const onPointerDown = (event) => {
    const state = container._chartState;
    const c = canvas();
    if (!state || !c || event.button !== 0) return;
    const rect = c.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!isInsidePlot(state, x, y)) return;

    dragging = true;
    dragStart = {
      pointerId: event.pointerId,
      x,
      y,
      minX: state.minX,
      maxX: state.maxX,
      minY: state.minY,
      maxY: state.maxY
    };
    c.setPointerCapture(event.pointerId);
    setCursor('grabbing');
  };

  const onPointerMove = (event) => {
    const state = container._chartState;
    const c = canvas();
    if (!state || !c) return;

    const rect = c.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (dragging && dragStart) {
      event.preventDefault();
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      const xSpan = dragStart.maxX - dragStart.minX;
      const ySpan = dragStart.maxY - dragStart.minY;
      const xShift = -dx / Math.max(1, state.plotW) * xSpan;
      const yShift = dy / Math.max(1, state.plotH) * ySpan;
      const [xMin, xMax] = clampRange(dragStart.minX + xShift, dragStart.maxX + xShift, state.dataMinX, state.dataMaxX);
      const [yMin, yMax] = clampRange(dragStart.minY + yShift, dragStart.maxY + yShift, state.dataMinY, state.dataMaxY);
      view.xMin = xMin;
      view.xMax = xMax;
      view.yMin = yMin;
      view.yMax = yMax;
      draw();
      return;
    }

    if (isInsidePlot(state, x, y)) {
      view.hover = { active: true, x, y };
      setCursor('grab');
      draw();
    } else if (view.hover?.active) {
      view.hover = { active: false };
      setCursor('default');
      draw();
    } else {
      setCursor('default');
    }
  };

  const onPointerUp = (event) => {
    if (!dragging) return;
    const c = canvas();
    if (c && dragStart?.pointerId === event.pointerId) c.releasePointerCapture(event.pointerId);
    dragging = false;
    dragStart = null;
    setCursor('grab');
  };

  const onPointerLeave = () => {
    if (dragging) return;
    if (view.hover?.active) {
      view.hover = { active: false };
      draw();
    }
    setCursor('default');
  };

  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('pointerleave', onPointerLeave);
  container.addEventListener('dblclick', resetView);

  return () => {
    container.removeEventListener('wheel', onWheel);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('pointerleave', onPointerLeave);
    container.removeEventListener('dblclick', resetView);
  };
}

export function attachAxisWheelZoom(container, view, draw) {
  return attachTradingViewInteractions(container, view, draw);
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
