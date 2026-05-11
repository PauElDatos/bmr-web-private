import { loadCatalog, loadTimeseries, loadJson } from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { drawLineChart, attachResize, attachTradingChartInteractions } from '../utils/chart.js';
import {
  transformSeries,
  filterByYears,
  calculateSeriesAligned,
  makeRecessionBands,
  describePoints,
  toCsvRows
} from '../utils/series.js';
import { escapeHtml, lastOf, translateDbText } from '../utils/format.js';

const slots = ['blue', 'red', 'green'];
let cleanupResize = null;
let cleanupChartInteractions = null;
let catalogs = null;
let analysisView = {};
let lastRendered = { loaded: [], chartSeries: [], calcPoints: [], calcResults: [] };
let focusedAnalysisSeries = null;
let renderTimer = null;

const slotLabels = { blue: 'Azul', red: 'Rojo', green: 'Verde' };
const slotColors = { blue: '#60a5fa', red: '#f87171', green: '#34d399' };

const slotState = {
  blue: { key: 'series:SPX', invert: false, transform: 'NORMAL', lag: 0, visible: true },
  red: { key: 'indicators:FEDFUNDS', invert: false, transform: 'NORMAL', lag: 0, visible: true },
  green: { key: 'indicators:UNRATE', invert: false, transform: 'NORMAL', lag: 0, visible: true }
};

const transformOptions = [
  ['NORMAL', 'Normal'],
  ['LOG', 'Log'],
  ['EXP', 'Exp']
];

const calcOptions = [
  ['none', 'Sin cálculo'],
  ['sum', 'Sumar'],
  ['subtract', 'Restar'],
  ['divide', 'Ratio'],
  ['multiply', 'Multiplicar'],
  ['spread_z', 'Spread z-score'],
  ['correlation_rolling', 'Correlación rolling 24']
];

const calcPairs = [
  { id: 'blue-red', a: 'blue', b: 'red', label: 'Azul/rojo', color: '#fbbf24' },
  { id: 'red-green', a: 'red', b: 'green', label: 'Rojo/verde', color: '#f472b6' }
];

