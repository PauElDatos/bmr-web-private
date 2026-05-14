import { hypothesisPublicTitle, replaceHypothesisNamesInText } from '../data/hypothesisPublicInfo.js';
import { escapeHtml } from '../utils/format.js';

export function runInputTable(rows = []) {
  if (!rows.length) {
    return `<div class="empty-state">No hay inputs declarados para este run. Se mostrará cuando existan filas en ml_run_inputs.</div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tipo</th><th>Código</th><th>Rol</th><th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const publicTitle = hypothesisPublicTitle(r.input_code, r.input_code || '—');
            return `
            <tr>
              <td><span class="pill neutral">${escapeHtml(r.input_kind || '—')}</span></td>
              <td><strong>${escapeHtml(publicTitle)}</strong></td>
              <td>${escapeHtml(r.role || '—')}</td>
              <td>${escapeHtml(replaceHypothesisNamesInText(r.notes || ''))}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
