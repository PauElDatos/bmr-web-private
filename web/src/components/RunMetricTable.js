import { escapeHtml, fmtNumber } from '../utils/format.js';

function shortJson(value) {
  if (!value) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export function runMetricTable(rows = []) {
  if (!rows.length) {
    return `<div class="empty-state">No hay métricas ml_run_metrics para este run todavía.</div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Métrica</th><th>Valor</th><th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><strong>${escapeHtml(r.metric_code || '—')}</strong></td>
              <td>${fmtNumber(r.metric_value, 5)}</td>
              <td><code>${escapeHtml(shortJson(r.details_json))}</code></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}