export async function AnalysisPage() {
  catalogs = await loadAnalysisCatalogs();
  setTimeout(() => wireAnalysisPage(), 0);
  return `
    <div class="analysis-page">
      ${pageHeader('Análisis')}
      ${chartPanel('analysis-chart', 'Comparador de series')}
      <section class="card control-panel analysis-control-panel">
        <div class="analysis-topbar">
          <label>Plantilla
            <select id="analysis-preset" class="select-input">
              <option value="">Manual</option>
              ${catalogs.presets.map((p, idx) => `<option value="${idx}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </label>
          <label>Año inicio<input id="year-start" class="text-input small" value="1995" /></label>
          <label>Año fin<input id="year-end" class="text-input small" value="2026" /></label>
          <label>Cálculo azul/rojo
            <select id="calc-blue-red" class="select-input">
              ${calcOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
          <label>Cálculo rojo/verde
            <select id="calc-red-green" class="select-input">
              ${calcOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
          <button id="export-analysis" class="btn ghost">Exportar CSV</button>
          <button id="reset-analysis" class="btn ghost">Borrar</button>
        </div>
        <div class="slot-controls enhanced">
          ${slots.map(slot => renderSlotControl(slot)).join('')}
        </div>
        <div class="overlay-row">
          <strong>Capas:</strong>
          ${catalogs.overlays.map((o, idx) => `<label class="check"><input class="overlay-check" type="checkbox" value="${escapeHtml(o.code)}" ${idx === 1 ? 'checked' : ''}/> <span>${escapeHtml(o.code)}</span></label>`).join('')}
          <label class="check"><input id="overlay-recession" type="checkbox" checked /> <span>Recesión</span></label>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2>Catálogo BMR para análisis</h2>
            <p>Busca indicadores macro y activos clasificados por tipo para enviarlos directamente a un slot.</p>
          </div>
        </div>
        <div class="catalog-toolbar">
          <input id="catalog-search" class="text-input" placeholder="Buscar código, nombre, fuente, tipo..." />
          <select id="catalog-kind" class="select-input"><option value="all">Todos</option><option value="indicators">Indicadores macro</option><option value="equity">Equity</option><option value="crypto">Cripto</option><option value="commodity">Commodity</option><option value="index">Índice</option></select>
          <select id="catalog-source" class="select-input"><option value="all">Todas las fuentes/tipos</option>${catalogs.facets.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(translateDbText(f))}</option>`).join('')}</select>
        </div>
        <div id="analysis-catalog-table" class="analysis-catalog-table"></div>
      </section>
    </div>
  `;
}

async function loadAnalysisCatalogs() {
  const [indicators, series, overlays, presets, recession] = await Promise.all([
    loadCatalog('indicators'),
    loadCatalog('series'),
    loadJson('analysis/overlays.json').catch(() => ({ items: [] })),
    loadJson('analysis/presets.json').catch(() => ({ items: [] })),
    loadJson('analysis/recession_bands.json').catch(() => ({ items: [] }))
  ]);
  const options = [
    ...indicators.items.map(i => normalizeCatalogOption('indicators', i.code, i.name, i.source, i.frequency, i.unit, i)),
    ...series.items.map(s => normalizeCatalogOption('series', s.code, s.name, s.series_type, s.source || 'series_sources', '', s))
  ].filter(o => o.code);
  const facets = [...new Set(options.flatMap(o => [o.rawSource, o.rawType, o.rawFrequency].filter(Boolean)))].sort();
  return { options, overlays: overlays.items || [], presets: normalizePresets(presets.items || []), recessionBands: recession.items || [], facets };
}

function normalizeCatalogOption(kind, code, name, type, source, frequency, item) {
  const rawName = name || code;
  const rawType = type || '';
  const rawSource = source || '';
  const rawFrequency = frequency || '';
  const displayName = translateDbText(rawName);
  const displayType = translateDbText(rawType);
  const displaySource = translateDbText(rawSource);
  const displayFrequency = translateDbText(rawFrequency);
  const category = classifyCatalogOption(kind, code, rawName, rawType, rawSource, rawFrequency, item);
  return {
    key: `${kind}:${code}`,
    label: `${assetCategoryLabel(category)} · ${code} · ${displayName}`,
    category,
    kind,
    code,
    name: displayName,
    rawName,
    type: displayType,
    rawType,
    source: displaySource,
    rawSource,
    frequency: displayFrequency,
    rawFrequency,
    facetValues: [rawSource, rawType, rawFrequency].filter(Boolean),
    item
  };
}

function normalizePresets(items) {
  return (items || []).map((p) => {
    if (Array.isArray(p.slots)) {
      return { name: translateDbText(p.name || 'Plantilla'), blue: p.slots[0], red: p.slots[1], green: p.slots[2] };
    }
    return { ...p, name: translateDbText(p.name || 'Plantilla') };
  });
}

function labelKind(kind) {
  return { indicators: 'Macro', assets: 'Activo', series: 'Serie', crypto: 'Cripto' }[kind] || kind;
}

function assetCategoryLabel(category) {
  return {
    indicators: 'Macro',
    equity: 'Equity',
    crypto: 'Cripto',
    commodity: 'Commodity',
    index: 'Índice',
    assets: 'Activo'
  }[category] || labelKind(category);
}

function classifyCatalogOption(kind, code, name, type, source, frequency, item = {}) {
  if (kind === 'indicators') return 'indicators';
  if (kind === 'crypto') return 'crypto';
  if (kind === 'series') {
    const seriesType = String(item.series_type || type || '').toUpperCase();
    if (seriesType === 'EQUITY') return 'equity';
    if (seriesType === 'INDEX') return 'index';
    if (seriesType === 'CRYPTO') return 'crypto';
    if (seriesType === 'COMMODITY') return 'commodity';
  }
  const haystack = [
    kind,
    code,
    name,
    type,
    source,
    frequency,
    item.asset_type,
    item.series_type,
    item.category,
    item.type,
    item.source,
    item.exchange,
    item.quote
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\b(crypto|cryptocurrency|coin|token|btc|bitcoin|eth|ethereum|solana|sol|xrp|ada|bnb)\b/.test(haystack)) return 'crypto';
  if (/\b(commodity|commodities|materia|materias|gold|silver|copper|oil|brent|wti|gas|xau|xag|oro|plata|crude)\b/.test(haystack)) return 'commodity';
  if (/\b(index|indices|índice|indice|benchmark|spx|s&p|nasdaq|ndx|dow|dji|russell|iwm|vix|dax|stoxx|ftse|nikkei)\b/.test(haystack)) return 'index';
  if (/\b(equity|stock|stocks|share|shares|acciones|accion|empresa|company|nyse|nasdaqgs|nasdaqgm|amex)\b/.test(haystack)) return 'equity';
  if (kind === 'assets') return 'equity';
  if (kind === 'series') return 'assets';
  return 'assets';
}

function isSp500Option(opt = {}) {
  const haystack = [opt.code, opt.name, opt.rawName, opt.type, opt.rawType, opt.source, opt.rawSource].filter(Boolean).join(' ').toUpperCase();
  return /\b(SPX|SP500|SPX500|S&P\s*500|S\s*&\s*P\s*500|STANDARD\s*&\s*POOR)/.test(haystack);
}

function safeAxisId(value) {
  return String(value || 'axis').replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function renderSlotControl(slot) {
  const colorName = slotLabels[slot];
  const state = slotState[slot];
  return `
    <div class="slot-card ${slot}">
      <div class="slot-title-row">
        <h3>${colorName}</h3>
        <label class="check"><input id="visible-${slot}" type="checkbox" ${state.visible ? 'checked' : ''}/> <span>Visible</span></label>
      </div>
      <select id="slot-${slot}" class="select-input">
        ${catalogs.options.map(o => `<option value="${escapeHtml(o.key)}" ${o.key === state.key ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
      </select>
      <div class="mini-row phase4-mini-row">
        <button class="btn tiny invert-btn ${state.invert ? 'active' : ''}" data-slot="${slot}">Invertir</button>
        <label>Transformación
          <select id="transform-${slot}" class="select-input tiny-select">
            ${transformOptions.map(([value, label]) => `<option value="${value}" ${value === state.transform ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label>Desfase meses<input id="lag-${slot}" class="text-input xsmall" value="${state.lag}" /></label>
      </div>
    </div>
  `;
}

async function wireAnalysisPage() {
  for (const slot of slots) {
    document.getElementById(`slot-${slot}`).addEventListener('change', e => { slotState[slot].key = e.target.value; scheduleRenderAnalysis(); });
    document.getElementById(`transform-${slot}`).addEventListener('change', e => { slotState[slot].transform = e.target.value; scheduleRenderAnalysis(); });
    document.getElementById(`lag-${slot}`).addEventListener('input', e => { slotState[slot].lag = Number(e.target.value || 0); scheduleRenderAnalysis(); });
    document.getElementById(`visible-${slot}`).addEventListener('change', e => { slotState[slot].visible = e.target.checked; scheduleRenderAnalysis(); });
  }
  document.querySelectorAll('.invert-btn').forEach(b => b.addEventListener('click', () => {
    const s = b.dataset.slot;
    slotState[s].invert = !slotState[s].invert;
    b.classList.toggle('active', slotState[s].invert);
    scheduleRenderAnalysis();
  }));
  document.getElementById('analysis-preset').addEventListener('change', applyPreset);
  document.getElementById('export-analysis').addEventListener('click', exportVisibleCsv);
  document.getElementById('reset-analysis').addEventListener('click', resetAnalysis);
  document.querySelectorAll('.overlay-check').forEach(c => c.addEventListener('change', scheduleRenderAnalysis));
  document.getElementById('overlay-recession').addEventListener('change', scheduleRenderAnalysis);
  ['year-start', 'year-end'].forEach(id => document.getElementById(id).addEventListener('input', scheduleRenderAnalysis));
  ['calc-blue-red', 'calc-red-green'].forEach(id => document.getElementById(id).addEventListener('change', scheduleRenderAnalysis));
  ['catalog-search', 'catalog-kind', 'catalog-source'].forEach(id => document.getElementById(id).addEventListener('input', renderCatalogTable));
  renderCatalogTable();
  await renderAnalysis();
}

function scheduleRenderAnalysis() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => { renderAnalysis(); }, 80);
}

function applyPreset(e) {
  const idx = e.target.value;
  if (idx === '') return;
  const p = catalogs.presets[Number(idx)];
  if (!p) return;
  for (const slot of slots) {
    if (p[slot] && catalogs.options.some(o => o.key === p[slot])) {
      slotState[slot].key = p[slot];
      const el = document.getElementById(`slot-${slot}`);
      if (el) el.value = p[slot];
    }
  }
  scheduleRenderAnalysis();
}

function resetAnalysis() {
  slotState.blue = { key: 'series:SPX', invert: false, transform: 'NORMAL', lag: 0, visible: true };
  slotState.red = { key: 'indicators:FEDFUNDS', invert: false, transform: 'NORMAL', lag: 0, visible: true };
  slotState.green = { key: 'indicators:UNRATE', invert: false, transform: 'NORMAL', lag: 0, visible: true };
  location.reload();
}

async function loadSlotSeries(slot) {
  const opt = catalogs.options.find(o => o.key === slotState[slot].key) || catalogs.options[0];
  const ts = await loadTimeseries(opt.kind, opt.code);
  let pts = transformSeries(ts.points, {
    invert: slotState[slot].invert,
    transform: slotState[slot].transform,
    scale: slotState[slot].transform,
    lagMonths: slotState[slot].lag
  });
  pts = filterByYears(pts, document.getElementById('year-start')?.value, document.getElementById('year-end')?.value);
  const rawStats = describePoints(pts);
  return { slot, opt, rawPoints: pts, points: pts, rawStats, state: { ...slotState[slot] } };
}

async function renderAnalysis() {
  const chart = document.getElementById('analysis-chart');
  if (!chart) return;
  const loaded = await Promise.all(slots.map(loadSlotSeries));
  const series = loaded
    .filter(s => s.state.visible)
    .map((s) => buildAnalysisSeries({
      id: `slot-${s.slot}`,
      name: `${slotLabels[s.slot]} · ${s.opt.code}`,
      shortName: s.opt.code,
      opt: s.opt,
      points: isSp500Option(s.opt) ? s.rawPoints : s.points,
      color: slotColors[s.slot],
      width: 2.2
    }));

  const calcResults = [];
  const loadedBySlot = Object.fromEntries(loaded.map(item => [item.slot, item]));
  for (const pair of calcPairs) {
    const op = document.getElementById(`calc-${pair.id}`)?.value || 'none';
    if (op === 'none') continue;
    const first = loadedBySlot[pair.a];
    const second = loadedBySlot[pair.b];
    if (!first || !second) continue;
    const calcPoints = calculateSeriesAligned(first.points, second.points, op);
    calcResults.push({ pair, op, points: calcPoints });
    series.push(buildAnalysisSeries({
      id: `calc-${pair.id}-${op}`,
      name: `Cálculo ${pair.label} · ${labelCalc(op)}`,
      shortName: `Calc ${pair.label}`,
      points: calcPoints,
      color: pair.color,
      width: 2.8
    }));
  }

  const selectedOverlays = Array.from(document.querySelectorAll('.overlay-check:checked')).map(c => c.value);
  for (const o of selectedOverlays) {
    const ov = catalogs.overlays.find(x => x.code === o);
    if (!ov) continue;
    try {
      const kind = ov.kind;
      const code = ov.target_code || ov.code;
      const ts = await loadTimeseries(kind, code);
      const pts = filterByYears(ts.points, document.getElementById('year-start')?.value, document.getElementById('year-end')?.value);
      series.push(buildAnalysisSeries({ id: `overlay-${o}`, name: `Capa ${o}`, shortName: o, opt: { code: code, name: o, rawName: o }, points: isSp500Option({ code, name: o, rawName: o }) ? filterByYears(ts.points, document.getElementById('year-start')?.value, document.getElementById('year-end')?.value) : pts, color: ov.color || '#a78bfa', width: 1.5 }));
    } catch (_) {}
  }

  if (focusedAnalysisSeries && !series.some(s => s.id === focusedAnalysisSeries)) focusedAnalysisSeries = null;

  let recessionBands = [];
  if (document.getElementById('overlay-recession')?.checked) {
    recessionBands = catalogs.recessionBands.length ? catalogs.recessionBands : await loadRecessionBandsFromUSREC();
    recessionBands = recessionBands.filter(b => inYearRange(b.from) || inYearRange(b.to));
  }

  const draw = () => {
    drawLineChart(chart, series, {
      view: analysisView,
      bands: recessionBands,
      anchoredGrid: true,
      compactAxes: true,
      dualAxis: true,
      independentLeftAxes: true,
      axisLabels: { left: 'Series añadidas', right: 'SP500' },
      bottomLegendSpace: 92,
      hideLegend: true,
      focusedSeriesId: focusedAnalysisSeries
    });
    renderAnalysisLegend(chart, series);
  };
  draw();
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, draw);
  if (cleanupChartInteractions) cleanupChartInteractions();
  cleanupChartInteractions = attachTradingChartInteractions(chart, analysisView, draw);

  lastRendered = { loaded, chartSeries: series, calcPoints: calcResults.flatMap(r => r.points), calcResults };

}

function buildAnalysisSeries({ id, name, shortName, opt = {}, points, color, width }) {
  const sp500 = isSp500Option(opt) || isSp500Option({ code: shortName, name });
  const axisId = sp500 ? 'right' : `left:${safeAxisId(id || name)}`;
  return {
    id,
    name,
    shortName,
    points,
    color,
    width,
    axis: axisId,
    axisLabel: sp500 ? 'SP500' : (shortName || name),
    isSp500: sp500
  };
}

function renderAnalysisLegend(container, series) {
  let legend = container.querySelector('.analysis-chart-legend');
  if (!legend) {
    legend = document.createElement('div');
    legend.className = 'analysis-chart-legend';
    container.appendChild(legend);
  }
  legend.innerHTML = (series || []).map((s) => `
    <button class="analysis-legend-item ${focusedAnalysisSeries && focusedAnalysisSeries !== s.id ? 'dimmed' : ''} ${focusedAnalysisSeries === s.id ? 'active' : ''}" data-series-id="${escapeHtml(s.id)}" type="button">
      <span class="legend-swatch" style="background:${escapeHtml(s.color)}"></span>
      <span>${escapeHtml(s.name)}</span>
    </button>
  `).join('');
  legend.querySelectorAll('.analysis-legend-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      focusedAnalysisSeries = focusedAnalysisSeries === btn.dataset.seriesId ? null : btn.dataset.seriesId;
      renderAnalysis();
    });
  });
}

