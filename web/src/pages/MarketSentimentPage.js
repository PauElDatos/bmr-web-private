import {
  loadJson,
  loadMarketModule,
  loadMarketWeights,
  loadMarketWeightChunk
} from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { metricGrid } from '../components/MetricCard.js';
import { signalWeightTable } from '../components/SignalWeightTable.js';
import { drawLineChart, attachResize, attachTradingChartInteractions } from '../utils/chart.js';
import { classForLevel, escapeHtml, fmtNumber, sentimentLabel } from '../utils/format.js';

let currentModule = 'M5';
let selectedDateByModule = {};
let highlightedLegendKeyByModule = {};
let yearRangeByModule = {};
let availableModules = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M10'];
let cleanupResize = null;
let cleanupChartInteractions = null;
let marketView = {};
let weightsRenderToken = 0;
let moduleRenderToken = 0;
const weightChunkCache = new Map();

const SIGNAL_COLORS = ['#f87171', '#fbbf24', '#34d399', '#a78bfa', '#22d3ee', '#fb7185', '#60a5fa'];
const MIN_MARKET_DATE = '1875-01-01';
const DEFAULT_START_YEAR = 1950;
const YEAR_MIN = 1875;
const WEIGHT_CHUNK_PRELOAD_CONCURRENCY = 6;
const SPX_KEY = 'spx';
const USREC_KEY = 'usrec';
const M6_BLOCKS = [
  { key: 'cycle_macro', label: 'Ciclo macro', buy: 'M6_CYCLE_MACRO_BUY', sell: 'M6_CYCLE_MACRO_SELL', net: 'M6_CYCLE_MACRO_NET' },
  { key: 'rates_curve', label: 'Tipos y curva', buy: 'M6_RATES_CURVE_BUY', sell: 'M6_RATES_CURVE_SELL', net: 'M6_RATES_CURVE_NET' },
  { key: 'market_sentiment', label: 'Sentimiento mercado', buy: 'M6_MARKET_SENTIMENT_BUY', sell: 'M6_MARKET_SENTIMENT_SELL', net: 'M6_MARKET_SENTIMENT_NET' },
  { key: 'credit_stress', label: 'Credito', buy: 'M6_CREDIT_STRESS_BUY', sell: 'M6_CREDIT_STRESS_SELL', net: 'M6_CREDIT_STRESS_NET' },
  { key: 'real_cycle', label: 'Economia real', buy: 'M6_REAL_CYCLE_BUY', sell: 'M6_REAL_CYCLE_SELL', net: 'M6_REAL_CYCLE_NET' }
];
const COMPACT_WEIGHT_FIELDS = [
  'hypothesis_code',
  'run_id',
  'signal_code',
  'direction',
  'weight',
  'contribution',
  'raw_value',
  'output_signal_code',
  'signed_value',
  'model_weight'
];

export async function MarketSentimentPage() {
  const [latest, runs] = await Promise.all([
    loadJson('market/latest.json'),
    loadJson('market/runs.json').catch(() => ({ items: [] }))
  ]);

  availableModules = moduleCodesFromRuns(runs, latest);
  if (!availableModules.includes(currentModule)) currentModule = availableModules[0] || 'M1';
  const buttons = availableModules.map(m => `<button class="module-btn ${m === currentModule ? 'active' : ''}" data-module="${escapeHtml(m)}">${escapeHtml(m)}</button>`).join('');

  setTimeout(() => wireMarketPage(), 0);

  return `
    <div class="market-page">
      ${pageHeader('Sentimiento del mercado')}
      ${metricGrid([
        { label: 'Regimen actual', value: sentimentLabel(latest.regime || '-'), detail: latest.asof_dt || 'sin fecha', level: classForLevel(latest.regime) },
        { label: 'Confianza', value: `${fmtNumber(latest.confidence, 1)} / 100`, detail: latest.primary_driver || 'driver no disponible', level: 'warn' }
      ])}

      <div class="market-chart-stack">
        ${chartPanel('market-chart', 'Grafico de mercado y senales', '', yearRangeControls())}
        <div id="market-chart-legend" class="market-chart-legend"></div>
        <div id="market-date-selector" class="market-date-selector"></div>
        <aside class="card module-panel market-module-panel">
          <h2>Modulos</h2>
          <div class="module-buttons market-module-buttons">${buttons}</div>
        </aside>
      </div>

      <section id="m6-macro-summary-card" class="card m6-macro-summary-card" hidden>
        <div class="card-header">
          <div>
            <h2>M6 resumen macro</h2>
          </div>
        </div>
        <div id="m6-macro-summary"></div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2>Indicadores, H e inputs que explican la senal</h2>
          </div>
        </div>
        <div id="weights-table"></div>
      </section>
    </div>
  `;
}

