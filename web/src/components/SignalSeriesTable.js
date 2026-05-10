import { escapeHtml, fmtNumber, sentimentLabel, sentimentPillClass } from '../utils/format.js';

export function signalSeriesTable(rows = []) {
  if (!rows.length) return `<div class="empty-state">No hay señales temporales disponibles para este módulo.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Señal</th><th>Última fecha</th><th>Último valor</th><th>Nivel</th><th>Puntos</th><th>Explicación</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><strong>${escapeHtml(r.signal_code || '—')}</strong></td>
              <td>${escapeHtml(r.latest_dt || '—')}</td>
              <td>${fmtNumber(r.latest_value, 4)}</td>
              <td><span class="pill ${sentimentPillClass(r.latest_level)}">${escapeHtml(sentimentLabel(r.latest_level || '—'))}</span></td>
              <td>${fmtNumber(r.n_points, 0)}</td>
              <td>${escapeHtml(r.latest_explanation || '')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}
