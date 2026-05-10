import {
  loadJson,
  loadMarketModule,
  loadMarketWeights,
  loadMarketWeightChunk,
  loadMarketInputs
} from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { metricGrid } from '../components/MetricCard.js';
import { signalWeightTable } from '../components/SignalWeightTable.js';
import { runInputTable } from '../components/RunInputTable.js';
import { drawLineChart, attachResize, attachTradingChartInteractions } from '../utils/chart.js';
import { classForLevel, escapeHtml, fmtNumber, sentimentLabel } from '../utils/format.js';

let currentModule = 'M5';
let selectedDateByModule = {};
let highlightedLegendKeyByModule = {};
let availableModules = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
let cleanupResize = null;
let cleanupChartInteractions = null;
let marketView = {};
let weightsRenderToken = 0;

const SIGNAL_COLORS = ['#f87171', '#fbbf24', '#34d399', '#a78bfa', '#22d3ee', '#fb7185', '#60a5fa'];
const MIN_MARKET_DATE = '1800-01-01';
const SPX_KEY = 'spx';
const USREC_KEY = 'usrec';
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
        { label: 'Régimen actual', value: sentimentLabel(latest.regime || '—'), detail: latest.asof_dt || 'sin fecha', level: classForLevel(latest.regime) },
        { label: 'Confianza', value: `${fmtNumber(latest.confidence, 1)} / 100`, detail: latest.primary_driver || 'driver no disponible', level: 'warn' }
      ])}

      <div class="market-chart-stack">
        ${chartPanel('market-chart', 'Gráfico de mercado y señales', '')}
        <div id="market-chart-legend" class="market-chart-legend"></div>
        <div id="market-date-selector" class="market-date-selector"></div>
        <aside class="card module-panel market-module-panel">
          <h2>Módulos</h2>
          <div class="module-buttons market-module-buttons">${buttons}</div>
        </aside>
      </div>

      <section class="card">
        <div class="card-header">
          <div>
            <h2>Indicadores, H e inputs que explican la señal</h2>
          </div>
        </div>
        <div id="weights-table"></div>
      </section>

      <section class="card">
        <div class="card-header"><div><h2>Inputs del run</h2><p>Origen directo: ml_run_inputs.</p></div></div>
        <div id="inputs-table"></div>
      </section>
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
  return sorted.length ? sorted : ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
}

function allSignalSeries(mod) {
  if (Array.isArray(mod.signals) && mod.signals.length) return mod.signals;
  return [{
    signal_code: mod.signal_code || 'SEÑAL',
    latest_dt: mod.chart?.signal?.at?.(-1)?.dt || null,
    latest_value: mod.latest_value,
    latest_level: mod.latest_level,
    points: mod.chart?.signal || [],
    n_points: (mod.chart?.signal || []).length,
    latest_explanation: mod.description || ''
  }];
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
  return colorWithAlpha(baseColor, 0.22);
}

function seriesWidth(key) {
  const active = activeLegendKey();
  if (!active) return 2;
  return active === key ? 3 : 1.2;
}

function bandsForChart(bands = []) {
  const active = activeLegendKey();
  const alpha = active === USREC_KEY ? 0.3 : active ? 0.05 : 0.16;
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
  return `${dateKey(point.dt) || '—'} · ${fmtNumber(point.value, digits)}`;
}

