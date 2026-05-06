import { loadCatalog, loadTimeseries } from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { catalogList, factsPanel } from '../components/CatalogTable.js';
import { drawLineChart, attachResize } from '../utils/chart.js';
import { lastOf, escapeHtml } from '../utils/format.js';

let selectedCode = 'FEDFUNDS';
let sourceFilter = 'ALL';
let freqFilter = 'ALL';
let cleanupResize = null;

export async function MacroDataPage() {
  const catalog = await loadCatalog('indicators');
  const sources = ['ALL', ...new Set(catalog.items.map(i => i.source).filter(Boolean))];
  const freqs = ['ALL', ...new Set(catalog.items.map(i => i.frequency).filter(Boolean))];
  setTimeout(() => wireMacroPage(), 0);

  return `
    ${pageHeader('Macro datos', 'Catálogo de indicators/indicator_values preparado para los JSON reales de BMR.')}
    <section class="data-browser">
      <aside class="card browser-sidebar">
        <div class="filter-grid">
          <label>Buscar<input id="macro-search" class="text-input" placeholder="FRED, CPI, empleo…" /></label>
          <label>Fuente<select id="source-filter" class="select-input">${sources.map(s => `<option value="${s}">${s}</option>`).join('')}</select></label>
          <label>Frecuencia<select id="freq-filter" class="select-input">${freqs.map(f => `<option value="${f}">${f}</option>`).join('')}</select></label>
        </div>
        <div id="macro-list">${catalogList(catalog.items, selectedCode, 'indicators')}</div>
      </aside>
      <main class="browser-main">
        ${chartPanel('macro-chart', 'Serie macro seleccionada', 'Valores históricos del indicador seleccionado')}
        <section class="card">
          <h2>Detalle y explicación</h2>
          <div id="macro-detail"></div>
        </section>
      </main>
    </section>
  `;
}

async function wireMacroPage() {
  const catalog = await loadCatalog('indicators');
  const list = document.getElementById('macro-list');
  const search = document.getElementById('macro-search');
  const source = document.getElementById('source-filter');
  const freq = document.getElementById('freq-filter');

  const renderList = () => {
    const q = (search.value || '').toLowerCase();
    sourceFilter = source.value;
    freqFilter = freq.value;
    const filtered = catalog.items.filter(i => {
      const text = `${i.code} ${i.name} ${i.source} ${i.notes || ''}`.toLowerCase();
      return (!q || text.includes(q)) && (sourceFilter === 'ALL' || i.source === sourceFilter) && (freqFilter === 'ALL' || i.frequency === freqFilter);
    });
    list.innerHTML = catalogList(filtered, selectedCode, 'indicators');
    bindItems();
  };

  const bindItems = () => {
    list.querySelectorAll('.catalog-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        selectedCode = btn.dataset.code;
        renderList();
        await renderMacroDetail(catalog);
      });
    });
  };

  search.addEventListener('input', renderList);
  source.addEventListener('change', renderList);
  freq.addEventListener('change', renderList);
  bindItems();
  await renderMacroDetail(catalog);
}

async function renderMacroDetail(catalog) {
  const item = catalog.items.find(i => i.code === selectedCode) || catalog.items[0];
  if (!item) return;
  selectedCode = item.code;
  const ts = await loadTimeseries('indicators', item.code);
  const detail = document.getElementById('macro-detail');
  const chart = document.getElementById('macro-chart');
  const last = lastOf(ts.points);
  detail.innerHTML = `
    ${factsPanel(item, last)}
    <div class="explanation-box">
      <h3>Lectura operativa</h3>
      <p>${escapeHtml(item.explanation || 'Indicador macro utilizado como input potencial para hipótesis H y modelos M.')}</p>
      <h3>Señales remarcables</h3>
      <ul>${(item.signal_notes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
    </div>
  `;
  const draw = () => drawLineChart(chart, [{ name: item.code, points: ts.points, color: '#60a5fa' }], { bands: ts.bands || [] });
  draw();
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, draw);
}
