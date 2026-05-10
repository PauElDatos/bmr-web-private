import {
  loadJson,
  loadMarketModule,
  loadMarketWeights,
  loadMarketInputs
} from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { metricGrid } from '../components/MetricCard.js';
import { signalWeightTable } from '../components/SignalWeightTable.js';
import { runInputTable } from '../components/RunInputTable.js';
import { signalSeriesTable } from '../components/SignalSeriesTable.js';
import { drawLineChart, attachResize, attachTradingChartInteractions } from '../utils/chart.js';
import { classForLevel, escapeHtml, fmtNumber, sentimentLabel } from '../utils/format.js';

let currentModule = 'M5';
let selectedSignalByModule = {};
let selectedDateByModule = {};
let availableModules = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
let cleanupResize = null;
let cleanupChartInteractions = null;
let marketView = {};

const SIGNAL_COLORS = ['#f87171', '#fbbf24', '#34d399', '#a78bfa', '#22d3ee', '#fb7185', '#60a5fa'];
const MIN_MARKET_DATE = '1950-01-01';

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
        <div id="market-date-selector" class="market-date-selector"></div>
        <aside class="card module-panel market-module-panel">
          <h2>Módulos</h2>
          <div class="module-buttons market-module-buttons">${buttons}</div>
        </aside>
      </div>

      <section class="card">
        <div class="card-header">
          <div>
            <h2>Señales disponibles del módulo</h2>
            <p>Selecciona qué señal se dibuja contra el S&amp;P 500.</p>
          </div>
        </div>
        <div id="signal-selector" class="signal-selector"></div>
        <div id="signal-series-table"></div>
      </section>

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
      ['module_code', 'module', 'code', 'moduleCode'].forEach(key => visit(value[key], depth + 1));
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

function selectedSignal(mod) {
  const signals = allSignalSeries(mod);
  const current = selectedSignalByModule[currentModule];
  const found = signals.find(s => s.signal_code === current);
  return found || signals.find(s => s.signal_code === mod.signal_code) || signals[0];
}

function signalButtons(mod) {
  const selected = selectedSignal(mod)?.signal_code;
  return allSignalSeries(mod).map(s => `
    <button class="signal-chip ${s.signal_code === selected ? 'active' : ''}" data-signal="${escapeHtml(s.signal_code)}">
      <strong>${escapeHtml(s.signal_code)}</strong>
      <span>${escapeHtml(s.latest_dt || '—')} · ${fmtNumber(s.latest_value, 3)}</span>
    </button>
  `).join('');
}

function dateKey(value) {
  if (!value) return '';
  const direct = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString().slice(0, 10);
}

function collectDateOptions(mod, chosen, weights) {
  const dates = new Set();
  const addPoints = (points = []) => points.forEach(point => {
    const dt = dateKey(point.dt || point.asof_dt || point.date);
    if (dt && dt >= MIN_MARKET_DATE) dates.add(dt);
  });
  addPoints(mod.chart?.spx || []);
  addPoints(chosen?.points || mod.chart?.signal || []);
  allSignalSeries(mod).forEach(signal => addPoints(signal.points || []));
  (weights.items || []).forEach(row => {
    const dt = dateKey(row.dt || row.asof_dt || row.event_dt_effective);
    if (dt && dt >= MIN_MARKET_DATE) dates.add(dt);
  });
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

function rowsForSelectedDate(rows = [], selectedDate = '') {
  if (!rows.length) return [];
  const rowsByDate = new Map();
  const undated = [];
  rows.forEach(row => {
    const dt = dateKey(row.dt || row.asof_dt || row.event_dt_effective);
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

function renderWeightsForDate(weights, selectedDate) {
  const table = document.getElementById('weights-table');
  if (!table) return;
  table.innerHTML = signalWeightTable(rowsForSelectedDate(weights.items || [], selectedDate));
}

async function renderModule() {
  const [mod, weights, inputs] = await Promise.all([
    loadMarketModule(currentModule),
    loadMarketWeights(currentModule).catch(() => ({ items: [] })),
    loadMarketInputs(currentModule).catch(() => ({ items: [] }))
  ]);

  const chart = document.getElementById('market-chart');
  const title = document.getElementById('market-chart-title');
  const inputsTable = document.getElementById('inputs-table');
  const selector = document.getElementById('signal-selector');
  const signalTable = document.getElementById('signal-series-table');
  if (!chart) return;

  const chosen = selectedSignal(mod);
  selectedSignalByModule[currentModule] = chosen?.signal_code;
  const dateOptions = collectDateOptions(mod, chosen, weights);
  const selectedDate = selectedDateForModule(dateOptions);

  if (title) title.textContent = `${currentModule} · S&P 500 y señal seleccionada`;

  const draw = () => {
    const selectedMarker = selectedDateByModule[currentModule]
      ? [{ dt: selectedDateByModule[currentModule], color: 'rgba(254, 247, 2, .66)', width: 1.5 }]
      : [];
    const series = [
      { name: chosen?.signal_code || mod.signal_code || currentModule, points: chosen?.points || mod.chart?.signal || [], color: SIGNAL_COLORS[0], width: 2, axis: 'left' },
      { name: 'S&P 500', points: mod.chart?.spx || [], color: '#60a5fa', width: 2, axis: 'right' }
    ];
    drawLineChart(chart, series, {
      view: marketView,
      dualAxis: true,
      bands: mod.chart?.bands || [],
      markers: selectedMarker,
      anchoredGrid: true,
      axisLabels: { left: 'Módulos', right: 'S&P 500' }
    });
  };

  draw();
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, draw);
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
    draw();
  });

  selector.innerHTML = signalButtons(mod);
  selector.querySelectorAll('.signal-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      selectedSignalByModule[currentModule] = btn.dataset.signal;
      marketView = {};
      await renderModule();
    });
  });

  renderWeightsForDate(weights, selectedDate);
  inputsTable.innerHTML = runInputTable(inputs.items || []);
  signalTable.innerHTML = signalSeriesTable(allSignalSeries(mod));
}
