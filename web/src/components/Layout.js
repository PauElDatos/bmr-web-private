import { loadManifest } from '../api/dataClient.js';
import { escapeHtml } from '../utils/format.js';
import { authConfig, logoutUrl } from '../api/authClient.js';

const navItems = [
  { href: '#/', label: 'Inicio' },
  { href: '#/sentimiento', label: 'Sentimiento del mercado' },
  { href: '#/macro', label: 'Macro datos' },
  { href: '#/analisis', label: 'Análisis' }
];

export async function renderLayout(route, content) {
  let manifest = null;
  try { manifest = await loadManifest(); } catch (_) {}
  const active = route || '/';
  const snapshotLabel = escapeHtml(manifest?.snapshot_date || 'mock');
  return `
    <aside class="sidebar">
      <nav class="nav">
        ${navItems.map(i => `<a class="nav-link ${active === i.href.slice(1) ? 'active' : ''}" href="${i.href}">${i.label}</a>`).join('')}
      </nav>
    </aside>
    <main class="main">
      ${content}
    </main>
    <div class="snapshot-badge" aria-label="Snapshot de datos">
      <span class="status-dot"></span>
      Snapshot: ${snapshotLabel}
      ${authConfig().authRequired ? `<a class="logout-link" href="${logoutUrl()}">Salir</a>` : ''}
    </div>
  `;
}

export function pageHeader(title, subtitle = '', actions = '') {
  return `
    <header class="page-header">
      <div>
        <p class="eyebrow">N.Geolitics</p>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="page-actions">${actions}</div>
    </header>
  `;
}

export function loadingView() {
  return `<div class="loading-card"><div class="spinner"></div><p>Cargando datos…</p></div>`;
}

export function errorView(error) {
  return `<div class="error-card"><h2>Error de carga</h2><p>${escapeHtml(error?.message || error)}</p></div>`;
}
