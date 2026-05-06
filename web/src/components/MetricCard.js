import { escapeHtml } from '../utils/format.js';

export function metricCard(label, value, detail = '', level = 'muted') {
  return `
    <div class="metric-card ${level}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
    </div>
  `;
}

export function metricGrid(metrics) {
  return `<div class="metric-grid">${metrics.map(m => metricCard(m.label, m.value, m.detail, m.level)).join('')}</div>`;
}
