import { escapeHtml, fmtNumber } from '../utils/format.js';

export function catalogList(items, selectedCode, kind = 'indicator') {
  return `
    <div class="catalog-list">
      ${items.map((item) => `
        <button class="catalog-item ${item.code === selectedCode || item.symbol === selectedCode ? 'active' : ''}" data-code="${escapeHtml(item.code || item.symbol)}" data-kind="${kind}">
          <strong>${escapeHtml(item.code || item.symbol)}</strong>
          <span>${escapeHtml(item.name || item.asset_name || '')}</span>
          <em>${escapeHtml(item.source || item.asset_type || item.series_type || '')}</em>
        </button>
      `).join('')}
    </div>
  `;
}

export function factsPanel(item) {
  if (!item) return '';
  return `
    <div class="facts-grid">
      <div><span>Código</span><strong>${escapeHtml(item.code || item.symbol)}</strong></div>
      <div><span>Nombre</span><strong>${escapeHtml(item.name || item.asset_name || '—')}</strong></div>
      <div><span>Fuente/tipo</span><strong>${escapeHtml(item.source || item.asset_type || item.series_type || '—')}</strong></div>
    </div>
  `;
}
