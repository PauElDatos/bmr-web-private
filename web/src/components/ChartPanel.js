import { escapeHtml } from '../utils/format.js';

export function chartPanel(id, title, subtitle = '') {
  const safeId = escapeHtml(id);
  return `
    <section class="card chart-card">
      <div class="card-header">
        <div>
          <h2 id="${safeId}-title">${escapeHtml(title)}</h2>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        </div>
      </div>
      <div id="${safeId}" class="chart-wrap"><canvas></canvas></div>
    </section>
  `;
}
