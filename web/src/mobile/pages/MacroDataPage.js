// Versión móvil duplicada de src/pages/MacroDataPage.js.
// Mantiene la lógica original y carga estilos verticales desde mobile.html.

import { loadCatalog, loadTimeseries } from '../../api/dataClient.js';
import { pageHeader } from '../../components/Layout.js';
import { chartPanel } from '../../components/ChartPanel.js';
import { catalogList, factsPanel } from '../../components/CatalogTable.js';
import { drawLineChart, attachResize, attachTradingChartInteractions } from '../../utils/chart.js';
import { escapeHtml, translateDbText } from '../../utils/format.js';
import { MACRO_SERIES_EXPLANATIONS, fallbackMacroSeriesExplanation } from '../../data/macroSeriesExplanations.js';

let selectedCode = 'FEDFUNDS';
let sourceFilter = 'ALL';
let cleanupResize = null;
let cleanupChartInteractions = null;
let macroView = {};

export async function MacroDataPage() {
  const catalog = await loadCatalog('indicators');
  const sources = ['ALL', ...new Set(catalog.items.map(i => i.source).filter(Boolean))];
  const selectedItem = catalog.items.find(i => i.code === selectedCode) || catalog.items[0];
  if (selectedItem) selectedCode = selectedItem.code;
  setTimeout(() => wireMacroPage(), 0);

  const chartActions = `
    <button id="macro-prev" class="btn icon-btn" type="button" aria-label="Serie anterior">‹</button>
    <button id="macro-next" class="btn icon-btn" type="button" aria-label="Serie siguiente">›</button>
  `;

  return `
    <div class="macro-page">
      ${pageHeader('Macro datos')}
      <section class="data-browser">
        <aside class="card browser-sidebar">
          <div class="filter-grid compact-filter-grid">
            <label>Fuente<select id="source-filter" class="select-input">${sources.map(s => `<option value="${escapeHtml(s)}" ${s === sourceFilter ? 'selected' : ''}>${escapeHtml(s === 'ALL' ? 'Todas' : translateDbText(s))}</option>`).join('')}</select></label>
          </div>
          <div id="macro-list" class="macro-list-scroll">${catalogList(filteredCatalogItems(catalog.items), selectedCode, 'indicators')}</div>
        </aside>
        <main class="browser-main">
          <div id="macro-facts">${factsPanel(selectedItem)}</div>
          ${chartPanel('macro-chart', `Serie ${selectedCode}`, '', chartActions)}
          ${seriesExplanationPanel(selectedItem)}
        </main>
      </section>
    </div>
  `;
}

async function wireMacroPage() {
  const catalog = await loadCatalog('indicators');
  const list = document.getElementById('macro-list');
  const source = document.getElementById('source-filter');
  const prevBtn = document.getElementById('macro-prev');
  const nextBtn = document.getElementById('macro-next');
  if (!list || !source) return;

  const getVisibleItems = () => filteredCatalogItems(catalog.items);

  const renderList = ({ preserveScroll = false } = {}) => {
    const scrollBox = list.querySelector('.catalog-list');
    const previousScrollTop = preserveScroll && scrollBox ? scrollBox.scrollTop : 0;

    sourceFilter = source.value;
    list.innerHTML = catalogList(getVisibleItems(), selectedCode, 'indicators');
    bindItems();

    if (preserveScroll) {
      const nextScrollBox = list.querySelector('.catalog-list');
      if (nextScrollBox) nextScrollBox.scrollTop = previousScrollTop;
    }
  };

  const selectCode = async (code) => {
    selectedCode = code;
    macroView = {};
    renderList({ preserveScroll: true });
    await renderMacroDetail(catalog);
  };

  const selectByOffset = async (offset) => {
    const visible = getVisibleItems();
    if (!visible.length) return;
    const currentIndex = Math.max(0, visible.findIndex(i => i.code === selectedCode));
    const nextIndex = (currentIndex + offset + visible.length) % visible.length;
    await selectCode(visible[nextIndex].code);
  };

  const bindItems = () => {
    list.querySelectorAll('.catalog-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        await selectCode(btn.dataset.code);
      });
    });
  };

  source.addEventListener('change', async () => {
    sourceFilter = source.value;
    const visible = getVisibleItems();
    if (visible.length && !visible.some(i => i.code === selectedCode)) {
      selectedCode = visible[0].code;
      macroView = {};
    }
    renderList();
    await renderMacroDetail(catalog);
  });

  prevBtn?.addEventListener('click', () => selectByOffset(-1));
  nextBtn?.addEventListener('click', () => selectByOffset(1));

  bindItems();
  await renderMacroDetail(catalog);
}


function seriesExplanationPanel(item) {
  if (!item) return '';
  return `
    <section id="macro-series-explanation" class="card series-explanation-card">
      ${seriesExplanationContent(item)}
    </section>
  `;
}

function seriesExplanationContent(item) {
  const code = item.code || item.symbol || '';
  const info = MACRO_SERIES_EXPLANATIONS.get(code) || fallbackMacroSeriesExplanation();
  const selectedSeries = code || item.name || item.asset_name || 'serie seleccionada';
  return `
    <div class="card-header explanation-header">
      <div>
        <h2>Explicación de ${escapeHtml(selectedSeries)}</h2>
      </div>
    </div>
    <div class="series-explanation-body">
      <article>
        <span>Qu\u00e9 mide</span>
        <p>${escapeHtml(info.summary)}</p>
      </article>
      <article>
        <span>Zona sana</span>
        <p>${escapeHtml(info.healthy)}</p>
      </article>
      <article>
        <span>Alerta</span>
        <p>${escapeHtml(info.alert)}</p>
      </article>
    </div>
  `;
}

function renderMacroExplanation(item) {
  const explanation = document.getElementById('macro-series-explanation');
  if (!explanation || !item) return;
  explanation.innerHTML = seriesExplanationContent(item);
}
function filteredCatalogItems(items) {
  return (items || []).filter(i => sourceFilter === 'ALL' || i.source === sourceFilter);
}

async function renderMacroDetail(catalog) {
  const item = catalog.items.find(i => i.code === selectedCode) || catalog.items[0];
  if (!item) return;
  selectedCode = item.code;
  const ts = await loadTimeseries('indicators', item.code);
  const chart = document.getElementById('macro-chart');
  const title = document.getElementById('macro-chart-title');
  const facts = document.getElementById('macro-facts');
  if (title) title.textContent = `Serie ${item.code}`;
  if (facts) facts.innerHTML = factsPanel(item);
  renderMacroExplanation(item);
  if (!chart) return;

  const draw = () => drawLineChart(
    chart,
    [{ name: item.code, points: ts.points, color: '#60a5fa', width: 2 }],
    {
      view: macroView,
      hideLegend: true,
      hideYAxisGutter: true,
      bands: [],
      compactAxes: true,
      anchoredGrid: true
    }
  );

  draw();
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, draw);
  if (cleanupChartInteractions) cleanupChartInteractions();
  cleanupChartInteractions = attachTradingChartInteractions(chart, macroView, draw);
}
