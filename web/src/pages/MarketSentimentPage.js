import {
  loadJson,
  loadMarketModule,
  loadMarketWeights,
  loadMarketInputs,
  loadMarketMetrics,
  loadMarketEvents
} from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { metricGrid } from '../components/MetricCard.js';
import { signalWeightTable } from '../components/SignalWeightTable.js';
import { runInputTable } from '../components/RunInputTable.js';
import { runMetricTable } from '../components/RunMetricTable.js';
import { signalEventTable } from '../components/SignalEventTable.js';
import { signalSeriesTable } from '../components/SignalSeriesTable.js';
import { drawLineChart, attachResize } from '../utils/chart.js';
import { classForLevel, escapeHtml, fmtNumber } from '../utils/format.js';

let currentModule = 'M5';
let selectedSignalByModule = {};
let cleanupResize = null;

const MODULES = ['M1', 'M2', 'M3', 'M4', 'M5'];
const SIGNAL_COLORS = ['#f87171', '#fbbf24', '#34d399', '#a78bfa', '#22d3ee', '#fb7185'];

export async function MarketSentimentPage() {
  const [latest, runs] = await Promise.all([
    loadJson('market/latest.json'),
    loadJson('market/runs.json')
  ]);
  const buttons = MODULES.map(m => `<button class="module-btn ${m === currentModule ? 'active' : ''}" data-module="${m}">${m}</button>`).join('');

  setTimeout(() => wireMarketPage(), 0);

  return `
    ${pageHeader('Sentimiento del mercado')} 
    ${metricGrid([
      { label: 'Régimen actual', value: latest.regime || '—', detail: latest.asof_dt || 'sin fecha', level: classForLevel(latest.regime) },
      { label: 'Confianza', value: `${fmtNumber(latest.confidence, 1)} / 100`, detail: latest.primary_driver || 'driver no disponible', level: 'warn' },
      { label: 'Pulso BUY', value: latest.buy_pulse == null ? '—' : fmtNumber(latest.buy_pulse, 3), detail: 'si existe en el corte de datos', level: 'ok' },
      { label: 'Pulso SELL', value: latest.sell_pulse == null ? '—' : fmtNumber(latest.sell_pulse, 3), detail: latest.primary_driver_reason || 'explicación pendiente', level: 'danger' }
    ])}
    <div class="market-layout">
      <div>
        ${chartPanel('market-chart', 'Gráfico de mercado y señales', 'SPX normalizado + señal seleccionada del módulo')}
      </div>
      <aside class="card module-panel">
        <h2>Módulos</h2>
        <div class="module-buttons">${buttons}</div>
      </aside>
    </div>

    <section class="card">
      <div class="card-header">
        <div>
          <h2>Señales disponibles del módulo</h2>
          <p>Selecciona qué señal se dibuja contra el SPX. El exportador conserva todas las señales del run en el JSON del módulo.</p>
        </div>
      </div>
      <div id="signal-selector" class="signal-selector"></div>
      <div id="signal-series-table"></div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h2>Indicadores, H e inputs que explican la señal</h2>
          <p id="weights-caption">Contribuciones efectivas registradas por el módulo para el último punto exportado.</p>
        </div>
      </div>
      <div id="weights-table"></div>
    </section>

    <div class="split-grid">
      <section class="card">
        <div class="card-header"><div><h2>Inputs del run</h2><p>Origen directo: ml_run_inputs.</p></div></div>
        <div id="inputs-table"></div>
      </section>
      <section class="card">
        <div class="card-header"><div><h2>Métricas del run</h2><p>Origen directo: ml_run_metrics.</p></div></div>
        <div id="metrics-table"></div>
      </section>
    </div>

    <section class="card">
      <div class="card-header">
        <div>
          <h2>Eventos históricos detectados</h2>
          <p>Origen directo: ml_signal_events. Sirve para auditar por qué un score/peso fue asignado.</p>
        </div>
      </div>
      <div id="events-table"></div>
    </section>

    <section class="card prose-card">
      <h2>Lectura operativa</h2>
      <div id="operational-reading"></div>
    </section>
  `;
}