function usrecMeta(bands = [], selectedDate = '') {
  const dt = dateKey(selectedDate);
  if (!dt) return 'recesiones EEUU';
  const active = bands.some(band => dateKey(band.from) <= dt && dt <= dateKey(band.to));
  return active ? `${dt} · en recesión` : `${dt} · sin recesión`;
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
      label: signal.signal_code || `Señal ${idx + 1}`,
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
    <button class="legend-item ${item.key === active ? 'active' : ''}" data-key="${escapeHtml(item.key)}" type="button">
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
  addPoints(mod.chart?.spx || []);
  addPoints(mod.chart?.signal || []);
  allSignalSeries(mod).forEach(signal => addPoints(signal.points || []));
  weightHistoryDates(weights).forEach(addDate);
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
  if (!dt) return '—';
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
      <span>${escapeHtml(dateOptions[0].slice(0, 4))} — ${escapeHtml(dateOptions[dateOptions.length - 1].slice(0, 4))}</span>
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
  const target = dateKey(selectedDate) || dates[dates.length - 1];
  let lo = 0;
  let hi = dates.length - 1;
  let best = '';
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (dates[mid] <= target) {
      best = dates[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best || dates[0];
}

function chunkForDate(historyIndex, dt) {
  return (historyIndex?.chunks || []).find(chunk => chunk.from <= dt && dt <= chunk.to);
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
      const chunkPayload = await loadMarketWeightChunk(chunk.path);
      return hydrateCompactRows(chunkPayload, effectiveDate);
    }
  }
  return rowsForSelectedDate(weights.items || [], selectedDate);
}

async function renderWeightsForDate(weights, selectedDate) {
  const table = document.getElementById('weights-table');
  if (!table) return;
  const token = ++weightsRenderToken;
  table.innerHTML = `<div class="empty-state">Cargando pesos para la fecha seleccionada...</div>`;
  try {
    const rows = await weightRowsForSelectedDate(weights, selectedDate);
    if (token !== weightsRenderToken) return;
    table.innerHTML = signalWeightTable(rows);
  } catch (err) {
    if (token !== weightsRenderToken) return;
    table.innerHTML = `<div class="empty-state">No se pudieron cargar los pesos históricos para esta fecha.</div>`;
  }
}

async function renderModule() {
  weightsRenderToken += 1;
  const [mod, weights, inputs] = await Promise.all([
    loadMarketModule(currentModule),
    loadMarketWeights(currentModule).catch(() => ({ items: [] })),
    loadMarketInputs(currentModule).catch(() => ({ items: [] }))
  ]);

  const chart = document.getElementById('market-chart');
  const title = document.getElementById('market-chart-title');
  const inputsTable = document.getElementById('inputs-table');
  if (!chart) return;

  const signals = allSignalSeries(mod);
  const dateOptions = collectDateOptions(mod, weights);
  const selectedDate = selectedDateForModule(dateOptions);

  if (title) title.textContent = `${currentModule} · SP500 completo, USREC y señales`;

  const draw = () => {
    const selectedMarker = selectedDateByModule[currentModule]
      ? [{ dt: selectedDateByModule[currentModule], color: 'rgba(254, 247, 2, .66)', width: 1.5 }]
      : [];
    const signalSeries = signals.map((signal, idx) => {
      const key = signalKey(signal.signal_code);
      const color = SIGNAL_COLORS[idx % SIGNAL_COLORS.length];
      return {
        name: signal.signal_code || `Señal ${idx + 1}`,
        points: signal.points || [],
        color: seriesColor(color, key),
        width: seriesWidth(key),
        axis: 'left'
      };
    });
    const series = [
      ...signalSeries,
      {
        name: 'SP500 completo',
        points: mod.chart?.spx || [],
        color: seriesColor('#60a5fa', SPX_KEY),
        width: seriesWidth(SPX_KEY),
        axis: 'right'
      }
    ];
    drawLineChart(chart, series, {
      view: marketView,
      dualAxis: true,
      bands: bandsForChart(mod.chart?.bands || []),
      markers: selectedMarker,
      anchoredGrid: true,
      hideLegend: true,
      axisLabels: { left: 'Señales M', right: 'SP500' }
    });
  };

  draw();
  renderLegend(mod, draw);
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
    const nextDate = dateOptions[Number(range.value)] || selectedDate;
    selectedDateByModule[currentModule] = nextDate;
    if (dateLabel) dateLabel.textContent = formatSelectedDate(nextDate);
    renderWeightsForDate(weights, nextDate);
    renderLegend(mod, draw);
    draw();
  });

  await renderWeightsForDate(weights, selectedDate);
  inputsTable.innerHTML = runInputTable(inputs.items || []);
}
