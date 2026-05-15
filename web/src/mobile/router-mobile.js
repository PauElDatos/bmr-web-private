import { renderLayout, loadingView, errorView } from '../components/Layout.js';
import { HomePage } from './pages/HomePage.js';
import { MarketSentimentPage } from './pages/MarketSentimentPage.js';
import { MacroDataPage } from './pages/MacroDataPage.js';
import { AnalysisPage } from './pages/AnalysisPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { StatusPage } from './pages/StatusPage.js';
import { authConfig, loadSession } from '../api/authClient.js';

const mobileRoutes = {
  '/': HomePage,
  '/sentimiento': MarketSentimentPage,
  '/macro': MacroDataPage,
  '/analisis': AnalysisPage,
  '/auth': AuthPage,
  '/status': StatusPage
};

export async function renderMobileRoute() {
  const app = document.getElementById('app');
  const route = normalizeRoute(location.hash.replace(/^#/, '') || '/');
  document.documentElement.classList.add('mobile-vertical');
  document.body.classList.add('mobile-vertical');
  app?.classList.add('mobile-app-shell');
  app.innerHTML = await renderLayout(route, loadingView());
  const handler = mobileRoutes[route] || mobileRoutes['/'];
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