function yearRangeControls() {
  return `
    <div class="market-year-controls" aria-label="Rango de anos del grafico">
      <label><span>Inicio</span><input id="market-year-start" class="text-input xsmall" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" aria-label="Ano inicial"></label>
      <label><span>Fin</span><input id="market-year-end" class="text-input xsmall" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" aria-label="Ano final"></label>
    </div>
  `;
}

async function wireMarketPage() {
  document.querySelectorAll('.module-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentModule = btn.dataset.module;
      marketView = {};
      document.querySelectorAll('.module-btn').forEach(b => b.classList.toggle('active', b.dataset.module === currentModule));
      await renderModule();
    });
  });
  await renderModule();
}

function moduleCodesFromRuns(runs, latest) {
  const codes = new Set();
  const visit = (value, depth = 0) => {
    if (depth > 5 || value == null) return;
    if (typeof value === 'string') {
      const code = value.trim().toUpperCase();
      if (/^M\d+$/.test(code)) codes.add(code);
      const match = code.match(/^(M\d+)/);
      if (match) codes.add(match[1]);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach(key => {
        const code = key.trim().toUpperCase();
        if (/^M\d+$/.test(code)) codes.add(code);
      });
      ['module_code', 'module', 'code', 'moduleCode', 'hypothesis_code'].forEach(key => visit(value[key], depth + 1));
      ['items', 'modules', 'runs', 'data'].forEach(key => visit(value[key], depth + 1));
    }
  };
  visit(runs);
  visit(latest?.modules);
  const sorted = [...codes].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return sorted.length ? sorted : ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M10'];
}

function allSignalSeries(mod) {
  if (Array.isArray(mod.signals) && mod.signals.length) {
    if (currentModule === 'M6') return [];
    return mod.signals;
  }
  return [{
    signal_code: mod.signal_code || 'SENAL',
    latest_dt: mod.chart?.signal?.at?.(-1)?.dt || null,
    latest_value: mod.latest_value,
    latest_level: mod.latest_level,
    points: mod.chart?.signal || [],
    n_points: (mod.chart?.signal || []).length,
    latest_explanation: mod.description || ''
  }];
}

function signalSeriesByCode(mod) {
  const map = new Map();
  (mod.signals || []).forEach(signal => {
    if (signal?.signal_code) map.set(signal.signal_code, signal);
  });
  return map;
}

function signalValueAt(signalMap, signalCode, selectedDate) {
  const signal = signalMap.get(signalCode);
  const point = pointAtOrBefore(signal?.points || [], selectedDate);
  const value = Number(point?.value);
  return Number.isFinite(value) ? value : 0;
}

function m6BlockState(row) {
  if (row.net >= 0.15 || (row.buy >= 0.25 && row.buy > row.sell + 0.05)) return 'risk_on';
  if (row.net <= -0.15 || (row.sell >= 0.25 && row.sell > row.buy + 0.05)) return 'risk_off';
  return 'neutral';
}

