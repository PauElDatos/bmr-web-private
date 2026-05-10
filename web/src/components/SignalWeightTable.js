import { escapeHtml, fmtNumber, fmtPct, sentimentLabel, sentimentPillClass } from '../utils/format.js';

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
  if (!rows.length) return `<div class="empty-state">No hay contribuciones disponibles para la fecha seleccionada.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hipótesis/Input</th>
            <th>Dirección</th>
            <th>Peso efectivo</th>
            <th>Contribución</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const directionClass = sentimentPillClass(r.direction || r.latest_level);
            return `
            <tr>
              <td>${escapeHtml(rowDate(r) || '—')}</td>
              <td><strong>${escapeHtml(r.hypothesis_code || r.input_code || '—')}</strong></td>
              <td><span class="pill ${directionClass}">${escapeHtml(sentimentLabel(r.direction || '—'))}</span></td>
              <td>${pctValue(r)}</td>
              <td>${contributionValue(r)}</td>
              <td>${r.raw_value == null ? '—' : fmtNumber(r.raw_value, 4)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
