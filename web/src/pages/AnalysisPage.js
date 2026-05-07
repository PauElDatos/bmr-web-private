import { loadCatalog, loadTimeseries, loadJson } from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { chartPanel } from '../components/ChartPanel.js';
import { drawLineChart, attachResize } from '../utils/chart.js';
import {
  transformSeries,
  filterByYears,
  calculateSeries,
  calculateSeriesAligned,
  normalizeTo100,
  makeRecessionBands,
  describePoints,
  toCsvRows
} from '../utils/series.js';
import { escapeHtml, lastOf, translateDbText } from '../utils/format.js';

const slots = ['blue', 'red', 'green'];
let cleanupResize = null;
let catalogs = null;
let lastRendered = { loaded: [], chartSeries: [], calcPoints: [] };

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
  ['EXP', 'EXP'],
  ['DIFF_1', 'Dif. 1 obs.'],
  ['DIFF_12', 'Dif. 12 obs.'],
  ['PCT_1', '% 1 obs.'],
  ['PCT_12', '% 12 obs.'],
  ['ZSCORE', 'Z-score']
];

const calcOptions = [
  ['none', 'Sin cálculo'],
  ['sum', 'Sumar azul + rojo'],
  ['subtract', 'Restar azul - rojo'],
  ['divide', 'Ratio azul / rojo'],
  ['multiply', 'Multiplicar azul * rojo'],
  ['spread_z', 'Spread z-score'],
  ['correlation_rolling', 'Correlación rolling 24']
];

