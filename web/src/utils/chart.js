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

const PALETTE = ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#22d3ee', '#fb7185'];

function parseDate(d) { return new Date(d).getTime(); }

export function drawLineChart(container, series, options = {}) {
  const { ctx, width, height } = getCanvas(container);
  const pad = { l: 58, r: 22, t: 28, b: 38 };
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
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillText('Sin datos para mostrar', 24, 40);
    return;
  }

  const minX = Math.min(...all.map(p => p.x));
  const maxX = Math.max(...all.map(p => p.x));
  let minY = Math.min(...all.map(p => p.y));
  let maxY = Math.max(...all.map(p => p.y));
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const yPad = (maxY - minY) * 0.08;
  minY -= yPad; maxY += yPad;

  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xScale = (x) => pad.l + ((x - minX) / Math.max(1, maxX - minX)) * plotW;
  const yScale = (y) => pad.t + (1 - ((y - minY) / Math.max(1, maxY - minY))) * plotH;

  ctx.fillStyle = '#08111f';
  ctx.fillRect(0, 0, width, height);

  // recession or regime bands
  for (const band of options.bands || []) {
    const bx0 = xScale(parseDate(band.from));
    const bx1 = xScale(parseDate(band.to));
    ctx.fillStyle = band.color || 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(Math.max(pad.l, bx0), pad.t, Math.min(width - pad.r, bx1) - Math.max(pad.l, bx0), plotH);
  }

  // grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 1;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i / 4);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    const label = (maxY - (maxY - minY) * i / 4).toLocaleString('es-ES', { maximumFractionDigits: 2 });
    ctx.fillText(label, 8, y + 4);
  }
  for (let i = 0; i <= 4; i++) {
    const x = pad.l + (plotW * i / 4);
    const t = minX + (maxX - minX) * i / 4;
    const label = new Date(t).getFullYear().toString();
    ctx.fillText(label, x - 14, height - 12);
  }

  // border
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
  ctx.strokeRect(pad.l, pad.t, plotW, plotH);

  (series || []).forEach((s, idx) => {
    const pts = (s.points || []).filter(p => Number.isFinite(Number(p.value))).map(p => ({ x: parseDate(p.dt), y: Number(p.value) }));
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
    ctx.strokeStyle = marker.color || 'rgba(251, 191, 36, .38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, pad.t);
    ctx.lineTo(mx, pad.t + plotH);
    ctx.stroke();
  }

  // legend
  let lx = pad.l;
  let ly = 16;
  ctx.font = '12px Inter, system-ui, sans-serif';
  (series || []).forEach((s, idx) => {
    const c = s.color || PALETTE[idx % PALETTE.length];
    ctx.fillStyle = c;
    ctx.fillRect(lx, ly - 9, 14, 3);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(s.name || `Serie ${idx + 1}`, lx + 20, ly - 5);
    lx += (s.name || '').length * 7 + 64;
  });
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
