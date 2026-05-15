// Versión móvil duplicada de src/pages/AuthPage.js.
// Mantiene la lógica original y carga estilos verticales desde mobile.html.

import { loginUrl } from '../../api/authClient.js';

export async function AuthPage() {
  return `
    <section class="auth-shell">
      <div class="auth-panel">
        <p class="eyebrow">Acceso privado</p>
        <h1>BMR Market Intelligence</h1>
        <p>Esta instalación está configurada para verificar el acceso con Patreon antes de entregar los JSON reales de mercado, macro y análisis.</p>
        <a class="primary-button" href="${loginUrl()}">Entrar con Patreon</a>
        <p class="muted-note">La validación de tier ocurre en el Worker. El navegador no recibe el client secret ni puede autorizarse por sí solo.</p>
      </div>
    </section>
  `;
}