async function loadRecessionBandsFromUSREC() {
  try {
    const ts = await loadTimeseries('indicators', 'USREC');
    return makeRecessionBands(ts.points, { color: 'rgba(148, 163, 184, .16)' });
  } catch (_) {
    return [
      { from: '2001-03-01', to: '2001-11-01', color: 'rgba(148, 163, 184, .12)' },
      { from: '2007-12-01', to: '2009-06-01', color: 'rgba(148, 163, 184, .16)' },
      { from: '2020-02-01', to: '2020-05-01', color: 'rgba(148, 163, 184, .16)' }
    ];
  }
}

function inYearRange(dt) {
  const y = Number(String(dt || '').slice(0, 4));
  const s = Number(document.getElementById('year-start')?.value || 0);
  const e = Number(document.getElementById('year-end')?.value || 9999);
  return !Number.isFinite(y) || (y >= s && y <= e);
}

function labelCalc(op) {
  return (calcOptions.find(([v]) => v === op) || [op, op])[1];
}

function renderFacts(loaded) {
  const facts = document.getElementById('analysis-facts');
  if (!facts) return;
  facts.innerHTML = loaded.map(s => {
    const last = lastOf(s.rawPoints) || lastOf(s.points) || {};
    const stats = describePoints(s.rawPoints);
    return `
      <div class="fact-row ${s.slot}">
        <strong>${slotLabels[s.slot].toUpperCase()}</strong>
        <span>${escapeHtml(s.opt.code)}</span>
        <em>${escapeHtml(s.opt.name || '')}</em>
        <small>${escapeHtml(labelKind(s.opt.kind))} · ${escapeHtml(s.opt.source || s.opt.type || 'BMR')}</small>
        <small>Último: ${formatMaybe(last.value)} · ${escapeHtml(last.dt || '—')}</small>
        <small>Rango: ${escapeHtml(stats.firstDt || '—')} → ${escapeHtml(stats.lastDt || '—')} · ${stats.count} puntos</small>
      </div>
    `;
  }).join('');
}

