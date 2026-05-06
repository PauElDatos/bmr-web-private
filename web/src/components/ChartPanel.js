export function chartPanel(id, title, subtitle = '') {
  return `
    <section class="card chart-card">
      <div class="card-header">
        <div>
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
      </div>
      <div id="${id}" class="chart-wrap"><canvas></canvas></div>
    </section>
  `;
}
