import { escapeHtml, fmtNumber, fmtPct } from '../utils/format.js';

function sourceLabel(row) {
  return row.weight_source || row.source || row.weights_source || row.method || '';
}

function rowDate(row) {
  return row.dt || row.asof_dt || '';
}

function pctValue(row) {
  const value = row.weight ?? row.contribution_pct;
  return value == null ? '—' : fmtPct(Number(value) * 100, 2);
}

function contributionValue(row) {
  const value = row.contribution ?? row.score;
  return value == null ? '—' : fmtNumber(value, 5);
}

export function signalWeightTable(rows = []) {
  if (!rows.length) return `<div class="empty-state">No hay contribuciones disponibles en este snapshot.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hipótesis/Input</th>
            <th>Señal/Rol</th>
            <th>Dirección</th>
            <th>Peso efectivo</th>
            <th>Contribución</th>
            <th>Valor</th>
            <th>Coef.</th>
            <th>Fuente</th>
            <th>Explicación</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const directionClass = String(r.direction || 'neutral').toLowerCase();
            return `
            <tr>
              <td>${escapeHtml(rowDate(r) || '—')}</td>
              <td><strong>${escapeHtml(r.hypothesis_code || r.input_code || '—')}</strong></td>
              <td>${escapeHtml(r.signal_code || r.role || r.output_signal_code || '—')}</td>
              <td><span class="pill ${directionClass}">${escapeHtml(r.direction || '—')}</span></td>
              <td>${pctValue(r)}</td>
              <td>${contributionValue(r)}</td>
              <td>${r.raw_value == null ? '—' : fmtNumber(r.raw_value, 4)}</td>
              <td>${r.model_weight == null ? '—' : fmtNumber(r.model_weight, 5)}</td>
              <td><code>${escapeHtml(sourceLabel(r))}</code></td>
              <td>${escapeHtml(r.explanation || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
