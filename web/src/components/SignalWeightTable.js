import { hypothesisPublicDescription, hypothesisPublicTitle } from '../data/hypothesisPublicInfo.js';
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

function hypothesisCell(row) {
  const rawName = row.hypothesis_code || row.input_code || '—';
  const publicTitle = hypothesisPublicTitle(rawName, rawName);
  const description = hypothesisPublicDescription(rawName);
  return `
    <div class="public-h-name">
      <strong>${escapeHtml(publicTitle)}</strong>
      ${publicTitle !== rawName ? `<span>${escapeHtml(rawName)}</span>` : ''}
      ${description ? `
        <details class="h-description-disclosure">
          <summary>Ver explicación</summary>
          <p>${escapeHtml(description)}</p>
        </details>
      ` : ''}
    </div>
  `;
}

export function signalWeightTable(rows = []) {
  if (!rows.length) return `<div class="empty-state">No hay contribuciones disponibles para la fecha seleccionada.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Indicador o input</th>
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
              <td>${hypothesisCell(r)}</td>
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
