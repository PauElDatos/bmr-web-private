import { loadCatalog, loadTimeseries } from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { catalogList, factsPanel } from '../components/CatalogTable.js';
import { drawLineChart, attachResize, attachTradingViewInteractions } from '../utils/chart.js';

let selectedCode = 'FEDFUNDS';
let sourceFilter = 'ALL';
let cleanupResize = null;
let cleanupChartInteractions = null;
let macroView = {};
let macroCatalog = [];

export async function MacroDataPage() {
  const catalog = await loadCatalog('indicators');
  macroCatalog = catalog.items || [];
  const sources = ['ALL', ...new Set(macroCatalog.map(i => i.source).filter(Boolean))];
  setTimeout(() => wireMacroPage(), 0);

  return `
    ${pageHeader('Macro datos')}
    <section class="data-browser macro-data-browser">
      <aside class="card browser-sidebar macro-browser-sidebar">
        <div class="filter-grid compact-filter-grid">
          <label>Fuente<select id="source-filter" class="select-input">${sources.map(s => `<option value="${s}" ${s === sourceFilter ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        </div>
        <div id="macro-list" class="macro-list-scroll">${catalogList(filteredCatalog(), selectedCode, 'indicators')}</div>
      </aside>
      <main class="browser-main macro-browser-main">
        <div id="macro-facts"></div>
        ${chartPanel(
          'macro-chart',
          `Serie ${selectedCode}`,
          '',
          `<button id="macro-prev" class="icon-btn" type="button" aria-label="Serie anterior">‹</button><button id="macro-next" class="icon-btn" type="button" aria-label="Serie siguiente">›</button>`
        )}
      </main>
    </section>
  `;
}

function filteredCatalog() {
  return macroCatalog.filter(i => sourceFilter === 'ALL' || i.source === sourceFilter);
}

async function wireMacroPage() {
  const catalog = await loadCatalog('indicators');
  macroCatalog = catalog.items || [];
  const list = document.getElementById('macro-list');
  const source = document.getElementById('source-filter');
  const prev = document.getElementById('macro-prev');
  const next = document.getElementById('macro-next');

  const renderList = () => {
    if (!list) return;
    sourceFilter = source?.value || 'ALL';
    const filtered = filteredCatalog();
    if (filtered.length && !filtered.some(i => i.code === selectedCode)) selectedCode = filtered[0].code;
    list.innerHTML = catalogList(filtered, selectedCode, 'indicators');
    bindItems();
  };

  const navigateSeries = async (step) => {
    const filtered = filteredCatalog();
    if (!filtered.length) return;
    const currentIndex = Math.max(0, filtered.findIndex(i => i.code === selectedCode));
    const nextIndex = (currentIndex + step + filtered.length) % filtered.length;
    selectedCode = filtered[nextIndex].code;
    macroView = {};
    renderList();
    await renderMacroDetail(catalog);
  };

  const bindItems = () => {
    if (!list) return;
    list.querySelectorAll('.catalog-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        selectedCode = btn.dataset.code;
        macroView = {};
        renderList();
        await renderMacroDetail(catalog);
      });
    });
  };

  source?.addEventListener('change', async () => {
    renderList();
    macroView = {};
    await renderMacroDetail(catalog);
  });
  prev?.addEventListener('click', () => navigateSeries(-1));
  next?.addEventListener('click', () => navigateSeries(1));
  bindItems();
  await renderMacroDetail(catalog);
}

async function renderMacroDetail(catalog) {
  const item = (catalog.items || []).find(i => i.code === selectedCode) || (catalog.items || [])[0];
  if (!item) return;
  selectedCode = item.code;
  const ts = await loadTimeseries('indicators', item.code);
  const chart = document.getElementById('macro-chart');
  const title = document.getElementById('macro-chart-title');
  const facts = document.getElementById('macro-facts');
  if (title) title.textContent = `Serie ${item.code}`;
  if (facts) facts.innerHTML = factsPanel(item);
  if (!chart) return;

  const draw = () => drawLineChart(
    chart,
    [{ name: item.code, points: ts.points, color: '#60a5fa', width: 2 }],
    {
      view: macroView,
      hideLegend: true,
      hideYAxisGutter: true,
      bands: []
    }
  );

  draw();
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, draw);
  if (cleanupChartInteractions) cleanupChartInteractions();
  cleanupChartInteractions = attachTradingViewInteractions(chart, macroView, draw);
}
