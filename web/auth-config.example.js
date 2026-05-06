// Copia este archivo como web/auth-config.js en producción si quieres activar UX de login en el frontend.
// La seguridad real la aplica el Worker; esto solo mejora la experiencia de usuario.
window.BMR_AUTH = {
  enabled: true,
  // Déjalo vacío si la web se sirve bajo el mismo dominio del Worker.
  authBase: '',
  loginPath: '/auth/login',
  logoutPath: '/auth/logout',
  mePath: '/api/me',
  // Cuando enabled=true, dataClient pedirá /data/... con cookies de sesión.
  protectedData: true
};
