import { loadManifest, loadStatus, loadAutomationStatus, loadPublishStatus, loadLastExport } from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { escapeHtml } from '../utils/format.js';

function statusPill(status) {
  const s = String(status || 'unknown').toLowerCase();
  const cls = s === 'ok' || s === 'pushed' || s === 'validated' ? 'buy' : s === 'warning' ? 'watch' : 'sell';
  return `<span class="pill ${cls}">${escapeHtml(status || 'unknown')}</span>`;
}

function renderChecks(health) {
  return (health.checks || []).map((c) => {
    const rawStatus = c.status || (c.ok === true ? 'ok' : c.ok === false ? 'error' : 'unknown');
    const detail = c.detail || (typeof c.count !== 'undefined' ? `count=${c.count}` : '—');
    return `<tr><td>${escapeHtml(c.name)}</td><td>${statusPill(rawStatus)}</td><td>${escapeHtml(detail)}</td></tr>`;
  }).join('');
}

function renderStatusCard(title, payload, rows) {
  if (!payload) {
    return `
      <section class="card">
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">No existe todavía este fichero de estado. Se generará al ejecutar la automatización de Fase 5.</p>
      </section>
    `;
  }
  return `
    <section class="card">
      <h2>${escapeHtml(title)}</h2>
      <div class="json-grid">
        ${rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '—')}</strong></div>`).join('')}
      </div>
    </section>
  `;
}

export async function StatusPage() {
  const [manifest, health, automation, publish, lastExport] = await Promise.all([
    loadManifest(),
    loadStatus(),
    loadAutomationStatus(),
    loadPublishStatus(),
    loadLastExport(),
  ]);

  return `
    ${pageHeader('Estado del corte de datos')}
    <section class="card">
      <h2>Manifest</h2>
      <div class="json-grid">
        <div><span>Versión</span><strong>${escapeHtml(manifest.version)}</strong></div>
        <div><span>Corte de datos</span><strong>${escapeHtml(manifest.snapshot_date)}</strong></div>
        <div><span>Modo</span><strong>${escapeHtml(manifest.mode)}</strong></div>
        <div><span>Generado</span><strong>${escapeHtml(manifest.generated_at)}</strong></div>
      </div>
    </section>

    <section class="card">
      <h2>Health</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Componente</th><th>Estado</th><th>Detalle</th></tr></thead>
          <tbody>${renderChecks(health)}</tbody>
        </table>
      </div>
    </section>

    ${renderStatusCard('Automatización diaria', automation, [
      ['Estado', automation?.status],
      ['Fase', automation?.stage],
      ['Validación', automation?.validation_status],
      ['Mensaje', automation?.message],
      ['Host', automation?.host],
      ['Log', automation?.log_file],
    ])}

    ${renderStatusCard('Publicación GitHub Pages', publish, [
      ['Fase', publish?.stage],
      ['Rama', publish?.branch],
      ['Commit', publish?.commit],
      ['Worktree sucio', publish?.dirty_worktree],
      ['Ficheros cambiados', publish?.changed_files_count],
      ['Fuente Pages', publish?.pages_source],
    ])}

    ${renderStatusCard('Última exportación', lastExport, [
      ['Corte de datos', lastExport?.manifest?.snapshot_date || lastExport?.snapshot_date],
      ['Versión', lastExport?.manifest?.version || lastExport?.manifest_version],
      ['Warnings', (lastExport?.warnings || []).length],
      ['Generado', lastExport?.generated_at || lastExport?.manifest?.generated_at],
    ])}

    <section class="card prose-card">
      <h2>Operación recomendada</h2>
      <p>La VM BMR ejecuta <code>automation/run_daily_pipeline.sh</code>, genera los JSON desde MariaDB, valida el contrato, escribe estos ficheros de estado y hace <code>git push</code>. GitHub Actions despliega el contenido de <code>web/</code> en GitHub Pages.</p>
    </section>
  `;
}