function renderDiagnostics(loaded, calcResults = []) {
  const el = document.getElementById('analysis-diagnostics');
  if (!el) return;
  const rows = loaded.map(s => {
    const stats = describePoints(s.rawPoints);
    return {
      label: `${slotLabels[s.slot]} · ${s.opt.code}`,
      type: `${labelKind(s.opt.kind)} / ${s.opt.source || s.opt.type || 'BMR'}`,
      transform: `${s.state.invert ? 'Invertida + ' : ''}${s.state.transform}${s.state.lag ? ` · lag ${s.state.lag}m` : ''}`,
      points: stats.count,
      from: stats.firstDt || '—',
      to: stats.lastDt || '—',
      last: formatMaybe(stats.lastValue)
    };
  });
  calcResults.forEach(result => {
    const stats = describePoints(result.points);
    rows.push({ label: `Cálculo ${result.pair.label} · ${labelCalc(result.op)}`, type: 'Alineado por fecha con forward-fill', transform: 'Serie derivada en navegador', points: stats.count, from: stats.firstDt || '—', to: stats.lastDt || '—', last: formatMaybe(stats.lastValue) });
  });
  el.innerHTML = rows.map(r => `
    <div class="diagnostic-card">
      <strong>${escapeHtml(r.label)}</strong>
      <span>${escapeHtml(r.type)}</span>
      <small>${escapeHtml(r.transform)}</small>
      <div class="diagnostic-metrics"><b>${r.points}</b><em>${escapeHtml(r.from)} → ${escapeHtml(r.to)}</em><i>${escapeHtml(r.last)}</i></div>
    </div>
  `).join('');
}

