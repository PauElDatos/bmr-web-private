import { loadJson, loadCatalog } from '../api/dataClient.js';
import { pageHeader } from '../components/Layout.js';
import { metricGrid } from '../components/MetricCard.js';
import { classForLevel, escapeHtml } from '../utils/format.js';

export async function HomePage() {
  const [latest, indicators, assets, series, health] = await Promise.all([
    loadJson('market/latest.json'),
    loadCatalog('indicators'),
    loadCatalog('assets'),
    loadCatalog('series'),
    loadJson('status/health.json')
  ]);

  const cards = [
    {
      href: '#/sentimiento',
      title: 'Sentimiento del mercado',
      kicker: 'M1–M5',
      body: 'Régimen agregado, pulsos BUY/SELL, últimas señales y pesos explicativos preparados para datos reales.',
      stat: latest.regime,
      level: classForLevel(latest.regime)
    },
    {
      href: '#/macro',
      title: 'Macro datos',
      kicker: 'Indicadores',
      body: 'Catálogo macro desde indicators/indicator_values: fuente, frecuencia, unidad, último valor y gráfico histórico.',
      stat: `${indicators.items.length} indicadores`,
      level: 'ok'
    },
    {
      href: '#/analisis',
      title: 'Análisis',
      kicker: 'Comparador',
      body: 'Versión web del comparador: slots azul/rojo/verde, overlays, escalas, desfases y cálculos entre series.',
      stat: `${assets.items.length + series.items.length} series`,
      level: 'warn'
    }
  ];

  return `
    ${pageHeader('BMR Market Intelligence', 'Esqueleto web estático con mock data. Preparado para sustituir los JSON por exportaciones reales desde MariaDB.')}
    ${metricGrid([
      { label: 'Régimen mock', value: latest.regime, detail: latest.asof_dt, level: classForLevel(latest.regime) },
      { label: 'Módulo dominante', value: latest.primary_driver, detail: 'placeholder Fase 1', level: 'warn' },
      { label: 'Snapshot', value: health.snapshot_status, detail: health.generated_at, level: 'ok' }
    ])}
    <section class="home-grid">
      ${cards.map(c => `
        <a class="home-card ${c.level}" href="${c.href}">
          <span>${escapeHtml(c.kicker)}</span>
          <h2>${escapeHtml(c.title)}</h2>
          <p>${escapeHtml(c.body)}</p>
          <strong>${escapeHtml(c.stat)}</strong>
        </a>
      `).join('')}
    </section>
    <section class="card prose-card">
      <h2>Alcance de esta fase</h2>
      <p>Esta entrega no se conecta todavía a MariaDB ni a Patreon. Sirve como estructura navegable y contrato visual para validar páginas, componentes, rutas y formato de JSON.</p>
      <p>En la Fase 2 el exportador Python generará estos mismos ficheros desde la base BMR; en fases posteriores se completarán pesos reales, análisis avanzado y control de acceso.</p>
    </section>
  `;
}
