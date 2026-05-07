import { renderLayout, loadingView, errorView } from './components/Layout.js';
import { HomePage } from './pages/HomePage.js';
import { MarketSentimentPage } from './pages/MarketSentimentPage.js';
import { MacroDataPage } from './pages/MacroDataPage.js';
import { AnalysisPage } from './pages/AnalysisPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { authConfig, loadSession } from './api/authClient.js';

const routes = {
  '/': HomePage,
  '/sentimiento': MarketSentimentPage,
  '/macro': MacroDataPage,
  '/analisis': AnalysisPage,
  '/auth': AuthPage
};

export async function renderRoute() {
  const app = document.getElementById('app');
  const route = normalizeRoute(location.hash.replace(/^#/, '') || '/');
  app.innerHTML = await renderLayout(route, loadingView());
  const handler = routes[route] || routes['/'];
  try {
    const cfg = authConfig();
    if (cfg.authRequired && route !== '/auth') {
      const session = await loadSession();
      if (!session.authenticated) {
        const content = await AuthPage();
        app.innerHTML = await renderLayout('/auth', content);
        return;
      }
    }
    const content = await handler();
    app.innerHTML = await renderLayout(route, content);
  } catch (error) {
    console.error(error);
    app.innerHTML = await renderLayout(route, errorView(error));
  }
}

function normalizeRoute(route) {
  if (!route.startsWith('/')) return `/${route}`;
  return route.replace(/\/$/, '') || '/';
}
