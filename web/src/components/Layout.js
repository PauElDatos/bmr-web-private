import { loadManifest } from '../api/dataClient.js';
import { escapeHtml } from '../utils/format.js';
import { authConfig, logoutUrl } from '../api/authClient.js';

const navItems = [
  { href: '#/', label: 'Inicio' },
  { href: '#/sentimiento', label: 'Sentimiento del mercado' },
  { href: '#/macro', label: 'Macro datos' },
  { href: '#/analisis', label: 'Análisis' },
  { href: '#/estado', label: 'Estado' }
];

export async function renderLayout(route, content) {
  let manifest = null;
  try { manifest = await loadManifest(); } catch (_) {}
  const active = route || '/';
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">B</div>
        <div>
          <div class="brand-title">BMR</div>
          <div class="brand-subtitle">Market Intelligence</div>
        </div>
      </div>
      <nav class="nav">
        ${navItems.map(i => `<a class="nav-link ${active === i.href.slice(1) ? 'active' : ''}" href="${i.href}">${i.label}</a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <span class="status-dot"></span>
        Snapshot: ${escapeHtml(manifest?.snapshot_date || 'mock')}
        ${authConfig().enabled ? `<a class="logout-link" href="${logoutUrl()}">Salir</a>` : ''}
      </div>
    </aside>
    <main class="main">
      ${content}
    </main>
  `;
}

export function pageHeader(title, subtitle, actions = '') {
  return `
    <header class="page-header">
      <div>
        <p class="eyebrow">Sistema BMR</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="page-subtitle">${escapeHtml(subtitle)}</p>
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
