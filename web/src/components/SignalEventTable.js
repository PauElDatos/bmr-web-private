import { hypothesisPublicTitle } from '../data/hypothesisPublicInfo.js';
import { escapeHtml, fmtNumber, fmtPct } from '../utils/format.js';

export function signalEventTable(rows = []) {
  if (!rows.length) {
    return `<div class="empty-state">Sin eventos para esta vista.</div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha efectiva</th><th>Hipótesis</th><th>Señal</th><th>Dirección</th><th>Entrada</th><th>Salida 12m</th><th>Ret. 12m</th><th>Max DD</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escapeHtml(String(r.event_dt_effective || '—'))}</td>
              <td>${escapeHtml(hypothesisPublicTitle(r.hypothesis_code, r.hypothesis_code || '—'))}</td>
              <td><strong>${escapeHtml(hypothesisPublicTitle(r.signal_code, r.signal_code || '—'))}</strong></td>
              <td><span class="pill ${String(r.direction || '').toLowerCase()}">${escapeHtml(r.direction || '—')}</span></td>
              <td>${fmtNumber(r.entry_close, 2)}</td>
              <td>${fmtNumber(r.exit_close_12m, 2)}</td>
              <td>${fmtPct(r.end_ret_12m_pct, 2)}</td>
              <td>${fmtPct(r.max_dd_12m_pct, 2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}