function m6Conclusion(rows, consensus) {
  const positives = rows.filter(row => row.state === 'risk_on').length;
  const negatives = rows.filter(row => row.state === 'risk_off').length;
  const extreme = consensus <= -0.5 || rows.some(row => (
    ['rates_curve', 'credit_stress', 'real_cycle'].includes(row.key) && row.sell >= 0.5
  ));
  if (extreme) return 'Conclusion: presion macro alta y senal de riesgo extremo.';
  if (negatives > 0 && positives > 0) return 'Conclusion: mercado mixto, con presion macro pero sin senal de riesgo extremo.';
  if (negatives >= 2) return 'Conclusion: sesgo macro negativo, con presion en varios bloques.';
  if (positives >= 2 && negatives === 0) return 'Conclusion: sesgo macro positivo, sin presion macro relevante.';
  if (negatives === 0 && positives === 0) return 'Conclusion: mercado macro neutral, sin bloques dominantes.';
  return 'Conclusion: mercado mixto, sin senal dominante.';
}

function renderM6MacroSummary(mod, selectedDate) {
  const card = document.getElementById('m6-macro-summary-card');
  const wrap = document.getElementById('m6-macro-summary');
  if (!card || !wrap) return;
  if (currentModule !== 'M6') {
    card.hidden = true;
    wrap.innerHTML = '';
    return;
  }

  const signalMap = signalSeriesByCode(mod);
  const rows = M6_BLOCKS.map(block => {
    const buy = signalValueAt(signalMap, block.buy, selectedDate);
    const sell = signalValueAt(signalMap, block.sell, selectedDate);
    const net = signalValueAt(signalMap, block.net, selectedDate);
    const row = { ...block, buy, sell, net };
    row.state = m6BlockState(row);
    return row;
  });
  const consensus = signalValueAt(signalMap, 'M6_MACRO_CONSENSUS', selectedDate);
  const conclusion = m6Conclusion(rows, consensus);
  card.hidden = false;
  wrap.innerHTML = `
    <div class="m6-summary-head">
      <span>${escapeHtml(formatSelectedDate(selectedDate))}</span>
      <strong>Consenso neto: ${escapeHtml(fmtNumber(consensus, 3))}</strong>
    </div>
    <div class="m6-summary-grid">
      ${rows.map(row => `
        <div class="m6-block-card">
          <div class="m6-block-top">
            <strong>${escapeHtml(row.label)}</strong>
            <span class="pill ${classForLevel(row.state)}">${escapeHtml(sentimentLabel(row.state))}</span>
          </div>
          <div class="m6-block-values">
            <span>BUY ${escapeHtml(fmtNumber(row.buy, 3))}</span>
            <span>SELL ${escapeHtml(fmtNumber(row.sell, 3))}</span>
            <span>NET ${escapeHtml(fmtNumber(row.net, 3))}</span>
          </div>
        </div>
      `).join('')}
    </div>
    <p class="m6-summary-conclusion">${escapeHtml(conclusion)}</p>
  `;
}

function signalKey(code) {
  return `signal:${code || ''}`;
}

function activeLegendKey() {
  return highlightedLegendKeyByModule[currentModule] || '';
}