export async function AnalysisPage() {
  catalogs = await loadAnalysisCatalogs();
  setTimeout(() => wireAnalysisPage(), 0);
  return `
    ${pageHeader('Análisis')}
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
        <label>Cálculo
          <select id="calc-op" class="select-input">
            ${calcOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select>
        </label>
        <label class="check"><input id="normalize" type="checkbox" checked /> <span>Normalizar a 100</span></label>
        <label class="check"><input id="align-ffill" type="checkbox" checked /> <span>Relleno hacia delante para cálculo</span></label>
        <button id="apply-analysis" class="btn primary">Aplicar</button>
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

    <div class="analysis-layout wide">
      <main>
        ${chartPanel('analysis-chart', 'Comparador de series', 'Slots azul/rojo/verde + overlays + cálculo opcional')}
        <section class="card">
          <div class="card-header">
            <div>
              <h2>Diagnóstico del cálculo</h2>
              <p>Resumen de las series renderizadas, último punto, rango visible y compatibilidad temporal.</p>
            </div>
          </div>
          <div id="analysis-diagnostics" class="diagnostic-grid"></div>
        </section>
        <section class="card">
          <div class="card-header">
            <div>
              <h2>Catálogo BMR para análisis</h2>
              <p>Busca indicadores, activos, series canónicas o cripto y envíalos directamente a un slot.</p>
            </div>
          </div>
          <div class="catalog-toolbar">
            <input id="catalog-search" class="text-input" placeholder="Buscar código, nombre, fuente, tipo..." />
            <select id="catalog-kind" class="select-input"><option value="all">Todos</option><option value="indicators">Indicadores macro</option><option value="assets">Activos</option><option value="series">Series canónicas</option><option value="crypto">Cripto</option></select>
            <select id="catalog-source" class="select-input"><option value="all">Todas las fuentes/tipos</option>${catalogs.facets.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(translateDbText(f))}</option>`).join('')}</select>
          </div>
          <div id="analysis-catalog-table" class="analysis-catalog-table"></div>
        </section>
      </main>
      <aside>
        <section class="card sticky-card">
          <h2>Slots activos</h2>
          <p>Equivalente web de los tres selectores del comparador local.</p>
          <div id="analysis-facts" class="analysis-facts"></div>
        </section>
        <section class="card">
          <h2>Lectura rápida</h2>
          <div id="analysis-reading" class="reading-box"></div>
        </section>
      </aside>
    </div>
  `;
}

async function loadAnalysisCatalogs() {
  const [indicators, assets, series, crypto, overlays, presets, recession] = await Promise.all([
    loadCatalog('indicators'),
    loadCatalog('assets'),
    loadCatalog('series'),
    loadCatalog('crypto'),
    loadJson('analysis/overlays.json').catch(() => ({ items: [] })),
    loadJson('analysis/presets.json').catch(() => ({ items: [] })),
    loadJson('analysis/recession_bands.json').catch(() => ({ items: [] }))
  ]);
  const options = [
    ...indicators.items.map(i => normalizeCatalogOption('indicators', i.code, i.name, i.source, i.frequency, i.unit, i)),
    ...assets.items.map(a => normalizeCatalogOption('assets', a.symbol || a.code, a.name, a.asset_type, 'prices', '', a)),
    ...series.items.map(s => normalizeCatalogOption('series', s.code, s.name, s.series_type, 'series_prices', '', s)),
    ...crypto.items.map(c => normalizeCatalogOption('crypto', c.symbol || c.code, c.name || c.symbol, 'crypto', c.source || 'coinpaprika', c.quote || 'usd', c))
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
  return {
    key: `${kind}:${code}`,
    label: `${labelKind(kind)} · ${code} · ${displayName}`,
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
    document.getElementById(`slot-${slot}`).addEventListener('change', e => { slotState[slot].key = e.target.value; renderAnalysis(); });
    document.getElementById(`transform-${slot}`).addEventListener('change', e => { slotState[slot].transform = e.target.value; renderAnalysis(); });
    document.getElementById(`lag-${slot}`).addEventListener('change', e => { slotState[slot].lag = Number(e.target.value || 0); renderAnalysis(); });
    document.getElementById(`visible-${slot}`).addEventListener('change', e => { slotState[slot].visible = e.target.checked; renderAnalysis(); });
  }
  document.querySelectorAll('.invert-btn').forEach(b => b.addEventListener('click', () => {
    const s = b.dataset.slot;
    slotState[s].invert = !slotState[s].invert;
    b.classList.toggle('active', slotState[s].invert);
    renderAnalysis();
  }));
  document.getElementById('analysis-preset').addEventListener('change', applyPreset);
  document.getElementById('apply-analysis').addEventListener('click', renderAnalysis);
  document.getElementById('export-analysis').addEventListener('click', exportVisibleCsv);
  document.getElementById('reset-analysis').addEventListener('click', resetAnalysis);
  document.querySelectorAll('.overlay-check').forEach(c => c.addEventListener('change', renderAnalysis));
  document.getElementById('overlay-recession').addEventListener('change', renderAnalysis);
  ['year-start', 'year-end', 'calc-op', 'normalize', 'align-ffill'].forEach(id => document.getElementById(id).addEventListener('change', renderAnalysis));
  ['catalog-search', 'catalog-kind', 'catalog-source'].forEach(id => document.getElementById(id).addEventListener('input', renderCatalogTable));
  renderCatalogTable();
  await renderAnalysis();
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
  renderAnalysis();
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
  const visiblePoints = document.getElementById('normalize')?.checked ? normalizeTo100(pts) : pts;
  return { slot, opt, rawPoints: pts, points: visiblePoints, rawStats, state: { ...slotState[slot] } };
}

async function renderAnalysis() {
  const chart = document.getElementById('analysis-chart');
  if (!chart) return;
  const loaded = await Promise.all(slots.map(loadSlotSeries));
  const series = loaded
    .filter(s => s.state.visible)
    .map(s => ({ name: `${slotLabels[s.slot]} · ${s.opt.code}`, points: s.points, color: slotColors[s.slot], width: 2.2 }));

  const op = document.getElementById('calc-op')?.value || 'none';
  let calcPoints = [];
  if (op !== 'none') {
    const align = document.getElementById('align-ffill')?.checked;
    calcPoints = align ? calculateSeriesAligned(loaded[0].points, loaded[1].points, op) : calculateSeries(loaded[0].points, loaded[1].points, op);
    series.push({ name: `Cálculo · ${labelCalc(op)}`, points: calcPoints, color: '#fbbf24', width: 2.8 });
  }

  const selectedOverlays = Array.from(document.querySelectorAll('.overlay-check:checked')).map(c => c.value);
  for (const o of selectedOverlays) {
    const ov = catalogs.overlays.find(x => x.code === o);
    if (!ov) continue;
    try {
      const kind = ov.kind;
      const code = ov.target_code || ov.code;
      const ts = await loadTimeseries(kind, code);
      let pts = filterByYears(ts.points, document.getElementById('year-start')?.value, document.getElementById('year-end')?.value);
      if (document.getElementById('normalize')?.checked) pts = normalizeTo100(pts);
      series.push({ name: `Capa ${o}`, points: pts, color: ov.color || '#a78bfa', width: 1.5 });
    } catch (_) {}
  }

  let recessionBands = [];
  if (document.getElementById('overlay-recession')?.checked) {
    recessionBands = catalogs.recessionBands.length ? catalogs.recessionBands : await loadRecessionBandsFromUSREC();
    recessionBands = recessionBands.filter(b => inYearRange(b.from) || inYearRange(b.to));
  }

  const draw = () => drawLineChart(chart, series, { bands: recessionBands });
  draw();
  if (cleanupResize) cleanupResize();
  cleanupResize = attachResize(chart, draw);

  lastRendered = { loaded, chartSeries: series, calcPoints };
  renderFacts(loaded);
  renderDiagnostics(loaded, calcPoints, op);
  renderReading(loaded, calcPoints, op);
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

function renderDiagnostics(loaded, calcPoints, op) {
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
  if (op !== 'none') {
    const stats = describePoints(calcPoints);
    rows.push({ label: `Cálculo · ${labelCalc(op)}`, type: document.getElementById('align-ffill')?.checked ? 'Alineado con forward-fill' : 'Fechas exactas', transform: 'Serie derivada en navegador', points: stats.count, from: stats.firstDt || '—', to: stats.lastDt || '—', last: formatMaybe(stats.lastValue) });
  }
  el.innerHTML = rows.map(r => `
    <div class="diagnostic-card">
      <strong>${escapeHtml(r.label)}</strong>
      <span>${escapeHtml(r.type)}</span>
      <small>${escapeHtml(r.transform)}</small>
      <div class="diagnostic-metrics"><b>${r.points}</b><em>${escapeHtml(r.from)} → ${escapeHtml(r.to)}</em><i>${escapeHtml(r.last)}</i></div>
    </div>
  `).join('');
}

function renderReading(loaded, calcPoints, op) {
  const el = document.getElementById('analysis-reading');
  if (!el) return;
  const primary = loaded[0];
  const secondary = loaded[1];
  const pStats = describePoints(primary.rawPoints);
  const sStats = describePoints(secondary.rawPoints);
  const calcStats = describePoints(calcPoints);
  const msg = [
    `Serie principal: ${primary.opt.code} (${pStats.count} puntos).`,
    `Comparación: ${secondary.opt.code} (${sStats.count} puntos).`,
    op !== 'none' ? `Cálculo activo: ${labelCalc(op)} con ${calcStats.count} puntos resultantes.` : 'Sin cálculo derivado activo.',
    document.getElementById('normalize')?.checked ? 'El gráfico está normalizado a base 100 para comparar direcciones, no niveles absolutos.' : 'El gráfico muestra niveles transformados sin normalización común.'
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
  if (kind !== 'all') items = items.filter(i => i.kind === kind);
  if (facet !== 'all') items = items.filter(i => (i.facetValues || [i.source, i.type, i.frequency]).includes(facet));
  if (q) {
    items = items.filter(i => [i.code, i.name, i.rawName, i.source, i.rawSource, i.type, i.rawType, i.frequency, i.rawFrequency, i.kind].join(' ').toLowerCase().includes(q));
  }
  items = items.slice(0, 160);
  el.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Tipo</th><th>Código</th><th>Nombre</th><th>Fuente/tipo</th><th>Slot</th></tr></thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td><span class="pill input">${escapeHtml(labelKind(i.kind))}</span></td>
            <td><code>${escapeHtml(i.code)}</code></td>
            <td>${escapeHtml(i.name)}</td>
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
    renderAnalysis();
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
