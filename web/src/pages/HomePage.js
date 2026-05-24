import { pageHeader } from '../components/Layout.js';
import { escapeHtml } from '../utils/format.js';

export async function HomePage() {
  const cards = [
    {
      href: '#/sentimiento',
      title: 'Sentimiento del mercado',
      icon: './noun-graph-5745805.svg',
      body: 'Consulta el pulso actual del mercado: régimen dominante, evolución reciente, pesos explicativos y lectura agregada del apetito por riesgo.',
      level: 'ok'
    },
    {
      href: '#/macro',
      title: 'Macro datos',
      icon: './noun-line-graph-5745821.svg',
      body: 'Explora indicadores macro y financieros con su fuente, frecuencia, unidad, último dato disponible y evolución histórica en gráfico.',
      level: 'ok'
    },
    {
      href: '#/analisis',
      title: 'Análisis',
      icon: './noun-pie-chart-5745822.svg',
      body: 'Compara series macro, commodities e índices; ajusta transformaciones, inversiones, desfases, overlays y cálculos personalizados en un mismo gráfico.',
      level: 'warn'
    }
  ];

  return `
    ${pageHeader('Datos de Mercado')}
    <section class="home-grid">
      ${cards.map(c => `
        <a class="home-card ${c.level}" href="${c.href}">
          <h2>${escapeHtml(c.title)}</h2>
          <img class="home-card-icon" src="${c.icon}" alt="" aria-hidden="true" loading="lazy" />
          <p>${escapeHtml(c.body)}</p>
        </a>
      `).join('')}
    </section>
  `;
}