async function wireMarketPage() {
  document.querySelectorAll('.module-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentModule = btn.dataset.module;
      document.querySelectorAll('.module-btn').forEach(b => b.classList.toggle('active', b.dataset.module === currentModule));
      await renderModule();
    });
  });
  await renderModule();
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

function buildOperationalReading(mod, weights, inputs, events, metrics) {
  const weightsInfo = weights.weights_available
    ? `Las contribuciones proceden de <code>${escapeHtml(weights.weights_source)}</code>${weights.asof_dt ? ` para <strong>${escapeHtml(weights.asof_dt)}</strong>` : ''}.`
    : `No hay contribución H→M explícita disponible; la web muestra inputs o señales como aproximación estructural.`;
  const topWeight = (weights.items || [])[0];
  const topSentence = topWeight
    ? `El contribuyente principal mostrado es <strong>${escapeHtml(topWeight.hypothesis_code || topWeight.input_code)}</strong> con señal/rol <strong>${escapeHtml(topWeight.signal_code || topWeight.role || '—')}</strong>.`
    : `No hay contribuyentes exportados para este módulo.`;
  return `
    <p><strong>${escapeHtml(mod.module_code)}</strong> usa el run <strong>${escapeHtml(String(mod.run_id || '—'))}</strong>, señal principal <strong>${escapeHtml(mod.signal_code || '—')}</strong> y último nivel <strong>${escapeHtml(mod.latest_level || '—')}</strong>.</p>
    <p>${weightsInfo} ${topSentence}</p>
    <p>Inputs declarados: <strong>${inputs.items?.length || 0}</strong>. Métricas disponibles: <strong>${metrics.items?.length || 0}</strong>. Eventos exportados: <strong>${events.items?.length || 0}</strong>.</p>
  `;
}

async function renderModule() {
  const [mod, weights, inputs, metrics, events] = await Promise.all([
    loadMarketModule(currentModule),
    loadMarketWeights(currentModule),
    loadMarketInputs(currentModule).catch(() => ({ items: [] })),
    loadMarketMetrics(currentModule).catch(() => ({ items: [] })),
    loadMarketEvents(currentModule).catch(() => ({ items: [] }))
  ]);

  const chart = document.getElementById('market-chart');
  const table = document.getElementById('weights-table');
  const inputsTable = document.getElementById('inputs-table');
  const metricsTable = document.getElementById('metrics-table');
  const eventsTable = document.getElementById('events-table');
  const selector = document.getElementById('signal-selector');
  const signalTable = document.getElementById('signal-series-table');
  const reading = document.getElementById('operational-reading');
  const caption = document.getElementById('weights-caption');
  if (!chart || !table) return;

  const chosen = selectedSignal(mod);
  selectedSignalByModule[currentModule] = chosen?.signal_code;

  const draw = () => {
    const series = [
      { name: 'SPX normalizado', points: mod.chart?.spx || [], color: '#60a5fa', width: 2 },
      { name: chosen?.signal_code || mod.signal_code, points: chosen?.points || mod.chart?.signal || [], color: SIGNAL_COLORS[0], width: 2 }
    ];
    drawLineChart(chart, series, { bands: mod.chart?.bands || [], markers: (events.items || []).slice(0, 60).map(e => ({ dt: e.event_dt_effective, label: e.direction })) });
  };
  draw();
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, draw);

  selector.innerHTML = signalButtons(mod);
  selector.querySelectorAll('.signal-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      selectedSignalByModule[currentModule] = btn.dataset.signal;
      await renderModule();
    });
  });

  if (caption) {
    caption.textContent = weights.weights_available
      ? `Contribuciones disponibles desde ${weights.weights_source}${weights.asof_dt ? ` para ${weights.asof_dt}` : ''}. ${weights.items?.length || 0} filas exportadas.`
      : `Sin contribuciones explícitas. Fallback actual: ${weights.weights_source || 'none'}.`;
  }
  table.innerHTML = signalWeightTable(weights.items || []);
  inputsTable.innerHTML = runInputTable(inputs.items || []);
  metricsTable.innerHTML = runMetricTable(metrics.items || []);
  eventsTable.innerHTML = signalEventTable(events.items || []);
  signalTable.innerHTML = signalSeriesTable(allSignalSeries(mod));
  reading.innerHTML = buildOperationalReading(mod, weights, inputs, events, metrics);
}
