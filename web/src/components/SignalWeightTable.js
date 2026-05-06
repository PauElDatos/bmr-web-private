import { escapeHtml, fmtNumber, fmtPct } from '../utils/format.js';

function sourceLabel(row) {
  return row.weight_source || row.source || row.weights_source || '';
}

export function signalWeightTable(rows = []) {
  if (!rows.length) return `<div class="empty-state">No hay pesos disponibles en este snapshot. La estructura queda preparada para datos futuros.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hipótesis/Input</th><th>Señal/Rol</th><th>Dirección</th><th>Peso</th><th>Score</th><th>Eventos</th><th>Ret. medio 12m</th><th>Fuente</th><th>Explicación</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const directionClass = String(r.direction || 'neutral').toLowerCase();
            return `
            <tr>
              <td><strong>${escapeHtml(r.hypothesis_code || r.input_code || '—')}</strong></td>
              <td>${escapeHtml(r.signal_code || r.role || '—')}</td>
              <td><span class="pill ${directionClass}">${escapeHtml(r.direction || '—')}</span></td>
              <td>${r.weight == null ? '—' : fmtPct(Number(r.weight) * 100, 2)}</td>
              <td>${r.score == null ? '—' : fmtNumber(r.score, 4)}</td>
              <td>${r.n_events == null ? '—' : fmtNumber(r.n_events, 0)}</td>
              <td>${r.avg_end_ret_12m_pct == null ? '—' : fmtPct(r.avg_end_ret_12m_pct, 2)}</td>
              <td><code>${escapeHtml(sourceLabel(r))}</code></td>
              <td>${escapeHtml(r.explanation || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