function colorWithAlpha(color, alpha) {
  const hex = String(color || '').replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function seriesColor(baseColor, key) {
  const active = activeLegendKey();
  if (!active || active === key) return baseColor;
  return colorWithAlpha(baseColor, 0.18);
}

function bandsForChart(bands = []) {
  const active = activeLegendKey();
  const alpha = active && active !== USREC_KEY ? 0.05 : 0.16;
  return bands.map(band => ({ ...band, color: `rgba(148, 163, 184, ${alpha})` }));
}

function dateKey(value) {
  if (!value) return '';
  const direct = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString().slice(0, 10);
}

function parsePointTime(point) {
  const dt = dateKey(point?.dt);
  const time = dt ? new Date(`${dt}T00:00:00Z`).getTime() : NaN;
  return Number.isFinite(time) ? time : NaN;
}

function latestYearFromPoints(points = []) {
  const dt = dateKey(points.at?.(-1)?.dt);
  const year = Number(dt.slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function moduleMaxYear(mod) {
  return Math.max(YEAR_MIN, latestYearFromPoints(mod.chart?.spx || []), new Date().getFullYear());
}

function normalizeYearRange(range, maxYear) {
  let start = Number(range?.start);
  let end = Number(range?.end);
  if (!Number.isFinite(start)) start = DEFAULT_START_YEAR;
  if (!Number.isFinite(end)) end = maxYear;
  start = Math.max(YEAR_MIN, Math.min(maxYear, Math.trunc(start)));
  end = Math.max(YEAR_MIN, Math.min(maxYear, Math.trunc(end)));
  if (start > end) start = end;
  return { start, end };
}

function yearRangeForModule(mod) {
  const maxYear = moduleMaxYear(mod);
  const saved = yearRangeByModule[currentModule] || { start: DEFAULT_START_YEAR, end: maxYear };
  const range = normalizeYearRange(saved, maxYear);
  yearRangeByModule[currentModule] = range;
  return range;
}

function applyYearRangeToView(mod) {
  const range = yearRangeForModule(mod);
  const dataStart = parsePointTime((mod.chart?.spx || [])[0]);
  const dataEnd = parsePointTime((mod.chart?.spx || []).at?.(-1));
  const start = Date.UTC(range.start, 0, 1);
  const end = Date.UTC(range.end, 11, 31, 23, 59, 59);
  marketView.xMin = Number.isFinite(dataStart) ? Math.max(dataStart, start) : start;
  marketView.xMax = Number.isFinite(dataEnd) ? Math.min(dataEnd, end) : end;
}

function syncYearInputs(mod) {
  const startInput = document.getElementById('market-year-start');
  const endInput = document.getElementById('market-year-end');
  const maxYear = moduleMaxYear(mod);
  const range = yearRangeForModule(mod);
  [startInput, endInput].forEach(input => {
    if (!input) return;
    input.min = String(YEAR_MIN);
    input.max = String(maxYear);
  });
  if (startInput) startInput.value = String(range.start);
  if (endInput) endInput.value = String(range.end);
}

function wireYearInputs(mod, draw) {
  syncYearInputs(mod);
  const bind = (id, key) => {
    const input = document.getElementById(id);
    if (!input) return;
    const apply = () => {
      if (!/^\d{4}$/.test(input.value)) return;
      const current = yearRangeForModule(mod);
      const next = normalizeYearRange({ ...current, [key]: Number(input.value) }, moduleMaxYear(mod));
      yearRangeByModule[currentModule] = next;
      syncYearInputs(mod);
      applyYearRangeToView(mod);
      draw();
    };
    input.addEventListener('input', apply);
    input.addEventListener('change', apply);
  };
  bind('market-year-start', 'start');
  bind('market-year-end', 'end');
}

function pointAtOrBefore(points = [], selectedDate = '') {
  if (!points.length) return null;
  const target = dateKey(selectedDate) || dateKey(points.at(-1)?.dt);
  let lo = 0;
  let hi = points.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const dt = dateKey(points[mid]?.dt);
    if (!dt || dt > target) {
      hi = mid - 1;
    } else {
      best = points[mid];
      lo = mid + 1;
    }
  }
  return best || points[0] || null;
}

function legendPointMeta(point, digits = 3) {
  if (!point) return 'sin dato';
  return `${dateKey(point.dt) || '-'} · ${fmtNumber(point.value, digits)}`;
}

function usrecMeta(bands = [], selectedDate = '') {
  const dt = dateKey(selectedDate);
  if (!dt) return 'recesiones EEUU';
  const active = bands.some(band => dateKey(band.from) <= dt && dt <= dateKey(band.to));
  return active ? `${dt} · en recesion` : `${dt} · sin recesion`;
}

function legendItems(mod, selectedDate) {
  const signals = allSignalSeries(mod);
  return [
    {
      key: SPX_KEY,
      label: 'SP500 completo',
      color: '#60a5fa',
      meta: legendPointMeta(pointAtOrBefore(mod.chart?.spx || [], selectedDate), 2)
    },
    ...signals.map((signal, idx) => ({
      key: signalKey(signal.signal_code),
      label: signal.signal_code || `Senal ${idx + 1}`,
      color: SIGNAL_COLORS[idx % SIGNAL_COLORS.length],
      meta: legendPointMeta(pointAtOrBefore(signal.points || [], selectedDate), 4)
    })),
    {
      key: USREC_KEY,
      label: 'USREC',
      color: '#94a3b8',
      meta: usrecMeta(mod.chart?.bands || [], selectedDate)
    }
  ];
}

function renderLegend(mod, draw) {
  const wrap = document.getElementById('market-chart-legend');
  if (!wrap) return;
  const selectedDate = selectedDateByModule[currentModule] || '';
  const active = activeLegendKey();
  wrap.innerHTML = legendItems(mod, selectedDate).map(item => `
    <button class="legend-item ${active && item.key !== active ? 'muted' : ''}" data-key="${escapeHtml(item.key)}" type="button">
      <span class="legend-swatch" style="background:${escapeHtml(item.color)}"></span>
      <span class="legend-text">
        <strong>${escapeHtml(item.label)}</strong>
        <em>${escapeHtml(item.meta)}</em>
      </span>
    </button>
  `).join('');
  wrap.querySelectorAll('.legend-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key || '';
      highlightedLegendKeyByModule[currentModule] = activeLegendKey() === key ? '' : key;
      renderLegend(mod, draw);
      draw();
    });
  });
}

