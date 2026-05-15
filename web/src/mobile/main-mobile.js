import { renderMobileRoute } from './router-mobile.js';

function enableMobileMode() {
  document.documentElement.classList.add('mobile-vertical');
  document.body.classList.add('mobile-vertical');
  document.getElementById('app')?.classList.add('mobile-app-shell');
}

enableMobileMode();
window.addEventListener('hashchange', renderMobileRoute);
window.addEventListener('DOMContentLoaded', () => {
  enableMobileMode();
  renderMobileRoute();
});
