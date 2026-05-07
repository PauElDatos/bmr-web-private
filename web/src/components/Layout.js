import { loadManifest } from '../api/dataClient.js';
import { escapeHtml } from '../utils/format.js';

const navItems = [
  { href: '#/', route: '/', label: 'Inicio' },
  { href: '#/sentimiento', route: '/sentimiento', label: 'Sentimiento del mercado' },
  { href: '#/macro', route: '/macro', label: 'Macro datos' },
  { href: '#/analisis', route: '/analisis', label: 'Análisis' }
];

function currentRoute() {
  const route = location.hash.replace(/^#/, '') || '/';
  if (!route.startsWith('/')) return `/${route}`;
  return route.replace(/\/$/, '') || '/';
}

function headerNavigation() {
  const active = currentRoute();
  return `
    <nav class="header-nav" aria-label="Navegación principal">
      ${navItems.map(i => `<a class="nav-link ${active === i.route ? 'active' : ''}" href="${i.href}">${escapeHtml(i.label)}</a>`).join('')}
    </nav>
  `;
}

export async function renderLayout(route, content) {
  let manifest = null;
  try { manifest = await loadManifest(); } catch (_) {}
  const snapshotLabel = escapeHtml(manifest?.snapshot_date || 'mock');
  return `
    <main class="main">
      ${content}
    </main>
    <div class="snapshot-badge" aria-label="Snapshot de datos">
      <span class="status-dot"></span>
      Snapshot: ${snapshotLabel}
    </div>
  `;
}

export function pageHeader(title, subtitle = '', actions = '') {
  return `
    <header class="page-header">
      <div class="page-title-block">
        <p class="eyebrow">N.Geolitics</p>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <div class="page-actions">
        ${headerNavigation()}
        ${actions || ''}
      </div>
    </header>
  `;
}

export function loadingView() {
  return `<div class="loading-card"><div class="spinner"></div><p>Cargando datos…</p></div>`;
}

export function errorView(error) {
  return `<div class="error-card"><h2>Error de carga</h2><p>${escapeHtml(error?.message || error)}</p></div>`;
}