function collectDateOptions(mod, weights) {
  const dates = new Set();
  const addDate = (dt) => {
    const key = dateKey(dt);
    if (key && key >= MIN_MARKET_DATE) dates.add(key);
  };
  const addPoints = (points = []) => points.forEach(point => addDate(point.dt || point.asof_dt || point.date));
  weightHistoryDates(weights).forEach(addDate);
  addPoints(mod.chart?.signal || []);
  allSignalSeries(mod).forEach(signal => addPoints(signal.points || []));
  return [...dates].sort();
}

function selectedDateForModule(dateOptions) {
  if (!dateOptions.length) return '';
  const saved = selectedDateByModule[currentModule];
  if (saved && dateOptions.includes(saved)) return saved;
  const latest = dateOptions[dateOptions.length - 1];
  selectedDateByModule[currentModule] = latest;
  return latest;
}

function formatSelectedDate(dt) {
  if (!dt) return '-';
  const date = new Date(`${dt}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return dt;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function timelineOptions(dateOptions) {
  if (!dateOptions.length) return '';
  const options = [];
  let lastYear = '';
  dateOptions.forEach((dt, idx) => {
    const year = dt.slice(0, 4);
    const isBoundary = idx === 0 || idx === dateOptions.length - 1;
    if (year !== lastYear && (isBoundary || Number(year) % 5 === 0)) {
      options.push(`<option value="${idx}" label="${year}"></option>`);
      lastYear = year;
    }
  });
  return options.join('');
}

function renderDateSelector(dateOptions, selectedDate) {
  const wrap = document.getElementById('market-date-selector');
  if (!wrap) return;
  if (!dateOptions.length) {
    wrap.innerHTML = '';
    return;
  }
  const index = Math.max(0, dateOptions.indexOf(selectedDate));
  wrap.innerHTML = `
    <div class="timeline-head">
      <strong>Fecha seleccionada: <span id="market-selected-date">${escapeHtml(formatSelectedDate(selectedDate))}</span></strong>
      <span>${escapeHtml(dateOptions[0].slice(0, 4))} - ${escapeHtml(dateOptions[dateOptions.length - 1].slice(0, 4))}</span>
    </div>
    <input id="market-date-range" class="market-date-range" type="range" min="0" max="${dateOptions.length - 1}" step="1" value="${index}" list="market-year-ticks" aria-label="Fecha del mercado">
    <datalist id="market-year-ticks">${timelineOptions(dateOptions)}</datalist>
    <div class="timeline-foot"><span>${escapeHtml(dateOptions[0])}</span><span>${escapeHtml(dateOptions[dateOptions.length - 1])}</span></div>
  `;
}

function rowDate(row) {
  return dateKey(row.dt || row.asof_dt || row.event_dt_effective);
}

function rowsForSelectedDate(rows = [], selectedDate = '') {
  if (!rows.length) return [];
  const rowsByDate = new Map();
  const undated = [];
  rows.forEach(row => {
    const dt = rowDate(row);
    if (!dt) {
      undated.push(row);
      return;
    }
    if (!rowsByDate.has(dt)) rowsByDate.set(dt, []);
    rowsByDate.get(dt).push(row);
  });
  if (!rowsByDate.size) return rows;
  if (selectedDate && rowsByDate.has(selectedDate)) return rowsByDate.get(selectedDate);

  const sortedDates = [...rowsByDate.keys()].sort();
  const fallbackDate = selectedDate
    ? [...sortedDates].reverse().find(dt => dt <= selectedDate) || sortedDates[0]
    : sortedDates[sortedDates.length - 1];
  return rowsByDate.get(fallbackDate) || undated;
}

function weightHistoryDates(weights = {}) {
  const indexed = weights.history_index?.dates;
  if (Array.isArray(indexed) && indexed.length) return indexed.map(dateKey).filter(Boolean);
  return (weights.items || []).map(rowDate).filter(Boolean).sort();
}

function findDateAtOrBefore(dates = [], selectedDate = '') {
  if (!dates.length) return '';
  const sorted = dates.map(dateKey).filter(Boolean).sort();
  const target = dateKey(selectedDate) || sorted[sorted.length - 1];
  let lo = 0;
  let hi = sorted.length - 1;
  let best = '';
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] <= target) {
      best = sorted[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best || sorted[0];
}

function chunkForDate(historyIndex, dt) {
  return (historyIndex?.chunks || []).find(chunk => chunk.from <= dt && dt <= chunk.to);
}

function weightHistoryChunkPaths(weights = {}) {
  const chunks = weights.history_index?.chunks;
  if (!Array.isArray(chunks) || !chunks.length) return [];
  return [...new Set(chunks.map(chunk => chunk?.path).filter(Boolean))];
}

function loadWeightChunkCached(path) {
  if (!path) return Promise.resolve(null);
  if (!weightChunkCache.has(path)) {
    const promise = loadMarketWeightChunk(path).catch(err => {
      weightChunkCache.delete(path);
      throw err;
    });
    weightChunkCache.set(path, promise);
  }
  return weightChunkCache.get(path);
}

async function preloadWeightHistoryChunks(weights) {
  const paths = weightHistoryChunkPaths(weights);
  if (!paths.length) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(WEIGHT_CHUNK_PRELOAD_CONCURRENCY, paths.length) }, async () => {
    while (index < paths.length) {
      const path = paths[index];
      index += 1;
      await loadWeightChunkCached(path);
    }
  });
  await Promise.all(workers);
}

function hydrateCompactRows(chunk, dt) {
  const fields = chunk.fields || COMPACT_WEIGHT_FIELDS;
  const rows = chunk.rows_by_date?.[dt] || [];
  return rows.map(values => {
    const row = {
      dt,
      asof_dt: dt,
      module_code: chunk.module_code,
      weight_source: chunk.source || 'ml_module_contributions'
    };
    fields.forEach((field, idx) => {
      row[field] = values[idx];
    });
    return row;
  });
}

async function weightRowsForSelectedDate(weights, selectedDate) {
  const history = weights.history_index;
  if (history?.dates?.length) {
    const effectiveDate = findDateAtOrBefore(history.dates, selectedDate);
    const chunk = chunkForDate(history, effectiveDate);
    if (chunk?.path) {
      const chunkPayload = await loadWeightChunkCached(chunk.path);
      return hydrateCompactRows(chunkPayload, effectiveDate);
    }
  }
  return rowsForSelectedDate(weights.items || [], selectedDate);
}

function preserveWindowScroll(position) {
  if (!position) return;
  window.scrollTo(position.x, position.y);
}

function captureWindowScroll() {
  return { x: window.scrollX, y: window.scrollY };
}

async function renderWeightsForDate(weights, selectedDate, options = {}) {
  const table = document.getElementById('weights-table');
  if (!table) return;
  const preserveScroll = Boolean(options.preserveScroll);
  const scrollPos = preserveScroll ? captureWindowScroll() : null;
  const token = ++weightsRenderToken;
  table.innerHTML = `<div class="empty-state">Cargando pesos para la fecha seleccionada...</div>`;
  preserveWindowScroll(scrollPos);
  try {
    const rows = await weightRowsForSelectedDate(weights, selectedDate);
    if (token !== weightsRenderToken) return;
    table.innerHTML = signalWeightTable(rows);
    preserveWindowScroll(scrollPos);
  } catch (err) {
    if (token !== weightsRenderToken) return;
    table.innerHTML = `<div class="empty-state">No se pudieron cargar los pesos historicos para esta fecha.</div>`;
    preserveWindowScroll(scrollPos);
  }
}

async function renderModule() {
  const renderToken = ++moduleRenderToken;
  weightsRenderToken += 1;
  const [mod, weights] = await Promise.all([
    loadMarketModule(currentModule),
    loadMarketWeights(currentModule).catch(() => ({ items: [] }))
  ]);
  if (renderToken !== moduleRenderToken) return;

  const chart = document.getElementById('market-chart');
  const title = document.getElementById('market-chart-title');
  if (!chart) return;

  const signals = allSignalSeries(mod);
  const dateOptions = collectDateOptions(mod, weights);
  const selectedDate = selectedDateForModule(dateOptions);
  applyYearRangeToView(mod);

  if (title) title.textContent = `${currentModule} · SP500 completo, USREC y señales`;

  const draw = () => {
    const selectedMarker = selectedDateByModule[currentModule]
      ? [{ dt: selectedDateByModule[currentModule], color: 'rgba(254, 247, 2, .66)', width: 1.5 }]
      : [];
    const signalSeries = signals.map((signal, idx) => {
      const key = signalKey(signal.signal_code);
      const color = SIGNAL_COLORS[idx % SIGNAL_COLORS.length];
      return {
        name: signal.signal_code || `Senal ${idx + 1}`,
        points: signal.points || [],
        color: seriesColor(color, key),
        width: 2,
        axis: 'left'
      };
    });
    const series = [
      ...signalSeries,
      {
        name: 'SP500 completo',
        points: mod.chart?.spx || [],
        color: seriesColor('#60a5fa', SPX_KEY),
        width: 2,
        axis: 'right'
      }
    ];
    drawLineChart(chart, series, {
      view: marketView,
      dualAxis: true,
      axisScales: { right: 'log' },
      bands: bandsForChart(mod.chart?.bands || []),
      markers: selectedMarker,
      anchoredGrid: true,
      hideLegend: true,
      axisLabels: { left: 'Señales M', right: 'SP500 log' }
    });
  };

  draw();
  renderLegend(mod, draw);
  wireYearInputs(mod, draw);
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, () => {
    draw();
    renderLegend(mod, draw);
  });
  if (cleanupChartInteractions) cleanupChartInteractions();
  cleanupChartInteractions = attachTradingChartInteractions(chart, marketView, draw);

  renderDateSelector(dateOptions, selectedDate);
  const range = document.getElementById('market-date-range');
  const dateLabel = document.getElementById('market-selected-date');
  range?.addEventListener('input', () => {
    const scrollPos = captureWindowScroll();
    const nextDate = dateOptions[Number(range.value)] || selectedDate;
    selectedDateByModule[currentModule] = nextDate;
    if (dateLabel) dateLabel.textContent = formatSelectedDate(nextDate);
    renderWeightsForDate(weights, nextDate, { preserveScroll: true });
    renderM6MacroSummary(mod, nextDate);
    renderLegend(mod, draw);
    draw();
    preserveWindowScroll(scrollPos);
  });

  const table = document.getElementById('weights-table');
  const chunksToPreload = weightHistoryChunkPaths(weights);
  if (table && chunksToPreload.length) {
    table.innerHTML = `<div class="empty-state">Cargando historial completo de pesos (${chunksToPreload.length} bloques)...</div>`;
    try {
      await preloadWeightHistoryChunks(weights);
    } catch (err) {
      if (renderToken !== moduleRenderToken) return;
      table.innerHTML = `<div class="empty-state">No se pudo cargar el historial completo de pesos.</div>`;
      return;
    }
    if (renderToken !== moduleRenderToken) return;
  }

  await renderWeightsForDate(weights, selectedDate);
  renderM6MacroSummary(mod, selectedDate);
}