function renderReading(loaded, calcResults = []) {
  const el = document.getElementById('analysis-reading');
  if (!el) return;
  const primary = loaded[0];
  const secondary = loaded[1];
  const pStats = describePoints(primary.rawPoints);
  const sStats = describePoints(secondary.rawPoints);
  const calcCount = calcResults.reduce((acc, result) => acc + describePoints(result.points).count, 0);
  const msg = [
    `Serie principal: ${primary.opt.code} (${pStats.count} puntos).`,
    `Comparación: ${secondary.opt.code} (${sStats.count} puntos).`,
    calcResults.length ? `Cálculos activos: ${calcResults.length} con ${calcCount} puntos resultantes.` : 'Sin cálculo derivado activo.',
    'El gráfico muestra niveles transformados sin normalización común.'
  ];
  el.innerHTML = `<ul>${msg.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
}

function renderCatalogTable() {
  const el = document.getElementById('analysis-catalog-table');
  if (!el || !catalogs) return;
  const q = (document.getElementById('catalog-search')?.value || '').trim().toLowerCase();
  const kind = document.getElementById('catalog-kind')?.value || 'all';
  const facet = document.getElementById('catalog-source')?.value || 'all';
  let items = catalogs.options;
  if (kind !== 'all') items = items.filter(i => i.category === kind);
  if (facet !== 'all') items = items.filter(i => (i.facetValues || [i.source, i.type, i.frequency]).includes(facet));
  if (q) {
    items = items.filter(i => [i.code, i.name, i.rawName, i.source, i.rawSource, i.type, i.rawType, i.frequency, i.rawFrequency, i.kind, i.category].join(' ').toLowerCase().includes(q));
  }
  items = items.slice(0, 160);
  el.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Fuente/tipo</th><th>Slot</th></tr></thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td><strong>${escapeHtml(i.name)}</strong><small class="catalog-row-meta">${escapeHtml(i.code)} · ${escapeHtml(assetCategoryLabel(i.category))}</small></td>
            <td>${escapeHtml([i.source, i.type, i.frequency].filter(Boolean).join(' · ') || '—')}</td>
            <td class="slot-actions">
              ${slots.map(s => `<button class="btn tiny set-slot" data-slot="${s}" data-key="${escapeHtml(i.key)}">${slotLabels[s]}</button>`).join('')}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
  el.querySelectorAll('.set-slot').forEach(btn => btn.addEventListener('click', () => {
    const slot = btn.dataset.slot;
    const key = btn.dataset.key;
    slotState[slot].key = key;
    const select = document.getElementById(`slot-${slot}`);
    if (select) select.value = key;
    scheduleRenderAnalysis();
  }));
}

function exportVisibleCsv() {
  const rows = toCsvRows(lastRendered.chartSeries || []);
  if (!rows.length) return;
  const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bmr_analysis_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatMaybe(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-ES', { maximumFractionDigits: 4 });
}
