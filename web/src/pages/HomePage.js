import { pageHeader } from '../components/Layout.js';
import { escapeHtml } from '../utils/format.js';

export async function HomePage() {
  const cards = [
    {
      href: '#/sentimiento',
      title: 'Sentimiento del mercado',
      body: 'Régimen agregado, pulsos BUY/SELL, últimas señales y pesos explicativos preparados para datos reales.',
      level: 'ok'
    },
    {
      href: '#/macro',
      title: 'Macro datos',
      body: 'Catálogo macro desde indicators/indicator_values: fuente, frecuencia, unidad, último valor y gráfico histórico.',
      level: 'ok'
    },
    {
      href: '#/analisis',
      title: 'Análisis',
      body: 'Versión web del comparador: slots azul/rojo/verde, overlays, escalas, desfases y cálculos entre series.',
      level: 'warn'
    }
  ];

  return `
    ${pageHeader('Datos de Mercado')}
    <section class="home-grid">
      ${cards.map(c => `
        <a class="home-card ${c.level}" href="${c.href}">
          <h2>${escapeHtml(c.title)}</h2>
          <p>${escapeHtml(c.body)}</p>
        </a>
      `).join('')}
    </section>
  `;
}
