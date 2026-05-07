import { loadCatalog, loadTimeseries } from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { catalogList } from '../components/CatalogTable.js';
import { drawLineChart, attachResize, attachAxisWheelZoom } from '../utils/chart.js';

let selectedCode = 'FEDFUNDS';
let sourceFilter = 'ALL';
let cleanupResize = null;
let cleanupWheelZoom = null;
let macroView = {};

export async function MacroDataPage() {
  const catalog = await loadCatalog('indicators');
  const sources = ['ALL', ...new Set(catalog.items.map(i => i.source).filter(Boolean))];
  setTimeout(() => wireMacroPage(), 0);

  return `
    ${pageHeader('Macro datos')}
    <section class="data-browser">
      <aside class="card browser-sidebar">
        <div class="filter-grid compact-filter-grid">
          <label>Fuente<select id="source-filter" class="select-input">${sources.map(s => `<option value="${s}">${s}</option>`).join('')}</select></label>
        </div>
        <div id="macro-list" class="macro-list-scroll">${catalogList(catalog.items, selectedCode, 'indicators')}</div>
      </aside>
      <main class="browser-main">
        ${chartPanel('macro-chart', `Serie ${selectedCode}`)}
      </main>
    </section>
  `;
}

async function wireMacroPage() {
  const catalog = await loadCatalog('indicators');
  const list = document.getElementById('macro-list');
  const source = document.getElementById('source-filter');

  const renderList = () => {
    sourceFilter = source.value;
    const filtered = catalog.items.filter(i => sourceFilter === 'ALL' || i.source === sourceFilter);
    list.innerHTML = catalogList(filtered, selectedCode, 'indicators');
    bindItems();
  };

  const bindItems = () => {
    list.querySelectorAll('.catalog-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        selectedCode = btn.dataset.code;
        macroView = {};
        renderList();
        await renderMacroDetail(catalog);
      });
    });
  };

  source.addEventListener('change', renderList);
  bindItems();
  await renderMacroDetail(catalog);
}

async function renderMacroDetail(catalog) {
  const item = catalog.items.find(i => i.code === selectedCode) || catalog.items[0];
  if (!item) return;
  selectedCode = item.code;
  const ts = await loadTimeseries('indicators', item.code);
  const chart = document.getElementById('macro-chart');
  const title = document.getElementById('macro-chart-title');
  if (title) title.textContent = `Serie ${item.code}`;
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
  if (cleanupWheelZoom) cleanupWheelZoom();
  cleanupWheelZoom = attachAxisWheelZoom(chart, macroView, draw);
}
